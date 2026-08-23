# Repository guidance

## Scope

This repository packages the global `wiki` skill. The repository root is installed as `~/.agents/skills/wiki`.

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
node scripts/validate-install.cjs
node scripts/test.cjs
git diff --check
```

Review `git status --short` and keep unrelated user changes intact.
