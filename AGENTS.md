# Repository guidance

## Scope

This repository packages the global `wiki` skill. The repository root is canonical and is symlinked into global agent skill directories such as `~/.agents/skills/wiki`.

## Sources of truth

- `SKILL.md` defines triggering, supported invocations, and the agent workflow.
- `agents/openai.yaml` defines UI-facing skill metadata.
- `scripts/` contains the installer, updater, validator, and test suite.
- `assets/repository/` contains the files copied into target repositories.
- `README.md` documents installation and user-facing behavior.

Keep `CLAUDE.md` as a one-line import of this file: `@AGENTS.md`.

## Change rules

- Keep instructions concise and put deterministic behavior in scripts.
- Preserve the installer's checksum protection, idempotence, and authored-file conflict handling.
- Preserve symlink and path-traversal defenses in installers, audit tools, and the graph viewer.
- Use Node.js standard-library modules unless a new dependency is clearly necessary.
- Do not add `.cursor/rules/wiki.mdc`; Cursor receives the contract through installed `AGENTS.md`.
- Keep graph nodes restricted to Markdown files under `wiki/`; source code and tooling are never graph nodes.
- Preserve existing Git hooks and their failures. The managed wiki hook remains advisory and fail-open.
- Keep the write workflows named `Sync context wiki` and `Sync wiki issue state`, with `GRAPHIFY_SKIP_HOOK=1` at workflow scope.
- Treat minified files under `assets/repository/scripts/wiki/graph/viewer/vendor/` as vendored assets; do not hand-edit them.
- Update `README.md`, tests, and installed assets together when user-facing behavior changes.

## Validation

Run these commands before completing changes:

```sh
pnpm run verify:push
pnpm run verify:ci
git diff --check
```

Review `git status --short` and keep unrelated user changes intact.

<!-- wiki-skill:start -->
## Context wiki

Use `wiki/` as this repository's durable record of executed plans, decisions, and substantive change history. Never bulk-load `wiki/` or `scripts/wiki/graph/data/graph.json`.

- For a direct single-topic history or rationale question, start at `wiki/INDEX.md` and open only the page it routes to.
- Only for a cross-page question, use `node scripts/wiki/navigate.cjs --intent why --query "<terms>"`. Use `wiring` for ownership/dependency questions and `impact` before cross-topic changes.
- Read only the returned byte-counted itinerary, in order, and stop as soon as the answer is grounded.
- If navigation returns candidates or no route, rerun with exact `--from`/`--to` node IDs. If ambiguity remains, ask one focused question or use one targeted `rg`; never guess a route.
- After executing a Claude, Codex, or Cursor plan, archive it and add the journal/topic updates in the same delivery per `wiki/MECHANICS.md`.
- Run `node scripts/wiki/discover-plans.cjs` to recover missed plans, `node scripts/wiki/build-graph.cjs` after wiki edits, and `node scripts/wiki/check.cjs` before completion.
- The Sigma.js graph indexes only Markdown under `wiki/`; never add code nodes.

This managed block was installed for Codex, Cursor, and Claude (via `@AGENTS.md` in `CLAUDE.md`).
<!-- wiki-skill:end -->
