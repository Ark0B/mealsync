# 00 · Project Charter — MealSync

| | |
|---|---|
| Product | MealSync — digital mess management |
| Course | Software Engineering Project 2026 (B.Tech track, university domain) |
| Team | Arkodyuti Bhattacharyya, Tarun, Ananya, Sania |
| Repository | GitHub (mandatory; all work via pull requests) |
| Version of this document | 1.0 |

## 1. Problem statement

The university mess runs on a **handwritten monthly paper card** (dates, card number, validity, veg/non-veg tick) plus physical registers and Excel sheets. Registration, re-registration and cancellation happen through Google Forms and email. Payment is "proved" by showing a payment-app screenshot to the server. At the counter, cards are checked only *if and when* staff ask; otherwise verification relies on workers remembering faces.

Consequences:

1. **Fraud** — borrowed or forged cards, eating twice, edited/old payment screenshots, unsubscribed students blending in.
2. **Waste** — a subscribed student who misses a meal loses the money and the cooked food is thrown away, because the kitchen has no idea how many will eat.
3. **Late students go hungry** — no way to reserve a plate.
4. **No accountability loop** — the complaint register is rarely used; menu decisions happen in WhatsApp polls and general-body meetings with no record linking feedback to decisions.
5. **Manual administration** — the mess manager's time goes to cards, forms and spreadsheets.

## 2. Vision

> For students, mess staff and mess administrators at universities whose dining runs on paper cards, **MealSync** is a mess-management platform that verifies every plate, every payment and every subscription digitally. Unlike paper cards and spreadsheets, it gives the kitchen a live headcount and gives students credit for meals they skip.

## 3. Objectives (measurable)

| # | Objective | Measure |
|---|---|---|
| O1 | Eliminate unverifiable meals | 100 % of served plates have a `meal_logs` row tied to a verified subscription or token |
| O2 | Eliminate screenshot payments | 0 subscriptions activated without a server-verified payment signature |
| O3 | Reduce cooked-food waste | Kitchen sees expected plates per meal (subscribers − skips + tokens) before cooking |
| O4 | Stop losing money on missed meals | Skips before cut-off credit a configurable % of the plate cost |
| O5 | Make feedback traceable | Every complaint has a status history; every menu change is audited |
| O6 | Be adoptable elsewhere | One deployment per institution, all prices/rules/plans configurable without code changes |

## 4. Scope

**In scope (v1.0):** student registration and approval; monthly plans (hostel veg/non-veg, day-scholar), pro-rated subscriptions, cancellations with refunds; pay-per-meal tokens; gateway-style payment verification (mock gateway in dev); rotating QR pass and counter scanner; meal skips with wallet credit; late plates; kitchen headcount; complaints, ratings, polls, menu; reports, CSV export, fraud signals, audit log; role-based access for student, committee, staff, manager, admin.

**Out of scope (v1.0):** live payment-gateway merchant onboarding (needs the university's merchant/KYC account), guest meal passes (CR-003, deferred), inventory/procurement, native mobile apps (the web app is mobile-first), SMS/email notifications.

## 5. Stakeholders

| Stakeholder | Interest | Influence |
|---|---|---|
| Hostel students | Fair billing, no wasted money, food when late, a voice in the menu | High (largest user group) |
| Day scholars | Flexible lunch-only or per-meal options | Medium |
| Counter staff / servers | Fast, unambiguous verification at peak hours | Medium |
| Mess manager | Less paperwork, fewer disputes, reliable numbers | High |
| Student mess committee | Evidence for menu decisions, a channel to act on complaints | Medium |
| Mess contractor / kitchen | Accurate headcount → less waste | Medium |
| University administration (warden, finance) | Revenue visibility, audit trail | High |
| Course instructor | Engineering process, quality, individual contribution | High |

## 6. Team roles and responsibilities (RACI)

R = Responsible, A = Accountable, C = Consulted, I = Informed.

| Activity | Arkodyuti (Lead + Architect) | Tarun (Dev + DevOps) | Ananya (Req + Analyst) | Sania (QA + UX) |
|---|---|---|---|---|
| Discovery (survey, interviews) | A | C | R | R |
| SRS and backlog | A | C | R | C |
| Analysis models (use case, DFD, ER) | C | C | R/A | I |
| UI/UX wireframes and front end look | C | C | I | R/A |
| Architecture and ADRs | R/A | C | I | C |
| Backend implementation | C | R/A | I | C |
| Front-end implementation | C | R | I | R |
| Test plan, test cases, test report | C | C | C | R/A |
| CI/CD, repo hygiene, releases | C | R/A | I | C |
| Change control board | A | R | R | R |
| Sprint planning / review / retro | A (facilitator) | R | R | R |
| Final pitch | A | R | R | R |

Every member is expected to understand the whole product. Roles decide who *owns* an artefact, not who may touch it.

## 7. Process model

**Incremental delivery run as Scrum (one-week sprints), with a short up-front phase for requirements and architecture.** Details and justification: [ADR-0001](adr/0001-process-model.md).

```
Sprint 0  Discovery, SRS v1, analysis + design models, architecture, repo/CI skeleton
Sprint 1  Accounts & roles, registration approval, plans, subscriptions, payments
Sprint 2  Rotating QR pass, counter scanner, one-plate-per-meal guarantee, scan audit
Sprint 3  Meal skips + wallet credit, late plates, pay-per-meal tokens, kitchen headcount
Sprint 4  Complaints, ratings, polls, menu, reports/CSV/fraud signals, change requests
Release   Hardening, UAT, v1.0.0 tag, deployment, product pitch
```

Ceremonies per sprint: planning (Mon), stand-up notes in the team chat, review + retrospective (end of sprint). Records live in `docs/sprints/` and `docs/meetings/`.

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mess office does not adopt the tool | Medium | High | Interview the manager early; keep CSV export so Excel workflows survive |
| Real payment gateway needs merchant KYC we cannot get | High | Medium | Gateway adapter with a mock that follows Razorpay's exact signature scheme (ADR-0004) |
| No reliable Wi-Fi at the counter | Medium | High | Manual-code fallback; offline queue planned for v1.1 (backlog) |
| Students share phones to share passes | Low | Medium | Scanner shows name + roll number; photo field reserved in schema; denied scans logged |
| Requirements change (committee policy, prices) | High | Medium | All rules/prices in settings tables; formal change requests |
| Team bandwidth around exams | High | Medium | One-week sprints with a small, prioritised backlog (MoSCoW) |
