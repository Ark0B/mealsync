# 09 · Release plan and notes

Owner: Tarun (Release Engineer).

## Release plan
| Version | Content | Gate |
|---|---|---|
| 0.1.0 | Sprint 1: accounts, plans, subscriptions, verified payments | Sprint 1 review |
| 0.2.0 | Sprint 2: pass + scanner | Sprint 2 review |
| 0.3.0 | Sprint 3: skips, late plates (CR-001), tokens, wallet, headcount | Sprint 3 review |
| 0.4.0 | Sprint 4: feedback, committee, reports, CR-002 | Sprint 4 review |
| **1.0.0** | Hardening, docs, UAT fixes | M05 go / no-go |
| 1.1.0 (planned) | Backlog B-01…B-09 (guest meals, offline scanner, webhooks, notifications…) | — |

Tag each sprint's merge commit (`git tag -a v0.2.0 -m "Sprint 2: pass and scanner"`), so the history shows the increments.

## Release procedure (1.0.0)
1. Freeze `main`; open `release/1.0.0` only for fixes.
2. CI green on SQLite **and** MySQL.
3. Update `CHANGELOG.md`, `docs/07-test-report.md` (numbers + CI link), and the version in `package.json`.
4. M05 go / no-go checklist.
5. `git tag -a v1.0.0 -m "MealSync 1.0.0"` → `git push --tags` → GitHub Release with the changelog section.
6. Deploy ([11-deployment.md](11-deployment.md)); run `npm run seed -- --no-demo` and `npm run create-admin`.
7. Smoke test on the live URL: login, pass, scan (manual code), headcount.

## Rollback
Redeploy the previous tag. Schema changes in 1.x are additive only (new tables/columns), so an older build runs against a newer schema.

## Release notes — 1.0.0
See [`CHANGELOG.md`](../CHANGELOG.md#100).
