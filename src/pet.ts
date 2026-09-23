import { SpritePet, actionDurationMs, maxPetLift } from './sprite'
import rabbitIdle from '../assets/rabbit-idle-nohat.png'
import rabbitSleep from '../assets/rabbit-sleep-nohat.png'
import rabbitEat from '../assets/rabbit-eat-nohat.png'
import carrotRealistic from '../assets/carrot-realistic.png'
import handPetSideCute from '../assets/hand-pet-side-cute.png'
import handCarryCute from '../assets/hand-carry-cute.png'

interface ClientContext {
  effect(setup: () => void | (() => void), label?: string): void
}

type Action = 'idle' | 'walk' | 'hop' | 'groom' | 'stretch' | 'look' | 'sleep' | 'eat' | 'spin' | 'pet' | 'carry'

const PLUGIN_ID = 'dsh-rabbit-pet'
const STORAGE_KEY = 'dsh-rabbit-pet:v1'
const STAGE_HEIGHT = 300
const FLOOR_Y = 34
const PHOTO_WIDTH = 250
const PHOTO_HEIGHT = 260

const STYLE = `
  #dsh-rabbit-pet-stage{position:fixed;left:0;right:0;bottom:0;height:${STAGE_HEIGHT}px;z-index:2147482000;pointer-events:none;overflow:visible}
  #dsh-rabbit-pet-stage canvas{position:absolute;inset:0;z-index:2;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 10px 8px rgba(38,24,13,.12))}
  #dsh-rabbit-pet-photo{position:fixed;z-index:1;width:${PHOTO_WIDTH}px;height:${PHOTO_HEIGHT}px;pointer-events:none;transform-origin:50% 88%;will-change:left,bottom,transform;filter:drop-shadow(0 13px 9px rgba(38,24,13,.2))}
  #dsh-rabbit-pet-photo-inner{position:absolute;inset:0;transform-origin:50% 88%;will-change:transform}
  #dsh-rabbit-pet-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;opacity:0;transition:opacity .18s ease;user-select:none;-webkit-user-drag:none}
  #dsh-rabbit-pet-photo img.active{opacity:1}
  #dsh-rabbit-pet-carrot{position:fixed;z-index:3;display:none;width:64px;height:112px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 7px 4px rgba(72,42,16,.25));transform-origin:50% 88%;will-change:left,bottom,transform;user-select:none;-webkit-user-drag:none}
  #dsh-rabbit-pet-carrot.show{display:block;animation:dsh-carrot-grow .34s cubic-bezier(.18,.9,.3,1.3)}
  #dsh-rabbit-pet-carrot.dragging{transform:rotate(8deg) scale(1.06);filter:drop-shadow(0 13px 7px rgba(72,42,16,.28))}
  #dsh-rabbit-pet-carrot-hit{position:fixed;z-index:4;display:none;width:76px;height:118px;pointer-events:auto;cursor:grab;touch-action:none;border-radius:45%;user-select:none}
  #dsh-rabbit-pet-carrot-hit.show{display:block}
  #dsh-rabbit-pet-carrot-hit.dragging{cursor:grabbing}
  #dsh-rabbit-pet-hit{position:fixed;z-index:3;width:${PHOTO_WIDTH}px;height:${PHOTO_HEIGHT}px;bottom:0;pointer-events:auto;cursor:pointer;touch-action:none;border-radius:48% 52% 34% 38%;outline:none;-webkit-user-select:none;user-select:none}
  #dsh-rabbit-pet-hit:focus-visible{outline:2px solid rgba(113,150,255,.8);outline-offset:3px}
  #dsh-rabbit-pet-menu{position:fixed;z-index:4;display:none;min-width:174px;padding:8px;background:rgba(255,252,247,.96);color:#342b24;border:1px solid rgba(85,65,49,.14);border-radius:16px;box-shadow:0 16px 48px rgba(34,24,16,.2);backdrop-filter:blur(18px);pointer-events:auto;font:13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;transform-origin:bottom left}
  #dsh-rabbit-pet-menu.open{display:grid;grid-template-columns:1fr 1fr;gap:5px;animation:dsh-rabbit-pop .16s ease-out}
  #dsh-rabbit-pet-menu button{border:0;border-radius:10px;background:transparent;color:inherit;padding:9px 10px;text-align:left;cursor:pointer;font:inherit;white-space:nowrap}
  #dsh-rabbit-pet-menu button:hover,#dsh-rabbit-pet-menu button:focus-visible{background:rgba(119,91,67,.1);outline:none}
  #dsh-rabbit-pet-menu .wide{grid-column:1/-1}
  #dsh-rabbit-pet-hand{position:fixed;display:none;z-index:5;object-fit:contain;line-height:1;filter:drop-shadow(0 6px 5px rgba(45,31,21,.2));pointer-events:none;will-change:left,top,transform;user-select:none;-webkit-user-drag:none}
  #dsh-rabbit-pet-hand.pet{display:block;width:104px;height:48px;transform:translate(-91%,-50%) rotate(-4deg);animation:dsh-rabbit-rua .48s ease-in-out infinite alternate}
  #dsh-rabbit-pet-hand.carry{display:block;width:122px;height:176px;transform:translate(-50%,-18%) rotate(2deg)}
  #dsh-rabbit-pet-toast{position:fixed;display:none;padding:6px 10px;border-radius:999px;background:rgba(50,40,32,.78);color:white;font:12px/1.2 system-ui;pointer-events:none;white-space:nowrap;transform:translate(-50%,-100%);animation:dsh-rabbit-pop .18s ease-out}
  #dsh-rabbit-pet-toast.show{display:block}
  .dsh-rabbit-heart{position:fixed;z-index:3;pointer-events:none;font-size:15px;animation:dsh-rabbit-heart .9s ease-out forwards}
  @keyframes dsh-rabbit-pop{from{opacity:0;transform:translateY(5px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes dsh-rabbit-rua{to{transform:translate(-86%,-50%) rotate(4deg) translateX(5px)}}
  @keyframes dsh-carrot-grow{from{opacity:0;transform:scale(.15) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes dsh-rabbit-heart{0%{opacity:0;transform:translate(-50%,0) scale(.7)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-54px) scale(1.25) rotate(12deg)}}
  @media(prefers-reduced-motion:reduce){#dsh-rabbit-pet-menu,.dsh-rabbit-heart,#dsh-rabbit-pet-hand{animation-duration:.001ms!important;animation-iteration-count:1!important}}
`

