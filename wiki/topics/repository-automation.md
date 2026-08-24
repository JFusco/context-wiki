---
slug: repository-automation
---
# Repository automation

## Local package

The canonical checkout requires Node.js 24.14 or newer and uses pnpm. One exact provider owns commit policy:

- `pnpm commit` runs `@verndale/ai-commit` for Conventional Commit generation.

`@verndale/ai-commit@2.7.0` is the only direct commit/PR-related dependency. `commitlint.config.cjs` exports that provider, while `pnpm-workspace.yaml` narrowly public-hoists its bundled `@commitlint/cli` so local and CI `pnpm exec commitlint` commands resolve under pnpm's strict layout.

## Hooks

`@verndale/ai-commit` initializes Husky 9 with `core.hooksPath=.husky/_`. The generated stubs dispatch to tracked user hooks:

- `.husky/prepare-commit-msg` optionally generates an AI-backed message.
- `.husky/commit-msg` enforces the bundled Conventional Commit rules.
- `.husky/pre-commit` contains the wiki skill's advisory, fail-open lifecycle block.

The wiki installer recognizes the Husky 9 dispatch layout and never appends its block after the exiting `_/h` runner.

## Pull requests, CI, and secrets

The source repository owns `Quality` and `Commit message lint` workflows. Portable wiki writers use direct authenticated `gh` commands rather than a second package.

- Local AI commits require `OPENAI_API_KEY`.
- Wiki bot branches require `PR_BOT_TOKEN` with contents and pull-request write access.

## Decisions

- 2026-08-23 — Removed the second PR provider and verified `ai-commit@2.7.0` plus a narrow public hoist in a clean pnpm fixture ([issue #7](https://github.com/JFusco/context-wiki/issues/7)).
