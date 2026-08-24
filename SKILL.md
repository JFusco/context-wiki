---
name: wiki
description: Initialize, reconcile, validate, and navigate repository context wikis; recover executed Claude, Codex, and Cursor plans; install Git hooks and canonical GitHub wiki Actions; or add headless navigation to an existing custom wiki. Use for /wiki, $wiki, wiki history/rationale, graph routing, plan backfill, and wiki drift.
---

# Repository Wiki

Preserve project rationale in Markdown and retrieve it with deterministic, byte-aware routes. Never bulk-load a wiki.

## Select the operation

- No argument: initialize/reconcile, backfill plans, rebuild, and validate.
- `check`: read-only installer drift plus repository wiki checks.
- `backfill`: discover, evidence-audit, and archive historical plans.
- `graph` / `graph view`: rebuild or view the wiki-only graph.
- `headless <wiki-root>`: install navigation for an existing custom wiki without adding a viewer, committed graph, plan ledger, hook, or workflow.

Resolve the Git root when present. Inspect `git status --short` and preserve existing work.

## Navigate before reading

For a direct single-topic history or rationale question, start at the repository's wiki index and open only the page it routes to. Only for a cross-page question, use the managed `AGENTS.md` command with the matching `why`, `wiring`, or `impact` intent:

`node scripts/wiki/navigate.cjs --intent why --query "<terms>"`

Add `--wiki-root <dir>` in headless installations. Read only the returned itinerary—explicit Source→Target authority, relationship, per-page bytes, and total bytes—in order, and stop when grounded. Never bulk-load the wiki or generated graph JSON. If navigation returns candidates or no route, rerun with exact IDs via `--from` and `--to`; if ambiguity remains, ask one focused question or use one targeted `rg`. Never guess.

The browser viewer exposes the same weighted policy through Source and Target selectors. Graph nodes remain Markdown files under the configured wiki root; code and automation are never nodes.

## Initialize or reconcile

Run from this skill's directory:

`node "$SKILL_ROOT/scripts/init-repository.cjs" --repo "$PROJECT_ROOT"`

Use `--github` to force the canonical Actions or `--no-github` to omit them. For navigation-only integration with existing mechanics:

`node "$SKILL_ROOT/scripts/init-repository.cjs" --repo "$PROJECT_ROOT" --headless-navigation --wiki-root <relative-dir>`

The full installer checksum-manages scripts, viewer assets, three wiki workflows, managed `AGENTS.md`/`CLAUDE.md` blocks, and an advisory pre-commit block. It creates `wiki/plans/INDEX.md` only when missing. It preserves authored files, local hook failures, Husky 9 dispatch, and conflicts instead of overwriting them.

GitHub installs use these exact workflows: `Wiki integrity` (`check`), `Sync context wiki` (`sync`), and `Sync wiki issue state` (`sync`). Writers use `PR_BOT_TOKEN`, reviewable `bot/wiki-*` branches, Node 24, `GRAPHIFY_SKIP_HOOK=1`, and never push directly to the default branch.

## Backfill plans

1. Discover:

   `node scripts/wiki/discover-plans.cjs --repo "$PROJECT_ROOT" --json "$GIT_DIR/wiki-plan-candidates.json"`

2. Draft evidence against the correct integration ref:

   `node scripts/wiki/audit-plan-candidates.cjs --manifest "$GIT_DIR/wiki-plan-candidates.json" --audit "$GIT_DIR/wiki-plan-audit.json" --repo "$PROJECT_ROOT" --base-branch main`

3. Review every matched/ambiguous result. `implemented` requires plausible merged-PR branch evidence; title-only or path-only matches are insufficient. Keep other repositories `out-of-scope`. Give `implemented`/`partial` rows an existing durable topic.
4. Apply:

   `node scripts/wiki/apply-plan-audit.cjs --manifest "$GIT_DIR/wiki-plan-candidates.json" --audit "$GIT_DIR/wiki-plan-audit.json"`

5. Rerun discovery and report unresolved ambiguity.

## Maintain and validate

For substantive work, archive the executed plan, add a journal entry, update the affected topic, then rebuild and check in the same delivery per `wiki/MECHANICS.md`:

```sh
node scripts/wiki/archive-plan.cjs <plan.md> --status implemented --evidence "<PR, commit, test, or path>" --topic <slug>
node scripts/wiki/build-graph.cjs
node scripts/wiki/check.cjs
```

Implemented/partial archives require evidence and an existing topic. Use `node scripts/wiki/serve-graph.cjs` for the viewer; it starts at `127.0.0.1:4173` and selects the next port unless `GRAPH_PORT` is explicit.

For `check`, run `node "$SKILL_ROOT/scripts/validate-install.cjs"`, the installer with `--dry-run`, and the repository's `node scripts/wiki/check.cjs`. Do not repair during a check-only request. Exit 1 from dry-run means drift; exit 2 means conflict/unsafe input.

Finish only when requested work, graph freshness, validation, and same-delivery wiki records are complete. Report conflicts, unresolved plans, hook target, workflow state, and the graph command.
