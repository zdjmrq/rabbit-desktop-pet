const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, screen, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const smokeTest = process.argv.includes('--smoke-test')
const captureTest = process.argv.includes('--capture-test')
const interactionTest = process.argv.includes('--interaction-test')
const isMac = process.platform === 'darwin'
let mainWindow = null
let tray = null
let quitting = false
let interactiveRegions = []
let pointerCaptured = false
let ignoringMouse = false
let hitTestTimer = null
let petInteractionEnabled = true

// Keep development checks independent of the pet already running on the desktop.
if (smokeTest) app.setPath('userData', path.join(app.getPath('temp'), 'rabbit-pet-smoke-profile'))
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
  const image = nativeImage.createFromPath(path.join(__dirname, 'assets', 'rabbit-idle-nohat.png')).resize({ width: traySize, height: traySize })
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
    show: !smokeTest || captureTest,
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
      backgroundThrottling: false,
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
      spriteReady: document.querySelector('#dsh-rabbit-pet-stage canvas[data-sprite-ready]')?.dataset.spriteReady === 'true',
      extraReady: document.querySelector('#dsh-rabbit-pet-stage canvas[data-extra-ready]')?.dataset.extraReady === 'true',
      rabbitHit: Boolean(document.getElementById('dsh-rabbit-pet-hit')),
      errors: document.getElementById('startup-error')?.textContent || ''
    })`)
    console.log(`SMOKE_RESULT ${JSON.stringify(result)}`)
    if (captureTest) {
      const region = await mainWindow.webContents.executeJavaScript(`(() => {
        const rect = document.getElementById('dsh-rabbit-pet-hit').getBoundingClientRect()
        return { x: Math.max(0, Math.floor(rect.x - 20)), y: Math.max(0, Math.floor(rect.y - 20)), width: Math.ceil(rect.width + 40), height: Math.ceil(rect.height + 40) }
      })()`)
      const png = (await mainWindow.webContents.capturePage(region)).toPNG()
      const output = path.join(__dirname, 'art', 'qa', 'runtime.png')
      fs.mkdirSync(path.dirname(output), { recursive: true })
      fs.writeFileSync(output, png)
      console.log(`CAPTURE_RESULT ${output}`)
    }
    if (interactionTest) {
      const interaction = await mainWindow.webContents.executeJavaScript(`(() => {
        const root = document.getElementById('dsh-rabbit-pet-stage')
        const hit = document.getElementById('dsh-rabbit-pet-hit')
        const menu = document.getElementById('dsh-rabbit-pet-menu')
        const open = () => hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        open()
        const menuOpened = menu.classList.contains('open')
        menu.querySelector('[data-action="sleep"]').click()
        const sleep = root.dataset.action
        open()
        menu.querySelector('[data-action="wake"]').click()
        const wake = root.dataset.action
        const initialQuiet = root.dataset.quiet
        open()
        menu.querySelector('[data-action="quiet"]').click()
        const quietOn = root.dataset.quiet
        const quietSaved = JSON.parse(localStorage.getItem('dsh-rabbit-pet:v1')).quiet
        open()
        menu.querySelector('[data-action="quiet"]').click()
        const quietOff = root.dataset.quiet
        const quietToggled = quietOn !== initialQuiet && quietSaved === (quietOn === 'true') && quietOff === initialQuiet
        const hatRemoved = !menu.querySelector('[data-action="hat"]')
        open()
        menu.querySelector('[data-action="feed"]').click()
        const carrot = document.getElementById('dsh-rabbit-pet-carrot').classList.contains('show')
        return { menuOpened, sleep, wake, quietToggled, hatRemoved, carrot }
      })()`)
      console.log(`INTERACTION_RESULT ${JSON.stringify(interaction)}`)
    }
    if (captureTest && interactionTest) {
      try {
        await require('./scripts/runtime-check.cjs')(mainWindow)
      } catch (error) {
        console.error(error)
        app.exit(1)
        return
      }
    }
    if (!result.spriteReady || !result.extraReady || result.errors) { app.exit(1); return }
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
