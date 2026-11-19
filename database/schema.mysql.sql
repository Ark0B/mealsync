-- =====================================================================
-- MealSync — MySQL 8 schema (canonical production schema)
-- Money is stored in PAISE (integer) to avoid floating-point errors.
-- Dates are 'YYYY-MM-DD' (DATE); timestamps are UTC (DATETIME).
-- Meals: B = breakfast, L = lunch, S = snacks, D = dinner.
-- Normalised to 3NF; see docs/03-analysis.md for the ER diagram.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(100) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'student',   -- student | staff | manager | admin
  is_committee    TINYINT      NOT NULL DEFAULT 0,           -- student who sits on the mess committee
  roll_no         VARCHAR(30)  NULL UNIQUE,
  phone           VARCHAR(20)  NULL,
  is_day_scholar  TINYINT      NOT NULL DEFAULT 0,
  diet_pref       VARCHAR(10)  NOT NULL DEFAULT 'veg',       -- veg | nonveg
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | disabled
  photo_url       VARCHAR(255) NULL,
  created_at      DATETIME     NOT NULL,
  CONSTRAINT chk_users_role   CHECK (role IN ('student','staff','manager','admin')),
  CONSTRAINT chk_users_status CHECK (status IN ('pending','approved','rejected','disabled')),
  CONSTRAINT chk_users_diet   CHECK (diet_pref IN ('veg','nonveg'))
);

CREATE TABLE IF NOT EXISTS plans (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(40)  NOT NULL UNIQUE,
  name             VARCHAR(100) NOT NULL,
  diet             VARCHAR(10)  NOT NULL,                    -- veg | nonveg
  meals            VARCHAR(20)  NOT NULL,                    -- comma list, e.g. 'B,L,S,D'
  for_day_scholar  TINYINT      NOT NULL DEFAULT 0,
  price_paise      INT          NOT NULL,                    -- price for a FULL calendar month
  active           TINYINT      NOT NULL DEFAULT 1,
  CONSTRAINT chk_plans_diet  CHECK (diet IN ('veg','nonveg')),
  CONSTRAINT chk_plans_price CHECK (price_paise > 0)
);

-- Price of a single pay-per-meal token
CREATE TABLE IF NOT EXISTS meal_prices (
  meal         CHAR(1)     NOT NULL,
  diet         VARCHAR(10) NOT NULL,
  price_paise  INT         NOT NULL,
  PRIMARY KEY (meal, diet)
);

CREATE TABLE IF NOT EXISTS payments (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  order_id             VARCHAR(40)  NOT NULL UNIQUE,
  user_id              INT          NOT NULL,
  purpose              VARCHAR(20)  NOT NULL,                -- subscription | token
  ref_id               INT          NOT NULL,                -- id of the subscription or token being paid for
  amount_paise         INT          NOT NULL,
  status               VARCHAR(20)  NOT NULL DEFAULT 'created', -- created | paid | failed
  provider_payment_id  VARCHAR(60)  NULL,
  created_at           DATETIME     NOT NULL,
  paid_at              DATETIME     NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  user_id              INT          NOT NULL,
  plan_id              INT          NOT NULL,
  start_date           DATE         NOT NULL,
  end_date             DATE         NOT NULL,
  amount_paise         INT          NOT NULL,                -- what the student actually paid (pro-rated)
  status               VARCHAR(20)  NOT NULL DEFAULT 'pending_payment',
                       -- pending_payment | active | cancel_requested | cancelled
  created_at           DATETIME     NOT NULL,
  cancel_requested_at  DATETIME     NULL,
  cancelled_at         DATETIME     NULL,
  refund_paise         INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  INDEX idx_sub_user_dates (user_id, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS meal_tokens (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  meal_date    DATE         NOT NULL,
  meal         CHAR(1)      NOT NULL,
  diet         VARCHAR(10)  NOT NULL,
  price_paise  INT          NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending_payment', -- pending_payment | active | used
  created_at   DATETIME     NOT NULL,
  used_at      DATETIME     NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_token_user_meal (user_id, meal_date, meal)
);

CREATE TABLE IF NOT EXISTS skips (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT      NOT NULL,
  subscription_id  INT      NOT NULL,
  meal_date        DATE     NOT NULL,
  meal             CHAR(1)  NOT NULL,
  credit_paise     INT      NOT NULL,
  created_at       DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  UNIQUE KEY uq_skip_user_meal (user_id, meal_date, meal)
);

CREATE TABLE IF NOT EXISTS late_plates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  meal_date   DATE     NOT NULL,
  meal        CHAR(1)  NOT NULL,
  created_at  DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_late_user_meal (user_id, meal_date, meal)
);

-- One row per plate actually served. The UNIQUE key is what makes a second meal impossible.
CREATE TABLE IF NOT EXISTS meal_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT         NOT NULL,
  meal_date   DATE        NOT NULL,
  meal        CHAR(1)     NOT NULL,
  source      VARCHAR(20) NOT NULL,      -- subscription | token
  ref_id      INT         NOT NULL,      -- subscription id or token id
  served_by   INT         NOT NULL,      -- staff user id
  served_at   DATETIME    NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (served_by) REFERENCES users(id),
  UNIQUE KEY uq_log_user_meal (user_id, meal_date, meal)
);

