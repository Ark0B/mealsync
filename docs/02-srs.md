# 02 · Software Requirements Specification — MealSync v1.0

Format follows IEEE 830 / ISO/IEC/IEEE 29148. Owner: Ananya (Requirements Engineer). Changes after the baseline go through change control ([08](08-configuration-and-change-management.md)).

| Version | Change | Approved in |
|---|---|---|
| 1.0 | Baseline | M03 SRS review |
| 1.1 | + FR-33, FR-34 late plates (CR-001); day-scholar lunch + snacks plan added as data (CR-002); guest meals deferred (CR-003) | M04 CCB #1 |

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements of MealSync, a web system for running a university mess. It is the reference for design, implementation, testing and acceptance.

### 1.2 Scope
MealSync manages mess registration, subscriptions and payments, verifies each plate served at the counter, lets students skip meals for credit or reserve late plates, gives the kitchen a headcount, and supports complaints, ratings, menu polls and reporting. See the [charter](00-project-charter.md) for what is out of scope.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Meal codes | **B** breakfast, **L** lunch, **S** snacks, **D** dinner |
| Plan | A monthly offer with a diet (veg / non-veg), a set of meals, and an audience (hosteller / day scholar) |
| Subscription | A student's purchase of a plan for a date range within one calendar month |
| Token | A paid entitlement to one specific meal on one date |
| Entitlement | A subscription or token that allows a student to be served a given meal |
| Pass | A short-lived signed code (shown as a QR) that identifies a student at the counter |
| Skip | An advance opt-out from one meal, which earns wallet credit |
| Late plate | A request to collect a meal after the serving window closes |
| Cut-off | The latest time a meal can be skipped (default 4 h before it starts) |
| Paise | 1/100 rupee; all money is stored in paise |
| IST | Indian Standard Time, UTC+05:30; all meal logic uses IST |

### 1.4 References
Project overview (course), [charter](00-project-charter.md), [as-is analysis](01-discovery/as-is-analysis.md), [analysis models](03-analysis.md), [design](04-design.md).

## 2. Overall description

### 2.1 Product perspective
A stand-alone web application (browser front end + REST API + relational database). It replaces paper cards, registers, Google Forms and screenshot payments. It integrates with a payment gateway through an adapter; in development, a mock gateway implements the same signature scheme.

### 2.2 User classes
| Class | Description | Main pages |
|---|---|---|
| Student (hosteller) | Subscribes monthly, shows pass, skips meals, rates, complains, votes | `student.html` |
| Day scholar | A student with `is_day_scholar = 1`; sees day-scholar plans and tokens | `student.html` |
| Committee member | A student with `is_committee = 1`; runs polls, edits menu, handles escalated complaints | `committee.html` |
| Counter staff | Scans passes at the serving counter | `scanner.html` |
| Mess manager | Approves registrations and cancellations, sets prices and rules, sees reports | `manager.html` |
| Admin | Manager rights plus creating manager/admin accounts | `manager.html` |

### 2.3 Operating environment
Server: Node.js ≥ 22.13, MySQL 8 (SQLite for development/tests). Client: any modern browser on Android/iOS/desktop; camera scanning requires HTTPS or localhost.

### 2.4 Constraints
- C1 Technology limited to what the team can defend: plain HTML/CSS/JS, Node + Express, MySQL (course stack).
- C2 No real merchant account → live gateway integration is demonstrated with the mock adapter.
- C3 Times are IST regardless of server location.
- C4 One deployment (and database) per institution.

### 2.5 Assumptions and dependencies
- A1 Students carry a smartphone at meals (to be validated, survey Q14). A typed/printed manual code is the fallback.
- A2 The counter has network access during service (to be validated with staff).
- A3 The mess office keeps the authority to approve registrations and refunds.

## 3. Functional requirements

Priority uses MoSCoW: **M**ust, **S**hould, **C**ould. Every requirement is traced to code and tests in the [traceability matrix](traceability-matrix.md).

