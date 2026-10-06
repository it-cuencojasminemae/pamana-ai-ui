// Opt-in sibling-backend authorization regression; no database or network calls.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('backend transport-node permission is Passenger-only rather than public', () => {
  const accessControl = fs.readFileSync(new URL('../../pamana-backend/src/services/security/access-control.js', import.meta.url), 'utf8')
  assert.match(accessControl, /'transport-node'/)
  assert.match(accessControl, /\[ROLE\.PASSENGER\]:[\s\S]*?TRANSPORT_KNOWLEDGE_READ/)
  assert.doesNotMatch(accessControl, /\['Public'\]|Public:\s*\[/)
})
