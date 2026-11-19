# MealSync

**Mess management without the paper card.** MealSync replaces a university mess's handwritten monthly cards, registers, Excel sheets, Google Forms and "show me your payment screenshot" checks with one connected system:

| Problem today | MealSync |
|---|---|
| Paper card, checked only "if and when asked"; workers rely on remembering faces | **Rotating signed QR pass** (changes every 30 s), scanned at the counter. Screenshots expire, passes can't be shared or forged. |
| Payment proved by showing a UPI screenshot to the server | **Server-verified payments** (Razorpay-style order + HMAC signature). Nothing activates without a verified payment. |
| One person can eat twice (or lend their card) | Database guarantees **one plate per student per meal**; every refused scan is logged and surfaced as a **fraud signal**. |
| Missed meal = money and food wasted | **Skip a meal before the cut-off** → part of its cost is credited to a wallet, and the kitchen gets a **live headcount** per meal (veg / non-veg). |
| Late = maybe no food | **Late-plate reservations** with a grace period at the counter. |
| Registration, re-registration, cancellation by Google Forms and email | In-app requests approved by the mess manager; pro-rated refunds to the wallet. |
| Complaint register nobody uses; WhatsApp polls for the menu | Tracked **complaint tickets** (open → in progress → escalated → resolved), **meal ratings**, **committee polls** and a **menu editor**. |
| Excel for everything | Monthly **reports**, **CSV export** that opens in Excel, full **audit log**. |

Day-scholar plans, veg / non-veg plans and pay-per-meal tokens are all supported, and every price and rule is editable by the mess office.

---

## Quick start (zero setup — SQLite)

Requirements: **Node.js 22.13 or newer** (uses the built-in `node:sqlite`).

**In WebStorm / any JetBrains IDE:** *File → Open* the `mealsync` folder → when prompted, click **Run 'npm install'** → open the **npm** tool window (right-click `package.json` → *Show npm Scripts*) → double-click **seed**, then **start**.

From a terminal it is the same three commands:

```bash
npm install
npm run seed      # creates database/mealsync.db with plans, prices, a weekly menu and demo users
npm start         # http://localhost:3000   ·   API docs: http://localhost:3000/api-docs
```

Demo accounts (password **`MealSync@123`**):

| Email | Role | Try |
|---|---|---|
| `aman@mealsync.local` | Hosteller (non-veg) | subscribe → pay → show pass, skip a meal, buy a token with wallet credit |
| `neha@mealsync.local` | Day scholar | day-scholar plans, pay-per-meal tokens |
| `committee@mealsync.local` | Student on the mess committee | polls, menu editor, escalated complaints |
| `kabir@mealsync.local` | Pending registration | blocked until the manager approves |
| `staff@mealsync.local` | Counter staff | scanner (camera or paste the code shown under the QR) |
| `manager@mealsync.local` | Mess manager | approvals, cancellations, headcount, reports, prices & rules |
| `admin@mealsync.local` | Admin | everything the manager can, plus creating manager accounts |

> The camera scanner needs HTTPS or `localhost`. For a demo on one laptop, open the student pass in one browser window and paste its "manual code" into the scanner in another.

## Tests

```bash
npm test               # 128 tests (unit + API integration) on an in-memory database
npm run test:coverage  # with coverage report in coverage/
```

GitHub Actions runs the suite on **SQLite and on a real MySQL 8** for every push and pull request (`.github/workflows/ci.yml`). Latest results: [`docs/07-test-report.md`](docs/07-test-report.md).

## Production database (MySQL)

```bash
# create an empty database and user first (MySQL Workbench or the mysql shell), then in .env:
DB_CLIENT=mysql
DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=mealsync
npm run seed           # applies database/schema.mysql.sql and loads reference data
```

`database/schema.mysql.sql` is the single source of truth; the SQLite dev database is generated from it automatically. See [`docs/database.md`](docs/database.md) for the ER diagram and data dictionary and [`docs/11-deployment.md`](docs/11-deployment.md) for hosting.

## Tech stack

Plain HTML/CSS/JavaScript front end · Node.js + Express 4 (layered: routes → controllers → services → database adapter) · MySQL 8 (SQLite for dev/tests) · JWT + bcrypt · Helmet, CORS, rate limiting · Jest + Supertest · OpenAPI 3 / Swagger UI · GitHub Actions. Reasons for each choice: [`docs/adr/`](docs/adr).

## Repository map

```
src/
  app.js, server.js          Express app (no listen) and entry point
  config/                    all settings, overridable from .env
  db/                        database adapter (MySQL | SQLite), schema init, seed data
  middleware/                authenticate / authorise, central error handler
  routes/index.js            every API route and who may call it
  controllers/               HTTP <-> service translation only
  services/                  business rules + SQL (one file per module)
  utils/                     pass tokens, pricing, IST time, validation, errors
public/                      student, scanner, manager and committee pages
database/schema.mysql.sql    canonical schema
tests/unit, tests/integration
docs/                        the full software-engineering record (below)
```

## Engineering documentation

| Phase | Document |
|---|---|
| Charter, team roles, process model | [`docs/00-project-charter.md`](docs/00-project-charter.md) |
| Product discovery | [`docs/01-discovery/`](docs/01-discovery) |
| Requirements (IEEE 830 SRS) | [`docs/02-srs.md`](docs/02-srs.md) |
| Analysis (use cases, DFDs, ER) | [`docs/03-analysis.md`](docs/03-analysis.md), [`docs/database.md`](docs/database.md) |
| Design (UML, state machines, security) | [`docs/04-design.md`](docs/04-design.md) |
| Architecture + decisions | [`docs/05-architecture.md`](docs/05-architecture.md), [`docs/adr/`](docs/adr) |
| Sprints and meetings | [`docs/sprints/`](docs/sprints), [`docs/meetings/`](docs/meetings) |
| Testing | [`docs/06-test-plan.md`](docs/06-test-plan.md), [`docs/07-test-report.md`](docs/07-test-report.md) |
| Configuration & change management | [`docs/08-configuration-and-change-management.md`](docs/08-configuration-and-change-management.md), [`docs/change-requests/`](docs/change-requests) |
| Release | [`docs/09-release-plan.md`](docs/09-release-plan.md), [`CHANGELOG.md`](CHANGELOG.md) |
| User manual / deployment | [`docs/10-user-manual.md`](docs/10-user-manual.md), [`docs/11-deployment.md`](docs/11-deployment.md) |
| Requirement → code → test links | [`docs/traceability-matrix.md`](docs/traceability-matrix.md) |
| API reference | [`docs/openapi.yaml`](docs/openapi.yaml) (served at `/api-docs`) |
| Product pitch | [`docs/12-product-pitch.md`](docs/12-product-pitch.md) |

## Team

| Member | Primary roles |
|---|---|
| Arkodyuti Bhattacharyya | Product & Project Lead · Software Architect / Design Lead |
| Tarun | Software Developer / Implementation Lead · DevOps / Configuration & Release Engineer |
| Ananya | Requirements Engineer / SRS Lead · System Analyst |
| Sania | QA / Test Engineer · UX / UI Designer |

Software Engineering Project 2026, South Asian University. Licensed under MIT.
