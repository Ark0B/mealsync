# Sprint 4 — Feedback, committee, reports, change requests (Week 5)

**Status: DRAFT**

## Planning
**Goal:** close the feedback loop (complaints → resolution, ratings → menu polls → menu) and give the mess office reports.
**Committed:** US-21 … US-28 (21 points) + CR-002 (day-scholar lunch + snacks plan).

| Task | Owner | Files |
|---|---|---|
| Complaint state machine | Tarun | `services/complaints.service.js` |
| Ratings (served meals only) + summary | Tarun | `services/ratings.service.js` |
| Polls (one vote) + menu editor | Tarun | `services/polls.service.js`, `menu.service.js` |
| Cancellation workflow + refunds | Arkodyuti | `subscriptions.service.js` |
| Monthly summary, CSV export (formula-injection safe), fraud signals, audit log | Arkodyuti | `reports.service.js`, `audit.service.js` |
| Manager dashboard, committee page | Sania | `public/manager.html`, `committee.html` |
| OpenAPI spec + Swagger UI | Tarun | `docs/openapi.yaml` |
| Tests: community + reports integration; coverage ≥ 80 % | Arkodyuti | `tests/integration/community.test.js`, `reports.test.js` |
| CR-002 (new plan as data) | Ananya → Tarun | `src/db/seedData.js` |

## Review (draft)
Demo: complaint → manager escalates → committee resolves with a note → student sees it. Committee poll → students vote once → committee edits the menu. Manager downloads the meal log CSV and opens it in Excel. Fraud report shows the student who tried a second plate three times.

## Retrospective (fill in)
- Went well:
- Improve:
- Actions:
