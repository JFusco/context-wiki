---
date: 2026-08-23
topics: [wiki-navigation-and-automation, repository-automation, installer-contract, graph-viewer]
plans: [2026-08-23-promote-canonical-wiki-parity-369416673b.md]
pr: https://github.com/JFusco/context-wiki/pull/8
issue: https://github.com/JFusco/context-wiki/issues/7
---

# Promote canonical wiki parity

## Why

Portable wiki consumers had drifted in graph navigation, Git hook behavior, and GitHub Actions. Agents also lacked one exact, low-token traversal contract, while a custom wiki could not adopt navigation without receiving an unwanted second viewer and plan ledger.

## What changed

- Added repository-qualified GitHub evidence and byte metadata to the Markdown-only graph.
- Added deterministic weighted routing to the CLI and the Sigma Source/Target viewer.
- Made managed agent guidance route-first and introduced a navigation-only custom-root install boundary.
- Standardized installed wiki Actions, merge/issue reconciliation, and hook contamination defenses.
- Standardized the source repository on exact `@verndale/ai-commit@2.7.0` as its sole Commitlint provider, canonical commitlint/quality workflows, and a verified narrow pnpm hoist; retained its existing pinned PR helper and excluded `bot/wiki-**` from the generic PR workflow.
- Expanded installer, parser, router, viewer, workflow, hook, and clean-install regression coverage.
- Tightened shared GitHub evidence to canonical `pull-request` / `issue` kinds, excluded fenced citations, made citation search route-aware, preserved every closing-keyword issue in existing journals, made issue refresh fence-aware, and exposed route authority and byte cost explicitly in CLI/browser itineraries.
- Post-rollout review standardized the merge writer on `{schemaVersion: 1, repository, mergedAt, changedPaths}`, validated canonical/legacy commit records and wiki-owned journal paths, made exact evidence choose journal→topic→plan→index, and normalized pasted GitHub URL suffixes in CLI and browser.
- Length-aware fences, safe numeric IDs, hostile-URL boundaries, symlink-root rejection, and strict browser/Node routing-policy parity now keep parsing, refresh, graph links, and byte-aware itineraries on the same deterministic contract.

## Evidence

- [Issue #7](https://github.com/JFusco/context-wiki/issues/7)
- `node scripts/test.cjs`
- `pnpm exec commitlint --version`
- `node scripts/validate-install.cjs`

## Durable context

- [Wiki navigation and automation](../topics/wiki-navigation-and-automation.md)
- [Archived plan](../plans/2026-08-23-promote-canonical-wiki-parity-369416673b.md)
