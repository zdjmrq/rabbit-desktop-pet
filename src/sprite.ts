type PetAction = 'idle' | 'walk' | 'hop' | 'groom' | 'stretch' | 'look' | 'sleep' | 'eat' | 'spin' | 'pet' | 'carry'
type Row = { row: number; frames: number; timings: number[]; loop: boolean; sequence?: number[] }
const CELL_WIDTH = 192
const CELL_HEIGHT = 208
const STAGE_HEIGHT = 300
const STAGE_WIDTH = 280
const DISPLAY_WIDTH = 240
const DISPLAY_HEIGHT = 260
const GROUND_OFFSET: Record<PetAction, number> = {
  idle: 40, walk: 40, hop: 40, groom: 27, stretch: 40,
  look: 30, sleep: 60, eat: 50, spin: 30, pet: 30, carry: 0,
}
const standardRows: Record<string, Row> = {
  idle: { row: 0, frames: 6, timings: [2500, 90, 90, 120, 120, 2200], loop: true },
  walk: { row: 1, frames: 8, timings: [110, 110, 110, 110, 110, 110, 110, 110], loop: true },
  hop: { row: 4, frames: 5, timings: [140, 120, 140, 140, 240], loop: false },
}
const extraRows: Record<string, Row> = {
  // Raise paws once, maintain face washing, then lower paws once. Never replay the full entrance.
  groom: { row: 0, frames: 6,
    sequence: [0, 1, ...Array.from({ length: 14 }, (_, i) => 2 + i % 2), 4, 5],
    timings: [140, 140, ...Array(14).fill(185), 140, 180], loop: false },
  stretch: { row: 1, frames: 6, timings: [160, 180, 350, 350, 180, 220], loop: false },
  look: { row: 2, frames: 6, timings: [160, 160, 1900, 100, 160, 260], loop: false },
  sleep: { row: 3, frames: 6, timings: [320, 320, 320, 320, 320, 320], loop: true },
  eat: { row: 4, frames: 6, timings: [170, 170, 170, 170, 170, 170], loop: true },
  spin: { row: 5, frames: 6, timings: [100, 100, 110, 110, 100, 140], loop: false },
  pet: { row: 6, frames: 6, timings: [220, 220, 220, 220, 220, 220], loop: true },
  carry: { row: 7, frames: 6, timings: [240, 240, 240, 240, 240, 240], loop: true },
}
export function actionDurationMs(action: string): number {
  const row = standardRows[action] || extraRows[action]
  return row ? row.timings.reduce((sum, duration) => sum + duration, 0) : 0
}
export function maxPetLift(viewportHeight: number): number {
  return Math.max(0, viewportHeight - DISPLAY_HEIGHT - 12)
}
function pickFrame(row: Row, elapsedMs: number): { index: number; next: number; blend: number } {
  const total = row.timings.reduce((sum, duration) => sum + duration, 0)
  let cursor = row.loop ? Math.max(0, elapsedMs) % total : Math.min(Math.max(0, elapsedMs), total - 1)
  for (let index = 0; index < row.timings.length; index += 1) {
    const duration = row.timings[index]
    if (cursor < duration) {
      const next = index + 1 < row.timings.length ? index + 1 : row.loop ? 0 : index
      const window = Math.min(65, duration * 0.65)
      const t = next === index ? 0 : Math.max(0, (cursor - duration + window) / window)
      return { index: row.sequence?.[index] ?? index, next: row.sequence?.[next] ?? next, blend: t * t * (3 - 2 * t) }
    }
    cursor -= duration
  }
  return { index: row.frames - 1, next: row.frames - 1, blend: 0 }
}

