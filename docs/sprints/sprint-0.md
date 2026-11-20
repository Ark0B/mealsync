# Sprint 0 — Discovery and baseline (Week 1)

**Status: DRAFT** — confirm in the sprint review meeting.

## Planning
**Goal:** understand the problem well enough to baseline the SRS, and set up everything needed to build in Sprint 1.

| Task | Owner | Output |
|---|---|---|
| As-is process + pain points | Ananya | `docs/01-discovery/as-is-analysis.md` |
| Survey and interview guides; run them | Ananya, Sania, Tarun | `docs/01-discovery/*`, `findings.md` |
| Project charter, RACI, risk register | Sania | `docs/00-project-charter.md` |
| Process model decision | Sania | ADR-0001 |
| SRS v1.0 baseline | Ananya | `docs/02-srs.md` |
| Use cases, DFD 0/1, domain model, ER | Ananya | `docs/03-analysis.md`, `docs/database.md` |
| Architecture + stack ADRs | Arkodyuti | `docs/05-architecture.md`, ADR-0002/3/7/8 |
| Repo, branch protection, PR template, CI skeleton | Tarun | `.github/` |
| UI principles and page map | Sania | `docs/04-design.md §7` |

**Definition of Done for the whole project** (agreed this sprint):
1. Code merged to `main` only by a reviewed pull request.
2. CI green (SQLite and MySQL).
3. New behaviour has tests; coverage does not drop below 80 % lines.
4. SRS / traceability / CHANGELOG updated if behaviour changed.
5. No secrets or database files committed.

## Review (draft)
Delivered: charter, discovery instruments, SRS baseline, analysis models, architecture and ADRs, repo with CI.
Open: discovery results still to be collected (`findings.md`). Any SRS change they cause goes through change control.

## Retrospective (fill in at the meeting)
- What went well:
- What to improve:
- Action items (owner, due):
