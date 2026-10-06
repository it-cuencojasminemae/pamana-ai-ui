# Portable frontend contract checkpoints

These fixtures contain transport data only, with no accounts, cookies, tokens,
provider credentials or connection strings. They are regression inputs, not
evidence of a current live database, deployed authentication or provider call.

- `batch-a-fares.json`: captured on 2026-10-06 from the sibling backend's
  synthetic direct/transfer networks with injected walking and data services.
  Covers unavailable distance, the PHP 22 modern-jeep fare, and a PHP 100 demo
  tricycle plus an unknown jeep fare. No network or database was accessed.
- `passenger-route-options.json`: projected category/response fields from the
  2026-10-05 Batch B Passenger API checkpoint. Contains eight regular/student
  requests, approved geometry, integer fares and server recommendation IDs.
  The same pilot cases support Batch A5B geometry and fare assertions.
- `pilot-map-expectations.json`: projected transport nodes and independently
  recorded approved geometry. The backend's expectation helper verified the
  original approved geometry files against their manifest SHA-256 hashes
  before capture. Tests compare API coordinates with these fixed expectations.
- `missing-transit-geometry.json`: five earlier Phase 24 acceptance responses,
  projected from the local acceptance capture. Walking geometry is present;
  unknown transit geometry must stay absent from the rendered map.
- `empty-recommendations.json`: the backend's no-journey recommendation DTO.

To advance a checkpoint, review a backend contract change, capture transport-only
responses and independently verified expectations, then review the fixture diff.
Do not regenerate fixtures from the frontend implementation just to pass tests.
For current backend behavior use `npm run test:integration:backend`. Database
regressions remain separate and require the backend installation and credentials;
see `documentation/vercel-deployment.md`.
