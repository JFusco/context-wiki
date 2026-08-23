---
slug: repository-automation
---
# Repository automation

## Local package

The canonical checkout requires Node.js 24.14 or newer and uses pnpm. Exact development dependencies provide two repository-owned commands:

- `pnpm commit` runs `@verndale/ai-commit` for Conventional Commit generation.
- `pnpm pr:create` runs `@verndale/ai-pr` to create or update a pull request from the current branch.

The canonical setup commands are `pnpm exec ai-commit init` and `pnpm exec ai-pr init`. Both are run without `--force` so existing environment files, hooks, package scripts, and workflows remain authoritative.

## Hooks

`@verndale/ai-commit` initializes Husky 9 with `core.hooksPath=.husky/_`. The generated stubs dispatch to tracked user hooks:

- `.husky/prepare-commit-msg` optionally generates an AI-backed message.
- `.husky/commit-msg` enforces the bundled Conventional Commit rules.
- `.husky/pre-commit` contains the wiki skill's advisory, fail-open lifecycle block.

The wiki installer recognizes the Husky 9 dispatch layout and never appends its block after the exiting `_/h` runner.

## Pull requests and secrets

`@verndale/ai-pr` owns `.github/workflows/pr.yml` and the `pr:create` package script. Local runs load ignored `.env` and `.env.local` files; the tracked `.env.example` documents supported keys.

- Local AI commits require `OPENAI_API_KEY`.
- Local PR creation requires `GH_TOKEN` or `GITHUB_TOKEN`.
- The GitHub workflow requires `PR_BOT_TOKEN`; optional AI summaries use the documented `PR_AI_*` variables and secret.
