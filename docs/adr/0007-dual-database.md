# ADR-0007: One MySQL schema; SQLite generated from it for development and tests

- Status: Accepted · Deciders: Tarun, Arkodyuti

## Context
Requiring every teammate and every test run to have a MySQL server slows development and makes tests flaky. But production is MySQL, and SQL dialect differences are a classic source of "works on my machine" bugs.

## Decision
- `database/schema.mysql.sql` is the **only** schema. `mysqlToSqlite()` rewrites three syntax differences (AUTO_INCREMENT, named UNIQUE KEY, secondary INDEX) at start-up.
- `src/db/index.js` exposes `all/get/run/transaction` for both drivers, normalises duplicate-key errors, and makes mysql2 return dates as strings like SQLite does.
- Queries stay in the common subset: `?` params; no `NOW()` (time comes from `utils/clock.js`); no `ON DUPLICATE KEY`; half-open date ranges instead of invalid dates like `2026-02-31`; `SUM/AVG` wrapped with `Number()` because MySQL returns strings.
- **CI runs the full suite on both SQLite and a real MySQL 8 container.**

## Consequences
+ `npm install && npm start` works on any laptop. 128 tests run in ~3 s.
+ Production parity is verified on every PR.
− Developers must stay in the common SQL subset. Reviewers check this.
