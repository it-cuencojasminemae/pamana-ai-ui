'use strict';
// Workspace regression only: reads backend connection settings without copying
// credentials into frontend config. No migrations, startup, writes or fixtures.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { connect, snapshot } = require('../../pamana-backend/scripts/seed-phase5b-transfer-research');
const { manifest } = require('../../pamana-backend/scripts/activate-pilot-field-verified');

const EXPECTED_DIGEST = '3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139';

(async () => {
  const client = await connect();
  try {
    await client.query('begin read only');
    const nodeCodes = manifest.nodes.map((item) => item.node_code);
    const nodes = await client.query("select latitude, longitude, planning_enabled, verification_status, data_mode from transport_nodes where node_code = any($1::text[])", [nodeCodes]);
    assert.equal(nodes.rows.length, 4);
    for (const row of nodes.rows) {
      assert.notEqual(row.latitude, null);
      assert.notEqual(row.longitude, null);
      assert.equal(row.planning_enabled, true);
      assert.equal(row.verification_status, 'FIELD_VERIFIED');
      assert.equal(row.data_mode, 'REAL');
    }
    const variants = await client.query("select encoded_polyline, geometry_geojson, planning_enabled, verification_status from route_variants where variant_code = any($1::text[])", [manifest.variants.map((item) => item.variant_code)]);
    assert.equal(variants.rows.length, 4);
    assert.ok(variants.rows.every((row) => row.planning_enabled && row.verification_status === 'FIELD_VERIFIED'
      && row.encoded_polyline === null && row.geometry_geojson === null));
    const state = await snapshot(client);
    assert.equal(state.fare_rules.length, 2);
    assert.equal(state.service_patterns.length, 0);
    assert.equal(state.route_variant_stops.length, 8);
    const digest = crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
    assert.equal(digest, EXPECTED_DIGEST);
    console.log('ok - read-only frontend DB check: exact pilot counts, planning trust and null transit geometry');
    console.log('Transport row digest: ' + digest);
  } finally {
    await client.query('rollback');
    await client.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
