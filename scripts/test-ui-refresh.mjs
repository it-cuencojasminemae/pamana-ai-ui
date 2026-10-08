import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function home({ initialized = false, authenticated = false, route = '/passenger', restoredAuth = authenticated } = {}) {
  let mounted, restores = 0
  const navigations = []
  const auth = { initialized: Vue.ref(initialized), isAuthenticated: Vue.ref(authenticated),
    async restoreSession() { restores++; auth.initialized.value = true; auth.isAuthenticated.value = restoredAuth },
    getRoleHomeRoute: () => route }
  const context = { ...Vue, definePageMeta() {}, useHead() {}, useAuth: () => auth,
    onMounted: callback => { mounted = callback }, navigateTo: async url => { navigations.push(url) } }
  const source = stripTypeScriptTypes(parse(read('app/pages/index.vue')).descriptor.scriptSetup.content)
  vm.runInNewContext(`${source}\nstate={sessionReady}`, context)
  return { state: context.state, mount: () => mounted(), navigations, restores: () => restores }
}

test('home waits for session restoration and shows the landing page to guests', async () => {
  const page = home()
  assert.equal(page.state.sessionReady.value, false)
  await page.mount()
  assert.equal(page.restores(), 1)
  assert.equal(page.state.sessionReady.value, true)
  assert.deepEqual(page.navigations, [])
})

test('home retains all role-dashboard redirects after session restoration', async () => {
  for (const route of ['/passenger', '/driver', '/lgu', '/admin']) {
    const page = home({ route, restoredAuth: true })
    await page.mount()
    assert.equal(page.restores(), 1)
    assert.equal(page.state.sessionReady.value, false, 'do not flash guest content before redirect')
    assert.deepEqual(page.navigations, [route])
  }
})

test('home uses an already restored session without another request', async () => {
  const page = home({ initialized: true, authenticated: true, route: '/driver' })
  await page.mount()
  assert.equal(page.restores(), 0)
  assert.deepEqual(page.navigations, ['/driver'])
})

test('refreshed pages and shared map/navigation compile with current interfaces', () => {
  for (const file of ['app/pages/index.vue', 'app/pages/login.vue', 'app/pages/register.vue', 'app/layouts/default.vue', 'app/pages/admin/users.vue', 'app/components/PamanaMapLibreMap.vue', 'app/pages/passenger/trip-planner.vue']) {
    const { descriptor, errors } = parse(read(file), { filename: file })
    assert.deepEqual(errors, [], file)
    const script = compileScript(descriptor, { id: file })
    const template = compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [], file)
  }
})
