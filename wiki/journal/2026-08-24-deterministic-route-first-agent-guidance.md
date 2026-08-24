---
date: 2026-08-24
topics: [installer-contract, wiki-navigation-and-automation]
plans: [2026-08-24-deterministic-route-first-wiki-guidance-and-pr-127-recovery-9f56bf461c.md]
pr: pending
---
# Make agent wiki navigation deterministic and route-first

## Why

Managed wiki guidance had diverged across repositories and some variants encouraged broad fallback searches or speculative reading. Updating guidance through the full installer could also overwrite repository-owned wiki mechanics when only `AGENTS.md` needed reconciliation.

## What changed

- Added `--agents-only`, which updates or checks only the managed `AGENTS.md` block and rejects workflow flags. Assets, hooks, workflows, graphs, and `CLAUDE.md` remain byte-stable.
- Generated full and headless blocks from one navigation core. Both distinguish source questions, single-topic history, and cross-page routing; require exact identifiers; trust the weighted shortest route; read sequentially; retry one exact candidate; and bound a router miss to one fixed-string search.
- Added malformed-marker protection and unit/integration coverage for isolation, idempotence, variants, custom roots, and dry-run exit codes.
- Updated the operator README and the skill contract so future installations follow the same behavior.

## Evidence

- `scripts/init-repository.cjs`
- `scripts/unit.test.cjs`
- `scripts/test.cjs`
- `node --test scripts/unit.test.cjs`
