---
status: "implemented"
executed: true
evidence: ["Issue #7 https://github.com/JFusco/context-wiki/issues/7", "node scripts/test.cjs (45 tests)", "pnpm exec commitlint --version (@commitlint/cli@20.5.3)"]
source_tool: "repository"
source: "/private/tmp/context-wiki-issue-7-plan.md"
topics: ["wiki-navigation-and-automation"]
digest: "369416673bd47f1581e8b06ce4e631039ab5c640a021e8ae4757ce04cbb769e9"
---

# Promote canonical wiki parity

## Goal

Make the `/wiki` skill the portable source for efficient graph navigation, GitHub evidence, hooks, and GitHub Actions while preserving repositories that already own custom wiki mechanics.

## Work

1. Add a reusable repository-qualified GitHub PR/issue parser and enrich Markdown graph nodes with evidence, aliases, degree, and byte size.
2. Add one deterministic weighted routing policy for the CLI and browser, Source/Target viewer controls, and compact byte-aware itineraries.
3. Install exact route-first `AGENTS.md` guidance and a custom-root headless mode that adds no viewer, committed graph, plan ledger, hook, or workflow.
4. Standardize the three portable wiki Actions on Node 24, safe bot branches/tokens, pagination, manual merged-PR replay, the daily issue-state cron, force-with-lease, reopen handling, and bot guards.
5. Preserve blocking Git hook failures and prevent generated-output contamination from unstaged wiki inputs.
6. Use `@verndale/ai-commit@2.7.0` as the source repository's sole provider, with a narrow public hoist for its bundled commitlint CLI and canonical quality checks.
7. Update installer manifests, mirrors, skill/docs/metadata, tests, and this repository's own wiki records.

## Verification

- Run installer integration, routing/parser/viewer/workflow/hook tests.
- Verify a clean pnpm fixture exposes commitlint without a direct CLI dependency.
- Run skill validation, wiki integrity, skill quick validation, and whitespace checks.
