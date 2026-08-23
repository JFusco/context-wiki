---
date: "2026-08-23"
topics:
  - repository-automation
  - installer-contract
plans: []
---
# AI pull-request and commit automation bootstrap

## What happened

The canonical context-wiki package installed exact versions of `@verndale/ai-pr` and `@verndale/ai-commit`, then ran their standard non-force initialization commands. The setup added package scripts, environment templates, a PR workflow, and Husky commit-message hooks.

Husky changed the active Git hooks path from `.githooks` to `.husky/_`. The wiki installer was updated to recognize that dispatch layer and place its managed pre-commit block in `.husky/pre-commit`; the generated `_` stub stays byte-identical and reachable.

## Decisions

- Require Node.js 24.14 or newer, matching both automation packages.
- Keep tool versions exact in the package manifest and lockfile.
- Ignore local `.env` and `.env.local`; track only the merged example.
- Initialize without `--force` and preserve authored hooks and workflows.
- Keep installed target wikis package-manager-neutral; these automation dependencies belong only to the canonical skill repository.

## Evidence

- `pnpm exec ai-commit init`
- `pnpm exec ai-pr init`
- A second exact setup sequence left all non-secret generated files byte-identical after the combined environment template was fully merged.
- `pnpm install --frozen-lockfile`
- The active commit-msg hook accepted `chore(repo): Validate automation` and rejected `bad message`.
- `pnpm validate` — 39 passing tests plus skill and wiki integrity checks
- `pnpm graph:build` — 14 wiki-only nodes and 30 relationships
- Zero installer dry-run drift and `git diff --check`
