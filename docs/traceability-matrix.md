# Requirements traceability matrix

Owner: Ananya. Forward trace: requirement → story → code → test. Backward trace: every test file maps to at least one requirement below. Updated in every PR that changes behaviour.

| FR | Story | Implementation | Tests |
|---|---|---|---|
| FR-01, FR-02 | US-01 | `auth.service.register` | `auth.test.js` registration block |
| FR-03 | US-02 | `users.service.setStatus` | `auth.test.js` approval workflow; "cannot change their own status" |
| FR-04 | US-03 | `auth.service.login` | `auth.test.js` "login works and wrong password…" |
| FR-05 | US-03 | `middleware/auth.authenticate` | `auth.test.js` "no token → 401…", "rejected student … old token" |
| FR-06 | US-02 | `middleware/auth.requireApproved` | `auth.test.js` "pending student cannot subscribe"; `scans.test.js` "pending students cannot even get a pass" |
| FR-07 | US-02 | `users.service.setCommittee` | `auth.test.js` "committee flag…" |
| FR-08 | US-08 | `users.service.createStaff` | `auth.test.js` "only an admin can create a manager" |
| FR-10 | US-04 | `subscriptions.service.listPlans` | `subscriptions.test.js` plans |
| FR-11 | US-05 | `subscriptions.service.create`, `pricing.proratedPrice` | `subscriptions.test.js` mid-month / next-month / month window; `pricing.test.js` |
| FR-12 | US-05 | overlap query in `create` | `subscriptions.test.js` "overlapping subscriptions are refused" |
| FR-13, FR-14 | US-06 | `payments.service.createOrder/verify/mockCheckout` | `subscriptions.test.js` verification, forged signature, other user's order |
| FR-15 | US-07 | `discardPending` (subscriptions, tokens) | `subscriptions.test.js` discard; `meals.test.js` token rules |
| FR-16, FR-17 | US-28 | `requestCancel`, `decideCancel`, `pricing.cancellationRefund` | `subscriptions.test.js` cancellation block; `pricing.test.js` refunds |
| FR-18 | US-16 | `updatePlan`, `tokens.setPrice` | `subscriptions.test.js` price management |
| FR-20 | US-09 | `utils/passToken.issue`, `GET /pass` | `passToken.test.js` |
| FR-21 | US-10 | `scans.service.scan` (7 checks) | `scans.test.js` (expired, forged, outside hours, no entitlement, skipped, inactive) |
| FR-22 | US-11 | UNIQUE `meal_logs(user_id, meal_date, meal)` + duplicate handling | `scans.test.js` "served once" |
| FR-23 | US-10 | scan response body; `scanner.js` | `scans.test.js` body assertions; browser smoke test |
| FR-24 | US-12 | `scans.logAttempt`, `scan_attempts` | `scans.test.js` "every attempt is logged" |
| FR-25 | US-10 | token → used in scan transaction | `scans.test.js` "with a paid token is served and the token is used" |
| FR-26 | US-13 | manual code box (`scanner.html`) | browser smoke test (manual code path) |
| FR-27 | US-20 | `scanner.js loadHeadcount` | browser smoke test |
| FR-30 | US-14 | `meals.createSkip`, `pricing.skipCredit` | `meals.test.js` skip credit / cut-off; `pricing.test.js` |
| FR-31 | US-15 | `meals.cancelSkip` | `meals.test.js` undo before / after cut-off |
| FR-32 | US-16 | skip limit in `createSkip` | `meals.test.js` "monthly skip limit…" |
| FR-33, FR-34 | US-17 (CR-001) | `meals.createLatePlate`; grace in `scans.scan` | `meals.test.js` late plates; `scans.test.js` grace period |
| FR-35 | US-18 | `tokens.buy` | `meals.test.js` token rules, wallet purchase; `scans.test.js` token serve |
| FR-36 | US-18 | `wallet.service` (ledger) | `meals.test.js` 402 / wallet purchase; `subscriptions.test.js` refund to wallet |
| FR-37 | US-19 | `reports.headcount` | `meals.test.js` kitchen headcount |
| FR-40, FR-41 | US-21, US-22 | `complaints.service` (+ `TRANSITIONS`) | `community.test.js` complaints; `rules.test.js` state machine |
| FR-42 | US-23 | `ratings.service` | `community.test.js` ratings |
| FR-43, FR-44 | US-24 | `polls.service` | `community.test.js` polls |
| FR-45 | US-25 | `menu.service` | `community.test.js` menu |
| FR-50 | US-26 | `reports.summary` | `reports.test.js` monthly summary |
| FR-51 | US-26 | `reports.mealLogCsv` | `reports.test.js` CSV |
| FR-52 | US-27 | `reports.fraudSignals` | `scans.test.js` fraud report |
| FR-53 | US-28 | `audit.service` (called by every office action) | `community.test.js` audit trail; `reports.test.js` setting audit |
| FR-54 | US-16 | `settings.service.update` (`RULES`) | `reports.test.js` settings; `meals.test.js` limit |

| NFR | Evidence |
|---|---|
| NFR-01/02 | `auth.service` (bcrypt 10), `passToken` + `payments` use `timingSafeEqual`; secrets from `.env` |
| NFR-03 | Parameterised SQL everywhere; `utils/validate`; `helmet` CSP in `app.js`; `esc()` in `public/js/api.js`; `express-rate-limit` on auth |
| NFR-04 | `middleware/error.js` + "malformed JSON" test |
| NFR-05 | Indexed scan path; measure on the deployment (record in the test report) |
| NFR-06 | UAT-3 |
| NFR-07 | `db.transaction` around money/entitlement changes; UNIQUE keys (database.md) |
| NFR-08 | Coverage 95.5 % lines; CI |
| NFR-09 | CI SQLite + MySQL jobs |
| NFR-10 | `plans`, `meal_prices`, `settings` tables; CR-002 |
| NFR-11 | `scan_attempts`, `audit_log` |
| NFR-12 | Ownership checks (`user_id = ?`) in services; `/complaints` limited to committee/office |
