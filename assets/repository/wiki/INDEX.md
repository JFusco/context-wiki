# Context wiki

This wiki is the durable project record for decisions, executed plans, and substantive change history.

## Start here

- [Wiki mechanics](./MECHANICS.md) — authoring, plan capture, validation, and automation.
- [Plan ledger](./plans/INDEX.md) — executed-plan archives and historical audit results.
- `wiki/topics/` — durable decision and domain pages.
- `wiki/journal/` — chronological substantive-change entries.
- `wiki/connections.md` — generated relationship summary.

The interactive Sigma.js viewer is served at http://127.0.0.1:4173/ after `node scripts/wiki/build-graph.cjs` then `node scripts/wiki/serve-graph.cjs` (set `GRAPH_PORT` to change the port).
