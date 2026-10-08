# San Juan roadside boarding correction

Follow-up UI update: at the user's request, all visible “Research Preview” labels were removed from the Trip Planner form, route cards, Live Map banner, and roadside popup. The screenshots below record the earlier routing acceptance before that text-only update. Routing permissions and evidence handling remain intact; 34 targeted frontend tests passed after removing the labels.

Verified on 2026-10-08 in the actual Passenger Trip Planner, using the signed-in Passenger account in the Codex in-app browser. The requested desktop viewport was 1440 × 1050 and mobile viewport 390 × 844; browser zoom produced smaller CSS viewport dimensions. Neither layout had horizontal document overflow.

## Actual before/after result

Request: Research Preview, AUTO, regular fare, origin **15.126596409675953, 120.69877588559318**, destination **JBL**. The saved URL retains the full-precision origin. Automated request/geometry assertions also verify full precision.

| Passenger fact | Before | After recommended | After direct SM alternative |
|---|---|---|---|
| Boarding | PSU Mexico frontage | Temporary San Juan main-road roadside pickup | Temporary San Juan main-road roadside pickup |
| Provider pedestrian access | 180 m to PSU | 9 m, “Walk east” | 9 m, “Walk east” |
| First outbound service | San Juan → SM Pampanga | San Juan → Mexico Bayan | San Juan → SM Pampanga |
| Remaining journey | Transfer to Palengke jeep; final walk to JBL | Mexico Bayan transfer to Palengke jeep; final walk to JBL | SM terminal pedestrian transfer to Palengke jeep; final walk to JBL |
| Displayed estimated fare | ₱42 | ₱39 = ₱21 + ₱18 | ₱42 = ₱27 + ₱15 |
| Vehicle transfers | 1 | 1 | 1 |
| Total walking | 689 m | 126 m | 518 m |

Both requested notices are removed. The form retains a compact Research Preview badge, and research/simulated labels remain on route cards. Roadside instructions explicitly separate walking, waiting, and boarding. The cyan roadside marker and popup distinguish temporary pickup from permanent terminals and show service direction and local placement caution. Mobile selection between the Mexico and SM services updated the route details successfully. The mobile roadside popup was expanded so its service and caution are fully visible without overlap with the legend.

Five current cards represent different fares/drop-off choices, rather than duplicate cards caused solely by nearby boarding locations. The ₱37 Mexico option uses an earlier drop-off with 1109 m total walking; the ₱41 SM option similarly uses an earlier drop-off. The ₱45 SM option uses the Palengke/SM Downtown drop-off and a different final walk. The shorter-walk recommended option remains available alongside cheaper alternatives.

## Implementation and limits

The two outbound boarding permissions are LOCAL_RESEARCH and service/direction specific, based on the user's explicit confirmation. They cover the reviewed San Juan part of the existing road geometry. The Mexico manifest reuses the already reviewed direct-SM corridor prefix, joined at an exact shared coordinate; no automobile route was generated to define transit geometry.

Temporary pickup connectors are created in memory for the request. The planner compares permanent stops and multiple nearby corridor positions using provider pedestrian distance and duration. Even a connector within 15 m requires a provider walking result. Failed access, mismatched endpoint snaps, or walking over 1500 m rejects the connector; no straight-line replacement is created. Search radius 1500 m, preferred walking 500 m, and hard maximum 1500 m remain in force. Candidate exploration remains bounded; this is a practical provider-routed comparison, not an exhaustive shortest-path search over every possible roadside point.

Equivalent downstream journeys are compared after fare/service enrichment, selecting the shorter valid access representative while preserving different fares, services, availability and other passenger facts. Permanent PSU and terminal options remain eligible. Existing feeder handling remains available for supported services. Operational mode cannot use the newly reported boarding permission. No database schema, stored transport records, permanent stops, authentication configuration, or Operational eligibility was changed by this correction.

Provider routability does not establish field-verified safety, property access, exact carriageway/boarding side, or a pedestrian crossing. The UI asks passengers to confirm a safe roadside position locally. The synthetic pedestrian fixtures prove fallback and selection behavior; they do not prove field safety. Live screenshot access uses the application's actual pedestrian provider result.

## Verification

- 37 focused backend tests passed across roadside boarding, connected research, and result deduplication. New cases cover the exact pin and arbitrary nearby pins, PSU/terminal selection, missing permission, wrong direction, Operational exclusion, provider failure, bad snap, hard cap, alternative routed access, equivalent boarding choices, and lower-fare/availability differences.
- Backend regressions passed for journey search, walking connectors, fare/service, availability, unified orchestration, disruptions, explanation, performance, recommendations, guide, and local pins/travel time.
- 48 frontend tests passed for connected research, route cards/selection/details, map markers, local pins/travel time, and the guide. The map selection contract passed. The final map popup CSS change was followed by 12 targeted frontend tests and actual mobile visual verification.
- Frontend production build passed. Git diff whitespace checks passed in both repositories.
- Desktop and mobile acceptance used the actual Passenger UI, not a mocked browser fixture. After acceptance and screenshot capture, the production build refreshed the local development session and returned the browser to sign-in; the saved evidence below is from the verified signed-in results.

## Desktop evidence

Before:

![Before: PSU boarding and 180 m access](<E:/Programming Files/Pamana with AI/pamana-frontend/documentation/san-juan-roadside-ui/before-desktop.jpg>)

After:

![After: 9 m roadside access and Mexico Bayan boarding](<E:/Programming Files/Pamana with AI/pamana-frontend/documentation/san-juan-roadside-ui/after-desktop.jpg>)

## Mobile evidence

Before:

![Mobile before](<E:/Programming Files/Pamana with AI/pamana-frontend/documentation/san-juan-roadside-ui/before-mobile.jpg>)

After:

![Mobile after, roadside popup and ordered boarding steps](<E:/Programming Files/Pamana with AI/pamana-frontend/documentation/san-juan-roadside-ui/after-mobile-detail.jpg>)

[Full mobile after capture](<E:/Programming Files/Pamana with AI/pamana-frontend/documentation/san-juan-roadside-ui/after-mobile.jpg>)
