---
aliases: [route-first wiki, portable wiki graph, wiki Actions]
---

# Wiki navigation and automation

## Purpose

Keep repository history cheap for agents to retrieve and keep portable wiki automation consistent across consumers.

## Current decisions

- Graph nodes are Markdown pages under the configured wiki root. Each node carries byte size, aliases, degree, and repository-qualified `githubRefs` with canonical `issue` / `pull-request` kinds; fenced URLs are ignored and source code and automation remain outside the knowledge graph.
- `scripts/wiki/routing-policy.json` is shared by the CLI and browser. Routes use explicit edge costs, hub and byte penalties, stable tie-breaking, and exact Source/Target IDs; both runtimes reject malformed exclusions and graph edge kinds without positive costs before traversal.
- Agent and browser output identifies explicit Source→Target authority, each page relationship and byte count, and total bytes. Exact repository-qualified evidence prefers a citing journal, then topic, plan, and index; ambiguity is reported only within the strongest type. Pasted canonical GitHub URLs are normalized across query/fragment suffixes in both CLI routing and browser search. Agents read the itinerary in order, stop when grounded, and resolve remaining ambiguity with returned candidates or one targeted search.
- Full installs own the portable viewer, generated graph, plan ledger, lifecycle hook, and three canonical GitHub Actions. Headless custom-root installs own only navigation scripts and managed agent guidance, preserving repository-specific mechanics.
- Merge reconciliation is event-driven and manually replayable. Its writer emits the versioned, repository-qualified canonical context while the reconciler retains named legacy aliases and validates commit records, URL identity, and normalized wiki-owned journal paths. It merges every closing-keyword same- or cross-repository issue, including Oxford-comma and ampersand lists, and ignores arbitrary or length-aware fenced citations. Only issue-state refresh needs the daily `30 11 * * *` schedule because an external issue can close or reopen without a repository event; refresh rejects symlinked roots and entries before lookup or write.
- Write workflows use `PR_BOT_TOKEN`, Node 24.14.0, pagination, bot recursion guards, authenticated force-with-lease, reopen handling, and `GRAPHIFY_SKIP_HOOK=1`.
- The advisory wiki hook never masks an earlier blocking hook failure and skips graph staging whenever unstaged inputs could contaminate generated output.
- This source repository uses exact `@verndale/ai-commit@2.7.0` as its sole Commitlint provider. A narrow pnpm public hoist exposes its bundled CLI. Its separate pinned PR helper remains in place, and the generic PR workflow ignores `bot/wiki-**`.

## Decisions

- 2026-08-23 — Promoted deterministic navigation, repo-qualified GitHub evidence, canonical Actions, safe hooks, and the custom-root headless boundary through the `/wiki` skill ([issue #7](https://github.com/JFusco/context-wiki/issues/7)).

## Open threads

- None.
