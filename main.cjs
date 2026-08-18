const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, screen, shell } = require('electron')
const path = require('node:path')

const smokeTest = process.argv.includes('--smoke-test')
const isMac = process.platform === 'darwin'
let mainWindow = null
let tray = null
let quitting = false
let interactiveRegions = []
let pointerCaptured = false
let ignoringMouse = false
let hitTestTimer = null
let petInteractionEnabled = true

if (!app.requestSingleInstanceLock()) app.quit()

function syncWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea
  mainWindow.setBounds({ x, y, width, height }, false)
}

function showPet() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  syncWindowBounds()
  mainWindow.showInactive()
}

function togglePet() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isVisible()) mainWindow.hide()
  else showPet()
}

function updateMouseHitTest() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return
  const cursor = screen.getCursorScreenPoint()
  const bounds = mainWindow.getBounds()
  const localX = cursor.x - bounds.x
  const localY = cursor.y - bounds.y
  const overInteractiveRegion = interactiveRegions.some((region) => (
    localX >= region.x
    && localX <= region.x + region.width
    && localY >= region.y
    && localY <= region.y + region.height
  ))
  const shouldIgnore = !petInteractionEnabled || (!pointerCaptured && !overInteractiveRegion)
  if (shouldIgnore === ignoringMouse) return
  ignoringMouse = shouldIgnore
  if (isMac) mainWindow.setIgnoreMouseEvents(shouldIgnore)
  else mainWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true })
}

function createTray() {
  const traySize = isMac ? 20 : 32
  const image = nativeImage.createFromPath(path.join(__dirname, 'assets', 'rabbit-idle.png')).resize({ width: traySize, height: traySize })
  tray = new Tray(image)
  tray.setToolTip('写实小兔子桌宠')
  const refreshMenu = () => {
    const autoStart = app.getLoginItemSettings().openAtLogin
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示小兔子', click: showPet },
      { label: '隐藏小兔子', click: () => mainWindow?.hide() },
      { label: `快速隐藏/显示（${isMac ? '⌘+⌥+R' : 'Ctrl+Alt+R'}）`, click: togglePet },
      {
        label: '允许鼠标与小兔子互动',
        type: 'checkbox',
        checked: petInteractionEnabled,
        click: (item) => {
          petInteractionEnabled = item.checked
          if (!petInteractionEnabled) pointerCaptured = false
          updateMouseHitTest()
          refreshMenu()
        },
      },
      { label: '重新加载', click: () => mainWindow?.reload() },
      {
        label: '开机自动启动',
        type: 'checkbox',
        checked: autoStart,
        click: (item) => {
          app.setLoginItemSettings(isMac
            ? { openAtLogin: item.checked }
            : { openAtLogin: item.checked, path: process.execPath })
          refreshMenu()
        },
      },
      { type: 'separator' },
      { label: '项目主页', click: () => shell.openExternal('https://github.com/zdjmrq/rabbit-desktop-pet') },
      { label: '退出桌宠', click: () => { quitting = true; app.quit() } },
    ]))
  }
  refreshMenu()
  tray.on('double-click', togglePet)
}

function createWindow() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea
  mainWindow = new BrowserWindow({
    x, y, width, height,
    show: !smokeTest,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setIgnoreMouseEvents(false)
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.on('close', (event) => {
    if (quitting || smokeTest) return
    event.preventDefault()
    mainWindow.hide()
  })
  mainWindow.webContents.on('did-finish-load', async () => {
    if (!smokeTest) return
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const result = await mainWindow.webContents.executeJavaScript(`({
      stage: Boolean(document.getElementById('dsh-rabbit-pet-stage')),
      canvas: Boolean(document.querySelector('#dsh-rabbit-pet-stage canvas')),
      rabbitHit: Boolean(document.getElementById('dsh-rabbit-pet-hit')),
      errors: document.getElementById('startup-error')?.textContent || ''
    })`)
    console.log(`SMOKE_RESULT ${JSON.stringify(result)}`)
    quitting = true
    app.quit()
  })
}

ipcMain.on('desktop-pet:set-interactive-regions', (_event, regions, capture) => {
  interactiveRegions = Array.isArray(regions)
    ? regions.filter((region) => region
      && Number.isFinite(region.x)
      && Number.isFinite(region.y)
      && Number.isFinite(region.width)
      && Number.isFinite(region.height))
    : []
  pointerCaptured = Boolean(capture)
  updateMouseHitTest()
})
ipcMain.on('desktop-pet:quit', () => { quitting = true; app.quit() })

app.whenReady().then(() => {
  if (isMac) app.dock?.hide()
  createWindow()
  if (!smokeTest) {
    createTray()
    globalShortcut.register('CommandOrControl+Alt+R', togglePet)
    hitTestTimer = setInterval(updateMouseHitTest, 16)
  }
  screen.on('display-metrics-changed', syncWindowBounds)
})

app.on('second-instance', showPet)
app.on('will-quit', () => {
  if (hitTestTimer) clearInterval(hitTestTimer)
  globalShortcut.unregisterAll()
})
app.on('window-all-closed', (event) => event.preventDefault?.())