interface SavedState {
  xRatio: number
  quiet?: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

class RabbitPet {
  private readonly root = document.createElement('div')
  private readonly canvas = document.createElement('canvas')
  private readonly spriteCanvas = document.createElement('canvas')
  private readonly sprite: SpritePet
  private readonly photo = document.createElement('div')
  private readonly photoInner = document.createElement('div')
  private readonly poseImages: Record<'idle' | 'sleep' | 'eat', HTMLImageElement>
  private readonly carrotPhoto = document.createElement('img')
  private readonly carrotHit = document.createElement('div')
  private readonly hit = document.createElement('div')
  private readonly menu = document.createElement('div')
  private readonly hand = document.createElement('img')
  private readonly toast = document.createElement('div')
  private readonly style = document.createElement('style')
  private carrot = false
  private carryOffsetX = 0
  private carryOffsetY = 0
  private landingHeight = 0
  private landingStart = 0
  private speed = 0
  private carrotX = 0
  private carrotY = 7
  private carrotDown = false
  private carrotDragging = false
  private carrotDragTimer = 0
  private carrotWatchTimer = 0
  private x = innerWidth * 0.24
  private y = FLOOR_Y
  private targetX = this.x
  private direction = 1
  private action: Action = 'idle'
  private actionStart = performance.now()
  private actionDuration = 0
  private nextBehavior = performance.now() + 35000
  private frame = 0
  private lastFrame = performance.now()
  private fpsSampleStart = performance.now()
  private fpsFrames = 0
  private resizeObserver: ResizeObserver | null = null
  private interactionPointerId: number | null = null
  private leftDown = false
  private rightDown = false
  private petTimer = 0
  private carryTimer = 0
  private rightPressAt = 0
  private heartAt = 0
  private menuOpen = false
  private quiet = false
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private destroyed = false

