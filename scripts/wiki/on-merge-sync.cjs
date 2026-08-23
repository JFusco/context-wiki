#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { repoRoot, slugify, substantive, ensureInside, hasSymlinkComponent, atomicWrite } = require("./lib/common.cjs");

function reconcile(context, root) {
  if (!context || !Number.isInteger(Number(context.number)) || Number(context.number) < 1 || !Array.isArray(context.files) || context.files.some((item) => typeof item !== "string")) throw new Error("merge context requires a positive number and string file paths");
  const changed = [];
  const number = Number(context.number);
  const title = String(context.title || "Merged change").replace(/\r?\n/g, " ").trim() || "Merged change";
  const journalFiles = context.files.filter((item) => item.startsWith("wiki/journal/") && item.endsWith(".md") && fs.existsSync(path.join(root, item)));
  if (substantive(context.files) && !journalFiles.length) {
    const date = String(context.merged_at || new Date().toISOString()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("merge context has an invalid merged_at date");
    const file = path.join(root, "wiki", "journal", `${date}-pr-${number}-${slugify(title)}.md`);
    if (!ensureInside(path.join(root, "wiki", "journal"), file) || hasSymlinkComponent(root, file)) throw new Error("merge journal path is unsafe");
    const body = `---\npr: ${JSON.stringify(context.url || `#${number}`)}\ntopics: []\nplans: []\n---\n\n# PR #${number}: ${title}\n\nMerged by GitHub reconciliation. Add durable rationale or topic links if the pull request context is insufficient.\n`;
    if (!fs.existsSync(file)) { atomicWrite(file, body); changed.push(path.relative(root, file)); }
  }
  for (const relative of journalFiles) {
    const file = path.join(root, relative);
    if (!ensureInside(root, file) || hasSymlinkComponent(root, file)) throw new Error(`unsafe journal path: ${relative}`);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, "utf8");
    const updated = original.replace(/\bPR:\s*(?:pending|TBD)\b/gi, `PR: ${context.url || `#${number}`}`);
    if (updated !== original) { atomicWrite(file, updated); changed.push(relative); }
  }
  return changed;
}

function main() {
  try {
    const at = process.argv.indexOf("--context");
    if (at < 0) throw new Error("Usage: on-merge-sync.cjs --context <merge.json> [--repo <path>]");
    const repoAt = process.argv.indexOf("--repo");
    const root = repoRoot(repoAt >= 0 ? process.argv[repoAt + 1] : process.cwd());
    const changed = reconcile(JSON.parse(fs.readFileSync(path.resolve(process.argv[at + 1]), "utf8")), root);
    console.log(`PASS merge reconciliation: ${changed.length} file(s) changed`);
    return 0;
  } catch (error) { console.error(`FAIL ${error.message}`); return 2; }
}
if (require.main === module) process.exit(main());
module.exports = { reconcile, main };
