---
name: wiki
description: Initialize, reconcile, validate, and navigate a repository context wiki that preserves executed Claude, Codex, and Cursor plans, design decisions, journal history, Git/GitHub automation, and a wiki-only Sigma.js graph. Use when the user invokes /wiki or $wiki, asks to add or repair wiki mechanics in a project, recover past executed plans, inspect project rationale/history, rebuild the wiki graph, or check wiki drift.
---

# Repository Wiki

Create durable project history without treating source code as graph content. Prefer the bundled deterministic scripts to handwritten setup or bulk prose.

## Resolve the invocation

- No argument: initialize or reconcile the current project, backfill plans, rebuild the graph, and validate.
- `check`: make no changes; run repository checks and report installer drift.
- `backfill`: discover and audit historical plans, then rebuild and validate.
- `graph`: rebuild the graph. With `view`, start the local viewer after building.

Treat additional text as repository context or an explicit project path. Resolve the Git root when one exists; otherwise use the current directory.

## Initialize or reconcile

1. Inspect `git status --short` when the project is a Git repository. Preserve all existing work.
2. Run the bundled installer with the directory containing this `SKILL.md` as `SKILL_ROOT`:

   `node "$SKILL_ROOT/scripts/init-repository.cjs" --repo "$PROJECT_ROOT"`

   The installer upserts a managed `<!-- wiki-skill:start -->` block into **`AGENTS.md`** with the full wiki contract (Codex, Cursor, and Claude). For Claude Code it accepts an existing standalone **`CLAUDE.md`** containing only `@AGENTS.md` without changing its bytes; otherwise it upserts a thin managed import block. Put Claude-only instructions below that block or in `.claude/CLAUDE.md`. The skill does not create `.cursor/rules/wiki.mdc`.

3. If the installer reports a conflict, inspect it. Do not overwrite authored wiki pages, workflows, or hooks. Resolve only the named conflict and rerun.
4. Report when GitHub automation was skipped because the project is not a Git repository or has no GitHub remote.
5. Remind the user that GitHub repositories need a `PR_BOT_TOKEN` secret with contents and pull-request write access.

The installer is checksum-protected and idempotent. It owns repo-local scripts, viewer assets, wiki workflow templates, the managed `AGENTS.md` instruction block, a thin managed `CLAUDE.md` import of `@AGENTS.md` when a standalone import is not already present, and its pre-commit block. It seeds `wiki/plans/INDEX.md` only when missing, then treats the ledger as authored content. For Husky 9's `.husky/_` hooks path, it updates the reachable `.husky/pre-commit` user hook and leaves the generated dispatch stub unchanged. The managed hook block is advisory and fail-open, but preserves a preceding command's failure so it cannot mask blocking lint-staged or test work. It does **not** install a separate `.cursor/rules/wiki.mdc` file. Authored wiki content remains repository-owned.

The two write workflows use the canonical Action names `Sync context wiki` and `Sync wiki issue state`. They set `GRAPHIFY_SKIP_HOOK=1` at workflow scope so bot-owned checkouts and commits do not invoke native Graphify hooks on runners where Graphify is intentionally absent. This does not change developer Graphify behavior.

## Backfill plans

1. Run:

   `node scripts/wiki/discover-plans.cjs --repo "$PROJECT_ROOT" --json "$GIT_DIR/wiki-plan-candidates.json"`

2. Read the manifest summary first. Audit every **matched** or **ambiguous** candidate against the working tree and `git log --all`; never infer execution from the existence of a plan alone. Unmatched candidates belong to other repositories and need no audit row.

3. Draft the audit with the bundled helper (review and adjust before applying):

   `node scripts/wiki/audit-plan-candidates.cjs --manifest "$GIT_DIR/wiki-plan-candidates.json" --audit "$GIT_DIR/wiki-plan-audit.json" --repo "$PROJECT_ROOT" --base-branch main`

   On a feature branch or rollback point, audit against that ref instead so only merged PRs reachable from the current tip count: `--base-branch HEAD` or `--base-branch 397da8b`.

   The helper uses `scripts/wiki/lib/common.cjs` `git()` (`execFileSync`, never a shell) and **`gh pr list`** (fallback: merge commits on the base branch) to require **merged PR branch evidence** for `implemented`:

   `PR #116 branch codex/115-windows-atlassian-preflight merge 7a9f671b7b8a`

   Title-only commit grep without a merged branch lands as `partial` or `not-implemented`. Path-only git history is insufficient. Session-local implementation plans can inherit branch evidence from sibling plans in the same agent session when titles overlap.

