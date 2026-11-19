# ADR-0002: Plain HTML/CSS/JS + Node/Express 4 + MySQL

- Status: Accepted · Deciders: Arkodyuti, Tarun

## Context
Every member must be able to explain any part of the code in the viva. The Full Stack Development course teaches HTML/CSS/JS, Node + Express, MySQL/MongoDB, JWT, Jest/Supertest, Git and Swagger.

## Decision
- Front end: plain HTML/CSS/JavaScript, no framework, no build step. Two vendored libraries only: `qrcode-generator` (draw the pass) and `html5-qrcode` (camera scanning).
- Back end: Node.js 22 + **Express 4** (the version taught, including the async-error trap we handle with `asyncHandler`).
- Database: **MySQL 8**. The data is relational with strong invariants (unique plate per meal, foreign keys, transactions for money), so a relational DB beats MongoDB here.
- Tests: Jest + Supertest. API docs: OpenAPI + swagger-ui-express.

## Consequences
+ Nothing in the repo is outside the syllabus, and there is no toolchain to break.
− More hand-written DOM code than a framework would need. Mitigated by one shared helper file (`public/js/api.js`) and small page scripts.
