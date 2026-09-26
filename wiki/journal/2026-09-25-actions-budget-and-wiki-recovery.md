---
date: 2026-09-25
topics: [repository-automation]
plans: [2026-09-26-reduce-actions-usage-and-recover-wiki-synchronization-a7e32708e7.md]
issue: https://github.com/JFusco/context-wiki/issues/13
pr: pending
---
# Reduce Actions usage and make wiki recovery repeatable

## Why

Daily maintenance, duplicate push checks, draft full-suite runs, and dependency installation in wiki-only jobs consumed runner time without improving release confidence. Billing exhaustion then prevented merge-triggered wiki reconciliation, so a reliable batch recovery path was needed.

## What changed

- Scheduled issue and merge maintenance for Mondays at 11:30 UTC while preserving immediate merge reconciliation and manual dispatch.
- Added a dependency-free batch helper with single-PR, `since`, 90-day default, pagination, chronological processing, dry-run, idempotence, and explicit partial-failure reporting.
- Replaced GraphQL-dependent bot PR commands with REST calls and reused maintenance branches when their proposed tree is unchanged.
- Promoted repository-wide strict frontmatter validation from QA Operations, including complete list-field spans and duplicate or malformed metadata rejection.
- Added draft and wiki-only lightweight Quality handling, removed the automated PR-helper push trigger, and removed duplicate main-push wiki integrity runs.
- Updated the installer assets, assertions, documentation, and unit coverage so consumers inherit one portable contract.

## Evidence

- `scripts/wiki/reconcile-merges.cjs`
- `.github/workflows/wiki-sync.yml`
- `.github/workflows/wiki-issue-sync.yml`
- `node scripts/validate-install.cjs`
- `node --test scripts/unit.test.cjs`
