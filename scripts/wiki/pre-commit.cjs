#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { repoRoot, git, substantive } = require("./lib/common.cjs");
const { discover } = require("./lib/plans.cjs");

function main() {
  const root = repoRoot(process.cwd());
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], root).split(/\r?\n/).filter(Boolean);
  if (substantive(staged) && !staged.some((item) => item.startsWith("wiki/journal/"))) console.warn("wiki warning: substantive staged changes have no journal entry");
  try {
    const manifest = discover(root, [], { sinceDays: 2 });
    const pending = manifest.candidates.filter((item) => item.association !== "unmatched");
    if (pending.length) console.warn(`wiki warning: ${pending.length} historical plan candidates still need an evidence audit`);
  } catch (error) { console.warn(`wiki warning: plan discovery failed open: ${error.message}`); }
  const wikiStatus = git(["status", "--porcelain", "--untracked-files=all", "--", "wiki"], root).split(/\r?\n/).filter(Boolean);
  const hasUnstagedWiki = wikiStatus.some((line) => line.startsWith("??") || (line.length > 1 && line[1] !== " "));
  if (hasUnstagedWiki) {
    console.warn("wiki warning: unstaged wiki changes detected; graph rebuild skipped to avoid staging generated data for uncommitted content");
    return 0;
  }
  const build = spawnSync(process.execPath, [path.join(root, "scripts/wiki/build-graph.cjs")], { cwd: root, encoding: "utf8" });
  if (build.status === 0) {
    spawnSync("git", ["add", "--", "wiki/connections.md", "scripts/wiki/graph/data/graph.json"], { cwd: root });
  } else console.warn(`wiki warning: graph rebuild failed open: ${(build.stderr || build.stdout).trim()}`);
  return 0;
}
if (require.main === module) process.exit(main());
module.exports = { main };
