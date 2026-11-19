# Sprint 1 — Accounts, plans, subscriptions, verified payments (Week 2)

**Status: DRAFT**

## Planning
**Goal:** a student can register, be approved, subscribe and pay, and the payment is verified by the system.
**Committed:** US-01 … US-08 (21 points).

| Task | Owner | Files |
|---|---|---|
| Schema: users, plans, payments, subscriptions, audit_log | Tarun | `database/schema.mysql.sql` |
| DB adapter (MySQL + SQLite) | Tarun | `src/db/index.js` |
| Register / login / me, bcrypt + JWT | Tarun | `services/auth.service.js` |
| authenticate / authorise / requireApproved | Arkodyuti | `middleware/auth.js` |
| Approvals, staff creation, committee flag | Tarun | `services/users.service.js` |
| Plans, pro-rating, overlap rule | Tarun | `services/subscriptions.service.js`, `utils/pricing.js` |
| Order + signature verification + mock gateway | Arkodyuti | `services/payments.service.js` |
| Login/register page, subscription tab | Sania | `public/index.html`, `public/js/student.js` |
| Tests: auth + subscription integration, pricing unit | Sania | `tests/integration/auth.test.js`, `subscriptions.test.js`, `tests/unit/pricing.test.js` |

## Review (draft)
Demo script: register `R-100` → log in as manager → approve → subscribe mid-month (amount checks out) → pay via mock gateway → status active → try a forged signature → refused.
Acceptance: FR-01 … FR-15, FR-08 pass in CI.

## Retrospective (fill in)
- Went well:
- Improve:
- Actions:
