---
date: "2026-08-23"
topics:
  - graph-viewer
  - wiki-system
  - installer-contract
plans: []
---
# Graph viewer parity and port fallback

## What happened

The context-wiki and research-operations viewers both displayed the simplified canonical `/wiki` viewer rather than the richer Build Orchestration presentation. Their installed viewer assets matched, and their vendored Sigma and Graphology runtimes matched the reference. The difference was in the skill-owned HTML, CSS, and JavaScript: it used the deterministic circular graph coordinates directly and did not run ForceAtlas2.

The canonical viewer now follows the reference shell and interaction model while retaining wiki-only nodes. The local graph server also advances from port 4173 when another repository viewer is already running, allowing simultaneous launches.

The global agent and Claude skill symlinks still targeted the checkout's removed `Projects/wiki` name after it was renamed to `Projects/context-wiki`. They now resolve to the renamed checkout. The global validator was corrected to validate real targets rather than rejecting the documented symlink installation pattern.

## Decisions

- Treat the browser ForceAtlas2 layout as presentation; keep generated graph bytes deterministic.
- Preserve search and type filtering, and add reference-style legend, neighborhood focus, reset, and node details.
- Automatically fall back only when no port was explicitly configured.
- Fix and test the canonical installer assets, then reinstall them into affected consumers.
- Treat resolved discovery targets, rather than literal checkout paths, as the global installation identity.

## Evidence

- `assets/repository/scripts/wiki/graph/viewer/{index.html,viewer.css,viewer.js}`
- `assets/repository/scripts/wiki/serve-graph.cjs`
- `node scripts/validate-install.cjs`
- `node scripts/test.cjs` — viewer, asset-path, port-fallback, and global discovery-link coverage
