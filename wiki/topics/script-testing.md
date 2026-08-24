---
slug: script-testing
---
# Script testing

## Strategy

`node scripts/test.cjs` is the canonical test command. It combines focused `node:test` unit coverage with isolated installer and repository integration scenarios, using Node.js standard-library modules and temporary repositories.

The suite protects parsing, dates, plan association and archiving, filesystem containment, symlink rejection, checksum behavior, hook preservation, graph determinism, and workflow installation. Topic integrity is part of that contract: implemented and partial archives without a topic must fail before any audit writes occur, and `wiki check` must reject legacy topicless archives.

## Historical delivery

- [Add focused `.cjs` unit tests](../plans/2026-08-23-add-focused-cjs-unit-tests-6569724de4.md) established the fast helper-level suite.
- [Create tracking issue and implementation branch](../plans/2026-08-23-create-tracking-issue-and-implementation-branch-aa427de2df.md) records the GitHub issue and branch setup for that delivery.
- [Issue #5](https://github.com/JFusco/context-wiki/issues/5 — closed) adds the topic-integrity regression coverage.

This testing strategy supports the broader [wiki system](./wiki-system.md).
