import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

// Production SSR check, localhost only; intentionally no provider key or calls.
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: '0', NUXT_PUBLIC_GEOAPIFY_API_KEY: '', NUXT_PUBLIC_GEOAPIFY_MAP_STYLE: '' },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})
try {
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SSR startup timed out')), 20000)
    let output = ''
    server.stdout.on('data', chunk => {
      output += chunk.toString()
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)
      if (match) { clearTimeout(timer); resolve(match[0]) }
    })
    server.on('error', () => { clearTimeout(timer); reject(new Error('SSR process failed to start')) })
    server.on('exit', code => { clearTimeout(timer); reject(new Error(`SSR exited before readiness: ${code}`)) })
  })
  for (const path of ['/login', '/register', '/passenger/map', '/driver/current-trip', '/lgu/live-mobility']) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
    assert.ok([200, 301, 302, 303, 307, 308].includes(response.status), `${path}: ${response.status}`)
    if (path === '/login' || path === '/register') {
      assert.equal(response.status, 200)
      assert.match(await response.text(), /<html/)
    }
    console.log(`ok - missing-key SSR ${path}: ${response.status}`)
  }
} finally {
  server.kill()
}
