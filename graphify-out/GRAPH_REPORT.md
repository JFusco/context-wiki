# Graph Report - .  (2026-09-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 675 nodes · 1565 edges · 30 communities (27 shown, 3 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 260 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8579959f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scripts/wiki/audit-plan-candidates.cjs
- scripts/wiki/graph/viewer/viewer.js
- repository/scripts/wiki/audit-plan-candidates.cjs
- repository/scripts/wiki/lib/common.cjs
- repository/scripts/wiki/routing.cjs
- scripts/wiki/routing.cjs
- repository/scripts/wiki/lib/plans.cjs
- init-repository.cjs
- repository/scripts/wiki/archive-plan.cjs
- repository/scripts/wiki/graph/viewer/viewer.js
- scripts/wiki/lib/wiki-graph.cjs
- scripts/wiki/on-merge-sync.cjs
- repository/scripts/wiki/refresh-issue-state.cjs
- scripts/wiki/refresh-issue-state.cjs
- scripts/wiki/lib/common.cjs
- repository/scripts/wiki/on-merge-sync.cjs
- scripts/wiki/lib/plans.cjs
- repository/scripts/wiki/check.cjs
- scripts/wiki/archive-plan.cjs
- repository/scripts/wiki/reconcile-merges.cjs
- scripts/wiki/reconcile-merges.cjs
- scripts/wiki/check.cjs
- repository/scripts/wiki/serve-graph.cjs
- MultiGraph
- scripts/wiki/serve-graph.cjs
- validate_pr_body.cjs
- update-repository.cjs
- validate-install.cjs
- repository/scripts/wiki/graph/viewer/routing.js
- scripts/wiki/graph/viewer/routing.js

