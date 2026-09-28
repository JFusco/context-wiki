---
topics: [repository-automation]
plans: [2026-09-28-standardize-deterministic-git-delivery-d9459693bc.md]
issue: 'https://github.com/jfusco/context-wiki/issues/25'
issues: ['https://github.com/jfusco/context-wiki/issues/25']
---

# Standardize deterministic Git delivery

Issue [#25](https://github.com/JFusco/context-wiki/issues/25) replaces assisted commit
and pull-request entry points with a direct, deterministic delivery contract.
Standalone Commitlint remains authoritative for commit messages and PR titles.
The canonical PR template and validator require meaningful sections, an issue
closing reference, verification evidence, risk and rollback, and a completed
checklist.

`AGENTS.md` now requires delivery to begin from updated `main`, create and read
back one labeled issue, use an issue branch, record substantive work in the wiki,
run `pnpm run verify:ci`, commit and push with ordinary Git, and open a validated
PR. The sequence explicitly stops before merge and leaves the issue and branch
open for user review.

Active wiki-writer workflows now read `BOT_TOKEN`. Live repository configuration
confirmed that secret is present and the prior bot-token name is absent. No
secret value is stored or copied by this delivery. Historical plans and journals
retain their original wording.

Local verification is completed before the delivery commit and recorded in the
pull request. No hosted workflow or live secret execution is claimed here.
