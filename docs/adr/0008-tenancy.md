# ADR-0008: One deployment per institution (database-per-tenant)

- Status: Accepted · Deciders: Arkodyuti

## Context
The brief asks for a product that could serve other universities. Options: shared database with an `institution_id` on every row, or one deployment and database per institution.

## Decision
Database-per-tenant. Institution name, meal windows (config), prices, plans and rules (database) are all configurable, so a new institution means a new deployment with its own `.env` and seed. No code change.

## Consequences
+ No risk of one university seeing another's data, and no tenant filter in every query.
+ Each institution can host on its own infrastructure (many will require that).
− Upgrades must be rolled out per deployment. Acceptable for a handful of institutions; revisit if offered as SaaS at scale.
