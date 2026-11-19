# M03 — SRS baseline review

**Status: DRAFT** · Date: ____ · Moderator: Arkodyuti · Author: Ananya · Reviewers: Tarun, Sania

## Agenda
1. Walk through SRS v1.0 section by section
2. Check every requirement is *testable* (Sania) and *buildable this semester* (Tarun)
3. Agree priorities (MoSCoW)
4. Baseline

## Review checklist
| Check | Result |
|---|---|
| Each FR has one testable "shall" | |
| Each FR has a priority | |
| No contradictions (e.g. skip vs late plate on the same meal → FR-33 forbids) | |
| NFRs have numbers (NFR-05 500 ms, NFR-06 3 min, NFR-08 80 %) | |
| Out of scope stated (charter §4) | |

## Proposed decisions
| # | Decision | Agreed? |
|---|---|---|
| D1 | Late plates are **not** in the baseline. If stakeholders ask, raise a change request | ☐ |
| D2 | Payments demonstrated with a mock gateway using Razorpay's signature scheme (ADR-0004) | ☐ |
| D3 | Rule values (cut-off, credit %, refund %) start as settings with defaults, to be fixed after discovery | ☐ |
| D4 | SRS v1.0 baselined; tag `srs-v1.0` | ☐ |

## Action items
| Action | Owner | Due |
|---|---|---|
| Fix review comments, tag the baseline | Ananya | |
| Create GitHub issues for US-01…US-28 | Arkodyuti | |
