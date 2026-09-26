---
status: "implemented"
executed: true
evidence: ["https://github.com/JFusco/context-wiki/issues/13; scripts/wiki/reconcile-merges.cjs; node scripts/unit.test.cjs"]
source_tool: "repository"
source: "/private/tmp/actions-budget-wiki-recovery-plan.md"
topics: ["repository-automation"]
digest: "a7e32708e7ff8fbe93bebab42a9bacb95abe9a8910d19fc68e64848f57b874c8"
---

# Reduce Actions usage and recover wiki synchronization

## Objective

Keep monthly Actions use within a 2,400-minute planning target while preserving complete verification for ready code changes and releases across the six JFusco repositories.

## Delivery

- Replace daily wiki refresh with Monday 11:30 UTC maintenance and retain manual dispatch.
- Run portable wiki scripts directly without application dependency, Python, or browser installation.
- Add single-PR replay, optional `since` batch replay, a 90-day default, dry runs, pagination, chronological processing, bot-PR exclusion, and idempotent reconciliation.
- Use REST pull-request updates, fail visibly on partial recovery, and reuse unchanged maintenance proposals.
- Run full CI for ready substantive PRs and main code changes; use stable lightweight gates for drafts and wiki-only changes.
- Remove push triggers from PR helpers and redundant wiki integrity runs.
- Recover missed merged-PR wiki updates from 2026-09-01 and measure representative before/after Actions use.
