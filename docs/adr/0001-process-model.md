# ADR-0001: Incremental delivery with Scrum sprints

- Status: Accepted
- Deciders: whole team (proposed by Sania)
- Context date: project start

## Context
The course evaluates the project progressively (problem → requirements → analysis → design → architecture → implementation → testing → change management → release → pitch). That needs real documents at each gate. At the same time the domain will change: committee policy, refund rules, prices and plan types are not fixed, and discovery may overturn our assumptions about the as-is system. The team is four students with exams in the middle of the semester.

## Options considered
1. **Waterfall**: matches the graded phases, but the first working software arrives at the end, and changes after the SRS baseline are expensive. That is risky when stakeholders have not seen anything yet.
2. **Pure Scrum**: adapts well, but tends to under-produce the SRS/design documents we are graded on, and with one-week sprints there is little time for up-front architecture.
3. **Incremental + Scrum (chosen)**: Sprint 0 produces SRS v1, the analysis/design models and the architecture. Sprints 1–4 each deliver a working, tested increment of prioritised requirements. Changes after the baseline go through change requests.
4. **Spiral / RAD**: risk-driven, but heavier than needed. Our main risks (adoption, payments) are handled by early demos and the payment adapter.

## Decision
Option 3. One-week sprints; backlog ordered by MoSCoW priority from the SRS; Definition of Done = code reviewed via PR + tests passing in CI + docs/traceability updated.

## Consequences
+ Every graded phase has an artefact, and there is working software from Sprint 1.
+ Change is expected and recorded (CR-001…).
− Sprint 0 is document-heavy, so the first increment arrives a week later.
− The SRS needs re-baselining when CRs are accepted (versioned in git).
