#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { repoRoot, walk, slash, digest, hasSymlinkComponent } = require("./lib/common.cjs");
const { splitFrontmatter, scalar, list } = require("./lib/frontmatter.cjs");

function main() {
  const repoAt = process.argv.indexOf("--repo");
  const root = repoRoot(repoAt >= 0 ? process.argv[repoAt + 1] : process.cwd());
  const errors = [];
  const ledgerFile = path.join(root, "wiki", "plans", "INDEX.md");
  const ledger = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, "utf8") : "";
  if (ledger && !ledger.includes("<!-- wiki-plan-rows -->")) errors.push("wiki/plans/INDEX.md: missing wiki-plan-rows marker");
  const ledgerDigests = [...ledger.matchAll(/<!--\s*plan:([a-f0-9]{64})\s*-->/gi)].map((match) => match[1].toLowerCase());
  const duplicateLedger = ledgerDigests.filter((value, index) => ledgerDigests.indexOf(value) !== index);
  if (duplicateLedger.length) errors.push(`duplicate plan ledger digests: ${[...new Set(duplicateLedger)].join(", ")}`);
  const archiveDigests = new Set();
  for (const required of ["wiki/INDEX.md", "wiki/MECHANICS.md", "wiki/plans/INDEX.md", "scripts/wiki/graph/data/graph.json"]) {
    if (!fs.existsSync(path.join(root, required))) errors.push(`missing ${required}`);
  }
  for (const file of walk(path.join(root, "wiki", "plans"), (item) => item.endsWith(".md") && path.basename(item) !== "INDEX.md")) {
    if (hasSymlinkComponent(root, file)) { errors.push(`${slash(path.relative(root, file))}: symbolic links are not allowed`); continue; }
    const parsed = splitFrontmatter(fs.readFileSync(file, "utf8"));
    const status = scalar(parsed.raw, "status");
    const executed = scalar(parsed.raw, "executed");
    const evidence = list(parsed.raw, "evidence");
    const recordedDigest = scalar(parsed.raw, "digest").toLowerCase();
    const computedDigest = digest(parsed.body.trim() + "\n");
    for (const key of ["status", "executed", "source_tool", "source", "topics", "digest"]) if (!new RegExp(`^${key}:`, "m").test(parsed.raw)) errors.push(`${slash(path.relative(root, file))}: missing ${key}`);
    if (!["implemented", "partial"].includes(status)) errors.push(`${slash(path.relative(root, file))}: archived bodies must be implemented or partial`);
    if (executed !== "true") errors.push(`${slash(path.relative(root, file))}: executed must be true`);
    if (!evidence.length) errors.push(`${slash(path.relative(root, file))}: implementation evidence is required`);
    if (!/^[a-f0-9]{64}$/.test(recordedDigest) || recordedDigest !== computedDigest) errors.push(`${slash(path.relative(root, file))}: digest does not match the archived body`);
    else {
      if (archiveDigests.has(recordedDigest)) errors.push(`${slash(path.relative(root, file))}: duplicate archived digest`);
      archiveDigests.add(recordedDigest);
      if (!ledgerDigests.includes(recordedDigest)) errors.push(`${slash(path.relative(root, file))}: missing plan ledger row`);
    }
    if (!scalar(parsed.raw, "source_tool")) errors.push(`${slash(path.relative(root, file))}: source_tool must not be empty`);
    if (!scalar(parsed.raw, "source")) errors.push(`${slash(path.relative(root, file))}: source must not be empty`);
  }
  if (fs.existsSync(path.join(root, "scripts/wiki/graph/data/graph.json"))) {
    try {
      const graph = JSON.parse(fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8"));
      if (graph.nodes.some((node) => !node.id.startsWith("wiki/"))) errors.push("graph contains a node outside wiki/");
    } catch (error) { errors.push(`invalid graph JSON: ${error.message}`); }
  }
  const graph = spawnSync(process.execPath, [path.join(root, "scripts/wiki/build-graph.cjs"), "--check", "--repo", root], { cwd: root, encoding: "utf8" });
  if (graph.status !== 0) errors.push((graph.stderr || graph.stdout).trim());
  if (errors.length) { for (const error of errors) console.error(`FAIL ${error}`); return 2; }
  console.log("PASS wiki integrity");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { main };
