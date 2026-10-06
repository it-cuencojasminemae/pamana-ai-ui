import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
// Include new Node regression files by default; integration and production
// smoke tests have separate entry points with explicit prerequisites.
const excluded = new Set(['test-phase-6-smoke.mjs'])
const files = fs.readdirSync(new URL('./', import.meta.url))
  .filter(file => /^test-.*\.mjs$/.test(file) && !file.startsWith('test-integration-') && !excluded.has(file))
  .sort().map(file => `scripts/${file}`)
for (const args of [['--test', ...files], ['scripts/test-trip-planner-selection-contract.cjs']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
