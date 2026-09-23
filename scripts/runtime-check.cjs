const fs = require('node:fs')
const path = require('node:path')
module.exports = async function check(win) {
  const result = await win.webContents.executeJavaScript(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    const root = document.getElementById('dsh-rabbit-pet-stage')
    const hit = document.getElementById('dsh-rabbit-pet-hit')
    const sprite = document.querySelector('canvas[data-sprite-ready]')
    const menu = document.getElementById('dsh-rabbit-pet-menu')
    const originalSaved = localStorage.getItem('dsh-rabbit-pet:v1')
    const click = name => menu.querySelector('[data-action="' + name + '"]').click()
    const pointer = (target, type, x, y, button = 2) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button, buttons: type === 'pointerup' ? 0 : button === 2 ? 2 : 1, pointerId: 99 }))
    click('sleep')
    const rect = hit.getBoundingClientRect()
    pointer(hit, 'pointerdown', rect.x + rect.width / 2, rect.y + 100)
    await wait(500)
    pointer(document, 'pointermove', innerWidth / 2, -5000)
    await wait(80)
    const lift = Number(sprite.dataset.lift)
    const top = hit.getBoundingClientRect().top
    const held = root.dataset.action === 'carry'
    pointer(document, 'pointermove', innerWidth / 2, -10000)
    await wait(80)
    const clamped = held && lift === Number(sprite.dataset.lift) && top >= 11
    const ctx = sprite.getContext('2d')
    const pixels = ctx.getImageData(0, 0, sprite.width, sprite.height).data
    let minY = sprite.height, maxY = -1
    for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) {
      if (pixels[(y * sprite.width + x) * 4 + 3] > 8) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    }
    const bounds = sprite.getBoundingClientRect()
    const bodyVisible = maxY >= minY && bounds.y + minY * bounds.height / sprite.height >= 0 && bounds.y + maxY * bounds.height / sprite.height <= innerHeight
    window.__carryCapture = { x: Math.max(0, Math.floor(bounds.x)), y: 0, width: 280, height: 300 }
    // Save actual canvas at the upper boundary for visual inspection.
    window.__carryPng = sprite.toDataURL('image/png')
    pointer(document, 'pointerup', innerWidth / 2, 0)
    await wait(180)
    const intermediateLift = Number(sprite.dataset.lift)
    await wait(600)
    const finalLift = Number(sprite.dataset.lift)
    const smoothLanding = intermediateLift > 0 && intermediateLift < lift && Number(sprite.dataset.lift) === 0
    click('hop')
    await wait(350)
    const hopNotCutShort = root.dataset.action === 'hop'
    await wait(550)
    const hopFinished = root.dataset.action === 'idle'
    const facingBefore = Number(sprite.dataset.direction)
    click('spin')
    await wait(750)
    const turnNatural = root.dataset.action === 'idle' && Number(sprite.dataset.direction) === -facingBefore
    click('groom')
    await wait(850)
    const groomingCoreStarted = ['2', '3'].includes(sprite.dataset.frameIndex)
    await wait(1750)
    const groomingContinues = root.dataset.action === 'groom' && ['2', '3'].includes(sprite.dataset.frameIndex)
    await wait(750)
    const groomingFinished = root.dataset.action === 'idle'
    click('feed')
    const carrot = document.getElementById('dsh-rabbit-pet-carrot-hit')
    const directions = []
    for (const x of [40, innerWidth - 40]) {
      const cr = carrot.getBoundingClientRect()
      pointer(carrot, 'pointerdown', cr.x + 30, cr.y + 30, 0)
      await wait(360)
      pointer(document, 'pointermove', x, innerHeight - 50, 0)
      pointer(document, 'pointerup', x, innerHeight - 50, 0)
      await wait(250)
      directions.push({ direction: sprite.dataset.direction, row: sprite.dataset.sourceRow, action: root.dataset.action })
    }
    const sameGait = directions[0].direction === '-1' && directions[1].direction === '1' && directions.every(d => d.row === '1' && d.action === 'walk')
    const timings = []
    await new Promise(resolve => {
      let start, previous
      function frame(t) {
        if (previous !== undefined) timings.push(t - previous)
        if (start === undefined) start = t
        previous = t
        if (t - start >= 2200) resolve(); else requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    timings.sort((a,b) => a-b)
    const medianMs = timings[Math.floor(timings.length / 2)]
    const p95Ms = timings[Math.floor(timings.length * .95)]
    if (root.dataset.quiet !== 'true') click('quiet')
    click('sleep')
    await wait(900)
    const sleepFrameBefore = sprite.dataset.frameIndex
    const sleepTransformBefore = sprite.getBoundingClientRect().top
    const rasterBefore = Number(sprite.dataset.rasterCount)
    await wait(1200)
    const idleRedraws = Number(sprite.dataset.rasterCount) - rasterBefore
    const idleCacheWorks = idleRedraws <= 1
    const quietSleepStill = root.dataset.action === 'sleep' && sprite.dataset.frameIndex === sleepFrameBefore && Math.abs(sprite.getBoundingClientRect().top - sleepTransformBefore) < 0.2
    if (originalSaved === null) localStorage.removeItem('dsh-rabbit-pet:v1'); else localStorage.setItem('dsh-rabbit-pet:v1', originalSaved)
    return { clamped, bodyVisible, lift, intermediateLift, finalLift, smoothLanding, hopNotCutShort, hopFinished, turnNatural, groomingCoreStarted, groomingContinues, groomingFinished, sameGait, idleRedraws, idleCacheWorks, quietSleepStill, directions, canvas: [sprite.width, sprite.height], medianMs, p95Ms, measuredFps: Math.round(1000 / medianMs), errors: document.getElementById('startup-error').textContent }
  })()`)
  const png = await win.webContents.executeJavaScript('window.__carryPng')
  const output = path.join(__dirname, '..', 'art', 'qa')
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(path.join(output, 'carry-boundary.png'), Buffer.from(png.split(',')[1], 'base64'))
  fs.writeFileSync(path.join(output, 'runtime-check.json'), JSON.stringify(result, null, 2))
  console.log('RUNTIME_CHECK ' + JSON.stringify(result))
  for (const key of ['clamped', 'bodyVisible', 'smoothLanding', 'hopNotCutShort', 'hopFinished', 'turnNatural', 'groomingCoreStarted', 'groomingContinues', 'groomingFinished', 'sameGait', 'idleCacheWorks', 'quietSleepStill']) {
    if (!result[key]) throw new Error('Runtime regression: ' + key)
  }
  if (result.errors) throw new Error(result.errors)
}
