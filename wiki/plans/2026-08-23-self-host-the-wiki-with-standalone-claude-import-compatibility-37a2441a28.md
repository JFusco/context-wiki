---
status: "implemented"
executed: true
evidence: ["Issue #3 branch codex/3-self-host-context-wiki", "Changed paths: scripts/init-repository.cjs, scripts/test.cjs, scripts/unit.test.cjs, SKILL.md, README.md", "PASS node scripts/validate-install.cjs; node scripts/test.cjs; node scripts/wiki/check.cjs; git diff --check"]
source_tool: "codex"
source: "codex:/Users/joe.fusco/.codex/sessions/2026/08/23/rollout-2026-08-23T12-54-35-01a02f8b-a3a1-7a11-abd1-98c4910afae9.jsonl"
topics: ["installer-contract"]
digest: "37a2441a284a6fd36b3249a83eb931eefffa85aef65e063c5039b85a578569f7"
---

# Self-Host the Wiki with Standalone CLAUDE Import Compatibility

## Summary

Initialize the clean current worktree at `bee181d` as its own context-wiki repository, backfill historical plans, record this delivery, and validate everything. Preserve the repository-required one-line `CLAUDE.md`; do not modify the separate `/Users/joe.fusco/Projects/wiki` checkout.

## Implementation Changes

- Update the local installer to treat a file containing only `@AGENTS.md` as already compliant and leave its bytes unchanged. Missing files and files with other authored content retain the existing managed-block behavior; no CLI flags change.
- Document this compatibility in `SKILL.md` and `README.md`, and add unit/integration coverage for standalone-import preservation, managed-block updates, dry runs, idempotence, and existing symlink/checksum protections.
- Run the updated worktree-local installer. It will add the wiki templates, repository scripts, Sigma.js viewer, three GitHub workflows, managed `AGENTS.md` contract, and `.githooks/pre-commit`; configure `core.hooksPath=.githooks`.
- Immediately rerun the installer in dry-run mode before authored wiki records change, confirming zero installer drift and an unchanged one-line `CLAUDE.md`.

## Plan Backfill and Wiki Record

- Discover candidates into the linked worktree’s Git directory and audit against `HEAD`, because this worktree is detached. Baseline discovery found 737 candidates: 6 matched, 193 ambiguous, and 538 unmatched.
- Review all 199 historical matched/ambiguous candidates rather than accepting filename/path matches:
  - Mark “Add focused `.cjs` unit tests” implemented with PR #2 branch/merge evidence.
  - Mark “Global `/wiki` Skill and Repository Bootstrap” partial because delivery commits exist but no merged-branch evidence is reachable.
  - Mark “Create tracking issue and implementation branch” implemented only if GitHub confirms issue #1 and its labels; otherwise partial with the exact PR #2 branch evidence.
  - Mark Build-Orchestration, Forge-to-Figma, provision-sitecore, Graphify, and other basename-only false matches out-of-scope.
  - Require plausible merged branch evidence for every other historical `implemented` row; otherwise use partial, not-implemented, or out-of-scope as supported by the body and history.
- Apply the corrected audit to the initially empty ledger, rerun discovery, and explicitly report any remaining ambiguity.
- Create `wiki/topics/installer-contract.md` and `wiki/journal/2026-08-23-wiki-bootstrap-and-claude-import.md`. Archive this plan as implemented with exact changed-path and passing-test evidence, then link the journal, topic, and generated plan archive.
- Rebuild the graph, keeping every node under `wiki/`.

## Test Plan

- Run `node scripts/validate-install.cjs`, `node scripts/test.cjs`, and the new standalone-import tests.
- Run `node scripts/wiki/build-graph.cjs` and `node scripts/wiki/check.cjs`; require fresh deterministic graph bytes, valid evidence, and no dangling relationships.
- Run `git diff --check` and review `git status --short`, preserving unrelated work.
- Report audit counts by final status, remaining ambiguity, hook target, installed GitHub workflows, and the direct viewer command: `node scripts/wiki/serve-graph.cjs`.

## Assumptions

- Keep the current detached worktree; do not create a branch, commit, push, or modify the separate canonical checkout.
- GitHub workflows are installed because `origin` is GitHub. Remind the user to configure `PR_BOT_TOKEN` with contents and pull-request write access.
- If live GitHub access remains unavailable, use merge commits as the documented fallback and avoid upgrading uncertain candidates to implemented.
