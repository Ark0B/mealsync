# CR-002 — Day-scholar lunch + snacks plan

| | |
|---|---|
| Status | **Accepted → Implemented** (Sprint 4) |
| Requested by | Day scholars *(scenario; confirm from survey free-text answers)* |
| Affects | Reference data only |

## Request
"Day scholars with evening labs want snacks as well as lunch without paying per meal."

## Impact analysis
Plans are stored as data (`plans.meals = 'L,S'`), so **no code change** is needed. The entitlement check, skip credit (per-meal cost uses the number of meals in the plan) and headcount already work for any meal list. One row is added in `src/db/seedData.js`; in production the mess office would add it from the database or a future "create plan" form.

**Estimate:** 0.5 point (data + one test assertion).

## Decision
Accepted at CCB #1. Implemented as seed row `DAY_LUNCH_SNACKS_VEG` (₹2,000/month placeholder). This CR is the evidence for the modifiability claim in [05-architecture §5](../05-architecture.md#5-quality-attributes-and-how-the-architecture-meets-them).
