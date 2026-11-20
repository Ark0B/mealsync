# Sprint 3 — Skips, late plates, tokens, wallet, headcount (Week 4)

**Status: DRAFT**

## Planning
**Goal:** students stop losing money on missed meals, and the kitchen knows how many plates to cook.
**Committed:** US-14 … US-20 (21 points), including CR-001 (late plates), accepted at the CCB meeting.

| Task | Owner | Files |
|---|---|---|
| Settings table + validation ranges | Tarun | `services/settings.service.js` |
| Skip / undo / limit, credit formula | Tarun | `services/meals.service.js`, `utils/pricing.js` |
| Wallet as a ledger (derived balance) | Arkodyuti | `services/wallet.service.js` |
| Late plates + grace at the scanner (CR-001) | Tarun | `meals.service.js`, `scans.service.js` |
| Tokens via gateway or wallet | Tarun | `services/tokens.service.js` |
| Headcount (veg / non-veg split) | Arkodyuti | `services/reports.service.js` |
| Skip grid, tokens tab, wallet tab, headcount on scanner | Sania | `public/js/student.js`, `scanner.js` |
| Tests: meals integration, headcount numbers | Arkodyuti | `tests/integration/meals.test.js` |

## Review (draft)
Demo: skip tomorrow's lunch → ₹18.00 credit → headcount for tomorrow's lunch drops by one → buy a dinner token with the credit as a day scholar → after-cutoff skip refused with the cut-off time.

## Retrospective (fill in)
- Went well:
- Improve:
- Actions:
