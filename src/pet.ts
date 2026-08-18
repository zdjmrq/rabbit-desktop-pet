import * as THREE from 'three'
import rabbitIdle from '../assets/rabbit-idle.png'
import rabbitSleep from '../assets/rabbit-sleep.png'
import rabbitEat from '../assets/rabbit-eat.png'
import rabbitIdleNoHat from '../assets/rabbit-idle-nohat.png'
import rabbitSleepNoHat from '../assets/rabbit-sleep-nohat.png'
import rabbitEatNoHat from '../assets/rabbit-eat-nohat.png'
import carrotRealistic from '../assets/carrot-realistic.png'
import handPetSideCute from '../assets/hand-pet-side-cute.png'
import handCarryCute from '../assets/hand-carry-cute.png'

interface ClientContext {
  effect(setup: () => void | (() => void), label?: string): void
}

type Action = 'idle' | 'walk' | 'hop' | 'groom' | 'stretch' | 'look' | 'sleep' | 'eat' | 'spin' | 'pet' | 'carry'
type Pose = 'idle' | 'sleep' | 'eat'
type TextureKey = Pose | `${Pose}-nohat`

const PLUGIN_ID = 'dsh-rabbit-pet'
const STORAGE_KEY = 'dsh-rabbit-pet:v1'
const STAGE_HEIGHT = 250
const FLOOR_Y = 34
const MODEL_SCALE = 1.25
const PHOTO_WIDTH = 250
const PHOTO_HEIGHT = 188
const CARRY_HAND_OFFSET = 104

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
  hat?: boolean
}

interface Parts {
  body: THREE.Group
  head: THREE.Group
  leftEar: THREE.Group
  rightEar: THREE.Group
  frontPaw: THREE.Mesh
  backPaw: THREE.Mesh
  tail: THREE.Mesh
  hat: THREE.Group
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const value = new THREE.Mesh(geometry, material)
  value.castShadow = true
  value.receiveShadow = true
  return value
}