## God Nodes (most connected - your core abstractions)
1. `repoRoot()` - 26 edges
2. `repoRoot()` - 26 edges
3. `reconcile()` - 23 edges
4. `reconcile()` - 23 edges
5. `collect()` - 18 edges
6. `collect()` - 18 edges
7. `slash()` - 17 edges
8. `git()` - 17 edges
9. `slash()` - 17 edges
10. `git()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `buildIndexes()` --indirect_call--> `node()`  [INFERRED]
  assets/repository/scripts/wiki/graph/viewer/viewer.js → scripts/test.cjs
- `buildModel()` --indirect_call--> `node()`  [INFERRED]
  assets/repository/scripts/wiki/graph/viewer/viewer.js → scripts/test.cjs
- `applyView()` --indirect_call--> `node()`  [INFERRED]
  assets/repository/scripts/wiki/graph/viewer/viewer.js → scripts/test.cjs
- `resolveBaseBranch()` --indirect_call--> `candidate()`  [INFERRED]
  assets/repository/scripts/wiki/audit-plan-candidates.cjs → assets/repository/scripts/wiki/lib/plans.cjs
- `resolveBaseBranch()` --indirect_call--> `candidate()`  [INFERRED]
  scripts/wiki/audit-plan-candidates.cjs → scripts/wiki/lib/plans.cjs

## Import Cycles
- None detected.

## Communities (30 total, 3 thin omitted)

### Community 0 - "scripts/wiki/audit-plan-candidates.cjs"
Cohesion: 0.07
Nodes (54): { archive, validateArchiveInput, STATUSES }, fs, { inferPlanDate }, main(), parse(), path, { repoRoot }, STATUSES (+46 more)

### Community 1 - "scripts/wiki/graph/viewer/viewer.js"
Cohesion: 0.07
Nodes (41): assert, FakeServer, fs, git(), INIT, makeGit(), node(), os (+33 more)

### Community 2 - "repository/scripts/wiki/audit-plan-candidates.cjs"
Cohesion: 0.09
Nodes (46): audit(), branchIssueNumbers(), classify(), distinctiveTitleWords(), { execFileSync }, extractPaths(), findPrForMergeSubject(), fmtCommit() (+38 more)

### Community 3 - "repository/scripts/wiki/lib/common.cjs"
Cohesion: 0.12
Nodes (30): fromArgs(), { collect, resolveWikiLink, kind }, connections(), fs, main(), path, { repoRoot, slash, hasSymlinkComponent, atomicWrite }, atomicWrite() (+22 more)

### Community 4 - "repository/scripts/wiki/routing.cjs"
Cohesion: 0.11
Nodes (31): { collect, normalizeWikiRoot }, main(), parseArgs(), { repoRoot }, { route, formatRoute }, usage(), adjacency(), edgeCost() (+23 more)

### Community 5 - "scripts/wiki/routing.cjs"
Cohesion: 0.11
Nodes (31): { collect, normalizeWikiRoot }, main(), parseArgs(), { repoRoot }, { route, formatRoute }, usage(), adjacency(), edgeCost() (+23 more)

### Community 6 - "repository/scripts/wiki/lib/plans.cjs"
Cohesion: 0.10
Nodes (29): { discover }, fs, main(), parse(), path, { repoRoot, atomicWrite }, substantive(), association() (+21 more)

### Community 7 - "init-repository.cjs"
Cohesion: 0.13
Nodes (31): ASSET_ROOT, atomicWrite(), AUTHORED_SEED_FILES, crypto, { execFileSync, spawnSync }, fs, githubRemote(), hasSymlinkComponent() (+23 more)

### Community 8 - "repository/scripts/wiki/archive-plan.cjs"
Cohesion: 0.11
Nodes (26): { archive, validateArchiveInput, STATUSES }, fs, { inferPlanDate }, main(), parse(), path, { repoRoot }, archive() (+18 more)

### Community 9 - "repository/scripts/wiki/graph/viewer/viewer.js"
Cohesion: 0.19
Nodes (25): addMetaLink(), addMetaRow(), addRelationship(), applyView(), buildIndexes(), buildLegend(), buildModel(), buildRenderer() (+17 more)

### Community 10 - "scripts/wiki/lib/wiki-graph.cjs"
Cohesion: 0.16
Nodes (23): fromArgs(), { collect, resolveWikiLink, kind }, connections(), fs, main(), path, { repoRoot, slash, hasSymlinkComponent, atomicWrite }, ensureInside() (+15 more)

### Community 11 - "scripts/wiki/on-merge-sync.cjs"
Cohesion: 0.18
Nodes (23): fieldSpan(), keyPattern(), list(), parseListLiteral(), scalar(), splitFrontmatter(), cleanCursor(), {
  closingIssues,
  normalizeGithubQuery,
  normalizeRepository,
  parseGithubQuery,
  ref,
} (+15 more)

### Community 12 - "repository/scripts/wiki/refresh-issue-state.cjs"
Cohesion: 0.18
Nodes (21): advanceFence(), closingIssues(), githubRefs(), key(), normalizeGithubQuery(), normalizeRepository(), parseGithubQuery(), ref() (+13 more)

### Community 13 - "scripts/wiki/refresh-issue-state.cjs"
Cohesion: 0.18
Nodes (21): advanceFence(), closingIssues(), githubRefs(), key(), normalizeGithubQuery(), normalizeRepository(), parseGithubQuery(), ref() (+13 more)

### Community 14 - "scripts/wiki/lib/common.cjs"
Cohesion: 0.12
Nodes (20): { discover }, fs, main(), parse(), path, { repoRoot, atomicWrite }, atomicWrite(), crypto (+12 more)

### Community 15 - "repository/scripts/wiki/on-merge-sync.cjs"
Cohesion: 0.19
Nodes (19): repoRoot(), splitFrontmatter(), {
  closingIssues,
  normalizeGithubQuery,
  normalizeRepository,
  parseGithubQuery,
  ref,
}, FILE_STATUSES, fs, main(), markdownCode(), mergeIssueEvidence() (+11 more)

### Community 16 - "scripts/wiki/lib/plans.cjs"
Cohesion: 0.19
Nodes (19): digest(), walk(), association(), auditedDigests(), candidate(), collapseByTitle(), { digest, git, remoteSlug, walk, slash }, discover() (+11 more)

### Community 17 - "repository/scripts/wiki/check.cjs"
Cohesion: 0.18
Nodes (17): fs, { key: githubRefKey }, { loadPolicy, policyProblems }, main(), path, {
  repoRoot,
  walk,
  slash,
  digest,
  hasSymlinkComponent,
}, { spawnSync }, {
  splitFrontmatter,
  scalar,
  list,
  frontmatterProblems,
} (+9 more)

### Community 18 - "scripts/wiki/archive-plan.cjs"
Cohesion: 0.16
Nodes (18): archive(), cell(), { cleanCursor }, { digest, repoRoot, slugify, slash, ensureInside, hasSymlinkComponent, atomicWrite, walk }, ensureIndex(), fs, { inferPlanDate }, label() (+10 more)

### Community 19 - "repository/scripts/wiki/reconcile-merges.cjs"
Cohesion: 0.18
Nodes (16): collectPulls(), copyWikiForDryRun(), { execFileSync }, flattenPages(), fs, githubRequest(), isWikiBotPull(), main() (+8 more)

### Community 20 - "scripts/wiki/reconcile-merges.cjs"
Cohesion: 0.18
Nodes (16): collectPulls(), copyWikiForDryRun(), { execFileSync }, flattenPages(), fs, githubRequest(), isWikiBotPull(), main() (+8 more)

### Community 21 - "scripts/wiki/check.cjs"
Cohesion: 0.22
Nodes (10): fs, { key: githubRefKey }, { loadPolicy, policyProblems }, main(), path, {
  repoRoot,
  walk,
  slash,
  digest,
  hasSymlinkComponent,
}, { spawnSync }, {
  splitFrontmatter,
  scalar,
  list,
  frontmatterProblems,
} (+2 more)

### Community 22 - "repository/scripts/wiki/serve-graph.cjs"
Cohesion: 0.24
Nodes (9): createServer(), fs, http, listen(), main(), path, { repoRoot, ensureInside }, resolveRequest() (+1 more)

### Community 24 - "scripts/wiki/serve-graph.cjs"
Cohesion: 0.24
Nodes (9): createServer(), fs, http, listen(), main(), path, { repoRoot, ensureInside }, resolveRequest() (+1 more)

### Community 25 - "validate_pr_body.cjs"
Cohesion: 0.39
Nodes (8): fs, main(), readableText(), REQUIRED_CHECKS, REQUIRED_SECTIONS, sections(), validatePullRequestBody(), withoutComments()

### Community 26 - "update-repository.cjs"
Cohesion: 0.40
Nodes (4): installer, path, result, { spawnSync }

### Community 27 - "validate-install.cjs"
Cohesion: 0.40
Nodes (3): fs, os, path

## Knowledge Gaps
- **193 isolated node(s):** `fs`, `path`, `{ archive, validateArchiveInput, STATUSES }`, `{ repoRoot }`, `{ inferPlanDate }` (+188 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `repoRoot()` connect `repository/scripts/wiki/on-merge-sync.cjs` to `repository/scripts/wiki/audit-plan-candidates.cjs`, `repository/scripts/wiki/lib/common.cjs`, `repository/scripts/wiki/routing.cjs`, `repository/scripts/wiki/lib/plans.cjs`, `repository/scripts/wiki/archive-plan.cjs`, `repository/scripts/wiki/refresh-issue-state.cjs`, `repository/scripts/wiki/check.cjs`, `repository/scripts/wiki/reconcile-merges.cjs`, `repository/scripts/wiki/serve-graph.cjs`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `repoRoot()` connect `scripts/wiki/lib/common.cjs` to `scripts/wiki/audit-plan-candidates.cjs`, `scripts/wiki/routing.cjs`, `scripts/wiki/lib/wiki-graph.cjs`, `scripts/wiki/on-merge-sync.cjs`, `scripts/wiki/refresh-issue-state.cjs`, `scripts/wiki/archive-plan.cjs`, `scripts/wiki/reconcile-merges.cjs`, `scripts/wiki/check.cjs`, `scripts/wiki/serve-graph.cjs`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `node()` connect `scripts/wiki/graph/viewer/viewer.js` to `repository/scripts/wiki/graph/viewer/viewer.js`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `{ archive, validateArchiveInput, STATUSES }` to the rest of the system?**
  _193 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts/wiki/audit-plan-candidates.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06954887218045112 - nodes in this community are weakly interconnected._
- **Should `scripts/wiki/graph/viewer/viewer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07088989441930618 - nodes in this community are weakly interconnected._
- **Should `repository/scripts/wiki/audit-plan-candidates.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08776595744680851 - nodes in this community are weakly interconnected._