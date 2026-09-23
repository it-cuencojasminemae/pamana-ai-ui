'use strict';
// Workspace regression only: reads backend connection settings without copying
// credentials into frontend config. No migrations, startup, writes or fixtures.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { connect, snapshot, manifest, rowData } = require('../../pamana-backend/scripts/seed-phase5b-transfer-research');

(async () => {
  const client = await connect();
  try {
    await client.query('begin read only');
    for (const [table, key, records] of [
      ['transport_nodes', 'node_code', manifest.nodes], ['routes', 'route_code', manifest.routes], ['route_variants', 'variant_code', manifest.variants],
    ]) {
      for (const record of records) {
        const result = await client.query(`select * from ${table} where ${key} = $1`, [record[key]]);
        assert.equal(result.rows.length, 1);
        for (const [field, value] of Object.entries(rowData(record, table))) assert.deepEqual(result.rows[0][field], value);
      }
      const enabled = await client.query(`select count(*)::int as count from ${table} where planning_enabled is true`);
      assert.equal(enabled.rows[0].count, 0);
    }
    const endpoints = await client.query("select latitude, longitude, planning_enabled, verification_status, data_mode from transport_nodes where node_code = any($1::text[])", [['RCH-SM-PAMPANGA-MAIN-GATE-DROPOFF', 'RCH-ROB-STARMILLS-ARAYAT-GATE-LOAD']]);
    assert.equal(endpoints.rows.length, 2);
    for (const row of endpoints.rows) assert.deepEqual(row, { latitude: null, longitude: null, planning_enabled: false, verification_status: 'CORROBORATED_RESEARCH', data_mode: 'REAL' });
    const state = await snapshot(client);
    for (const table of ['fare_rules', 'service_patterns', 'route_variant_stops']) assert.equal(state[table].length, 0);
    console.log('ok - read-only Phase 6 check: Phase 5B records unchanged, no transport geometry/coordinates or planning activation');
    console.log('Transport row digest: ' + crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex'));
  } finally {
    await client.query('rollback');
    await client.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
