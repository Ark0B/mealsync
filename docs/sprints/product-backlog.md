# Product backlog

Owner: Arkodyuti (Product Lead), with Ananya (stories and acceptance criteria). Priority = MoSCoW from the SRS. Status reflects the repository at v1.0.0.

| ID | User story | FR | Pri | Pts | Sprint | Status |
|---|---|---|---|---|---|---|
| US-01 | As a **student** I want to register online so that I don't need Google Forms and email | FR-01, FR-02 | M | 3 | 1 | Done |
| US-02 | As the **mess manager** I want to approve or reject registrations so that only genuine students subscribe | FR-03, FR-06 | M | 3 | 1 | Done |
| US-03 | As a **user** I want to log in securely so that nobody else acts as me | FR-04, FR-05 | M | 3 | 1 | Done |
| US-04 | As a **student** I want to see only the plans that apply to me (hostel / day scholar) | FR-10 | M | 1 | 1 | Done |
| US-05 | As a **student** I want to subscribe for this or next month and pay only for the days left | FR-11, FR-12 | M | 3 | 1 | Done |
| US-06 | As the **mess office** I want payments verified by the system so that screenshots are no longer accepted | FR-13, FR-14 | M | 5 | 1 | Done |
| US-07 | As a **student** I want to discard an unpaid order | FR-15 | S | 1 | 1 | Done |
| US-08 | As an **admin** I want to create staff and manager accounts with the right permissions | FR-08 | M | 2 | 1 | Done |
| US-09 | As a **student** I want a meal pass on my phone that cannot be copied | FR-20 | M | 5 | 2 | Done |
| US-10 | As **counter staff** I want to scan a pass and get a clear SERVE / DO NOT SERVE with the student's diet | FR-21, FR-23 | M | 5 | 2 | Done |
| US-11 | As the **mess office** I want each student served at most once per meal | FR-22 | M | 3 | 2 | Done |
| US-12 | As the **mess office** I want every scan attempt recorded | FR-24 | M | 3 | 2 | Done |
| US-13 | As **counter staff** I want to type the code when the camera fails | FR-26 | S | 3 | 2 | Done |
| US-14 | As a **student** I want to skip a meal in advance and get credit so that my money is not wasted | FR-30 | M | 5 | 3 | Done |
| US-15 | As a **student** I want to undo a skip before the cut-off | FR-31 | S | 2 | 3 | Done |
| US-16 | As the **mess manager** I want a monthly skip limit and editable rules | FR-32, FR-54 | S | 2 | 3 | Done |
| US-17 | As a **student** running late I want a late plate kept for me | FR-33, FR-34 | S | 3 | 3 | Done (CR-001) |
| US-18 | As a **day scholar** I want to buy a single meal by UPI or wallet credit | FR-35, FR-36 | M | 3 | 3 | Done |
| US-19 | As the **kitchen** I want the expected number of veg and non-veg plates per meal | FR-37 | M | 3 | 3 | Done |
| US-20 | As **counter staff** I want to see the live headcount for the meal I'm serving | FR-27 | S | 3 | 3 | Done |
| US-21 | As a **student** I want to raise a complaint and see what was done about it | FR-40, FR-41 | M | 3 | 4 | Done |
| US-22 | As a **committee member** I want to handle complaints the manager escalates | FR-41 | M | 2 | 4 | Done |
| US-23 | As a **student** I want to rate meals I ate | FR-42 | S | 2 | 4 | Done |
| US-24 | As a **committee member** I want to run menu polls with one vote per student | FR-43, FR-44 | M | 3 | 4 | Done |
| US-25 | As a **committee member** I want to edit the weekly menu | FR-45 | M | 2 | 4 | Done |
| US-26 | As the **mess manager** I want a monthly report and an Excel export | FR-50, FR-51 | M | 3 | 4 | Done |
| US-27 | As the **mess manager** I want to see students with repeated refused scans | FR-52 | S | 3 | 4 | Done |
| US-28 | As the **mess manager** I want to cancel subscriptions with automatic refunds, and an audit log | FR-16, FR-17, FR-53 | M | 3 | 4 | Done |

## Backlog for v1.1 (not started)

| ID | Item | Source |
|---|---|---|
| B-01 | Guest meal passes bought by a student for a visitor | CR-003 (deferred) |
| B-02 | Offline scanner queue (scan with no network, sync later) | Risk register |
| B-03 | Payment webhook for payments where the browser closes mid-flow | ADR-0004 |
| B-04 | Email / push notifications (approval, cancellation decided, poll opened) | Discovery |
| B-05 | HttpOnly cookie session + CSRF protection instead of localStorage JWT | ADR-0006 |
| B-06 | Staff lookup by roll number with a profile photo, for students without a phone | ADR-0005 |
| B-07 | Photo upload during registration, checked by the manager | Security review |
| B-08 | Demand forecasting per meal from history (day of week, exams, holidays) | Product idea |
| B-09 | Hindi interface | Accessibility |
