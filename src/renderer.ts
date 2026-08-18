import { apply } from './pet'

declare global {
  interface Window {
    desktopPet: {
      setInteractiveRegions(
        regions: Array<{ x: number; y: number; width: number; height: number }>,
        capture: boolean,
      ): void
      quit(): void
    }
  }
}

const cleanups: Array<() => void> = []

apply({
  effect(setup) {
    const cleanup = setup()
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  },
})

let pointerCaptured = false

function visibleRect(selector: string): { x: number; y: number; width: number; height: number } | null {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) return null
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1) return null
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

function syncInteractiveRegions(): void {
  const regions = [
    visibleRect('#dsh-rabbit-pet-hit'),
    visibleRect('#dsh-rabbit-pet-menu.open'),
    visibleRect('#dsh-rabbit-pet-carrot-hit.show'),
  ].filter((region): region is NonNullable<typeof region> => Boolean(region))
  window.desktopPet.setInteractiveRegions(regions, pointerCaptured)
}

window.addEventListener('pointerdown', () => {
  pointerCaptured = true
  syncInteractiveRegions()
}, true)
window.addEventListener('pointerup', () => {
  pointerCaptured = false
  syncInteractiveRegions()
}, true)
window.addEventListener('pointercancel', () => {
  pointerCaptured = false
  syncInteractiveRegions()
}, true)

const regionTimer = window.setInterval(syncInteractiveRegions, 32)
syncInteractiveRegions()
window.addEventListener('beforeunload', () => {
  clearInterval(regionTimer)
  cleanups.reverse().forEach((cleanup) => cleanup())
})
