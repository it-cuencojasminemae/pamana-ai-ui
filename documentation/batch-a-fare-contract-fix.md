# Batch A fare-response compatibility fix

The Passenger planner's red "PAMANA returned an incomplete response" error was caused by a contract mismatch. The backend now returns `fare.status: FARE_DISTANCE_UNAVAILABLE` for eligible jeepney legs with missing road distances. The frontend Zod validator only accepted KNOWN, PARTIAL, UNKNOWN and NOT_APPLICABLE, so it rejected an otherwise complete journey as INVALID_RESPONSE.

The frontend fare status type and validator now accept the new status. It is deliberately confined to fares; service statuses and the other response checks remain unchanged. Optional Batch A source/calculation/demo metadata and road-distance provenance are typed and validated, preserving compatibility with older payloads. The explanation adapter forwards the supplied fare provenance without calculating any fare.

Changed files:

- `app/services/tripPlanContract.ts`
- `app/types/tripPlan.ts`
- `app/services/journeyExplanation.ts`
- `scripts/test-batch-a-contract.mjs`
- `package.json`
- `documentation/batch-a-fare-contract-fix.md`

The previously modified `nuxt.config.ts` was left untouched. No Passenger page/component layout, MapLibre implementation, geocoding, camera/current-location behavior or planning eligibility was changed. Batch B/C remain outside scope. No commits or pushes.

Validation: 26 tests passed across the new backend-to-frontend contract suite and frontend phases 15, 20 and 24. The new suite runs the actual backend journey orchestrator with in-memory transport fixtures and a mocked walking router; it covers unavailable fare distance, a calculated integer fare, the narrowly scoped demo tricycle subtotal, source preservation and continued rejection of malformed payloads. A fresh Phase 24 Strapi integration run also passed and exported five current real-loader responses; the frontend acceptance tests validated them. Transport database counts and digest stayed unchanged.

`npm run build` completed successfully for the frontend, including client, SSR and Nitro output. `git diff --check` passed.

Unavailable road distance remains a fare limitation: journeys can render, but the client cannot invent a numeric jeep fare or a complete total. The existing cards display unavailable fare information, while the demo tricycle estimate remains PHP 100.
