---
slug: repository-automation
---
# Repository automation

## Local package

The canonical checkout requires Node.js 24.14 or newer and uses pnpm. Standalone
`@commitlint/cli` and `@commitlint/config-conventional` own commit policy.
`commitlint.config.cjs` is the single policy source used locally and in CI.

## Hooks

Husky 9 uses `core.hooksPath=.husky/_`. Its generated stubs dispatch to tracked
user hooks:

- `.husky/commit-msg` invokes standalone Commitlint with the repository config.
- `.husky/pre-commit` contains the wiki skill's advisory, fail-open lifecycle block.

The wiki installer recognizes the Husky 9 dispatch layout and never appends its block after the exiting `_/h` runner.

## Pull requests, CI, and secrets

The source repository owns `Quality` and `Commit message lint` workflows.
Commitlint validates the PR title, commit range, and deterministic PR body.
Portable wiki writers use direct authenticated `gh` commands.

Ready pull requests with substantive changes receive the full repository suite. Drafts and changes limited to `wiki/**` plus the generated wiki graph take the lightweight direct-Node path while retaining stable check names.

Portable wiki maintenance runs Mondays at 11:30 UTC. Merge events still reconcile immediately; manual recovery accepts one merged PR or a `since` date and defaults to the preceding 90 days. The dependency-free batch reconciler paginates REST results, processes merges chronologically, reuses authored journals, excludes wiki bot PRs, and compares the proposed tree before updating the shared maintenance PR.

The canonical frontmatter parser recognizes inline, dash, and bracket lists. Wiki validation scans every Markdown page and rejects duplicate fields, orphaned bracket lists, and unterminated bracket lists. Reconciliation rewrites a complete validated field span so multiline metadata is not partially replaced.

- Wiki bot branches require `BOT_TOKEN` with contents and pull-request write access.

## Decisions

- 2026-09-28 — Cut over to standalone Commitlint and deterministic human-opened pull requests ([issue #25](https://github.com/JFusco/context-wiki/issues/25)).
- 2026-09-25 — Reduced scheduled and duplicate Actions work while adding batch recovery and REST-only wiki PR updates ([issue #13](https://github.com/JFusco/context-wiki/issues/13)).
