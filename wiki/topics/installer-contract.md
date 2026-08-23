---
slug: installer-contract
---
# Installer contract

## Standalone Claude import

A repository whose `CLAUDE.md` contains only `@AGENTS.md` already satisfies the wiki skill's Claude discovery contract. The installer preserves that file byte-for-byte instead of replacing it with a managed comment block.

Missing `CLAUDE.md` files and files containing additional authored guidance retain the managed-block behavior. Claude-only instructions remain outside the managed block or under `.claude/CLAUDE.md`.

## Safety boundaries

- The standalone-import exception does not bypass symbolic-link checks.
- Checksum protection for installed assets is unchanged.
- Managed `AGENTS.md` and pre-commit blocks remain idempotent.
- The repository-local wiki graph contains Markdown nodes under `wiki/` only.

## Self-hosting decision

The context-wiki repository uses its worktree-local installer when validating installer changes against itself. A separate canonical skill checkout is never modified as a side effect of repository initialization.

## Evidence

- [Issue #3](https://github.com/JFusco/context-wiki/issues/3) tracks the compatibility and self-hosting delivery.
- The installer integration suite proves a standalone import remains byte-identical across installation and a clean dry run.
- The unit suite proves files with other authored content still receive the managed import block.
