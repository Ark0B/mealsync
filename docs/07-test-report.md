# 07 · Test report — v1.0.0

Owner: Arkodyuti (QA / Test Engineer). Generated from the Jest run on the release candidate (in-memory SQLite). CI repeats the same suite on MySQL 8 (`test-mysql` job). **Paste the CI run link here after the first green MySQL run:** ____

## 1. Summary
| Metric | Value |
|---|---|
| Test suites | 10 (4 unit, 6 integration) |
| Test cases | **128** |
| Passed / failed | **128 / 0** |
| Duration | ~3 s |
| Line coverage | **95.5 %** (919 / 962) |
| Statement coverage | 93.3 % |
| Function coverage | 95.5 % |
| Branch coverage | 80.9 % |
| Tool versions | Node 22, Jest 30.5, Supertest 7 |

Coverage target (NFR-08, ≥ 80 % lines) is **met**. The lowest-covered file is `src/db/index.js` (MySQL branches run only in the CI MySQL job).

## 2. Results by requirement area
| Area | Suites | Tests | Result |
|---|---|---|---|
| Accounts & access (FR-01…08) | `auth.test.js` | 15 | ✅ |
| Subscriptions & payments (FR-10…18) | `subscriptions.test.js`, `pricing.test.js` | 25 | ✅ |
| Pass & counter (FR-20…27) | `passToken.test.js`, `scans.test.js` | 25 | ✅ |
| Skips, late plates, tokens, wallet, headcount (FR-30…37) | `meals.test.js`, `time.test.js` | 34 | ✅ |
| Feedback & committee (FR-40…45) | `community.test.js`, `rules.test.js` | 24 | ✅ |
| Administration & reports (FR-50…54) | `reports.test.js` | 5 | ✅ |

## 3. Security test highlights
| Attack | Test | Result |
|---|---|---|
| Replay a pass screenshot after 2 min | TC in `scans.test.js` "a screenshot of the pass stops working" | Refused `EXPIRED_TOKEN` |
| Edit the user id inside a pass | "a forged / edited pass is rejected" | Refused `INVALID_TOKEN` |
| Forged payment signature ("screenshot payment") | "a forged signature … is rejected" | 400, subscription stays pending |
| Pay / verify another student's order | "cannot verify or checkout someone else's order" | 404 |
| Second plate | "served once; a second scan is refused" | 409 + logged |
| Disabled account with a still-valid pass/JWT | "a student disabled after issuing a pass…" / "rejected student … old token stops working" | Refused |
| Role escalation (manager creates manager) | "only an admin can create a manager" | 403 |
| CSV formula injection via student name | "CSV export … neutralises spreadsheet formulas" | Field prefixed with `'` |
| User enumeration at login | "wrong password gives the same message as unknown email" | Same 401 message |

## 4. Defects found during development
| # | Defect | Severity | Found by | Fix | Regression test |
|---|---|---|---|---|---|
| D-01 | Monthly skip count compared `meal_date <= 'YYYY-MM-31'`, which is an invalid date in MySQL for 30-day months | Major (MySQL only) | Code review against ADR-0007 rules | Half-open range `>= first AND < next month` (`monthRange()`) | `time.test.js` "monthRange gives a half-open range"; skip-limit test |
| D-02 | Serving vendor JS with `express.static(<file>)` returned 404 | Minor | Smoke test | Explicit `sendFile` route for the two vendor files | Browser smoke test |
| D-03 | Helmet's default `upgrade-insecure-requests` can break plain-HTTP local demos | Minor | Review | Disabled in app CSP; HTTPS enforced by the host | Browser smoke test |

> Add every real bug found during UAT to this table, with its GitHub issue number.

## 5. UAT results (fill in)
| UAT | Tester | Date | Pass/Fail | Time | Notes |
|---|---|---|---|---|---|
| UAT-1 | | | | | |
| UAT-2 | | | | | |
| UAT-3 | | | | | |
| UAT-4 | | | | | |
| UAT-5 | | | | | |
| UAT-6 | | | | | |
| UAT-7 | | | | | |
| UAT-8 | | | | | |
| UAT-9 | | | | | |

## 6. Browser smoke test (automated, release candidate)
A Playwright script drove Chrome through: student login → subscribe and pay → skip a meal → show the pass → staff pastes the pass code → **SERVE** shown → manager opens every tab → committee publishes a poll → mobile (390 px) pass view. No console errors.

