# Database design

Canonical schema: [`database/schema.mysql.sql`](../database/schema.mysql.sql) (MySQL 8). SQLite (dev/tests) is generated from it at start-up by `mysqlToSqlite()` in `src/db/index.js`. Reference data: `src/db/seedData.js`.

## Conventions
- Money in **paise** (`INT`), never floating point.
- `DATE` columns hold IST calendar dates (`YYYY-MM-DD`); `DATETIME` columns hold **UTC** timestamps.
- Meal codes `B`, `L`, `S`, `D`. Diet `veg` / `nonveg`.
- Status columns are `VARCHAR` + `CHECK` (portable across MySQL and SQLite) instead of `ENUM`.
- Wallet balance is **derived** (`SUM(amount_paise)`), never stored, so it cannot drift.
- Business invariants are enforced by **UNIQUE keys**, not only by code: one plate (`meal_logs`), one skip, one late plate, one token and one rating per student per meal; one vote per student per poll.

## ER diagram

```mermaid
erDiagram
  users ||--o{ subscriptions : holds
  plans ||--o{ subscriptions : "is bought as"
  users ||--o{ payments : makes
  users ||--o{ meal_tokens : buys
  subscriptions ||--o{ skips : "allows"
  users ||--o{ skips : makes
  users ||--o{ late_plates : requests
  users ||--o{ meal_logs : "is served"
  users ||--o{ scan_attempts : "is scanned"
  users ||--o{ wallet_transactions : owns
  users ||--o{ complaints : files
  users ||--o{ ratings : gives
  users ||--o{ polls : "creates (committee)"
  polls ||--|{ poll_options : has
  poll_options ||--o{ poll_votes : receives
  users ||--o{ poll_votes : casts
  users ||--o{ audit_log : "acts in"

  users {
    int id PK
    varchar email UK
    varchar roll_no UK
    varchar role
    tinyint is_committee
    tinyint is_day_scholar
    varchar diet_pref
    varchar status
  }
  plans {
    int id PK
    varchar code UK
    varchar diet
    varchar meals
    tinyint for_day_scholar
    int price_paise
    tinyint active
  }
  meal_prices {
    char meal PK
    varchar diet PK
    int price_paise
  }
  subscriptions {
    int id PK
    int user_id FK
    int plan_id FK
    date start_date
    date end_date
    int amount_paise
    varchar status
    int refund_paise
  }
  payments {
    int id PK
    varchar order_id UK
    int user_id FK
    varchar purpose
    int ref_id
    int amount_paise
    varchar status
    varchar provider_payment_id
  }
  meal_tokens {
    int id PK
    int user_id FK
    date meal_date
    char meal
    varchar diet
    int price_paise
    varchar status
  }
  skips {
    int id PK
    int user_id FK
    int subscription_id FK
    date meal_date
    char meal
    int credit_paise
  }
  late_plates {
    int id PK
    int user_id FK
    date meal_date
    char meal
  }
  meal_logs {
    int id PK
    int user_id FK
    date meal_date
    char meal
    varchar source
    int ref_id
    int served_by FK
    datetime served_at
  }
  scan_attempts {
    int id PK
    int user_id
    int staff_id
    date meal_date
    char meal
    varchar outcome
  }
  wallet_transactions {
    int id PK
    int user_id FK
    int amount_paise
    varchar reason
    int ref_id
  }
  complaints {
    int id PK
    int user_id FK
    varchar category
    text description
    varchar status
    text resolution
    int handled_by
  }
  ratings {
    int id PK
    int user_id FK
    date meal_date
    char meal
    tinyint stars
  }
  menu_items {
    int id PK
    tinyint day_of_week
    char meal
    varchar diet
    varchar items
  }
  polls {
    int id PK
    varchar question
    int created_by FK
    datetime closes_at
    varchar status
  }
  poll_options {
    int id PK
    int poll_id FK
    varchar label
  }
  poll_votes {
    int id PK
    int poll_id FK
    int option_id FK
    int user_id FK
  }
  settings {
    varchar setting_key PK
    varchar setting_value
  }
  audit_log {
    int id PK
    int actor_id
    varchar action
    varchar entity
    int entity_id
    varchar details
  }
```

## Data dictionary

| Table | Purpose | Key constraints |
|---|---|---|
| `users` | Every person: students (incl. day scholars and committee), staff, managers, admins | `email` UNIQUE, `roll_no` UNIQUE, CHECK on role/status/diet |
| `plans` | Monthly offers. `meals` is a comma list such as `B,L,S,D` | `code` UNIQUE, `price_paise > 0` |
| `meal_prices` | Price of one pay-per-meal token by meal and diet | PK (`meal`, `diet`) |
| `payments` | Gateway orders. `purpose` + `ref_id` point at the subscription or token being paid for | `order_id` UNIQUE |
| `subscriptions` | A plan bought for `start_date..end_date` (one calendar month). Status: `pending_payment → active → cancel_requested → cancelled` | FK user, plan; index (user, dates) |
| `meal_tokens` | One paid meal. Status `pending_payment → active → used` | UNIQUE (user, date, meal) |
| `skips` | Advance opt-out with the credit granted | UNIQUE (user, date, meal) |
| `late_plates` | "Keep my plate" requests | UNIQUE (user, date, meal) |
| `meal_logs` | One row per plate actually served | **UNIQUE (user, date, meal)** — the one-plate guarantee |
| `scan_attempts` | Every scan and its outcome (`served`, `invalid_token`, `expired_token`, `account_inactive`, `meal_skipped`, `no_entitlement`, `outside_meal_hours`, `already_served`) | index (user, date) |
| `wallet_transactions` | Credits (+) and debits (−); reasons `skip_credit`, `skip_reversal`, `cancel_refund`, `token_purchase` | FK user |
| `complaints` | Tickets: `open`, `in_progress`, `escalated`, `resolved` | FK user |
| `ratings` | 1–5 stars for a served meal | UNIQUE (user, date, meal), CHECK 1–5 |
| `menu_items` | Weekly menu slot | UNIQUE (day, meal, diet) |
| `polls`, `poll_options`, `poll_votes` | Committee polls | UNIQUE (poll, user) on votes |
| `settings` | Editable rules, defaults in `src/config` | PK key |
| `audit_log` | Administrative actions | — |

## Normalisation
All tables are in **3NF**: every non-key attribute depends on the whole key and only the key. Two deliberate exceptions, both documented:
- `plans.meals` stores a short comma list instead of a `plan_meals` join table. The list is fixed per plan, read-only after creation, and never queried by individual meal in SQL. A join table would add a join to every entitlement check (the hottest query) for no benefit. Revisit if plans become user-defined.
- `subscriptions.amount_paise` copies a computed price. This is a **historical fact** (what was charged), not redundant data: the plan price may change later.

## Reference and demo data (`npm run seed`)
- 5 plans: Hostel veg ₹3,600, Hostel non-veg ₹4,200, Day-scholar veg lunch ₹1,500, Day-scholar non-veg lunch ₹1,800, Day-scholar veg lunch + snacks ₹2,000 (added by CR-002). **Placeholder prices; replace with the mess office's real ones.**
- 8 token prices (each meal × diet).
- A 7-day menu for veg and non-veg (56 slots).
- Demo users listed in the README (password `MealSync@123`). Do not seed demo users in production.
