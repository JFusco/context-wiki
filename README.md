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
- A shared weighted router for agents and browser Source/Target selection, with explicit route authority, relationships, and per-file/total byte estimates.
- Repository-qualified pull-request and issue evidence on every graph node; search resolves those citations as well as page names and aliases.
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
node scripts/wiki/navigate.cjs --intent why --query "repository automation"
```

The local viewer starts at <http://127.0.0.1:4173/> and advances to the next available port when needed. Target repositories do not receive this `package.json`; their installed viewer remains self-contained.

## Repository automation

The canonical checkout uses exact `@verndale/ai-commit@2.7.0` as its sole commit-policy provider and retains exact `@verndale/ai-pr@1.3.5` for its existing generic PR workflow:

```sh
pnpm exec ai-commit init
pnpm exec ai-pr init
```

`commitlint.config.cjs` is the commit-policy provider's one-line export. Because pnpm's strict layout does not expose a transitive binary by default, `pnpm-workspace.yaml` narrowly public-hoists `@commitlint/cli`; `pnpm exec commitlint` then resolves without adding a second direct dependency. The `Quality` and `Commit message lint` workflows run on Node 24.14.0. `Create or update PR` ignores `bot/wiki-**` branches so wiki writers cannot start a second automation loop. Local `.env` files stay ignored; set provider credentials only for the local AI-assisted commands that use them.

Husky 9 dispatches Git hooks through `.husky/_`; the wiki installer attaches its advisory pre-commit block to `.husky/pre-commit`, where the runner can execute it. The wiki writer workflows require the `PR_BOT_TOKEN` repository secret.

## Install globally

Clone the repository into a persistent project checkout. Keep this checkout in place because every global agent entry will resolve directly to it:

```sh
mkdir -p ~/Projects
git clone https://github.com/JFusco/context-wiki.git ~/Projects/context-wiki
```

Symlink the checkout into each agent's global skills directory:

```sh
mkdir -p ~/.agents/skills ~/.codex/skills ~/.claude/skills
ln -s ~/Projects/context-wiki ~/.agents/skills/wiki
ln -s ~/Projects/context-wiki ~/.codex/skills/wiki
ln -s ~/Projects/context-wiki ~/.claude/skills/wiki
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
| `/wiki headless <wiki-root>` | Add deterministic navigation to an existing custom wiki without replacing its mechanics. |

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
--agents-only Reconcile only the managed AGENTS.md wiki block. Do not write assets,
              hooks, workflows, graphs, or CLAUDE.md.
--headless-navigation --wiki-root <dir>
              Install only navigation scripts and managed agent traversal.
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

Headless mode requires the custom wiki root to exist. It installs no viewer, committed graph data, plan ledger, hook, or workflow and explicitly leaves the repository's authoring and validation conventions in place.

Use `--agents-only` to distribute the same managed block without reconciling any other installer-owned file. Combine it with `--headless-navigation` for repositories that own their wiki lifecycle, and add `--wiki-root <dir>` when their Markdown lives somewhere other than `wiki/`. This mode rejects `--github` and `--no-github` because it never touches workflows.

## Token-efficient navigation

The managed `AGENTS.md` block directs models to choose an intent before reading:

```sh
node scripts/wiki/navigate.cjs --intent why --query "<terms>"
node scripts/wiki/navigate.cjs --intent wiring --from <node-id> --to <node-id>
node scripts/wiki/navigate.cjs --intent impact --query "<terms>" --max-bytes 12000
```

The managed decision tree sends exact current-code, file, symbol, and command questions directly to source; single-topic rationale questions to the wiki index and its one matching page; and only cross-page why, wiring, ownership, or impact questions to the navigator. Queries use exact identifiers or repository-qualified GitHub references. When both endpoints are known, use exact `--from` and `--to` IDs.

Routes use deterministic weighted shortest paths: relationship costs, a hub penalty, a small byte penalty, and stable tie-breaking. Output lists the exact Markdown itinerary, each file's byte count, and total estimated load. Agents open those pages sequentially and stop when grounded; ambiguous matches are retried with one returned exact ID instead of opening every candidate. For custom roots, add `--wiki-root <dir>`. Wiki discovery never starts with `grep`, `find`, or recursive `rg`; after a router miss the only fallback is one root-scoped fixed-string `rg`, followed by one known source path or one focused question.

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

The viewer starts at <http://127.0.0.1:4173/> by default. If that port is occupied, it automatically selects the next available port and prints the actual URL, so graphs from multiple repositories can run together. Set `GRAPH_PORT` to require a specific port instead. Its Sigma.js presentation uses the same dark control shell, ForceAtlas2 network layout, search, type toggles, neighborhood focus, detail panel, and weighted Source/Target route as Build Orchestration. Search includes repository-qualified GitHub evidence. Node details expose those PR/issue citations, and routes show explicit authority, relationship, per-page bytes, and total bytes.

## GitHub automation

When the target is a Git repository with a GitHub `origin`, the installer adds three workflows:

- `Wiki integrity`
- `Sync context wiki`
- `Sync wiki issue state`

The two write workflows require a `PR_BOT_TOKEN` repository secret with contents and pull-request write access. They propose reviewable `bot/wiki-*` branches rather than writing directly to the default branch.

`Sync context wiki` is merge-event driven and supports manual replay of a merged PR number; it does not need a cron. It records every same- or cross-repository issue cited with a GitHub closing keyword, merges that evidence into an existing journal when present, and ignores arbitrary or fenced citations. `Sync wiki issue state` runs at `30 11 * * *` because cited issues can close or reopen without any repository event. Both paginate GitHub API results, suppress unavailable Graphify bot hooks, use authenticated force-with-lease, and reopen an unmerged bot PR when appropriate. The installed `Wiki integrity` workflow expects the consuming package to expose `wiki:check` as `node scripts/wiki/check.cjs`.

## Validate this skill

From this repository:

```sh
node scripts/validate-install.cjs
node scripts/test.cjs
pnpm run verify:push
pnpm run verify:ci
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