## Appendix — every test case

### `tests/unit/pricing.test.js` (9 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-001 | pricing (all values in paise) | full month when joining on the 1st | ✅ pass |
| TC-002 | pricing (all values in paise) | pro-rated when joining mid-month (16 of 30 days left) | ✅ pass |
| TC-003 | pricing (all values in paise) | last day of month pays one day | ✅ pass |
| TC-004 | pricing (all values in paise) | per-meal cost divides by days x meals | ✅ pass |
| TC-005 | pricing (all values in paise) | skip credit applies the rate and rounds down | ✅ pass |
| TC-006 | pricing (all values in paise) | cancellation refund for unused days | ✅ pass |
| TC-007 | pricing (all values in paise) | cancelling before the subscription starts refunds every day | ✅ pass |
| TC-008 | pricing (all values in paise) | no refund after the end date | ✅ pass |
| TC-009 | pricing (all values in paise) | rupees formatting | ✅ pass |

### `tests/unit/time.test.js` (23 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-010 | IST helpers | istParts converts UTC late evening to next IST day | ✅ pass |
| TC-011 | IST helpers | today() follows the frozen clock | ✅ pass |
| TC-012 | IST helpers | currentMeal at 2026-11-20 07:29 is null | ✅ pass |
| TC-013 | IST helpers | currentMeal at 2026-11-20 07:30 is B | ✅ pass |
| TC-014 | IST helpers | currentMeal at 2026-11-20 09:29 is B | ✅ pass |
| TC-015 | IST helpers | currentMeal at 2026-11-20 09:30 is null | ✅ pass |
| TC-016 | IST helpers | currentMeal at 2026-11-20 13:00 is L | ✅ pass |
| TC-017 | IST helpers | currentMeal at 2026-11-20 17:59 is S | ✅ pass |
| TC-018 | IST helpers | currentMeal at 2026-11-20 21:29 is D | ✅ pass |
| TC-019 | IST helpers | currentMeal at 2026-11-20 21:30 is null | ✅ pass |
| TC-020 | IST helpers | mealStart returns the exact instant | ✅ pass |
| TC-021 | date validation and arithmetic | rejects "2026-02-29" | ✅ pass |
| TC-022 | date validation and arithmetic | rejects "2026-13-01" | ✅ pass |
| TC-023 | date validation and arithmetic | rejects "2026-1-1" | ✅ pass |
| TC-024 | date validation and arithmetic | rejects "tomorrow" | ✅ pass |
| TC-025 | date validation and arithmetic | rejects "" | ✅ pass |
| TC-026 | date validation and arithmetic | rejects null | ✅ pass |
| TC-027 | date validation and arithmetic | accepts a leap day in a leap year | ✅ pass |
| TC-028 | date validation and arithmetic | daysInMonth | ✅ pass |
| TC-029 | date validation and arithmetic | daysBetween is inclusive | ✅ pass |
| TC-030 | date validation and arithmetic | addDays crosses month and year | ✅ pass |
| TC-031 | date validation and arithmetic | monthRange gives a half-open range | ✅ pass |
| TC-032 | date validation and arithmetic | isMeal | ✅ pass |

