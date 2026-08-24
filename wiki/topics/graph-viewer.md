---
slug: graph-viewer
---
# Graph viewer

## Presentation contract

The installed wiki viewer uses the same Sigma.js presentation pattern as the Build Orchestration reference: a dark left control rail, dynamic type legend, search, reset, neighborhood focus, a right-side node detail panel, and Source/Target shortest-route controls. Graphology seeds nodes in a circle and runs 300 ForceAtlas2 iterations in the browser before Sigma renders them. The circular coordinates stored in deterministic `graph.json` output are not the final presentation layout.

The viewer continues to enforce the [wiki system](./wiki-system.md) boundary: every graph node ID must start with `wiki/`. The reference presentation does not broaden the graph into source code or tooling.

The browser and `scripts/wiki/navigate.cjs` share explicit edge, hub, and byte costs. Search and node details include repository-qualified PR/issue evidence. Route output shows Source→Target authority, each relationship, per-page bytes, and total estimated load so an agent can stop after the smallest grounded itinerary.

## Multi-repository serving

The local server tries port 4173 first. If an unconfigured launch finds that port occupied, it advances until it finds an available port and prints the selected URL. This permits viewers from multiple repositories to run simultaneously.

An explicit `GRAPH_PORT` or legacy `WIKI_GRAPH_PORT` is strict. If that requested port is occupied, the server fails instead of silently changing an automation-controlled endpoint.

## Installer ownership

The canonical HTML, CSS, JavaScript, and server live under `assets/repository/scripts/wiki/`. The checksum-protected installer distributes those files to `scripts/wiki/` in consuming repositories. Identical simplified viewers in multiple repositories therefore indicate canonical skill-asset behavior, not separate installation failures; update the skill and reinstall it in each consumer.
