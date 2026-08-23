# Context Wiki Skill

An agent skill for creating and maintaining a durable, repository-local record of executed plans, design decisions, and substantive project history.

The skill works with Codex, Claude Code, and Cursor. It keeps source code authoritative for current behavior while preserving the reasoning behind changes in a Markdown wiki and a deterministic, wiki-only Sigma.js graph.

## What it provides

- An idempotent, checksum-protected repository installer.
- Shared wiki instructions in `AGENTS.md` and a thin `CLAUDE.md` import, preserving a pre-existing standalone `@AGENTS.md` file byte-for-byte.
- Plan discovery across Claude, Cursor, active Codex, and archived Codex plan stores.
- Evidence-based auditing and topic-linked archiving of executed plans.
- Topic, journal, and plan-ledger conventions for durable project history.
- A deterministic Sigma.js graph containing only Markdown pages under `wiki/`.
- Wiki validation, pre-commit integration, and optional GitHub Actions.
- Conflict protection for authored pages and locally modified managed files.

## Requirements

- Node.js 24.14.0 or newer.
- Git for hooks, history inspection, and repository-root detection.
- Optional: GitHub CLI (`gh`) for stronger merged-PR evidence during plan audits.
- pnpm 10 when developing this package or using its root command aliases. Installed target repositories can use the direct Node.js commands without installing dependencies.

The core skill and its installed scripts use Node.js standard-library modules and do not require an `npm install`.

## Package commands

This repository declares Sigma and Graphology as pinned runtime dependencies for local development while continuing to ship vendored browser assets to target repositories:

```sh
pnpm install
pnpm test
pnpm graph:build
pnpm graph:view
```

The local viewer is served at <http://127.0.0.1:4173/>. Target repositories do not receive this `package.json`; their installed viewer remains self-contained.

## Repository automation

The canonical checkout uses `@verndale/ai-commit` for Conventional Commit generation and validation and `@verndale/ai-pr` for deterministic pull-request creation:

```sh
pnpm exec ai-commit init
pnpm exec ai-pr init
```

Initialization adds `pnpm commit`, `pnpm pr:create`, Husky commit-message hooks, `.env.example`, and `.github/workflows/pr.yml`. Local `.env` and `.env.local` files are ignored. Set `OPENAI_API_KEY` for AI commit generation and `GH_TOKEN` or `GITHUB_TOKEN` for local PR creation.

Husky 9 dispatches Git hooks through `.husky/_`; the wiki installer attaches its advisory pre-commit block to `.husky/pre-commit`, where the runner can execute it. The PR workflow requires the `PR_BOT_TOKEN` repository secret.

## Install globally

Clone the repository into a persistent project checkout. Keep this checkout in place because every global agent entry will resolve directly to it:

```sh
mkdir -p ~/Projects
git clone https://github.com/JFusco/context-wiki.git ~/Projects/wiki
```

Symlink the checkout into each agent's global skills directory:

```sh
mkdir -p ~/.agents/skills ~/.codex/skills ~/.claude/skills
ln -s ~/Projects/wiki ~/.agents/skills/wiki
ln -s ~/Projects/wiki ~/.codex/skills/wiki
ln -s ~/Projects/wiki ~/.claude/skills/wiki
```

Each destination must be absent before linking. If an older copied installation exists, move it aside only after verifying the exact path; do not overwrite a real directory in place. When two agent skills directories already resolve to the same directory, create the link there once rather than duplicating it.

Verify that every installed entry resolves to the checkout:

```sh
readlink ~/.agents/skills/wiki
readlink ~/.codex/skills/wiki
readlink ~/.claude/skills/wiki
```

The canonical skill definition is then:

```text
~/Projects/wiki/SKILL.md
```

Update the checkout with `git -C ~/Projects/wiki pull --ff-only`; every linked agent sees the update immediately.

## Use the skill

Run the skill from the repository you want to document. `$wiki` is accepted as an equivalent invocation.

| Invocation | Behavior |
| --- | --- |
| `/wiki` | Initialize or reconcile the wiki, backfill plans, rebuild the graph, and validate. |
| `/wiki check` | Inspect installer drift and wiki validity without making changes. |
| `/wiki backfill` | Discover and audit historical plans, then rebuild and validate. |
| `/wiki graph` | Rebuild the wiki-only graph. |
| `/wiki graph view` | Rebuild the graph and start the local viewer. |

Additional text can provide repository context or an explicit project path.

## Initialize manually

The installer can also be run directly:

```sh
node ~/.agents/skills/wiki/scripts/init-repository.cjs --repo /path/to/project
```

Useful options:

```text
--dry-run     Report managed-file drift without writing.
--github      Install GitHub workflows even when auto-detection is not sufficient.
--no-github   Skip GitHub workflows.
```

The installer resolves the Git root, preserves existing work, and adds or reconciles:

```text
AGENTS.md
CLAUDE.md
.githooks/pre-commit        # or an existing safe Husky/custom hook path
.github/workflows/          # for GitHub repositories
scripts/wiki/
wiki/
```

If `CLAUDE.md` already contains only `@AGENTS.md`, the installer treats it as compliant and leaves its bytes unchanged. Otherwise it creates or updates a managed import block so repository-specific Claude instructions can remain outside that block.

It does not create a separate `.cursor/rules/wiki.mdc` file. Cursor receives the wiki contract through the managed `AGENTS.md` block.

## Repository workflow

For substantive work, the installed contract expects the implementing change and its context update to ship together:

1. Archive the executed plan with delivery evidence and at least one existing topic.
2. Add a chronological journal entry.
3. Update the affected topic page with the durable decision.
4. Rebuild and validate the graph.

The reliable direct commands are:

```sh
node scripts/wiki/archive-plan.cjs path/to/plan.md --status implemented --evidence "PR #123" --topic topic-slug
node scripts/wiki/build-graph.cjs
node scripts/wiki/check.cjs
node scripts/wiki/serve-graph.cjs
```

Implemented and partial archives without a topic are rejected by both the archive/audit path and `wiki check`. Historical rows that were not executed may remain topicless.

The viewer is served at <http://127.0.0.1:4173/> by default. Set `GRAPH_PORT` to use another port.

## GitHub automation

When the target is a Git repository with a GitHub `origin`, the installer adds three workflows:

- `Wiki integrity`
- `Sync context wiki`
- `Sync wiki issue state`

The two write workflows require a `PR_BOT_TOKEN` repository secret with contents and pull-request write access. They propose reviewable `bot/wiki-*` branches rather than writing directly to the default branch.

## Validate this skill

From this repository:

```sh
node scripts/validate-install.cjs
node scripts/test.cjs
```

## Repository layout

```text
SKILL.md                    Agent instructions and supported invocations
agents/openai.yaml          Skill display metadata and invocation policy
scripts/                    Installer, updater, validator, and test suite
assets/repository/          Files installed into a target repository
```

Authored wiki content remains owned by the target repository. Managed mechanics are updated only when their recorded checksum still matches; otherwise the installer reports a conflict for review.

`wiki/plans/INDEX.md` is a create-only seed rather than a checksum-managed asset. After initialization, archive and audit tools own its authored rows, so routine installer reconciliation preserves the ledger without reporting it as drift.