function setEllipsoid(target: THREE.Object3D, x: number, y: number, z: number): void {
  target.scale.set(x, y, z)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function easeOutBack(value: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2
}

class RabbitPet {
  private readonly root = document.createElement('div')
  private readonly canvas = document.createElement('canvas')
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
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(0, innerWidth, STAGE_HEIGHT, 0, 0.1, 1500)
  private readonly renderer: THREE.WebGLRenderer
  private readonly rabbit = new THREE.Group()
  private readonly photoRig = new THREE.Group()
  private photoMaterial!: THREE.ShaderMaterial
  private photoMesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private poseTextures!: Record<TextureKey, THREE.Texture>
  private currentTextureKey: TextureKey | '' = ''
  private readonly shadow: THREE.Mesh
  private readonly parts: Parts
  private carrot: THREE.Group | null = null
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
  private nextBehavior = performance.now() + 4500
  private frame = 0
  private lastFrame = performance.now()
  private resizeObserver: ResizeObserver | null = null
  private leftDown = false
  private rightDown = false
  private petTimer = 0
  private carryTimer = 0
  private rightPressAt = 0
  private spinFlipped = false
  private heartAt = 0
  private menuOpen = false
  private hatOn = true
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private destroyed = false

  constructor() {
    this.root.id = 'dsh-rabbit-pet-stage'
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
      '<button data-action="hat" class="wide">👒 戴上 / 摘下草帽</button>',
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
    this.root.append(this.canvas, this.photo, this.carrotPhoto, this.carrotHit, this.hit, this.menu, this.hand, this.toast)
    document.body.appendChild(this.root)

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setSize(innerWidth, STAGE_HEIGHT, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = !this.reducedMotion
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.camera.position.set(0, 0, 700)
    this.camera.lookAt(0, 0, 0)

    const ambient = new THREE.HemisphereLight(0xfffbf3, 0x6f7b8c, 2.5)
    this.scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffead5, 4.4)
    key.position.set(-180, 280, 380)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -220
    key.shadow.camera.right = 220
    key.shadow.camera.top = 240
    key.shadow.camera.bottom = -80
    this.scene.add(key)
    const rim = new THREE.PointLight(0xb7d8ff, 2.2, 700)
    rim.position.set(240, 180, 220)
    this.scene.add(rim)

    this.parts = this.buildRabbit()
    this.rabbit.scale.setScalar(MODEL_SCALE)
    this.rabbit.visible = false
    this.scene.add(this.rabbit)
    this.buildPhotoRig()
    this.shadow = mesh(new THREE.PlaneGeometry(130, 44), new THREE.ShadowMaterial({ color: 0x26180f, opacity: 0.22 }))
    this.shadow.rotation.x = Math.PI / 2
    this.shadow.position.z = -30
    this.scene.add(this.shadow)
    this.loadState()
    this.bind()
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
    this.say('右键可以和我互动哦', 2400)
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
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) material.dispose()
    })
    this.renderer.dispose()
    for (const texture of Object.values(this.poseTextures)) texture.dispose()
    this.root.remove()
    this.style.remove()
  }

  private buildPhotoRig(): void {
    const loader = new THREE.TextureLoader()
    const load = (source: string): THREE.Texture => {
      const texture = loader.load(source)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      return texture
    }
    this.poseTextures = {
      idle: load(rabbitIdle),
      sleep: load(rabbitSleep),
      eat: load(rabbitEat),
      'idle-nohat': load(rabbitIdleNoHat),
      'sleep-nohat': load(rabbitSleepNoHat),
      'eat-nohat': load(rabbitEatNoHat),
    }
    this.photoMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      alphaTest: 0.015,
      uniforms: {
        uMap: { value: this.poseTextures.idle },
        uTime: { value: 0 },
        uMode: { value: 0 },
        uProgress: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uMode;
        uniform float uProgress;
        vec2 rotateAt(vec2 point, vec2 pivot, float angle) {
          float c = cos(angle), s = sin(angle);
          vec2 d = point - pivot;
          return pivot + vec2(d.x*c-d.y*s, d.x*s+d.y*c);
        }
        void main() {
          vUv = uv;
          vec3 p = position;
          float head = smoothstep(.52,.78,uv.x) * smoothstep(.28,.52,uv.y);
          float ears = smoothstep(.58,.82,uv.y) * smoothstep(.38,.58,uv.x);
          float frontLeg = smoothstep(.56,.76,uv.x) * (1.0-smoothstep(.23,.42,uv.y));
          float hindLeg = (1.0-smoothstep(.22,.43,uv.x)) * (1.0-smoothstep(.22,.42,uv.y));
          float chest = smoothstep(.42,.67,uv.x) * smoothstep(.18,.42,uv.y) * (1.0-smoothstep(.62,.78,uv.y));
          float body = smoothstep(.10,.32,uv.x) * (1.0-smoothstep(.73,.92,uv.x)) * smoothstep(.16,.35,uv.y) * (1.0-smoothstep(.72,.88,uv.y));
          float breath = sin(uTime*2.15)*.007;
          p.y += body * breath * 85.0;
          p.x += chest * breath * 28.0;
          p.z += body * 8.0 + head * 5.0;

          if (uMode > .5 && uMode < 1.5) {
            float step = sin(uTime*9.2);
            p.y += abs(step)*1.5;
            p.y += frontLeg*step*5.0 - hindLeg*step*4.2;
            p.x += frontLeg*step*2.6 + hindLeg*step*1.8;
            vec2 h = rotateAt(p.xy, vec2(52.0,24.0), head*step*.018);
            p.xy = mix(p.xy,h,head);
            p.x += ears*sin(uTime*6.1)*1.8;
          } else if (uMode > 1.5 && uMode < 2.5) {
            float lift = sin(uProgress*3.14159265);
            p.x *= 1.0 + sin(uProgress*6.2831853)*.025;
            p.y *= 1.0 - sin(uProgress*6.2831853)*.035;
            p.y += frontLeg*lift*7.0;
            p.x -= hindLeg*lift*5.0;
            p.y -= (1.0-lift)*smoothstep(.0,.16,abs(uProgress-.5))*.8;
          } else if (uMode > 2.5 && uMode < 3.5) {
            float rub = sin(uTime*12.0);
            p.y += frontLeg*(10.0+rub*5.0);
            p.x += frontLeg*(4.0-rub*2.0);
            p.x -= head*3.0;
            p.y -= head*4.0;
            p.x += ears*rub*1.4;
          } else if (uMode > 3.5 && uMode < 4.5) {
            float stretch = sin(uProgress*3.14159265);
            p.x += (uv.x-.35)*stretch*15.0;
            p.y -= body*stretch*5.0;
            p.x += frontLeg*stretch*9.0;
          } else if (uMode > 4.5 && uMode < 5.5) {
            float glance = sin(uTime*1.7);
            vec2 h = rotateAt(p.xy, vec2(45.0,18.0), head*glance*.035);
            p.xy = mix(p.xy,h,head);
            p.x += ears*sin(uTime*2.4)*2.0;
          } else if (uMode > 6.5 && uMode < 7.5) {
            float nibble = sin(uTime*10.5);
            p.y -= head*abs(nibble)*2.7;
            p.x += head*nibble*1.5;
            p.y += frontLeg*nibble*1.3;
          } else if (uMode > 8.5 && uMode < 9.5) {
            p.y -= head*3.0;
            p.x += ears*sin(uTime*2.8)*1.5;
            p.y += body*sin(uTime*2.8)*1.0;
          } else if (uMode > 9.5) {
            float sway = sin(uTime*2.25);
            p.x += (uv.y-.45)*sway*5.0;
            p.y -= frontLeg*3.5 + hindLeg*2.5;
            p.x += ears*sway*2.2;
          }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uMap;
        void main() {
          vec4 color = texture2D(uMap,vUv);
          if (color.a < .012) discard;
          float softDepth = 1.0 + (vUv.y-.42)*.035;
          color.rgb *= softDepth;
          gl_FragColor = color;
        }
      `,
    })
    const geometry = new THREE.PlaneGeometry(PHOTO_WIDTH, PHOTO_HEIGHT, 30, 22)
    this.photoMesh = new THREE.Mesh(geometry, this.photoMaterial)
    this.photoMesh.position.y = PHOTO_HEIGHT / 2 - 2
    this.photoMesh.renderOrder = 2
    this.photoRig.add(this.photoMesh)
    this.scene.add(this.photoRig)
  }

  private buildRabbit(): Parts {
    const furWhite = new THREE.MeshStandardMaterial({ color: 0xf8f3e9, roughness: 0.95, metalness: 0 })
    const furCream = new THREE.MeshStandardMaterial({ color: 0xd7c9b2, roughness: 0.98 })
    const furBrown = new THREE.MeshStandardMaterial({ color: 0x9b846b, roughness: 1 })
    const innerEar = new THREE.MeshStandardMaterial({ color: 0xd5a49f, roughness: 0.9 })
    const eye = new THREE.MeshPhysicalMaterial({ color: 0x100e0d, roughness: 0.12, clearcoat: 1 })
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xca8f91, roughness: 0.7 })
    const body = new THREE.Group()
    const bodyBase = mesh(new THREE.SphereGeometry(1, 48, 32), furWhite)
    setEllipsoid(bodyBase, 47, 31, 29)
    bodyBase.position.set(-4, 34, 0)
    body.add(bodyBase)
    const saddle = mesh(new THREE.SphereGeometry(1, 44, 28, 0, Math.PI * 2, 0, Math.PI * 0.62), furBrown)
    setEllipsoid(saddle, 42, 28, 28)
    saddle.position.set(-9, 44, -1)
    saddle.rotation.z = -0.08
    body.add(saddle)
    const chest = mesh(new THREE.SphereGeometry(1, 36, 24), furWhite)
    setEllipsoid(chest, 26, 33, 24)
    chest.position.set(27, 39, 0)
    chest.rotation.z = -0.16
    body.add(chest)
    this.rabbit.add(body)

    const head = new THREE.Group()
    head.position.set(34, 66, 0)
    const headBase = mesh(new THREE.SphereGeometry(1, 48, 32), furCream)
    setEllipsoid(headBase, 28, 28, 25)
    head.add(headBase)
    const faceBlaze = mesh(new THREE.SphereGeometry(1, 40, 28), furWhite)
    setEllipsoid(faceBlaze, 22, 25, 22)
    faceBlaze.position.set(10, -2, 7)
    head.add(faceBlaze)
    const cheekNear = mesh(new THREE.SphereGeometry(1, 36, 24), furWhite)
    setEllipsoid(cheekNear, 20, 15, 16)
    cheekNear.position.set(20, -11, 10)
    head.add(cheekNear)
    const cheekFar = cheekNear.clone()
    cheekFar.position.z = -10
    head.add(cheekFar)

    const eyeGeometry = new THREE.SphereGeometry(1, 28, 20)
    const nearEye = mesh(eyeGeometry, eye)
    setEllipsoid(nearEye, 5.4, 7.2, 3.2)
    nearEye.position.set(18, 7, 21)
    head.add(nearEye)
    const farEye = mesh(eyeGeometry, eye)
    setEllipsoid(farEye, 4.8, 6.5, 3)
    farEye.position.set(18, 8, -20)
    head.add(farEye)
    for (const target of [nearEye, farEye]) {
      const glint = mesh(new THREE.SphereGeometry(1, 12, 8), shine)
      setEllipsoid(glint, 1.4, 1.8, 0.8)
      glint.position.set(1.7, 2.2, target === nearEye ? 2.6 : -2.6)
      target.add(glint)
    }
    const nose = mesh(new THREE.SphereGeometry(1, 24, 16), noseMat)
    setEllipsoid(nose, 5.2, 3.8, 4.2)
    nose.position.set(39, -9, 0)
    nose.rotation.z = -0.15
    head.add(nose)

    const whiskerMaterial = new THREE.LineBasicMaterial({ color: 0x8c8177, transparent: true, opacity: 0.64 })
    const whiskerPoints: number[] = []
    for (const z of [-1, 1]) {
      for (let i = -1; i <= 1; i += 1) {
        whiskerPoints.push(33, -10 + i * 4, z * 9, 67, -9 + i * 8, z * (16 + Math.abs(i) * 2))
      }
    }
    const whiskers = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(whiskerPoints, 3)), whiskerMaterial)
    head.add(whiskers)
    this.rabbit.add(head)

    const makeEar = (z: number, tilt: number): THREE.Group => {
      const ear = new THREE.Group()
      ear.position.set(18, 19, z)
      ear.rotation.z = tilt
      const outer = mesh(new THREE.CapsuleGeometry(8.7, 29, 8, 20), furCream)
      outer.position.y = 20
      setEllipsoid(outer, 1, 1, 0.72)
      ear.add(outer)
      const inner = mesh(new THREE.CapsuleGeometry(4.4, 24, 8, 18), innerEar)
      inner.position.set(1, 20, z > 0 ? 6.3 : -6.3)
      setEllipsoid(inner, 1, 1, 0.3)
      ear.add(inner)
      head.add(ear)
      return ear
    }
    const leftEar = makeEar(10, -0.08)
    const rightEar = makeEar(-10, 0.12)

    const pawGeometry = new THREE.SphereGeometry(1, 32, 20)
    const frontPaw = mesh(pawGeometry, furWhite)
    setEllipsoid(frontPaw, 18, 8, 13)
    frontPaw.position.set(34, 11, 15)
    frontPaw.rotation.z = -0.08
    this.rabbit.add(frontPaw)
    const backPaw = mesh(pawGeometry, furCream)
    setEllipsoid(backPaw, 24, 11, 17)
    backPaw.position.set(-31, 12, 10)
    backPaw.rotation.z = 0.05
    this.rabbit.add(backPaw)
    const tail = mesh(new THREE.SphereGeometry(1, 30, 22), furWhite)
    setEllipsoid(tail, 15, 15, 14)
    tail.position.set(-48, 48, -3)
    this.rabbit.add(tail)

    const hat = this.buildHat()
    hat.position.set(-9, 32, 1)
    hat.rotation.z = -0.16
    head.add(hat)
    return { body, head, leftEar, rightEar, frontPaw, backPaw, tail, hat }
  }

  private buildHat(): THREE.Group {
    const group = new THREE.Group()
    const straw = new THREE.MeshStandardMaterial({ color: 0xd9ad5b, roughness: 0.92, side: THREE.DoubleSide })
    const ribbon = new THREE.MeshStandardMaterial({ color: 0xb53632, roughness: 0.75 })
    const brim = mesh(new THREE.CylinderGeometry(25, 27, 3.8, 48), straw)
    setEllipsoid(brim, 1.18, 1, 0.82)
    group.add(brim)
    const crown = mesh(new THREE.CylinderGeometry(13, 17, 16, 40), straw)
    crown.position.y = 9
    group.add(crown)
    const band = mesh(new THREE.CylinderGeometry(17.2, 17.2, 5, 40, 1, true), ribbon)
    band.position.y = 4.5
    group.add(band)
    return group
  }

  private buildCarrot(): THREE.Group {
    const group = new THREE.Group()
    const orange = new THREE.MeshStandardMaterial({ color: 0xf18432, roughness: 0.82 })
    const green = new THREE.MeshStandardMaterial({ color: 0x5d9652, roughness: 0.9, side: THREE.DoubleSide })
    const root = mesh(new THREE.ConeGeometry(8, 34, 24), orange)
    root.rotation.z = -0.18
    root.position.y = 17
    group.add(root)
    for (let i = -1; i <= 1; i += 1) {
      const leaf = mesh(new THREE.CapsuleGeometry(2.1, 13, 4, 8), green)
      leaf.position.set(i * 4, 38, 0)
      leaf.rotation.z = i * 0.36
      group.add(leaf)
    }
    return group
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
  }

  private readonly resize = (): void => {
    const width = Math.max(320, window.innerWidth)
    this.renderer.setSize(width, STAGE_HEIGHT, false)
    this.camera.right = width
    this.camera.updateProjectionMatrix()
    this.x = clamp(this.x, 125, width - 125)
    this.targetX = clamp(this.targetX, 125, width - 125)
    this.updateDomPositions()
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed) return
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000))
    this.lastFrame = now
    if (!document.hidden) {
      this.update(now, delta)
      this.renderer.render(this.scene, this.camera)
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  private update(now: number, delta: number): void {
    const elapsed = (now - this.actionStart) / 1000
    const phase = now / 1000
    const protectedAction = this.action === 'sleep' || this.action === 'pet' || this.action === 'carry' || this.action === 'eat'

    if (this.actionDuration > 0 && elapsed >= this.actionDuration && !protectedAction) this.setAction('idle')
    if (this.action === 'eat' && elapsed >= this.actionDuration) {
      this.removeCarrot()
      this.setAction('idle')
      this.say('好吃！', 1200)
    }

    if (!protectedAction && !this.reducedMotion) {
      const distance = this.targetX - this.x
      if (Math.abs(distance) > 3) {
        if (this.action === 'idle') this.setAction('walk')
        if (this.action === 'walk') {
          this.direction = Math.sign(distance) || this.direction
          this.x += this.direction * Math.min(Math.abs(distance), delta * 46)
        }
      } else if (this.action === 'walk') {
        this.setAction('idle')
      }
    }

    if (now >= this.nextBehavior && !protectedAction && !this.carrot) this.chooseBehavior(now)
    this.animateModel(phase, elapsed)
    this.animatePhotoRig(phase, elapsed)
    this.rabbit.position.set(this.x, this.y, 0)
    this.rabbit.scale.set(this.direction * MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
    this.photoRig.position.set(this.x, this.y - FLOOR_Y, 4)
    this.shadow.position.set(this.x, 3, -28)
    this.shadow.scale.setScalar(this.action === 'hop' ? clamp(1 - Math.sin(Math.min(1, elapsed / this.actionDuration) * Math.PI) * 0.35, 0.65, 1) : 1)
    this.updateDomPositions()
  }

  private animateModel(phase: number, elapsed: number): void {
    const { body, head, leftEar, rightEar, frontPaw, backPaw, tail } = this.parts
    body.rotation.set(0, 0, 0)
    body.scale.set(1, 1, 1)
    head.rotation.set(0, 0, 0)
    head.position.set(34, 66, 0)
    leftEar.rotation.set(0, 0, -0.08)
    rightEar.rotation.set(0, 0, 0.12)
    frontPaw.rotation.set(0, 0, -0.08)
    backPaw.rotation.set(0, 0, 0.05)
    setEllipsoid(tail, 15, 15, 14)
    this.rabbit.rotation.set(0, 0, 0)
    if (this.action !== 'carry') this.y = FLOOR_Y
    if (this.carrot && this.action !== 'eat' && !this.carrotDragging) this.carrotPhoto.style.transform = ''

    const breathe = Math.sin(phase * 2.6) * 0.018
    body.scale.y += breathe
    head.position.y += breathe * 14
    leftEar.rotation.z += Math.sin(phase * 1.7) * 0.025
    rightEar.rotation.z -= Math.sin(phase * 1.45) * 0.02

    if (this.action === 'walk') {
      const step = Math.sin(phase * 10)
      this.y += Math.abs(step) * 3
      body.rotation.z = step * 0.025
      frontPaw.rotation.z = -0.08 + step * 0.34
      backPaw.rotation.z = 0.05 - step * 0.27
      head.rotation.z = -step * 0.025
      return
    }
    if (this.action === 'hop') {
      const progress = clamp(elapsed / this.actionDuration, 0, 1)
      this.y += Math.sin(progress * Math.PI) * 55
      body.rotation.z = Math.sin(progress * Math.PI) * -0.1
      frontPaw.rotation.z = -0.72
      backPaw.rotation.z = 0.42
      return
    }
    if (this.action === 'groom') {
      const rub = Math.sin(phase * 13)
      head.rotation.z = -0.2 + rub * 0.05
      head.position.y -= 7
      frontPaw.position.set(42, 39 + rub * 4, 18)
      frontPaw.rotation.z = -0.85 + rub * 0.16
      return
    }
    frontPaw.position.set(34, 11, 15)
    if (this.action === 'stretch') {
      const progress = clamp(elapsed / this.actionDuration, 0, 1)
      const amount = Math.sin(progress * Math.PI)
      body.scale.x = 1 + amount * 0.28
      body.scale.y = 1 - amount * 0.12
      head.position.x += amount * 14
      head.position.y -= amount * 9
      frontPaw.position.x += amount * 16
      return
    }
    if (this.action === 'look') {
      head.rotation.y = Math.sin(phase * 2.2) * 0.26
      head.rotation.z = Math.sin(phase * 1.4) * 0.08
      leftEar.rotation.z -= 0.11
      rightEar.rotation.z += 0.12
      return
    }
    if (this.action === 'spin') {
      const progress = clamp(elapsed / this.actionDuration, 0, 1)
      this.y += Math.sin(progress * Math.PI) * 12
      return
    }
    if (this.action === 'sleep') {
      body.rotation.z = -0.06
      body.scale.y = 0.88
      head.position.set(39, 42, 12)
      head.rotation.z = -0.42
      leftEar.rotation.z = -1.13
      rightEar.rotation.z = -0.92
      frontPaw.position.set(48, 12, 16)
      return
    }
    if (this.action === 'eat') {
      head.position.x += 9
      head.position.y = 40 + Math.abs(Math.sin(phase * 7)) * 7
      head.rotation.z = -0.54 + Math.sin(phase * 7) * 0.07
      frontPaw.rotation.z = -0.36
      if (this.carrot) {
        const remaining = clamp(1 - elapsed / this.actionDuration, 0.08, 1)
        this.carrot.scale.setScalar(remaining)
        this.carrotPhoto.style.transform = `rotate(-8deg) scale(${remaining})`
      }
      return
    }
    if (this.action === 'pet') {
      head.rotation.z = -0.16 + Math.sin(phase * 3) * 0.045
      head.position.y -= 5
      leftEar.rotation.z = -0.42
      rightEar.rotation.z = -0.25
      tail.scale.multiplyScalar(1 + Math.sin(phase * 11) * 0.08)
      return
    }
    if (this.action === 'carry') {
      body.rotation.z = Math.sin(phase * 2.8) * 0.035
      frontPaw.rotation.z = -0.72 + Math.sin(phase * 5) * 0.1
      backPaw.rotation.z = 0.48 - Math.sin(phase * 5) * 0.08
      leftEar.rotation.z = -0.36
      rightEar.rotation.z = 0.37
    }
  }

  private animatePhoto(phase: number, elapsed: number): void {
    const pose: 'idle' | 'sleep' | 'eat' = this.action === 'sleep' ? 'sleep' : this.action === 'eat' ? 'eat' : 'idle'
    for (const [name, image] of Object.entries(this.poseImages)) image.classList.toggle('active', name === pose)

    let translateY = 0
    let rotate = 0
    let scaleX = 1
    let scaleY = 1 + Math.sin(phase * 2.15) * 0.006

    if (this.action === 'walk') {
      const step = Math.sin(phase * 8.4)
      translateY = Math.abs(step) * -1.8
      rotate = step * 0.7
      scaleY += Math.abs(step) * 0.008
    } else if (this.action === 'hop') {
      const progress = clamp(elapsed / Math.max(this.actionDuration, 0.01), 0, 1)
      const lift = Math.sin(progress * Math.PI)
      rotate = -lift * 4.2
      scaleX += Math.sin(progress * Math.PI * 2) * 0.025
      scaleY -= Math.sin(progress * Math.PI * 2) * 0.02
    } else if (this.action === 'groom') {
      rotate = -2.1 + Math.sin(phase * 7.5) * 1.1
      translateY = Math.abs(Math.sin(phase * 7.5)) * 2
    } else if (this.action === 'stretch') {
      const amount = Math.sin(clamp(elapsed / Math.max(this.actionDuration, 0.01), 0, 1) * Math.PI)
      scaleX += amount * 0.075
      scaleY -= amount * 0.055
      rotate = -amount * 1.4
    } else if (this.action === 'look') {
      rotate = Math.sin(phase * 1.7) * 1.8
      translateY = Math.sin(phase * 1.15) * 1.2
    } else if (this.action === 'spin') {
      const progress = clamp(elapsed / Math.max(this.actionDuration, 0.01), 0, 1)
      scaleX = Math.cos(progress * Math.PI * 2)
      scaleY += Math.sin(progress * Math.PI) * 0.035
      translateY = -Math.sin(progress * Math.PI) * 7
    } else if (this.action === 'sleep') {
      scaleY = 1 + Math.sin(phase * 1.25) * 0.009
      translateY = 4
    } else if (this.action === 'eat') {
      rotate = Math.sin(phase * 9.2) * 0.75
      translateY = Math.abs(Math.sin(phase * 9.2)) * 2.2
      scaleY += Math.sin(phase * 9.2) * 0.008
    } else if (this.action === 'pet') {
      rotate = -1.5 + Math.sin(phase * 2.8) * 0.65
      translateY = 2 + Math.sin(phase * 2.8)
      scaleY -= 0.018
    } else if (this.action === 'carry') {
      rotate = Math.sin(phase * 2.25) * 2.6
      scaleX = 0.98
      scaleY = 1.025
    }

    this.photo.style.transform = `scaleX(${this.direction})`
    this.photoInner.style.transform = `translateY(${translateY}px) rotate(${rotate}deg) scale(${scaleX},${scaleY})`
  }

  private animatePhotoRig(phase: number, elapsed: number): void {
    const pose: Pose = this.action === 'sleep' ? 'sleep' : this.action === 'eat' ? 'eat' : 'idle'
    const textureKey: TextureKey = this.hatOn ? pose : `${pose}-nohat`
    if (textureKey !== this.currentTextureKey) {
      this.currentTextureKey = textureKey
      this.photoMaterial.uniforms.uMap.value = this.poseTextures[textureKey]
    }
    const modes: Record<Action, number> = {
      idle: 0, walk: 1, hop: 2, groom: 3, stretch: 4, look: 5,
      sleep: 6, eat: 7, spin: 8, pet: 9, carry: 10,
    }
    const progress = this.actionDuration > 0 ? clamp(elapsed / this.actionDuration, 0, 1) : 0
    this.photoMaterial.uniforms.uTime.value = phase
    this.photoMaterial.uniforms.uMode.value = this.reducedMotion ? 0 : modes[this.action]
    this.photoMaterial.uniforms.uProgress.value = progress
    this.photoRig.scale.set(this.direction, 1, 1)
    this.photoRig.rotation.set(0, 0, 0)
    if (this.action === 'spin') {
      if (progress >= 0.5 && !this.spinFlipped) {
        this.direction *= -1
        this.spinFlipped = true
      }
      const turn = Math.sin(progress * Math.PI)
      this.photoRig.scale.set(this.direction * (1 - turn * 0.035), 1 - turn * 0.045, 1)
      this.photoRig.rotation.z = Math.sin(progress * Math.PI * 2) * 0.025
    }
    if (this.action === 'carry') this.photoRig.rotation.z = Math.sin(phase * 2.25) * 0.035
    if (this.action === 'walk') this.photoRig.rotation.z = Math.sin(phase * 9.2) * 0.008
    if (this.action === 'look') this.photoRig.rotation.y = Math.sin(phase * 1.25) * 0.09
  }

  private chooseBehavior(now: number): void {
    this.nextBehavior = now + 6500 + Math.random() * 9000
    const roll = Math.random()
    if (roll < 0.16 && !this.carrot) {
      this.spawnCarrot(false)
    } else if (roll < 0.34) {
      this.setAction('hop', 1.05)
    } else if (roll < 0.50) {
      this.setAction('groom', 2.8)
    } else if (roll < 0.64) {
      this.setAction('stretch', 2.3)
    } else if (roll < 0.78) {
      this.setAction('look', 2.7)
    } else if (roll < 0.87) {
      this.sleep(5 + Math.random() * 5)
    } else {
      this.targetX = clamp(125 + Math.random() * (innerWidth - 250), 125, innerWidth - 125)
    }
  }

  private setAction(action: Action, duration = 0): void {
    this.action = action
    if (action === 'spin') this.spinFlipped = false
    this.actionStart = performance.now()
    this.actionDuration = duration
    if (action !== 'sleep') this.hideToast()
  }

  private sleep(duration = 0): void {
    this.setAction('sleep', duration)
    this.say('Z z z…', duration > 0 ? duration * 1000 : 0)
    if (duration > 0) {
      window.setTimeout(() => {
        if (this.action === 'sleep') this.setAction('idle')
      }, duration * 1000)
    }
  }

  private spawnCarrot(userInitiated: boolean): void {
    this.removeCarrot()
    if (this.action === 'sleep') this.setAction('idle')
    this.nextBehavior = performance.now() + 9000
    this.carrot = this.buildCarrot()
    this.carrot.visible = false
    const offset = (Math.random() > 0.5 ? 1 : -1) * (105 + Math.random() * 90)
    this.carrotX = clamp(this.x + offset, 58, innerWidth - 58)
    this.carrotY = 7
    this.carrot.position.set(this.carrotX, 7, 0)
    this.carrot.scale.setScalar(0.01)
    this.scene.add(this.carrot)
    this.carrotPhoto.classList.add('show')
    this.carrotHit.classList.add('show')
    const born = performance.now()
    const grow = (): void => {
      if (!this.carrot) return
      const progress = clamp((performance.now() - born) / 330, 0, 1)
      this.carrot.scale.setScalar(easeOutBack(progress))
      if (progress < 1) requestAnimationFrame(grow)
    }
    requestAnimationFrame(grow)
    const approach = this.carrotX >= this.x ? this.carrotX - 82 : this.carrotX + 82
    this.targetX = clamp(approach, 125, innerWidth - 125)
    if (userInitiated) this.say('闻到胡萝卜啦！', 1400)
    this.startCarrotWatch()
  }

  private removeCarrot(): void {
    clearInterval(this.carrotWatchTimer)
    this.carrotWatchTimer = 0
    if (!this.carrot) return
    this.scene.remove(this.carrot)
    this.carrot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) material.dispose()
    })
    this.carrot = null
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
    this.carrot?.position.set(this.carrotX, this.carrotY, 0)
    this.retargetCarrot()
    this.updateDomPositions()
  }

  private finishCarrotDrag(): void {
    this.carrotDown = false
    clearTimeout(this.carrotDragTimer)
    if (!this.carrotDragging) return
    this.carrotDragging = false
    this.carrotY = 7
    this.carrot?.position.set(this.carrotX, this.carrotY, 0)
    this.carrotPhoto.classList.remove('dragging')
    this.carrotHit.classList.remove('dragging')
    this.retargetCarrot()
    this.startCarrotWatch()
    this.say('放这里吗？马上来！', 1000)
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
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
      this.x = clamp(event.clientX, 125, innerWidth - 125)
      this.y = clamp(innerHeight - event.clientY - 75, FLOOR_Y + 18, STAGE_HEIGHT - 106)
      this.targetX = this.x
      this.moveHand(event.clientX, event.clientY - CARRY_HAND_OFFSET)
    }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
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
    this.setAction('carry')
    this.hand.src = handCarryCute
    this.hand.className = 'carry'
    this.moveHand(x, y - CARRY_HAND_OFFSET)
    this.say('轻一点呀！', 1100)
  }

  private endTouch(message: string): void {
    this.hand.className = ''
    this.setAction('idle')
    this.say(message, 1100)
  }

  private endCarry(): void {
    this.hand.className = ''
    this.y = FLOOR_Y
    this.setAction('hop', 0.72)
    this.targetX = this.x
    this.saveState()
    this.say('放稳啦', 900)
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
      this.targetX = clamp(this.x + this.direction * 180, 125, innerWidth - 125)
      this.say('醒啦！', 900)
    }
    if (action === 'hat') {
      this.hatOn = !this.hatOn
      this.currentTextureKey = ''
      this.saveState()
      this.say(this.hatOn ? '小草帽戴好啦 👒' : '先摘下来透透气', 1100)
    }
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
    this.toast.style.bottom = `${screenBottom + 148}px`
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
        this.hatOn = saved.hat !== false
      }
    } catch { /* A corrupt preference should not prevent the pet from loading. */ }
  }

  private saveState(): void {
    try {
      const value: SavedState = { xRatio: clamp(this.x / innerWidth, 0, 1), hat: this.hatOn }
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
  }, 'rabbit-pet: articulated photoreal 2.5D desktop companion')
}
