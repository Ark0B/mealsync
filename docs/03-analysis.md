# 03 · Analysis — Use cases, data flow, domain model

Owner: Ananya (System Analyst). Inputs: [SRS](02-srs.md). The ER diagram and data dictionary are in [database.md](database.md).

## 1. Actors and use cases

```mermaid
flowchart LR
  ST((Student))
  DS((Day scholar))
  CM((Committee member))
  SF((Counter staff))
  MG((Mess manager))
  AD((Admin))
  PG[[Payment gateway]]

  subgraph MealSync
    UC1([UC1 Register])
    UC2([UC2 Subscribe and pay])
    UC3([UC3 Show meal pass])
    UC4([UC4 Skip a meal])
    UC5([UC5 Request late plate])
    UC6([UC6 Buy meal token])
    UC7([UC7 Rate meal / complain])
    UC8([UC8 Vote in poll])
    UC9([UC9 Scan pass and serve])
    UC10([UC10 Approve registration])
    UC11([UC11 Decide cancellation])
    UC12([UC12 View headcount])
    UC13([UC13 Reports, CSV, fraud signals])
    UC14([UC14 Set prices and rules])
    UC15([UC15 Run poll / edit menu])
    UC16([UC16 Handle complaint])
    UC17([UC17 Create staff / manager])
  end

  ST --- UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8
  DS -. is a .-> ST
  CM -. is a .-> ST
  CM --- UC15 & UC16 & UC12
  SF --- UC9 & UC12
  MG --- UC10 & UC11 & UC12 & UC13 & UC14 & UC16 & UC17
  AD -. is a .-> MG
  UC2 --- PG
  UC6 --- PG
```

## 2. Key use-case specifications

### UC2 — Subscribe and pay
| | |
|---|---|
| Actor | Student (approved) · Payment gateway |
| Pre-condition | Logged in, status approved, no overlapping subscription |
| Trigger | Student chooses a plan and a month |
| Main flow | 1. System lists plans for the student's residence type. 2. Student picks plan + month. 3. System computes the pro-rated amount, creates the subscription (pending payment) and a payment order. 4. Gateway collects money and returns paymentId + signature. 5. System verifies the signature, marks the payment paid and the subscription active (one transaction). |
| Alternatives | 3a. Overlap → 409. 3b. Plan for the other residence type → 400. 5a. Signature invalid → payment failed, subscription stays pending; student may retry or discard. 5b. Verify repeated → same success, no duplicate effect. |
| Post-condition | Active subscription covering start..end of month |
| Requirements | FR-10 … FR-15 |

### UC9 — Scan pass and serve
| | |
|---|---|
| Actor | Counter staff |
| Pre-condition | Staff logged in on the scanner, meal selected |
| Main flow | 1. Student opens pass. 2. Staff scans QR (or types code). 3. System checks signature → freshness → account → skip → entitlement → serving window → not already served. 4. System records the meal and shows SERVE with name, roll no., diet and source. |
| Alternatives | 3a–3g. Any check fails → attempt logged with the reason, DO NOT SERVE shown with the reason (for repeat: first-serve time). |
| Post-condition | `meal_logs` row (served) or `scan_attempts` row (refused) |
| Requirements | FR-20 … FR-27 |

### UC4 — Skip a meal
| | |
|---|---|
| Actor | Student (approved, subscribed) |
| Main flow | 1. Student picks a meal in the next 7 days. 2. System checks a covering subscription, the cut-off and the monthly limit. 3. System stores the skip and credits the wallet (one transaction). 4. The headcount for that meal drops by one. |
| Alternatives | 2a. After cut-off → 400 with the cut-off time. 2b. Limit reached → 400. 2c. Already skipped → 409. |
| Requirements | FR-30 … FR-32, FR-37 |

### UC11 — Decide cancellation
| | |
|---|---|
| Actor | Mess manager |
| Main flow | 1. Student requested cancellation. 2. Manager opens requests and approves. 3. System computes the refund for unused days, shortens the subscription to today, credits the wallet, writes the audit log. |
| Alternatives | 2a. Manager rejects → subscription active again. 2b. Request already decided → 409. |
| Requirements | FR-16, FR-17, FR-53 |

