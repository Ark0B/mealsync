# CR-001 — Late-plate reservations

| | |
|---|---|
| Status | **Accepted → Implemented** (Sprint 3) |
| Requested by | Mess committee *(scenario; confirm with the real committee and record the date)* |
| Affects | SRS (new FR-33, FR-34), schema (`late_plates`), `meals.service.js`, `scans.service.js`, student UI, tests |

## Request
"Students who come back late from labs or sports find the food finished. Let them reserve a plate."

## Current baseline
SRS 1.0 has no late plates. The scanner refuses everyone outside the serving window.

## Impact analysis
| Area | Change | Effort |
|---|---|---|
| Requirements | Add FR-33 (request rules) and FR-34 (grace period at the counter) | Ananya, 0.5 h |
| Data | New table `late_plates` with UNIQUE (user, date, meal) | Tarun, 0.5 h |
| Code | `createLatePlate`, `myLatePlates`; scan window extended by `late_plate_grace_minutes` when a late plate exists; headcount shows late plates | Tarun, 3 h |
| Settings | New rule `late_plate_grace_minutes` (default 60, range 0–180) | 0.5 h |
| UI | "Late" button in the skip grid | Sania, 1 h |
| Tests | Entitlement, skip conflict, duplicate, after-meal refusal, grace allows, grace expiry refuses | Arkodyuti, 2 h |
| Risk | Students might reserve every meal "just in case" → kitchen keeps food aside. Mitigation: headcount shows the late-plate count; can be limited later | — |

**Estimate:** 3 story points. **Schedule impact:** fits Sprint 3 without dropping a Must story.

## Decision
Accepted at CCB #1 (M04). Implemented in Sprint 3. Tests: `tests/integration/meals.test.js` ("late plates"), `tests/integration/scans.test.js` ("late plate holders…").
