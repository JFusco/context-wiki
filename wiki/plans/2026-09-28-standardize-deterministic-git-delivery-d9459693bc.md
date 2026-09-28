---
status: "implemented"
executed: true
evidence: ["https://github.com/JFusco/context-wiki/issues/25; AGENTS.md; scripts/validate_pr_body.cjs"]
source_tool: "repository"
source: "/private/tmp/standardize-deterministic-git-delivery-plan.md"
topics: ["repository-automation"]
digest: "d9459693bc22e3b27b4bb60d2ce2b243687ecab8994b4a6848b04b63e0eb8d8a"
---

# Standardize deterministic Git delivery

## Objective

Apply a hard cutover across the seven target repositories while leaving
`agent-review-workflows` unchanged:

- remove assisted commit and pull-request tooling with no compatibility path;
- keep standalone Commitlint and add deterministic PR-body validation;
- rename active wiki-writer secret references to `BOT_TOKEN`;
- document issue-first delivery from updated `main` through an opened PR, stopping
  before merge;
- preserve historical wiki records and any pre-existing dirty work.

## Delivery

1. Update every target from `main`, create and read back one labeled issue, and
   branch as `codex/<issue>-standardize-git-delivery`.
2. Remove helper packages, scripts, hooks, workflows, environment examples, and
   unused hoisting while retaining direct Commitlint policy.
3. Add the canonical PR template, validator, CI gate, and regression coverage.
4. Update active documentation, AGENTS guidance, wiki automation, and
   `BOT_TOKEN` references without rewriting historical plans or journals.
5. Run each repository's full `pnpm run verify:ci`, commit, push, open and verify
   the PR, then stop without merging.
6. Return repositories with pre-existing work to their original branches and
   restore the exact saved changes.
