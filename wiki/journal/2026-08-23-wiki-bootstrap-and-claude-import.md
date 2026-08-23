---
date: "2026-08-23"
topics:
  - installer-contract
plans:
  - 2026-08-23-self-host-the-wiki-with-standalone-claude-import-compatibility-37a2441a28.md
---
# Wiki bootstrap and standalone Claude import

## What happened

The context-wiki repository initialized its own repository wiki from commit `bee181d` while preserving the required one-line `CLAUDE.md`. Installer compatibility now treats a standalone `@AGENTS.md` import as compliant and leaves its bytes unchanged.

The installer added the repository-local scripts, Sigma.js viewer, GitHub workflows, and advisory `.githooks/pre-commit` integration. Its immediate dry run reported no drift, and the before/after Git object hash for `CLAUDE.md` remained `43c994c2d3617f947bcb5adf1933e21dabe46bb5`.

## Historical recovery

Plan discovery found 738 initial candidates. Every matched or ambiguous historical candidate was reviewed against its body, Git history, and available GitHub evidence.

- 2 historical plans were implemented.
- 1 historical plan was partial.
- 197 historical plans were out of scope because they targeted other repositories.
- This delivery plan was archived as implemented after its validation evidence was available.

No historical candidates were classified from title or path similarity alone. A late-arriving Claude revision targeting `ai-orchestration` was inspected and recorded as out of scope.

## Decisions

- Preserve a standalone one-line Claude import; use the managed block for every other installer case.
- Keep the exception isolated from symlink, checksum, hook, workflow, and graph safety rules.
- Use the worktree-local installer when this repository validates changes against itself.

See [the installer contract](../topics/installer-contract.md) and [the executed plan](../plans/2026-08-23-self-host-the-wiki-with-standalone-claude-import-compatibility-37a2441a28.md).

## Evidence

- [Issue #3](https://github.com/JFusco/context-wiki/issues/3)
- Branch `codex/3-self-host-context-wiki`, based on `bee181d`
- `node scripts/validate-install.cjs`
- `node scripts/test.cjs` — 38 passing tests
- `node scripts/wiki/check.cjs`
- `git diff --check`

No commit, push, pull request, merge, publication, or release occurred.