### `tests/unit/passToken.test.js` (13 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-033 | rotating QR pass | a freshly issued pass verifies and names the user | ✅ pass |
| TC-034 | rotating QR pass | the previous 30-second step is still accepted (slow scan) | ✅ pass |
| TC-035 | rotating QR pass | a pass older than ~60 s is expired (screenshot replay) | ✅ pass |
| TC-036 | rotating QR pass | a pass from the future is rejected | ✅ pass |
| TC-037 | rotating QR pass | changing the user id breaks the signature (cannot borrow a friend's pass) | ✅ pass |
| TC-038 | rotating QR pass | garbage "" is invalid | ✅ pass |
| TC-039 | rotating QR pass | garbage "hello" is invalid | ✅ pass |
| TC-040 | rotating QR pass | garbage "MS1.1.2" is invalid | ✅ pass |
| TC-041 | rotating QR pass | garbage "XX1.1.2.abc" is invalid | ✅ pass |
| TC-042 | rotating QR pass | garbage "MS1.a.b.c" is invalid | ✅ pass |
| TC-043 | rotating QR pass | garbage null is invalid | ✅ pass |
| TC-044 | rotating QR pass | garbage undefined is invalid | ✅ pass |
| TC-045 | rotating QR pass | a different signature length is rejected without throwing | ✅ pass |

### `tests/unit/rules.test.js` (13 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-046 | complaint state machine | open -> in_progress allowed: true | ✅ pass |
| TC-047 | complaint state machine | open -> resolved allowed: true | ✅ pass |
| TC-048 | complaint state machine | in_progress -> escalated allowed: true | ✅ pass |
| TC-049 | complaint state machine | escalated -> resolved allowed: true | ✅ pass |
| TC-050 | complaint state machine | resolved -> open allowed: false | ✅ pass |
| TC-051 | complaint state machine | resolved -> in_progress allowed: false | ✅ pass |
| TC-052 | complaint state machine | open -> open allowed: false | ✅ pass |
| TC-053 | complaint state machine | unknown -> resolved allowed: false | ✅ pass |
| TC-054 | schema conversion MySQL -> SQLite | auto increment, unique keys and indexes are converted | ✅ pass |
| TC-055 | validators | requireFields lists every missing field | ✅ pass |
| TC-056 | validators | toId rejects non-positive and non-integers | ✅ pass |
| TC-057 | validators | assertMeal / assertDate / assertOneOf | ✅ pass |
| TC-058 | asyncHandler | forwards a rejected promise to next() | ✅ pass |

### `tests/integration/auth.test.js` (15 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-059 | registration and login | a new student registers as pending and gets a token | ✅ pass |
| TC-060 | registration and login | duplicate email or roll number is rejected with 409 | ✅ pass |
| TC-061 | registration and login | invalid registration 0 | ✅ pass |
| TC-062 | registration and login | invalid registration 1 | ✅ pass |
| TC-063 | registration and login | invalid registration 2 | ✅ pass |
| TC-064 | registration and login | invalid registration 3 | ✅ pass |
| TC-065 | registration and login | login works and wrong password gives the same message as unknown email | ✅ pass |
| TC-066 | registration and login | malformed JSON body returns 400 | ✅ pass |
| TC-067 | approval workflow and authorisation | a pending student cannot subscribe until the manager approves | ✅ pass |
| TC-068 | approval workflow and authorisation | a rejected student cannot log in and an old token stops working | ✅ pass |
| TC-069 | approval workflow and authorisation | no token -> 401, bad token -> 401, wrong role -> 403 | ✅ pass |
| TC-070 | approval workflow and authorisation | only an admin can create a manager; a manager can create staff | ✅ pass |
| TC-071 | approval workflow and authorisation | a manager cannot change their own status | ✅ pass |
| TC-072 | approval workflow and authorisation | committee flag can only be given to students | ✅ pass |
| TC-073 | approval workflow and authorisation | unknown API route returns JSON 404 | ✅ pass |

### `tests/integration/subscriptions.test.js` (16 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-074 | plans | hostellers see only hostel plans, day scholars only day-scholar plans | ✅ pass |
| TC-075 | subscribing and paying | mid-month subscription is pro-rated and starts pending payment | ✅ pass |
| TC-076 | subscribing and paying | next-month subscription starts on the 1st at full price | ✅ pass |
| TC-077 | subscribing and paying | cannot subscribe two months ahead or in the past | ✅ pass |
| TC-078 | subscribing and paying | a hosteller cannot buy a day-scholar plan | ✅ pass |
| TC-079 | subscribing and paying | overlapping subscriptions are refused | ✅ pass |
| TC-080 | subscribing and paying | payment verification activates the subscription and is idempotent | ✅ pass |
| TC-081 | subscribing and paying | a forged signature (the "screenshot" attack) is rejected and nothing activates | ✅ pass |
| TC-082 | subscribing and paying | a student cannot verify or checkout someone else's order | ✅ pass |
| TC-083 | subscribing and paying | an unpaid subscription can be discarded, a paid one cannot | ✅ pass |
| TC-084 | subscribing and paying | payments history lists the student's orders | ✅ pass |
| TC-085 | cancellation | request -> manager approves -> refund of unused days lands in the wallet | ✅ pass |
| TC-086 | cancellation | manager can reject a cancellation; deciding twice is refused | ✅ pass |
| TC-087 | cancellation | cancelling before the start date leaves no entitlement and refunds every day | ✅ pass |
| TC-088 | cancellation | cannot cancel someone else's subscription or a pending one | ✅ pass |
| TC-089 | mess office price management | manager updates a plan price and a meal price; invalid values rejected | ✅ pass |

### `tests/integration/scans.test.js` (12 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-090 | scanning a pass at the counter | subscribed student is served once; a second scan is refused with the time served | ✅ pass |
| TC-091 | scanning a pass at the counter | a screenshot of the pass stops working after about a minute | ✅ pass |
| TC-092 | scanning a pass at the counter | a forged / edited pass is rejected | ✅ pass |
| TC-093 | scanning a pass at the counter | outside serving hours is refused | ✅ pass |
| TC-094 | scanning a pass at the counter | a day scholar with a lunch plan cannot take dinner | ✅ pass |
| TC-095 | scanning a pass at the counter | student without subscription is refused; with a paid token is served and the token is used | ✅ pass |
| TC-096 | scanning a pass at the counter | pending (unapproved) students cannot even get a pass | ✅ pass |
| TC-097 | scanning a pass at the counter | a student disabled after issuing a pass is refused at the counter | ✅ pass |
| TC-098 | scanning a pass at the counter | a skipped meal cannot then be eaten | ✅ pass |
| TC-099 | scanning a pass at the counter | late plate holders can be served during the grace period, others cannot | ✅ pass |
| TC-100 | scanning a pass at the counter | every attempt is logged and repeated denials appear in the fraud report | ✅ pass |
| TC-101 | scanning a pass at the counter | invalid meal code is a validation error | ✅ pass |

### `tests/integration/meals.test.js` (11 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-102 | skipping a meal | skip before the cutoff credits 60 % of the per-plate cost | ✅ pass |
| TC-103 | skipping a meal | skipping after the cutoff (4 h before the meal) is refused | ✅ pass |
| TC-104 | skipping a meal | cannot skip twice, cannot skip without a subscription, cannot skip a meal not in the plan | ✅ pass |
| TC-105 | skipping a meal | undoing a skip before the cutoff takes the credit back | ✅ pass |
| TC-106 | skipping a meal | undoing after the cutoff is refused | ✅ pass |
| TC-107 | skipping a meal | monthly skip limit is enforced (setting changed by the manager) | ✅ pass |
| TC-108 | skipping a meal | wallet credit can pay for a token; insufficient balance -> 402 | ✅ pass |
| TC-109 | skipping a meal | wallet purchase succeeds when the balance is enough | ✅ pass |
| TC-110 | skipping a meal | token rules: date window, finished meal, discard pending | ✅ pass |
| TC-111 | late plates | need an entitlement, cannot follow a skip, cannot be requested after the meal | ✅ pass |
| TC-112 | kitchen headcount | expected plates = subscribers - skips + tokens, split by diet | ✅ pass |

### `tests/integration/community.test.js` (11 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-113 | complaints | student files a complaint; short descriptions and bad categories are rejected | ✅ pass |
| TC-114 | complaints | students cannot see everyone's complaints; committee and manager can | ✅ pass |
| TC-115 | complaints | committee can act only after the manager escalates | ✅ pass |
| TC-116 | complaints | a resolved complaint cannot be re-opened (state machine) | ✅ pass |
| TC-117 | ratings | only meals actually served can be rated, once | ✅ pass |
| TC-118 | menu | everyone can read the menu; only committee/manager can edit it | ✅ pass |
| TC-119 | polls | committee creates a poll; validation of options and closing time | ✅ pass |
| TC-120 | polls | a student votes exactly once and sees their vote | ✅ pass |
| TC-121 | polls | option must belong to the poll; closed polls refuse votes | ✅ pass |
| TC-122 | polls | a poll past its closing time is treated as closed | ✅ pass |
| TC-123 | audit trail | manager actions are recorded | ✅ pass |

### `tests/integration/reports.test.js` (5 tests)

| ID | Suite | Test | Result |
|---|---|---|---|
| TC-124 | — | monthly summary adds up revenue, meals, skips and denied scans | ✅ pass |
| TC-125 | — | CSV export is downloadable and neutralises spreadsheet formulas | ✅ pass |
| TC-126 | — | settings: read, valid update, out-of-range and unknown keys rejected | ✅ pass |
| TC-127 | — | user search for the mess office | ✅ pass |
| TC-128 | — | health check and API docs are reachable | ✅ pass |