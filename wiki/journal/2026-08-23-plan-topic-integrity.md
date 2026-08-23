---
date: "2026-08-23"
topics:
  - wiki-system
  - script-testing
plans:
  - 2026-08-20-global-wiki-skill-and-repository-bootstrap-f45de79a63.md
  - 2026-08-23-add-focused-cjs-unit-tests-6569724de4.md
  - 2026-08-23-create-tracking-issue-and-implementation-branch-aa427de2df.md
---
# Plan topic integrity

## What happened

Three historical implemented or partial plan archives had empty `topics` lists. Their evidence and ledger rows were valid, so `wiki check` passed while the generated graph left those plan nodes without a durable topic relationship.

The archives and ledger now route the global bootstrap through [the wiki system](../topics/wiki-system.md) and the focused CommonJS test delivery through [script testing](../topics/script-testing.md).

## Decision

Implemented and partial archives must name at least one existing topic. Direct archiving and audit application reject topicless executed plans before writing, while `wiki check` catches legacy or hand-authored violations. Historical rows without an executed archive may remain topicless.

Backfill remains a reviewed process: discovery may draft empty topic lists, but the agent must choose meaningful durable topics and create missing pages before applying the audit.

Because official archive and audit commands author `wiki/plans/INDEX.md`, the installer now seeds that ledger only when missing and no longer checksum-tracks it. Other managed assets retain their existing conflict protection.

The canonical repository now includes a private `package.json` and lockfile with Sigma and Graphology plus working pnpm aliases for tests, graph generation, validation, and the local viewer. Installed repositories continue to use the vendored viewer and direct Node.js commands, so the reusable skill does not impose package dependencies.

## Evidence

- [Issue #5](https://github.com/JFusco/context-wiki/issues/5)
- Branch `codex/5-plan-topic-integrity`
- `node scripts/init-repository.cjs --repo /Users/joe.fusco/Projects/context-wiki --dry-run` — zero installer drift
- `node scripts/validate-install.cjs`
- `pnpm validate` — 39 passing tests plus skill and wiki integrity validation
- `pnpm graph:build` and `pnpm graph:view` — deterministic graph generation and a successful local viewer response
- `node scripts/wiki/check.cjs` — fresh deterministic graph with no dangling relationships
- `git diff --check`