4. **Review the draft audit before applying.** Spot-check `implemented` rows: the branch name should plausibly match the plan title. Downgrade weak matches to `partial` or `not-implemented` in the audit JSON. Plans whose bodies target other repositories stay `out-of-scope` even when this repo mentions shared paths.

5. Give every `implemented` or `partial` row at least one meaningful topic slug. Reuse a durable page when possible; otherwise create it under `wiki/topics/` before applying the audit. Non-executed audit rows may keep an empty `topics` list.

6. Before applying a corrected audit, reset a bad ledger: restore `wiki/plans/INDEX.md` to the installer template (header + `<!-- wiki-plan-rows -->` only) and delete archived bodies under `wiki/plans/` except `INDEX.md`.

7. Audit JSON shape:

   `{"entries":[{"id":"<candidate-id>","status":"implemented|partial|not-implemented|superseded|out-of-scope","evidence":["PR #N branch feat/foo merge abc123"],"topics":["<slug>"]}]}`

   The audit helper infers each row's `date` from delivery evidence (merge/commit dates) or, for `not-implemented` / `out-of-scope`, the earliest plan-source timestamp. Backfill apply must not stamp every row with today's date.

8. Apply the audit:

   `node scripts/wiki/apply-plan-audit.cjs --manifest "$GIT_DIR/wiki-plan-candidates.json" --audit "$GIT_DIR/wiki-plan-audit.json"`

9. Rerun discovery. Explain any remaining ambiguous candidates instead of silently dropping them.

Discovery and draft-audit helpers do **not** invent `wiki/topics/` or `wiki/journal/` pages. During backfill, author the topic pages required by in-scope archives and record the reconciliation delivery in a journal entry. GitHub merge reconciliation may still create later journal stubs.

Discovery scans Claude plans, Cursor plans, active and archived Codex JSONL sessions, conventional repository plan directories, Git history for conventional plan paths, and repeated `--plans-dir` overrides. It preserves exact Codex plan bytes, strips Cursor-private frontmatter, deduplicates by body digest, collapses same-title revisions to the latest source timestamp, and excludes already-audited digests. Codex session transcripts may replay earlier `<proposed_plan>` / `Plan` revisions from compacted history — discovery keeps only the **last** revision per title per session.

## Maintain the wiki

- After executing a plan, archive it in the same delivery with `node scripts/wiki/archive-plan.cjs <plan.md> --status implemented --evidence "<evidence>" --topic "<slug>"` or the candidate-manifest form documented by `--help`. Implemented and partial archives require at least one existing topic.
- Add a journal entry and affected topic decision for substantive work, following `wiki/MECHANICS.md`.
- For history or rationale questions, start at `wiki/INDEX.md` and open only routed pages.
- Rebuild with `node scripts/wiki/build-graph.cjs` after wiki edits.
- Validate with `node scripts/wiki/check.cjs`.
- View the Sigma.js graph with `node scripts/wiki/build-graph.cjs` then `node scripts/wiki/serve-graph.cjs`; stop the server when finished. It starts at http://127.0.0.1:4173/ and automatically selects the next available port when that one is occupied, allowing simultaneous repository viewers. Set `GRAPH_PORT` to require a specific port. The browser applies the Build Orchestration-style ForceAtlas2 layout and exposes search, type toggles, neighborhood focus, and node details. A repository package may alias these as `pnpm graph:build` and `pnpm graph:view`.

The graph must contain only Markdown nodes whose IDs begin with `wiki/`. Never add source files, tests, validators, hooks, or workflow files as graph nodes.

## Check only

Run `node "$SKILL_ROOT/scripts/validate-install.cjs"`, then run the installer with `--dry-run` and `node scripts/wiki/check.cjs`. A dry-run exit code of 1 means managed-file drift; code 2 means a conflict or unsafe path. Report missing or conflicted managed files, inactive hooks, invalid plan evidence, dangling wiki relationships, stale graph bytes, and skill discovery-link problems. Do not repair anything during `check`.

## Completion

Finish only after initialization/backfill requested by the invocation is complete, the graph is fresh, checks pass, and remaining ambiguity is explicitly reported. Summarize created or updated mechanics, audited plan counts by status, hook target, GitHub workflow state, and the graph-view command.