  constructor() {
    this.root.id = 'dsh-rabbit-pet-stage'
    this.root.dataset.action = this.action
    this.canvas.setAttribute('aria-hidden', 'true')
    this.photo.id = 'dsh-rabbit-pet-photo'
    this.photoInner.id = 'dsh-rabbit-pet-photo-inner'
    const createPose = (name: 'idle' | 'sleep' | 'eat', src: string): HTMLImageElement => {
      const image = new Image()
      image.src = src
      image.alt = ''
      image.dataset.pose = name
      image.draggable = false
      this.photoInner.appendChild(image)
      return image
    }
    this.poseImages = {
      idle: createPose('idle', rabbitIdle),
      sleep: createPose('sleep', rabbitSleep),
      eat: createPose('eat', rabbitEat),
    }
    this.poseImages.idle.classList.add('active')
    this.photo.appendChild(this.photoInner)
    this.photo.style.display = 'none'
    this.carrotPhoto.id = 'dsh-rabbit-pet-carrot'
    this.carrotPhoto.src = carrotRealistic
    this.carrotPhoto.alt = ''
    this.carrotPhoto.draggable = false
    this.carrotHit.id = 'dsh-rabbit-pet-carrot-hit'
    this.carrotHit.setAttribute('aria-label', '胡萝卜。左键长按可以移动，兔子会追过来吃。')
    this.hit.id = 'dsh-rabbit-pet-hit'
    this.hit.tabIndex = 0
    this.hit.setAttribute('role', 'button')
    this.hit.setAttribute('aria-label', '写实小兔子宠物。右键短按打开菜单，右键长按拎起，左键长按抚摸。')
    this.menu.id = 'dsh-rabbit-pet-menu'
    this.menu.setAttribute('role', 'menu')
    this.menu.innerHTML = [
      '<button data-action="feed">🥕 喂胡萝卜</button>',
      '<button data-action="sleep">💤 睡一会</button>',
      '<button data-action="hop">✨ 跳一跳</button>',
      '<button data-action="spin">↔️ 转个身</button>',
      '<button data-action="groom">🐾 梳理毛毛</button>',
      '<button data-action="look">👀 看看你</button>',
      '<button data-action="quiet" class="wide">🌙 开启安静模式</button>',
      '<button data-action="wake" class="wide">☀️ 醒醒，继续散步</button>',
    ].join('')
    this.hand.id = 'dsh-rabbit-pet-hand'
    this.hand.src = handPetSideCute
    this.hand.alt = ''
    this.hand.draggable = false
    this.toast.id = 'dsh-rabbit-pet-toast'
    this.style.dataset.plugin = PLUGIN_ID
    this.style.textContent = STYLE
    document.head.appendChild(this.style)
    this.root.append(this.canvas, this.spriteCanvas, this.photo, this.carrotPhoto, this.carrotHit, this.hit, this.menu, this.hand, this.toast)
    document.body.appendChild(this.root)
    this.sprite = new SpritePet(this.spriteCanvas)
    this.spriteCanvas.style.display = 'none'
    this.spriteCanvas.style.filter = 'none'

    this.loadState()
    this.root.dataset.quiet = String(this.quiet)
    this.updateQuietMenu()
    this.bind()
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
    if (!this.quiet) this.say('右键可以和我互动哦', 2400)
  }

  dispose(): void {
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    clearTimeout(this.petTimer)
    clearTimeout(this.carryTimer)
    clearTimeout(this.carrotDragTimer)
    clearInterval(this.carrotWatchTimer)
    this.resizeObserver?.disconnect()
    this.unbind()
    this.root.remove()
    this.style.remove()
  }

