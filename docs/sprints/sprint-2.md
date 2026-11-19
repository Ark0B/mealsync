# Sprint 2 — Rotating pass and counter scanner (Week 3)

**Status: DRAFT**

## Planning
**Goal:** counter staff can verify a student's pass and serve them exactly once per meal.
**Committed:** US-09 … US-13 (19 points).

| Task | Owner | Files |
|---|---|---|
| Pass token design + ADR-0005 | Arkodyuti | `utils/passToken.js`, `docs/adr/0005-rotating-qr-pass.md` |
| IST time helpers, single clock | Arkodyuti | `utils/time.js`, `utils/clock.js` |
| meal_logs + scan_attempts schema, UNIQUE guard | Tarun | schema |
| Scan service (7 checks) | Tarun | `services/scans.service.js` |
| Student pass tab (QR + countdown + manual code) | Sania | `public/js/student.js` |
| Scanner page (camera, manual code, beep, big result) | Sania, Tarun | `public/scanner.html`, `public/js/scanner.js` |
| Tests: pass token unit, scan integration (screenshot, forgery, double serve, window) | Sania | `tests/unit/passToken.test.js`, `tests/integration/scans.test.js` |

## Review (draft)
Demo: student pass on phone → staff scans → SERVE (VEG ONLY) → scan again → DO NOT SERVE, already served at hh:mm → wait 61 s with an old screenshot → expired.
**Usability check to do at the review:** time 10 consecutive scans with a teammate playing staff. Target ≤ 3 s each.

## Retrospective (fill in)
- Went well:
- Improve:
- Actions:
