# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0]
### Added
- Student self-registration with mess-office approval; roles: student, committee (flag), staff, manager, admin.
- Monthly plans for hostellers and day scholars; pro-rated mid-month subscriptions; overlap protection.
- Gateway-style payment verification (order → signature) with a mock gateway for development.
- Rotating 30-second signed QR meal pass; counter scanner with camera and manual-code fallback; one plate per student per meal; scan audit trail.
- Meal skips with wallet credit, undo before cut-off, monthly limit; late plates with a grace period (CR-001); pay-per-meal tokens via gateway or wallet.
- Kitchen headcount per meal (veg / non-veg split).
- Complaints with a tracked workflow and committee escalation; meal ratings; committee polls (one vote each); weekly menu editor.
- Cancellation requests with manager approval and pro-rated refunds to the wallet.
- Monthly summary, Excel-compatible CSV export (formula-injection safe), fraud signals, audit log, editable rules and prices.
- Day-scholar lunch + snacks plan (CR-002).
- OpenAPI 3 spec served at `/api-docs`; CI on SQLite and MySQL 8.

### Security
- bcrypt password hashing, JWT auth with per-request role/status reload, Helmet CSP (no inline scripts), login rate limiting, constant-time signature checks, parameterised SQL, output escaping.

### Deferred
- Guest meal passes (CR-003) → 1.1.
