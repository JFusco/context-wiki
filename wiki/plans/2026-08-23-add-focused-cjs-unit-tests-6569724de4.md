---
status: "implemented"
executed: true
evidence: ["PR #2 branch codex/1-cjs-unit-tests merge bee181dd9bbf"]
source_tool: "codex"
source: "codex:/Users/joe.fusco/.codex/sessions/2026/08/23/rollout-2026-08-23T07-45-40-01a02e70-ce78-70e3-b24f-43fb317cec2c.jsonl"
topics: ["script-testing"]
digest: "6569724de4e165427f8664e2bd9b1e8c0e2a3c93e015f478f7c6a7548c536a68"
---

# Add focused `.cjs` unit tests

## Summary

Add a fast, deterministic unit suite for the reusable wiki helpers while preserving the existing 19 integration tests and `node scripts/test.cjs` entry point.

## Implementation

- Add `scripts/unit.test.cjs` using only `node:test`, `node:assert`, and other Node standard-library modules.
- Load the new suite from `scripts/test.cjs`, so the documented validation command runs both unit and integration tests.
- Cover:
  - `lib/common.cjs`: hashing/slugging, path containment, symlink detection, substantive-file classification, sorted walking, and atomic writes.
  - `lib/frontmatter.cjs`: BOM/CRLF handling, scalar and list forms, title fallback, and deterministic rendering.
  - `lib/dates.cjs`: plan/session filename parsing, fixed file timestamps, Git evidence dates, and date-precedence rules.
  - `lib/plans.cjs`: Cursor-private frontmatter removal, Codex plan revision selection, repository association states, and same-title collapsing.
  - `init-repository.cjs`: argument parsing, managed-block create/update/dry-run behavior, containment checks, and atomic file modes.
- Use isolated temporary directories and fixed Git timestamps; avoid network access, the real home directory, and wall-clock-sensitive assertions.

## Interfaces

- No production exports, CLI behavior, installed assets, or public interfaces change.
- No coverage threshold or additional dependency is introduced.
- README and skill instructions remain unchanged because user-facing behavior is unaffected.

## Test Plan

- Confirm the current integration scenarios continue to pass alongside the new unit cases.
- Run:
  - `node scripts/validate-install.cjs`
  - `node scripts/test.cjs`
  - `git diff --check`
- Review `git status --short` and preserve unrelated changes.

## Assumptions

- Tests codify existing intended behavior; production fixes discovered during testing are reported separately rather than included silently.
- The new unit suite remains directly runnable with `node scripts/unit.test.cjs`, while `node scripts/test.cjs` stays canonical.
