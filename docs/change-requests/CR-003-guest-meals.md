# CR-003 — Guest meal passes

| | |
|---|---|
| Status | **Deferred to v1.1** (backlog B-01) |
| Requested by | Mess manager *(scenario; confirm in the M02 interview)* |

## Request
"Students should be able to buy a meal for a visiting parent or friend."

## Impact analysis
| Area | Change |
|---|---|
| Policy | Who may bring guests, how many per month, price (same as tokens?) — **needs a mess-office decision** |
| Data | `guest_passes` (host user, guest name, date, meal, status); guest has no account |
| Code | Purchase flow on behalf of someone else; a pass for a non-user (signed with a guest-pass id); scanner shows "GUEST of <student>" |
| Security | New abuse path: one student feeding friends at token price. Needs limits and reporting |
| Tests | ~10 new cases |

**Estimate:** 8 points. That would push two Must stories out of Sprint 4.

## Decision
Deferred: high effort, open policy questions, and not on the critical path to replacing paper cards. Re-evaluate for v1.1 once the mess office decides the policy.