export class SpritePet {
  private readonly context: CanvasRenderingContext2D
  private readonly standard = new Image()
  private readonly extra = new Image()
  private standardReady = false
  private extraReady = false
  // Isolate source cells: filtering at the edge must never sample a neighbouring leg.
  private readonly cells = new Map<string, HTMLCanvasElement>()
  private readonly mix = document.createElement('canvas')
  private readonly mixContext: CanvasRenderingContext2D
  private dpr = 1
  private lastAction: PetAction = 'idle'
  private offset = GROUND_OFFSET.idle
  private lastTime = performance.now()
  private rasterKey = ''
  private rasterCount = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('2D sprite canvas unavailable')
    this.context = context
    this.mix.width = CELL_WIDTH
    this.mix.height = CELL_HEIGHT
    this.mixContext = this.mix.getContext('2d')!
    this.standard.onload = () => { this.cache(this.standard, 'standard', standardRows); this.standardReady = true; this.canvas.dataset.spriteReady = 'true' }
    this.extra.onload = () => { this.cache(this.extra, 'extra', extraRows); this.extraReady = true; this.canvas.dataset.extraReady = 'true' }
    this.standard.src = 'assets/rabbit-atlas.webp'
    this.extra.src = 'assets/rabbit-extra.webp'
    this.resize()
  }

  private cache(image: HTMLImageElement, prefix: string, rows: Record<string, Row>): void {
    for (const row of Object.values(rows)) for (let i = 0; i < row.frames; i++) {
      const cell = document.createElement('canvas')
      cell.width = CELL_WIDTH
      cell.height = CELL_HEIGHT
      cell.getContext('2d')!.drawImage(image, i * CELL_WIDTH, row.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT)
      this.cells.set(`${prefix}:${row.row}:${i}`, cell)
    }
  }

  get ready(): boolean { return this.standardReady }

  resize(): void {
    this.rasterKey = ''
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(STAGE_WIDTH * this.dpr)
    this.canvas.height = Math.round(STAGE_HEIGHT * this.dpr)
    Object.assign(this.canvas.style, { width: `${STAGE_WIDTH}px`, height: `${STAGE_HEIGHT}px`, top: 'auto', right: 'auto', bottom: '0', left: '0', willChange: 'transform' })
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.context.imageSmoothingEnabled = true
    this.context.imageSmoothingQuality = 'high'
  }

  render(action: PetAction, direction: number, x: number, y: number, floorY: number, elapsedMs: number, quiet: boolean): void {
    if (!this.standardReady) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastTime) / 1000)
    this.lastTime = now
    const ctx = this.context
    const lift = Math.min(maxPetLift(innerHeight), Math.max(0, y - floorY))
    if (this.canvas.dataset.lift !== String(lift)) this.canvas.dataset.lift = String(lift)
    const row = standardRows[action] || (this.extraReady ? extraRows[action] : null) || standardRows.idle
    const prefix = standardRows[action] || !this.extraReady ? 'standard' : 'extra'
    const quietRest = quiet && (action === 'idle' || action === 'sleep')
    const frame = quietRest ? { index: 0, next: 0, blend: 0 } : pickFrame(row, elapsedMs)
    if (this.canvas.dataset.frameIndex !== String(frame.index)) this.canvas.dataset.frameIndex = String(frame.index)
    // Both directions use the same gait in the same temporal order.
    const flip = direction < 0
    if (this.canvas.dataset.direction !== String(direction)) this.canvas.dataset.direction = String(direction)
    if (this.canvas.dataset.sourceRow !== String(row.row)) this.canvas.dataset.sourceRow = String(row.row)
    if (action === 'carry' || this.lastAction === 'carry') this.offset = GROUND_OFFSET[action]
    else this.offset += (GROUND_OFFSET[action] - this.offset) * (1 - Math.exp(-dt * 9))
    this.lastAction = action
    const breath = action === 'idle' || action === 'sleep' ? Math.sin(now * (quietRest ? 0.0008 : 0.0014)) * (quietRest ? 0.08 : 0.65) : 0
    // Move/breathe in the compositor; identical poses need no canvas repaint.
    if (Math.abs(this.offset - GROUND_OFFSET[action]) < 0.01) this.offset = GROUND_OFFSET[action]
    const transform = `translate3d(${x - STAGE_WIDTH / 2}px, ${-lift + this.offset + breath}px, 0)`
    if (this.canvas.style.transform !== transform) this.canvas.style.transform = transform
    const key = `${prefix}:${row.row}:${frame.index}:${frame.next}:${frame.blend}:${flip}`
    if (key === this.rasterKey) return
    this.rasterKey = key
    this.canvas.dataset.rasterCount = String(++this.rasterCount)
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    const top = STAGE_HEIGHT - DISPLAY_HEIGHT
    const a = this.cells.get(`${prefix}:${row.row}:${frame.index}`)!
    const b = this.cells.get(`${prefix}:${row.row}:${frame.next}`)!
    let source: HTMLCanvasElement = a
    if (frame.blend > 0) {
      const mix = this.mixContext
      mix.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
      // Premultiplied weights preserve opacity while interpolating the two source poses.
      mix.globalCompositeOperation = 'source-over'
      mix.globalAlpha = 1 - frame.blend
      mix.drawImage(a, 0, 0)
      mix.globalCompositeOperation = 'lighter'
      mix.globalAlpha = frame.blend
      mix.drawImage(b, 0, 0)
      mix.globalAlpha = 1
      mix.globalCompositeOperation = 'source-over'
      source = this.mix
    }
    ctx.save()
    ctx.translate(STAGE_WIDTH / 2, top + DISPLAY_HEIGHT)
    ctx.scale(flip ? -1 : 1, 1)
    ctx.drawImage(source, -DISPLAY_WIDTH / 2, -DISPLAY_HEIGHT, DISPLAY_WIDTH, DISPLAY_HEIGHT)
    ctx.restore()
  }
}