  private bind(): void {
    this.hit.addEventListener('pointerdown', this.onPointerDown)
    this.hit.addEventListener('contextmenu', this.onContextMenu)
    this.hit.addEventListener('keydown', this.onKeyDown)
    this.menu.addEventListener('click', this.onMenuClick)
    this.carrotHit.addEventListener('pointerdown', this.onCarrotPointerDown)
    document.addEventListener('pointermove', this.onPointerMove, { passive: false })
    document.addEventListener('pointerup', this.onPointerUp)
    document.addEventListener('pointercancel', this.onPointerUp)
    document.addEventListener('pointerdown', this.onDocumentPointerDown)
    window.addEventListener('resize', this.resize)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(document.documentElement)
  }

  private unbind(): void {
    this.hit.removeEventListener('pointerdown', this.onPointerDown)
    this.hit.removeEventListener('contextmenu', this.onContextMenu)
    this.hit.removeEventListener('keydown', this.onKeyDown)
    this.menu.removeEventListener('click', this.onMenuClick)
    this.carrotHit.removeEventListener('pointerdown', this.onCarrotPointerDown)
    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)
    document.removeEventListener('pointercancel', this.onPointerUp)
    document.removeEventListener('pointerdown', this.onDocumentPointerDown)
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  private readonly onVisibility = (): void => {
    this.lastFrame = performance.now()
    this.fpsSampleStart = this.lastFrame
    this.fpsFrames = 0
  }

