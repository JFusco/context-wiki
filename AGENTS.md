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

## Commit message standard

Use a specific `type(scope): action` subject with an action verb and a subject
of at most 50 characters. Leave a blank line before a body when the reason,
impact, or tradeoff is not clear from the diff; wrap body and footer lines at
72 characters. Mark breaking changes with `!` or a `BREAKING CHANGE:` footer.
Follow this repository's commitlint configuration for allowed types, scopes,
and other enforced rules. Avoid vague or ticket-only subjects.

## Graphify repository workflow

Use the repository-local [Graphify skill](.agents/skills/graphify/SKILL.md)
for the shared code map of the installer scripts and shipped repository scripts. Exact behavior comes from source;
history and decisions come from the Markdown-only context wiki. Use Graphify
0.9.36. After cloning, install dependencies and run `graphify hook install`
for native Git refresh hooks and the local merge driver. Keep
`graphify-out/memory/` empty and review background graph changes before
staging. Do not install Graphify agent tool hooks.

## Git delivery flow

For repository changes that include delivery, complete this sequence:

1. Confirm the worktree is safe to switch, then switch to `main` and run
   `git pull --ff-only` so the branch point is the current remote main.
2. Create one actionable GitHub issue with the repository's canonical labels
   using the `github-issue-creator` workflow, and read the saved issue back
   before creating downstream artifacts.
3. Create `codex/<issue-number>-<short-slug>` from that updated `main`.
4. Implement only the issue scope, record substantive work in the wiki in the
   same delivery, and run `pnpm run verify:ci`.
5. Commit with a valid conventional message, then push the issue branch with
   ordinary Git commands.
6. Open a pull request with a conventional title and the canonical
   `.github/pull_request_template.md` body. Keep its level-two headings exactly
   once and in order; replace every placeholder with meaningful content,
   include `Closes #<issue-number>`, record verification and risk/rollback,
   and complete every required checkbox. Run `pnpm run lint:pr` before opening
   the PR and read the saved PR back afterward.
7. Stop after the pull request is open and verified. Never merge it, enable
   auto-merge, delete the delivery branch, or close the issue as part of this
   flow. Leave review and merging to the user.


<!-- wiki-skill:start -->
## Context wiki

Use `wiki/` as this repository's durable record of executed plans, decisions, and substantive change history. Never bulk-load `wiki/`.

- For an exact current-code, file, symbol, or command question, inspect the named source or use targeted source `rg`; do not load history.
- For a direct single-topic history or rationale question, start at `wiki/INDEX.md` when it exists and open only the page it routes to.
- Only for a cross-page why, wiring, ownership, or impact question, run `node scripts/wiki/navigate.cjs --intent why --query "<terms>"` before opening wiki pages. Use `wiring` for ownership/dependencies and `impact` for change scope.
- Query with exact slugs, identifiers, symbols, or repository-qualified GitHub references. Never use a bare issue or PR number such as `#123`.
- When both endpoints are known, use exact `--from` and `--to` node IDs.
- Trust the router's deterministic weighted shortest route, which accounts for relationship cost, hubs, and page bytes. Open only its itinerary; never add candidates, neighbors, or adjacent pages.
- Read itinerary pages sequentially, never speculatively in parallel, and stop as soon as the answer is grounded.
- If resolution is ambiguous, rerun with one returned exact ID; never open every candidate.
- Never use `grep`, `find`, or recursive `rg` as initial wiki discovery. After a router miss, run at most one root-scoped exact search: `rg -n --fixed-strings "<exact term>" wiki/`. If it fails, inspect one known source path or ask one focused question; never widen the search.
- Never read generated graph JSON directly.
- After executing a Claude, Codex, or Cursor plan, archive it and add the journal/topic updates in the same delivery per `wiki/MECHANICS.md`.
- Run `node scripts/wiki/discover-plans.cjs` to recover missed plans, `node scripts/wiki/build-graph.cjs` after wiki edits, and `node scripts/wiki/check.cjs` before completion.
- The Sigma.js graph indexes only Markdown under `wiki/`; never add code nodes.

This managed block was installed for Codex, Cursor, and Claude (via `@AGENTS.md` in `CLAUDE.md`).
<!-- wiki-skill:end -->
