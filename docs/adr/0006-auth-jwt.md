# ADR-0006: JWT bearer tokens, bcrypt, roles re-read from the database

- Status: Accepted · Deciders: Arkodyuti, Tarun

## Decision
- Passwords: bcrypt, cost 10. Login returns a JWT (`sub`, `role`, 8 h expiry) signed with `JWT_SECRET`.
- `authenticate` verifies the JWT **and reloads the user from the DB**, so disabling an account or removing committee membership takes effect on the next request (no revocation list needed).
- `authorise(...roles)` guards each route. The pseudo-role `committee` passes students with `is_committee = 1`.
- The token is stored in `localStorage` (as taught).

## Consequences
+ Simple, stateless, testable, and revocation is effectively instant.
− One extra indexed query per request (acceptable).
− `localStorage` is readable by XSS. Mitigated by a strict CSP (`script-src 'self'`, no inline handlers) and output escaping. Backlog B-05: move to an HttpOnly, SameSite cookie plus CSRF protection.
