---
topics: [maintainer-workflow]
issue: https://github.com/JFusco/context-wiki/issues/32
plans: [2026-11-24-preserve-wiki-writer-boundaries-b833ea14e7.md]
---

# Wiki writer safeguards

Default-branch checks protect the credentialed merge workflow before checkout.
Batch replay and weekly issue refresh serialize updates to the same maintenance
branch and pull request. The mechanics page records the Monday schedule.

The pre-commit hook skips regenerating and staging the graph when wiki inputs
have unstaged changes or Git status is unavailable. Graph validation requires
archived plans to resolve declared topics while preserving historical body links.

The workflow, Git status, graph, and installer paths have local regression
coverage. [Shared kit repair issue #32](https://github.com/JFusco/context-wiki/issues/32)