### 3.1 Accounts and access (ACC)
| ID | Requirement | Pri |
|---|---|---|
| FR-01 | A student shall self-register with name, email, password (≥ 8 chars), roll number, phone, diet preference and residence type; the account starts as **pending**. | M |
| FR-02 | Email and roll number shall be unique. | M |
| FR-03 | The mess manager shall approve, reject or disable student accounts; a manager cannot change their own status. | M |
| FR-04 | Users shall log in with email and password and receive a token valid for 8 h; wrong email and wrong password give the same error. | M |
| FR-05 | Every API call (except register, login, health) shall require a valid token; the user's current status and role are re-read on every request. | M |
| FR-06 | Pending students may log in and browse but may not subscribe, buy tokens, skip, request late plates, vote, or obtain a pass. | M |
| FR-07 | The manager shall grant or remove mess-committee membership for students only. | M |
| FR-08 | Managers shall create counter-staff accounts; only an admin may create manager or admin accounts. | M |

### 3.2 Plans, subscriptions and payments (SUB)
| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Students shall see only the active plans for their residence type (hosteller or day scholar). | M |
| FR-11 | A student shall subscribe for the current or next calendar month; joining mid-month charges `price × remaining days / days in month`. | M |
| FR-12 | A student shall not hold overlapping subscriptions that are pending, active or awaiting cancellation. | M |
| FR-13 | Subscribing creates a payment order for the server-computed amount; the subscription becomes **active** only after the server verifies the gateway signature `HMAC-SHA256(orderId|paymentId)`. A wrong signature marks the payment failed. | M |
| FR-14 | Verifying an already-paid order shall succeed again without side effects (idempotent). | M |
| FR-15 | A student may discard an unpaid subscription or token. | S |
| FR-16 | A student may request cancellation of an active subscription; the manager approves or rejects it. | M |
| FR-17 | On approval, food continues until the end of today; unused days from tomorrow are refunded to the wallet at `cancel_refund_rate` (default 50 %). Cancelling before the start date refunds every day and leaves no entitlement. | M |
| FR-18 | The manager shall edit plan prices, activate/deactivate plans, and edit pay-per-meal prices. | M |

### 3.3 Pass and counter verification (PASS)
| ID | Requirement | Pri |
|---|---|---|
| FR-20 | An approved student shall obtain a pass `MS1.<userId>.<step>.<signature>` that changes every 30 s; the app shows it as a QR code with a countdown and a manual code. | M |
| FR-21 | Staff shall submit a scanned pass and the meal being served; the system shall serve only if **all** hold: signature valid; pass from the current or previous 30-s step; account approved; meal not skipped; a covering subscription or a paid token exists; time inside the serving window (or late-plate grace). | M |
| FR-22 | A student shall be served at most once per meal per day, even with simultaneous scans on two counters. | M |
| FR-23 | The scanner shall show SERVE / DO NOT SERVE, the student's name and roll number, the diet the student is entitled to (VEG ONLY / NON-VEG OK), the entitlement source, and for a repeat the time of the first serve. | M |
| FR-24 | Every scan attempt and its outcome shall be stored. | M |
| FR-25 | When a token is used, it shall be marked used. | M |
| FR-26 | The scanner shall accept a typed/pasted code when no camera is available. | S |
| FR-27 | The scanner shall show the selected meal's live headcount (served vs expected). | S |

### 3.4 Skips, late plates, tokens, wallet, headcount (MEAL)
| ID | Requirement | Pri |
|---|---|---|
| FR-30 | A subscribed student may skip a meal covered by the plan until `skip_cutoff_hours` before it starts; the wallet is credited `floor(plan price / (days in month × meals per day) × skip_credit_rate)`. | M |
| FR-31 | A skip may be undone before the cut-off; the credit is reversed. | S |
| FR-32 | Skips per month shall not exceed `max_skips_per_month`. | S |
| FR-33 | *(CR-001)* A student with an entitlement may request a late plate for a meal until that meal ends; not for a skipped meal; once per meal. | S |
| FR-34 | *(CR-001)* Late-plate holders may be served up to `late_plate_grace_minutes` after the window closes. | S |
| FR-35 | Any approved student may buy a token for a meal from today up to 7 days ahead, if the meal has not ended and no subscription already covers it; payment by gateway or by wallet balance. | M |
| FR-36 | The wallet balance shall equal the sum of its transactions (credits from skips/cancellations, debits for tokens); a purchase exceeding the balance is refused. | M |
| FR-37 | Staff, committee and managers shall see, for any date and each meal: subscribers, skips, tokens, expected plates split veg/non-veg, late plates and plates served. | M |

