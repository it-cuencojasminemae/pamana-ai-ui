import test from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer, createSSRApp, h, nextTick, ref, withDirectives } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createRevealDirective, revealElement } from '../app/services/uiMotion.ts'

function surface({ reduced = false, map = false, transform = 'none', top = 0, delay = 0 } = {}) {
  const values = new Map([['opacity', '0.65']])
  const attributes = new Map()
  const listeners = new Map()
  let preferenceListener, observer, stopCount = 0, resolveFinished
  const preference = {
    matches: reduced,
    addEventListener(_, listener) { preferenceListener = listener },
    removeEventListener() { preferenceListener = undefined },
  }
  const view = {
    innerHeight: 800,
    matchMedia: () => preference,
    getComputedStyle: () => ({ opacity: '0.65', transform }),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observer = this }
      observe() { this.connected = true }
      disconnect() { this.connected = false }
    },
  }
  const element = {
    ownerDocument: { defaultView: view },
    style: {
      getPropertyValue: key => values.get(key) || '',
      getPropertyPriority: () => '',
      setProperty: (key, value) => values.set(key, value),
      removeProperty: key => values.delete(key),
    },
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    hasAttribute: key => attributes.has(key),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
    querySelector: () => map ? {} : null,
    getBoundingClientRect: () => ({ top }),
  }
  element.parentElement = { children: [element], closest: () => null }
  const calls = []
  const animate = (_, keyframes, options) => {
    calls.push({ keyframes, options })
    values.set('opacity', '0')
    if (keyframes.transform) values.set('transform', keyframes.transform[0])
    return {
      finished: new Promise(resolve => { resolveFinished = resolve }),
      stop() { stopCount++ },
    }
  }
  return {
    element, animate, calls, values, attributes, listeners,
    start: preset => revealElement(element, { preset, delay }, animate),
    finish: () => resolveFinished(),
    reduce() { preference.matches = true; preferenceListener?.() },
    enter() { observer.callback([{ isIntersecting: true }]) },
    get observer() { return observer },
    get stopCount() { return stopCount },
  }
}

test('server-rendered sections retain visible content without client animation', async () => {
  let reveals = 0
  const directive = createRevealDirective(() => { reveals++; return () => {} })
  const app = createSSRApp({ render: () => withDirectives(h('section', 'Usable before hydration'), [[directive]]) })
  const html = await renderToString(app)
  assert.match(html, /data-pamana-reveal/)
  assert.match(html, /Usable before hydration/)
  assert.doesNotMatch(html, /opacity|transform|hidden/)
  assert.equal(reveals, 0)
})

test('reduced motion skips animation and keeps original styles', () => {
  const ui = surface({ reduced: true })
  ui.start('rise')()
  assert.equal(ui.calls.length, 0)
  assert.equal(ui.values.get('opacity'), '0.65')
  assert.equal(ui.listeners.size, 0)
})

test('map surfaces and existing transforms receive opacity-only motion', () => {
  for (const options of [{ map: true }, { transform: 'matrix(1, 0, 0, 1, 0, -3)' }]) {
    const ui = surface(options), dispose = ui.start('rise')
    assert.deepEqual(ui.calls[0].keyframes, { opacity: [0, 0.65] })
    assert.equal(ui.values.has('transform'), false)
    dispose()
  }
})

test('completion restores authored styles and removes animation resources', async () => {
  const ui = surface({ delay: 9999 }), dispose = ui.start('rise')
  assert.equal(ui.calls[0].options.delay, 0.24)
  ui.finish(); await Promise.resolve()
  assert.equal(ui.values.get('opacity'), '0.65')
  assert.equal(ui.values.has('transform'), false)
  assert.equal(ui.attributes.has('data-pamana-revealing'), false)
  assert.equal(ui.listeners.size, 0)
  dispose()
  assert.equal(ui.stopCount, 1)
})

test('unmount, preference changes, and user interaction cancel safely', () => {
  for (const action of ['unmount', 'reduce', 'focusin', 'pointerdown']) {
    const ui = surface(), dispose = ui.start('rise')
    if (action === 'unmount') dispose()
    else if (action === 'reduce') ui.reduce()
    else ui.listeners.get(action)()
    assert.equal(ui.stopCount, 1, action)
    assert.equal(ui.values.get('opacity'), '0.65', action)
    assert.equal(ui.values.has('transform'), false, action)
    assert.equal(ui.listeners.size, 0, action)
  }
})

test('offscreen content stays visible until entry and observers clean up', () => {
  const ui = surface({ top: 1200 }), dispose = ui.start('rise')
  assert.equal(ui.calls.length, 0)
  assert.equal(ui.values.get('opacity'), '0.65')
  ui.enter()
  assert.equal(ui.calls.length, 1)
  assert.equal(ui.observer.connected, false)
  dispose()
  const abandoned = surface({ top: 1200 }), cancel = abandoned.start('rise')
  cancel(); abandoned.enter()
  assert.equal(abandoned.calls.length, 0)
})

test('animation failure leaves content visible and interactive', () => {
  const ui = surface()
  revealElement(ui.element, {}, () => { throw new Error('Animation unavailable') })
  assert.equal(ui.values.get('opacity'), '0.65')
  assert.equal(ui.attributes.has('data-pamana-revealing'), false)
  assert.equal(ui.listeners.size, 0)
})

test('live updates preserve the same element without replaying entrances', async () => {
  let starts = 0, cleanups = 0
  const directive = createRevealDirective(() => { starts++; return () => { cleanups++ } })
  const value = ref('Fresh'), key = ref('vehicle-1')
  const renderer = createRenderer({
    createElement: () => ({ setAttribute() {} }),
    createText: text => ({ text }), createComment: () => ({}),
    insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null,
    setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text }, patchProp() {},
  })
  const app = renderer.createApp({ render: () => withDirectives(h('article', { key: key.value }, value.value), [[directive]]) })
  app.mount({})
  assert.equal(starts, 1)
  value.value = 'Updated'; await nextTick()
  assert.equal(starts, 1)
  key.value = 'vehicle-2'; await nextTick()
  assert.equal(starts, 2)
  assert.equal(cleanups, 1)
  app.unmount()
  assert.equal(cleanups, 2)
})
