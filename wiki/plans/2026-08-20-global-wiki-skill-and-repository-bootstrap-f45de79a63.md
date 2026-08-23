---
status: "partial"
executed: true
evidence: ["commit 333511a80d58 Initial publish of global wiki skill", "commit 44124d94a325 Add project README", "commit 228f3ea4cbf Add repository agent guidance", "No merged PR branch on HEAD"]
source_tool: "codex"
source: "codex:/Users/joe.fusco/.codex/sessions/2026/08/20/rollout-2026-08-20T15-50-46-01a020b9-db39-7d00-917f-33fbcfc92855.jsonl"
topics: []
digest: "f45de79a63b528e6871c35538ae9b0cff8a527e9c4236c540005519c98791f7c"
---

# Global `/wiki` Skill and Repository Bootstrap

## Summary

Create one canonical `wiki` Agent Skill at `~/.agents/skills/wiki`, initialized with `skill-creator`, and symlink it into `~/.claude/skills/wiki`. This provides:

- Claude and Cursor: `/wiki`
- Codex: `$wiki` and `/skills` discovery
- Implicit activation for repository-wiki initialization, reconciliation, plan recovery, and graph maintenance

The skill will follow [Anthropic’s authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): concise `SKILL.md`, progressive disclosure, deterministic scripts, explicit validation, and at least three evaluation scenarios. The installation layout follows the documented discovery behavior for [Codex](https://learn.chatgpt.com/docs/build-skills), [Claude](https://code.claude.com/docs/en/slash-commands), and [Cursor](https://prod.cursor.com/docs/skills).

## Implementation Changes

### Global skill

- Run the official `init_skill.py` to scaffold `wiki` with `scripts/`, `assets/`, and `agents/openai.yaml`.
- Keep `SKILL.md` workflow-focused and under 500 lines. Define:
  - no arguments: initialize or reconcile the current project, audit historical plans, build the graph, and validate;
  - `check`: read-only integrity and installation check;
  - `backfill`: rerun historical plan discovery and evidence audit;
  - `graph`: rebuild the graph, with an optional viewer command.
- Add deterministic installer, updater, plan-discovery, fixture-test, and validation scripts. Store repository boilerplate and the vendored Sigma.js viewer as assets rather than large prose references.
- Use checksum-protected updates: replace unchanged kit-managed files, preserve authored wiki content and unrelated hooks, and report conflicts instead of overwriting them.

### Consuming repository bootstrap

- Resolve the Git root; for a non-Git project, initialize the wiki and scripts but skip Git hooks and GitHub Actions with a clear report.
- Create the context-wiki structure:
  - `wiki/INDEX.md`, `wiki/MECHANICS.md`
  - `wiki/topics/`, `wiki/journal/`
  - `wiki/plans/INDEX.md`
  - generated `wiki/connections.md`
- Install package-manager-neutral, Node-stdlib tooling under `scripts/wiki/`; do not require pnpm, npm dependencies, or a `package.json`.
- Add managed guidance to `AGENTS.md`, `CLAUDE.md`, and an always-applied Cursor wiki rule so future Claude, Codex, and Cursor executions archive plans and journal substantive changes in the same delivery.
- Install an idempotent pre-commit integration:
  - extend an existing Husky or repository-local `core.hooksPath` hook;
  - otherwise create `.githooks/pre-commit` and set repository-local `core.hooksPath`;
  - preserve an existing `.git/hooks/pre-commit` by dispatching to it;
  - warn and stop installation rather than modifying an external/global hook path.
- The hook remains fail-open: warn about missing journals or unarchived recent plans, rebuild and stage generated graph artifacts, but never block commits on uncertain execution classification.

### Historical and future plan capture

- Scan all relevant stores, including historical Codex archives:
  - Claude: `~/.claude/plans/**/*.md`
  - Cursor: `~/.cursor/plans/**/*.md`
  - Codex: `~/.codex/sessions/**/*.jsonl` and `~/.codex/archived_sessions/**/*.jsonl`
  - current and historical repository plan directories, plus repeatable `--plans-dir` overrides.
- Match candidates using repository path, GitHub owner/repository identity, session `cwd`, and grounded repository-path signals. Preserve ambiguous candidates for audit rather than silently discarding them.
- Normalize Cursor private frontmatter, preserve Claude bodies, and extract only assistant `<proposed_plan>` blocks from Codex sessions. Deduplicate by body digest and retain source-tool provenance.
- Perform a full evidence audit:
  - archive complete bodies for `implemented` and `partial`;
  - retain table rows for `not-implemented`, `superseded`, and `out-of-scope`;
  - require implementation evidence for executed statuses;
  - use collision-safe filenames and never overwrite a non-identical archive.
- Preserve the reference frontmatter contract: `status`, `executed`, `evidence`, `source_tool`, `source`, and `topics`.
- Future agents archive at execution time; recovery on `/wiki`, repository guidance, and pre-commit warnings provide independent backstops.

### Wiki-only Sigma.js graph and GitHub automation

- Adapt the reference Sigma.js/Graphology viewer and its vendored assets.
- Build nodes exclusively from `wiki/**/*.md`; hard-fail validation if any graph node points outside `wiki/`.
- Model wiki indexes, topics, journals, and archived plans with only grounded edges:
  - relative Markdown links;
  - journal/plan `topics` relationships;
  - journal-to-plan frontmatter relationships.
- Produce timestamp-free, stable JSON and generated connections pages; reject dangling links and unresolved frontmatter references.
- Install core GitHub workflows, excluding Slack:
  - PR wiki integrity check;
  - merged-PR reconciliation;
  - scheduled/manual cited-issue state refresh.
- Match the reference publication model: use required `PR_BOT_TOKEN`, write to `bot/wiki-*` branches, and open/update reviewable PRs without pushing wiki changes directly to the default branch. Use `gh` directly so consuming repositories do not need `@verndale/ai-pr`.

## Public Commands and Interfaces

- `/wiki`, `/wiki check`, `/wiki backfill`, `/wiki graph` in Claude and Cursor.
- `$wiki` with the same arguments in Codex.
- Repository commands:
  - `node scripts/wiki/discover-plans.cjs`
  - `node scripts/wiki/archive-plan.cjs <plan> --status <status>`
  - `node scripts/wiki/build-graph.cjs`
  - `node scripts/wiki/serve-graph.cjs`
  - `node scripts/wiki/check.cjs`
- GitHub configuration: required `PR_BOT_TOKEN` repository secret with contents and pull-request write access.

## Test Plan

- Validate the skill with `quick_validate.py`, generated `openai.yaml`, trigger-description cases, and exact global symlink layout.
- Run unit fixtures for Claude, Cursor, active Codex sessions, archived Codex sessions, malformed JSONL, wrong repositories, private frontmatter, duplicate bodies, and same-title collisions.
- Test audit rules requiring evidence for implemented/partial plans and preserving non-executed audit rows without archive bodies.
- Test initializer idempotency and conflict preservation in disposable repositories covering Husky, custom hooks paths, legacy `.git/hooks`, no existing hooks, GitHub and non-GitHub remotes, and non-Git projects.
- Assert every graph node starts with `wiki/`, output is byte-stable, dangling relationships fail, and the Sigma.js viewer loads and filters all four wiki node types.
- Exercise merge and issue reconciliation against fixture PR contexts, including repeat runs, custom default branches, existing bot PRs, missing `PR_BOT_TOKEN`, and no-op changes.
- Perform isolated discovery smoke tests with the installed Claude, Cursor, and Codex CLIs, using disposable repositories so no real project is modified.

## Assumptions

- Copy only vetted wiki, graph, viewer, and workflow patterns from `/Users/joe.fusco/Projects/@verndale/ai-orchestration`; do not copy its dirty working-tree changes or generated graph data.
- Node.js 20+ is the portable runtime; the current machine’s Node 24 satisfies it.
- Slack synchronization is intentionally excluded.
- Authored wiki pages and pre-existing hooks always take precedence over installer convenience; unresolved collisions are reported for review.
