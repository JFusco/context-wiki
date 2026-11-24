---
status: "implemented"
executed: true
evidence: ["https://github.com/JFusco/context-wiki/issues/32", "scripts/test.cjs"]
source_tool: "codex"
source: "https://github.com/JFusco/context-wiki/issues/32"
topics: ["maintainer-workflow"]
digest: "b833ea14e7072a870805da398f5ae37c1e776b3475f0985cde7ef102f6f8d997"
---

# Preserve wiki writer boundaries

- Bind automatic and numbered reconciliation to the repository default branch before credentialed checkout.
- Give batch replay and weekly issue refresh the same maintenance concurrency group while keeping separate groups for numbered PRs.
- Preserve both Git status columns in the advisory hook and skip a graph rebuild if status cannot be read.
- Check declared topics in archived plans while retaining historical body links.
- Match the mechanics page to the Monday schedule, cover the behavior with fixtures, and reconcile a clean consumer installation.