### UC16 — Handle complaint
| | |
|---|---|
| Actors | Mess manager, committee member |
| Main flow | 1. Student files a complaint (open). 2. Manager marks in progress or escalates to the committee. 3. The handler resolves it with a note, which the student sees. |
| Rules | State machine in [04-design §5](04-design.md#5-state-machines). Committee acts only on escalated tickets. |
| Requirements | FR-40, FR-41 |

## 3. Data flow diagrams

### Level 0 (context)
```mermaid
flowchart LR
  S[Student] -- registration, plan choice, skips, votes, complaints --> M((MealSync))
  M -- pass, wallet, receipts, menu, poll results --> S
  F[Counter staff] -- scanned pass, meal --> M
  M -- SERVE / DO NOT SERVE, headcount --> F
  G[Payment gateway] -- payment id + signature --> M
  M -- order amount --> G
  O[Mess office] -- approvals, prices, rules, decisions --> M
  M -- reports, CSV, fraud signals, audit --> O
  C[Committee] -- polls, menu edits, resolutions --> M
  M -- ratings, complaints, results --> C
```

### Level 1
```mermaid
flowchart TB
  S[Student] --> P1[1.0 Manage account]
  O[Mess office] --> P1
  P1 <--> D1[(D1 Users)]

  S --> P2[2.0 Subscribe / buy token]
  P2 <--> D2[(D2 Plans + prices)]
  P2 --> D3[(D3 Subscriptions, tokens)]
  P2 <--> G[Gateway]
  P2 --> D4[(D4 Payments)]

  S --> P3[3.0 Skip / late plate]
  P3 --> D5[(D5 Skips, late plates)]
  P3 --> D6[(D6 Wallet)]

  F[Counter staff] --> P4[4.0 Verify and serve]
  P4 --> D1 & D3 & D5
  P4 --> D7[(D7 Meal logs, scan attempts)]

  P5[5.0 Headcount and reports] --> O & F
  D3 & D5 & D7 & D4 --> P5

  S --> P6[6.0 Feedback and polls]
  C[Committee] --> P6
  P6 <--> D8[(D8 Complaints, ratings, polls, menu)]

  O --> P7[7.0 Configure]
  P7 --> D2 & D9[(D9 Settings, audit log)]
```

## 4. Domain model (conceptual)

```mermaid
classDiagram
  class Student {
    name
    rollNo
    dietPref
    isDayScholar
    isCommittee
    status
  }
  class Plan {
    code
    diet
    meals
    forDayScholar
    monthlyPrice
  }
  class Subscription {
    start
    end
    amountPaid
    status
  }
  class Payment {
    orderId
    amount
    status
  }
  class MealToken {
    date
    meal
    diet
    status
  }
  class Skip {
    date
    meal
    credit
  }
  class LatePlate {
    date
    meal
  }
  class MealLog {
    date
    meal
    source
    servedAt
  }
  class ScanAttempt {
    outcome
  }
  class WalletTxn {
    amount
    reason
  }
  class Complaint {
    category
    status
    resolution
  }
  class Rating {
    stars
  }
  class Poll {
    question
    closesAt
  }
  class MenuItem {
    dayOfWeek
    meal
    diet
    items
  }

  Student "1" -- "*" Subscription
  Plan "1" -- "*" Subscription
  Subscription "1" -- "0..1" Payment
  Student "1" -- "*" MealToken
  MealToken "1" -- "0..1" Payment
  Subscription "1" -- "*" Skip
  Student "1" -- "*" LatePlate
  Student "1" -- "*" MealLog
  Student "1" -- "*" ScanAttempt
  Student "1" -- "*" WalletTxn
  Student "1" -- "*" Complaint
  MealLog "1" -- "0..1" Rating
  Poll "1" -- "2..10" PollOption
  Student "*" -- "*" PollOption : votes once per poll
```