-- Every scan, successful or not: audit trail and fraud signal source.
CREATE TABLE IF NOT EXISTS scan_attempts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NULL,         -- NULL when the token could not be parsed
  staff_id    INT          NOT NULL,
  meal_date   DATE         NOT NULL,
  meal        CHAR(1)      NOT NULL,
  outcome     VARCHAR(30)  NOT NULL,     -- served | invalid_token | expired_token | already_served | no_entitlement | meal_skipped | outside_meal_hours | account_inactive
  created_at  DATETIME     NOT NULL,
  INDEX idx_scan_user (user_id, meal_date)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  amount_paise  INT          NOT NULL,   -- +credit / -debit
  reason        VARCHAR(30)  NOT NULL,   -- skip_credit | skip_reversal | cancel_refund | token_purchase
  ref_id        INT          NULL,
  created_at    DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS complaints (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  category     VARCHAR(30)  NOT NULL,   -- food_quality | quantity | hygiene | staff | billing | other
  description  TEXT         NOT NULL,
  meal_date    DATE         NULL,
  meal         CHAR(1)      NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'open', -- open | in_progress | escalated | resolved
  resolution   TEXT         NULL,
  handled_by   INT          NULL,
  created_at   DATETIME     NOT NULL,
  updated_at   DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  meal_date   DATE         NOT NULL,
  meal        CHAR(1)      NOT NULL,
  stars       TINYINT      NOT NULL,
  comment     VARCHAR(300) NULL,
  created_at  DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_rating_user_meal (user_id, meal_date, meal),
  CONSTRAINT chk_stars CHECK (stars BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week  TINYINT      NOT NULL,   -- 0 = Sunday ... 6 = Saturday
  meal         CHAR(1)      NOT NULL,
  diet         VARCHAR(10)  NOT NULL,
  items        VARCHAR(300) NOT NULL,
  updated_by   INT          NULL,
  updated_at   DATETIME     NOT NULL,
  UNIQUE KEY uq_menu_slot (day_of_week, meal, diet)
);

CREATE TABLE IF NOT EXISTS polls (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  question    VARCHAR(200) NOT NULL,
  created_by  INT          NOT NULL,
  closes_at   DATETIME     NOT NULL,
  status      VARCHAR(10)  NOT NULL DEFAULT 'open',  -- open | closed
  created_at  DATETIME     NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS poll_options (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  poll_id  INT          NOT NULL,
  label    VARCHAR(100) NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  poll_id     INT      NOT NULL,
  option_id   INT      NOT NULL,
  user_id     INT      NOT NULL,
  created_at  DATETIME NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  FOREIGN KEY (option_id) REFERENCES poll_options(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_vote_once (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS settings (
  setting_key    VARCHAR(50)  PRIMARY KEY,
  setting_value  VARCHAR(200) NOT NULL
);

-- Who did what (approvals, cancellations, setting changes): engineering + accountability record.
CREATE TABLE IF NOT EXISTS audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  actor_id    INT          NOT NULL,
  action      VARCHAR(50)  NOT NULL,
  entity      VARCHAR(30)  NOT NULL,
  entity_id   INT          NULL,
  details     VARCHAR(300) NULL,
  created_at  DATETIME     NOT NULL
);
