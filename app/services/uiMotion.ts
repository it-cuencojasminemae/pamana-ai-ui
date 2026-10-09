import { animate } from 'motion-v'
import type { ObjectDirective } from 'vue'

export type RevealPreset = 'rise' | 'fade' | 'panel'
export type RevealOptions = { preset?: RevealPreset; delay?: number }

export const motionTiming = {
  entrance: 0.32,
  panel: 0.2,
  stagger: 40,
  maxDelay: 240,
  distance: 12,
} as const

/** Decorate an existing element without changing its layout, events or state. */
export function revealElement(
  element: HTMLElement,
  options: RevealOptions = {},
  animateElement: typeof animate = animate,
): () => void {
  const view = element.ownerDocument.defaultView
  if (!view || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  // A section and its nested cards should not enter on top of each other.
  if (element.parentElement?.closest('[data-pamana-revealing]')
    || options.preset !== 'panel' && element.parentElement?.closest('[data-pamana-reveal]')) return () => {}

  const preference = view.matchMedia('(prefers-reduced-motion: reduce)')
  const saved = ['opacity', 'transform'].map(property => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }))
  let controls: ReturnType<typeof animate> | undefined
  let observer: IntersectionObserver | undefined
  let disposed = false

  const restore = () => {
    for (const { property, value, priority } of saved) {
      if (value) element.style.setProperty(property, value, priority)
      else element.style.removeProperty(property)
    }
    element.removeAttribute('data-pamana-revealing')
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    observer?.disconnect()
    preference.removeEventListener('change', onPreferenceChange)
    element.removeEventListener('focusin', dispose)
    element.removeEventListener('pointerdown', dispose)
    try { controls?.stop() } finally { restore() }
  }
  const onPreferenceChange = () => { if (preference.matches) dispose() }
  const start = () => {
    if (disposed || preference.matches) { dispose(); return }
    observer?.disconnect()
    // Maps and pre-transformed surfaces must retain their coordinate systems.
    const preset = options.preset ?? 'rise'
    const fadeOnly = preset === 'fade' || Boolean(element.querySelector('canvas, .maplibregl-map'))
      || view.getComputedStyle(element).transform !== 'none'
    const opacity = view.getComputedStyle(element).opacity || '1'
    const siblings = Array.from(element.parentElement?.children ?? [])
      .filter(sibling => sibling.hasAttribute('data-pamana-reveal'))
    const ordinal = Math.max(0, siblings.indexOf(element))
    const delay = Math.min(motionTiming.maxDelay, Math.max(0, options.delay ?? ordinal * motionTiming.stagger)) / 1000
    element.setAttribute('data-pamana-revealing', '')
    try {
      controls = animateElement(element, {
        opacity: [0, Number(opacity)],
        ...(fadeOnly ? {} : { transform: [`translateY(${preset === 'panel' ? 6 : motionTiming.distance}px)`, 'translateY(0px)'] }),
      }, {
        duration: preset === 'panel' ? motionTiming.panel : motionTiming.entrance,
        delay: preset === 'panel' ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      })
      void controls.finished.then(dispose, dispose)
    } catch {
      // Decorative motion must never leave usable content hidden on failure.
      dispose()
    }
  }

  preference.addEventListener('change', onPreferenceChange)
  // A focused or pressed control becomes immediately stable and fully visible.
  element.addEventListener('focusin', dispose)
  element.addEventListener('pointerdown', dispose)
  const bounds = element.getBoundingClientRect()
  if (options.preset !== 'panel' && bounds.top >= view.innerHeight && view.IntersectionObserver) {
    observer = new view.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) start()
    }, { threshold: 0.05 })
    observer.observe(element)
  } else start()
  return dispose
}

export function createRevealDirective(reveal = revealElement): ObjectDirective<HTMLElement, RevealOptions | undefined> {
  const cleanups = new WeakMap<HTMLElement, () => void>()
  return {
    getSSRProps: () => ({ 'data-pamana-reveal': '' }),
    beforeMount(element) { element.setAttribute('data-pamana-reveal', '') },
    mounted(element, binding) { cleanups.set(element, reveal(element, binding.value)) },
    beforeUnmount(element) {
      cleanups.get(element)?.()
      cleanups.delete(element)
    },
    // No updated hook: polling and reactive edits never replay motion.
  }
}
