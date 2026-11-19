# ADR-0003: Layered monolith (routes → controllers → services → db)

- Status: Accepted · Deciders: Arkodyuti

## Context
The course teaches layered MVC (route → controller → service → model). Microservices would add network failure modes and deployment work with no benefit at the scale of one mess.

## Decision
One Express app with four layers. **SQL lives in services** (no separate model/repository layer): each service owns its tables, and the DB adapter already isolates the driver. A separate model layer would mostly be one-line pass-through functions.

## Consequences
+ About 15 small service files, each readable in one sitting.
+ Services are testable without HTTP.
− If the schema grows a lot, a repository layer may be needed. Revisit when one service exceeds ~300 lines.