  private readonly resize = (): void => {
    const width = Math.max(320, window.innerWidth)
    this.sprite.resize()
    this.x = clamp(this.x, 125, width - 125)
    this.targetX = clamp(this.targetX, 125, width - 125)
    this.y = clamp(this.y, FLOOR_Y, FLOOR_Y + maxPetLift(innerHeight))
    this.updateDomPositions()
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed) return
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000))
    this.lastFrame = now
    if (!document.hidden) {
      this.update(now, delta)
      if (this.sprite.ready) {
        this.canvas.style.display = 'none'
        this.photo.style.display = 'none'
        this.spriteCanvas.style.display = 'block'
        this.sprite.render(this.action, this.direction, this.x, this.y, FLOOR_Y, now - this.actionStart, this.quiet)
      } else {
        this.photo.style.display = 'block'
      }
      this.fpsFrames += 1
      if (now - this.fpsSampleStart >= 1000) {
        this.root.dataset.renderFps = String(Math.round(this.fpsFrames * 1000 / (now - this.fpsSampleStart)))
        this.fpsFrames = 0
        this.fpsSampleStart = now
      }
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  private update(now: number, delta: number): void {
    const elapsed = (now - this.actionStart) / 1000
    const protectedAction = this.action === 'sleep' || this.action === 'pet' || this.action === 'carry' || this.action === 'eat' || this.landingHeight > 0

    if (this.actionDuration > 0 && elapsed >= this.actionDuration && !protectedAction) this.setAction('idle')
    if (this.action === 'eat' && elapsed >= this.actionDuration) {
      this.removeCarrot()
      this.setAction('idle')
      this.say('好吃！', 1200)
    }

    if (!protectedAction && !this.reducedMotion && (!this.quiet || this.carrot)) {
      const distance = this.targetX - this.x
      if (Math.abs(distance) > 3) {
        if (this.action === 'idle') this.setAction('walk')
        if (this.action === 'walk') {
          this.direction = Math.sign(distance) || this.direction
          const desiredSpeed = Math.min(42, Math.sqrt(2 * 55 * Math.abs(distance)))
          this.speed += (desiredSpeed - this.speed) * (1 - Math.exp(-delta * 5))
          this.x += this.direction * Math.min(Math.abs(distance), delta * this.speed)
        }
      } else if (this.action === 'walk') {
        this.setAction('idle')
      }
    }

    if (!this.quiet && now >= this.nextBehavior && this.action === 'idle' && !this.carrot) this.chooseBehavior(now)
    if (this.action !== 'walk') this.speed = 0
    if (this.action !== 'carry') {
      const progress = clamp((now - this.landingStart) / 650, 0, 1)
      this.y = FLOOR_Y + this.landingHeight * (1 - progress * progress * (3 - 2 * progress))
      if (progress >= 1) this.landingHeight = 0
    }
    if (this.carrot && this.action === 'eat') {
      const remaining = clamp(1 - elapsed / this.actionDuration, 0.08, 1)
      this.carrotPhoto.style.transform = `rotate(-8deg) scale(${remaining})`
    }
    this.updateDomPositions()
  }

  private chooseBehavior(now: number): void {
    this.nextBehavior = now + 35000 + Math.random() * 25000
    const roll = Math.random()
    if (roll < 0.50) return
    if (roll < 0.68) this.setAction('look', 2.2)
    else if (roll < 0.82) this.setAction('groom', 2.3)
    else if (roll < 0.91) this.setAction('stretch', 1.9)
    else if (roll < 0.97) this.sleep(8 + Math.random() * 6)
    else this.targetX = clamp(this.x + (Math.random() - 0.5) * 180, 125, innerWidth - 125)
  }

  private setAction(action: Action, duration = 0): void {
    // The spin strip already turns right to left; commit facing only when leaving it.
    if (this.action === 'spin' && action !== 'spin'
      && performance.now() - this.actionStart >= actionDurationMs('spin') / 2) this.direction *= -1
    if (action === this.action && ['groom', 'look', 'spin', 'stretch', 'hop'].includes(action)) return
    const previous = this.action
    this.action = action
    this.root.dataset.action = action
    this.actionStart = performance.now()
    // Session length and frame cadence are independent. One-shot clips stop on their own ending.
    this.actionDuration = ['groom', 'look', 'spin', 'stretch', 'hop'].includes(action)
      ? actionDurationMs(action) / 1000 : duration
    if (action === 'idle' && previous !== 'idle') {
      this.nextBehavior = this.actionStart + 35000 + Math.random() * 25000
    }
    if (action !== 'sleep') this.hideToast()
  }

  private updateQuietMenu(): void {
    const button = this.menu.querySelector<HTMLButtonElement>('[data-action="quiet"]')
    if (button) button.textContent = this.quiet ? '☀️ 关闭安静模式' : '🌙 开启安静模式'
  }

  private setQuiet(enabled: boolean): void {
    this.quiet = enabled
    this.root.dataset.quiet = String(enabled)
    this.targetX = this.x
    this.nextBehavior = performance.now() + 35000 + Math.random() * 25000
    if (enabled && !['sleep', 'pet', 'carry', 'eat'].includes(this.action)) this.setAction('idle')
    this.updateQuietMenu()
    this.saveState()
    this.say(enabled ? '安静陪着你' : '可以活动啦', 1200)
  }

  private sleep(duration = 0): void {
    this.setAction('sleep', duration)
    this.say('Z z z…', duration > 0 ? duration * 1000 : 0)
    if (duration > 0) {
      const started = this.actionStart
      window.setTimeout(() => {
        if (this.action === 'sleep' && this.actionStart === started) this.setAction('idle')
      }, duration * 1000)
    }
  }

  private spawnCarrot(userInitiated: boolean): void {
    this.removeCarrot()
    if (this.action === 'sleep') this.setAction('idle')
    this.nextBehavior = performance.now() + 35000
    this.carrot = true
    const offset = (Math.random() > 0.5 ? 1 : -1) * (105 + Math.random() * 90)
    this.carrotX = clamp(this.x + offset, 58, innerWidth - 58)
    this.carrotY = 7
    this.carrotPhoto.classList.add('show')
    this.carrotHit.classList.add('show')
    const approach = this.carrotX >= this.x ? this.carrotX - 82 : this.carrotX + 82
    this.targetX = clamp(approach, 125, innerWidth - 125)
    if (userInitiated) this.say('闻到胡萝卜啦！', 1400)
    this.startCarrotWatch()
  }

  private removeCarrot(): void {
    clearInterval(this.carrotWatchTimer)
    this.carrotWatchTimer = 0
    if (!this.carrot) return
    this.carrot = false
    this.carrotDown = false
    this.carrotDragging = false
    clearTimeout(this.carrotDragTimer)
    this.carrotPhoto.style.transform = ''
    this.carrotPhoto.classList.remove('show', 'dragging')
    this.carrotHit.classList.remove('show', 'dragging')
  }

  private retargetCarrot(): void {
    if (!this.carrot) return
    const approach = this.carrotX >= this.x ? this.carrotX - 82 : this.carrotX + 82
    this.targetX = clamp(approach, 125, innerWidth - 125)
    if (this.action !== 'carry' && this.action !== 'pet' && this.action !== 'sleep') {
      this.direction = this.carrotX >= this.x ? 1 : -1
      if (this.action === 'eat') this.setAction('idle')
    }
  }

  private startCarrotWatch(): void {
    clearInterval(this.carrotWatchTimer)
    this.carrotWatchTimer = window.setInterval(() => {
      if (!this.carrot || this.destroyed) {
        clearInterval(this.carrotWatchTimer)
        this.carrotWatchTimer = 0
        return
      }
      const canEat = !this.carrotDragging
        && Math.abs(this.x - this.targetX) < 5
        && (this.action === 'idle' || this.action === 'walk')
      if (!canEat) return
      clearInterval(this.carrotWatchTimer)
      this.carrotWatchTimer = 0
      this.direction = this.carrotX >= this.x ? 1 : -1
      this.carrotPhoto.style.transform = 'rotate(-8deg) scale(1)'
      this.setAction('eat', 4.1)
    }, 100)
  }

  private readonly onCarrotPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.carrot) return
    this.interactionPointerId = event.pointerId
    event.preventDefault()
    event.stopPropagation()
    this.carrotDown = true
    clearTimeout(this.carrotDragTimer)
    this.carrotDragTimer = window.setTimeout(() => {
      if (!this.carrotDown || !this.carrot) return
      this.carrotDragging = true
      clearInterval(this.carrotWatchTimer)
      this.carrotWatchTimer = 0
      this.carrotPhoto.style.transform = ''
      this.carrotPhoto.classList.add('dragging')
      this.carrotHit.classList.add('dragging')
      if (this.action === 'eat' || this.action === 'sleep') this.setAction('idle')
      this.say('胡萝卜被拿走啦，我来追！', 1300)
    }, 320)
    try { this.carrotHit.setPointerCapture(event.pointerId) } catch { /* Capture is optional. */ }
  }

  private moveCarrot(event: PointerEvent): void {
    this.carrotX = clamp(event.clientX, 38, innerWidth - 38)
    this.carrotY = clamp(innerHeight - event.clientY - 44, 8, STAGE_HEIGHT - 76)
    this.retargetCarrot()
    this.updateDomPositions()
  }

  private finishCarrotDrag(): void {
    this.carrotDown = false
    clearTimeout(this.carrotDragTimer)
    if (!this.carrotDragging) return
    this.carrotDragging = false
    this.carrotY = 7
    this.carrotPhoto.classList.remove('dragging')
    this.carrotHit.classList.remove('dragging')
    this.retargetCarrot()
    this.startCarrotWatch()
    this.say('放这里吗？马上来！', 1000)
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.interactionPointerId = event.pointerId
    this.closeMenu()
    if (event.button === 0) {
      this.leftDown = true
      clearTimeout(this.petTimer)
      this.petTimer = window.setTimeout(() => {
        if (this.leftDown && !this.rightDown) this.startPet(event.clientX, event.clientY)
      }, 420)
    }
    if (event.button === 2) {
      this.rightDown = true
      this.rightPressAt = performance.now()
      this.armCarry(event.clientX, event.clientY)
    }
    try { this.hit.setPointerCapture(event.pointerId) } catch { /* Pointer ownership may already belong to another button. */ }
    event.preventDefault()
  }

  private armCarry(x: number, y: number): void {
    clearTimeout(this.petTimer)
    clearTimeout(this.carryTimer)
    this.carryTimer = window.setTimeout(() => {
      if (this.rightDown) this.startCarry(x, y)
    }, 430)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.interactionPointerId !== event.pointerId) return
    if (this.carrotDragging) {
      event.preventDefault()
      this.moveCarrot(event)
      return
    }
    if (this.action === 'pet') {
      event.preventDefault()
      this.moveHand(event.clientX, event.clientY)
      if (performance.now() - this.heartAt > 360) {
        this.heartAt = performance.now()
        this.heart(event.clientX + (Math.random() - 0.5) * 34, event.clientY - 20)
      }
    } else if (this.action === 'carry') {
      event.preventDefault()
      this.x = clamp(event.clientX + this.carryOffsetX, 125, innerWidth - 125)
      this.y = FLOOR_Y + clamp(innerHeight - event.clientY + this.carryOffsetY, 0, maxPetLift(innerHeight))
      this.targetX = this.x
      this.positionCarryHand()
    }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.interactionPointerId !== event.pointerId) return
    if (event.type === 'pointercancel') {
      this.leftDown = false
      this.rightDown = false
      if (this.carrotDown) this.finishCarrotDrag()
      if (this.action === 'carry') this.endCarry()
      if (this.action === 'pet') this.endTouch('')
      clearTimeout(this.petTimer)
      clearTimeout(this.carryTimer)
      this.interactionPointerId = null
      return
    }
    if (event.button === 0 && this.carrotDown) this.finishCarrotDrag()
    if (event.button === 0) this.leftDown = false
    const wasCarry = this.action === 'carry'
    const wasRightDown = this.rightDown
    if (event.button === 2) this.rightDown = false
    clearTimeout(this.petTimer)
    clearTimeout(this.carryTimer)
    if (this.action === 'pet' && !this.leftDown) this.endTouch('心情变好了 ♡')
    if (event.button === 2 && wasCarry) this.endCarry()
    else if (event.button === 2 && wasRightDown && performance.now() - this.rightPressAt < 520) this.openMenu(event.clientX, event.clientY)
  }

  private startPet(x: number, y: number): void {
    this.setAction('pet')
    this.hand.src = handPetSideCute
    this.hand.className = 'pet'
    this.moveHand(x, y)
    this.say('舒服…再摸摸', 1300)
  }

  private startCarry(x: number, y: number): void {
    if (this.action === 'pet') this.hand.className = ''
    this.carryOffsetX = this.x - x
    this.carryOffsetY = this.y - FLOOR_Y - (innerHeight - y)
    this.landingHeight = 0
    this.setAction('carry')
    this.hand.src = handCarryCute
    this.hand.className = 'carry'
    this.positionCarryHand()
    this.say('轻一点呀！', 1100)
  }

  private endTouch(message: string): void {
    this.hand.className = ''
    this.setAction('idle')
    if (message) this.say(message, 1100)
  }

  private endCarry(): void {
    this.hand.className = ''
    this.landingHeight = this.y - FLOOR_Y
    this.landingStart = performance.now()
    this.setAction('idle')
    this.targetX = this.x
    this.saveState()
    this.hideToast()
  }

  private positionCarryHand(): void {
    this.moveHand(this.x, Math.max(32, innerHeight - (this.y - FLOOR_Y) - 190))
  }

  private moveHand(x: number, y: number): void {
    this.hand.style.left = `${x}px`
    this.hand.style.top = `${y}px`
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.menuOpen) return
    if (event.target instanceof Node && this.menu.contains(event.target)) return
    this.closeMenu()
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const rect = this.hit.getBoundingClientRect()
      this.openMenu(rect.right, rect.top)
    } else if (event.key === 'Escape') {
      this.closeMenu()
    }
  }

  private openMenu(x: number, y: number): void {
    this.menuOpen = true
    this.menu.classList.add('open')
    const width = 190
    const height = 205
    this.menu.style.left = `${clamp(x, 10, innerWidth - width - 10)}px`
    this.menu.style.top = `${clamp(y - height, 10, innerHeight - height - 10)}px`
    const first = this.menu.querySelector<HTMLButtonElement>('button')
    first?.focus({ preventScroll: true })
  }

  private closeMenu(): void {
    this.menuOpen = false
    this.menu.classList.remove('open')
  }

  private readonly onMenuClick = (event: MouseEvent): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]')
    if (!button) return
    const action = button.dataset.action
    this.closeMenu()
    if (action === 'feed') this.spawnCarrot(true)
    if (action === 'sleep') this.sleep(0)
    if (action === 'hop') this.setAction('hop', 1.05)
    if (action === 'spin') this.setAction('spin', 1.35)
    if (action === 'groom') this.setAction('groom', 3.2)
    if (action === 'look') this.setAction('look', 3.2)
    if (action === 'wake') {
      this.setAction('idle')
      this.targetX = this.quiet ? this.x : clamp(this.x + this.direction * 90, 125, innerWidth - 125)
      this.say('醒啦！', 900)
    }
    if (action === 'quiet') this.setQuiet(!this.quiet)
  }

  private updateDomPositions(): void {
    const screenBottom = Math.max(0, this.y - FLOOR_Y)
    this.photo.style.left = `${this.x - PHOTO_WIDTH / 2}px`
    this.photo.style.bottom = `${screenBottom - 2}px`
    this.hit.style.left = `${this.x - PHOTO_WIDTH / 2}px`
    this.hit.style.bottom = `${screenBottom}px`
    if (this.carrot) {
      const carrotBottom = Math.max(0, this.carrotY - 7)
      this.carrotPhoto.style.left = `${this.carrotX - 32}px`
      this.carrotPhoto.style.bottom = `${carrotBottom - 2}px`
      this.carrotHit.style.left = `${this.carrotX - 38}px`
      this.carrotHit.style.bottom = `${carrotBottom}px`
    }
    this.toast.style.left = `${this.x}px`
    this.toast.style.bottom = `${screenBottom + 220}px`
  }

  private say(message: string, duration: number): void {
    this.toast.textContent = message
    this.toast.classList.add('show')
    const token = message
    if (duration > 0) window.setTimeout(() => {
      if (this.toast.textContent === token) this.hideToast()
    }, duration)
  }

  private hideToast(): void {
    this.toast.classList.remove('show')
  }

  private heart(x: number, y: number): void {
    const heart = document.createElement('span')
    heart.className = 'dsh-rabbit-heart'
    heart.textContent = Math.random() > 0.45 ? '♡' : '✦'
    heart.style.left = `${x}px`
    heart.style.top = `${y}px`
    heart.style.color = Math.random() > 0.5 ? '#e68b9c' : '#d8a14d'
    this.root.appendChild(heart)
    window.setTimeout(() => heart.remove(), 950)
  }

  private loadState(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SavedState | null
      if (saved) {
        this.x = clamp(saved.xRatio * innerWidth, 125, innerWidth - 125)
        this.targetX = this.x
        this.quiet = saved.quiet === true
      }
    } catch { /* A corrupt preference should not prevent the pet from loading. */ }
  }

  private saveState(): void {
    try {
      const value: SavedState = { xRatio: clamp(this.x / innerWidth, 0, 1), quiet: this.quiet }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch { /* Storage can be disabled without affecting the current session. */ }
  }
}

/** Mount the browser-side rabbit and tie all resources to the Cordis fiber. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    document.getElementById('dsh-rabbit-pet-stage')?.remove()
    const pet = new RabbitPet()
    return () => pet.dispose()
  }, 'rabbit-pet: animated 2D desktop companion')
}