### 3.5 Feedback and committee (COMM)
| ID | Requirement | Pri |
|---|---|---|
| FR-40 | A student may file a complaint with a category, a 10–2000 character description and optionally a date and meal. | M |
| FR-41 | Complaints follow open → in progress / escalated / resolved; escalated → in progress / resolved; resolved is final; resolving requires a note. Managers act on any complaint; committee members only on escalated ones. | M |
| FR-42 | A student may rate (1–5, optional comment) only a meal they were served, once. Committee sees averages per meal and the lowest-rated meals for the last 30 days. | S |
| FR-43 | Committee members may publish polls with 2–10 unique options and a future closing time, and close them early. | M |
| FR-44 | Each approved student may vote once per open poll; everyone sees live counts and their own vote. | M |
| FR-45 | Everyone may read the weekly menu and today's menu; only committee and managers may edit a slot (day × meal × diet). | M |

### 3.6 Administration and reporting (ADM)
| ID | Requirement | Pri |
|---|---|---|
| FR-50 | The manager shall see a monthly summary: revenue by purpose, subscriptions by plan, meals served by meal, skips and credits, complaints by status, refused scans by reason. | M |
| FR-51 | The manager shall download the month's meal log as CSV that opens in Excel, with spreadsheet-formula injection neutralised. | M |
| FR-52 | The manager shall see students with at least 3 refused scans in a month, broken down by reason (fraud signals). | S |
| FR-53 | Approvals, cancellations, price/setting/menu changes, committee changes and poll actions shall be recorded in an audit log viewable by the manager. | M |
| FR-54 | The manager shall edit business rules (`skip_cutoff_hours` 0–48, `skip_credit_rate` 0–1, `max_skips_per_month` 0–124, `cancel_refund_rate` 0–1, `late_plate_grace_minutes` 0–180); out-of-range or unknown keys are refused. | M |

## 4. External interface requirements
- **User interface:** responsive pages usable at 360 px width; scan result readable at arm's length (large colour block + text); no information conveyed by colour alone.
- **API:** JSON over HTTPS, documented in OpenAPI 3 ([openapi.yaml](openapi.yaml)); errors as `{ "error": { "code", "message" } }`.
- **Payment gateway:** order → checkout → `{orderId, paymentId, signature}` → server verification (Razorpay-compatible).
- **Export:** RFC 4180 CSV.

## 5. Non-functional requirements
| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Security | Passwords hashed with bcrypt (cost 10); JWT signed with a secret from the environment; secrets never committed. |
| NFR-02 | Security | Pass and payment signatures compared in constant time; pass secret distinct from JWT secret. |
| NFR-03 | Security | All SQL parameterised; inputs validated server-side; HTML output escaped; security headers (Helmet, CSP without inline scripts); login rate-limited (20 / 15 min / IP). |
| NFR-04 | Security | Internal errors return a generic 500 without stack traces or SQL. |
| NFR-05 | Performance | A scan request completes in < 500 ms (p95) on the deployment tier with 2,000 students. |
| NFR-06 | Usability | A first-time student can subscribe and show a pass in under 3 minutes without help (UAT). |
| NFR-07 | Reliability | Money and entitlement changes are atomic (transactions); database constraints enforce one plate per meal, one vote per poll, one skip/late plate/token per meal. |
| NFR-08 | Maintainability | Layered code (routes → controllers → services → db); automated tests with ≥ 80 % line coverage; CI on every PR. |
| NFR-09 | Portability | Runs on MySQL 8 and SQLite from one schema file; no OS-specific code. |
| NFR-10 | Configurability | Plans, prices, meal rules and institution name changeable without code changes. |
| NFR-11 | Auditability | Every scan attempt and every administrative action is stored with actor and UTC timestamp. |
| NFR-12 | Privacy | Students see only their own records; complaint authors are visible to the office and committee only. |

## 6. Acceptance
v1.0 is accepted when all **Must** requirements pass their tests in CI on MySQL, the UAT script in the [test plan](06-test-plan.md) passes with at least three real students and one staff member, and the mess manager signs off a demo.
