#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { repoRoot, remoteSlug, slugify, substantive, ensureInside, hasSymlinkComponent, atomicWrite } = require("./lib/common.cjs");
const { splitFrontmatter, scalar, list } = require("./lib/frontmatter.cjs");
const { closingIssues } = require("./lib/github-refs.cjs");

function setFrontmatterField(text, key, rendered) {
  const parsed = splitFrontmatter(text);
  if (!parsed.full) return text;
  const lines = parsed.raw.split(/\r?\n/);
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*`);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) lines.push(`${key}: ${rendered}`);
  else {
    let count = 1;
    while (index + count < lines.length && /^\s+-\s+/.test(lines[index + count])) count++;
    lines.splice(index, count, `${key}: ${rendered}`);
  }
  return `---\n${lines.join("\n")}\n---\n${parsed.body}`;
}

function mergeIssueEvidence(text, issues) {
  if (!issues.length) return text;
  const parsed = splitFrontmatter(text);
  if (!parsed.full) return text;
  const current = scalar(parsed.raw, "issue");
  const retained = /^(?:pending|tbd|none)$/i.test(current) ? [] : [current];
  const urls = [...new Set([...retained, ...list(parsed.raw, "issues"), ...issues.map((item) => item.url)].filter(Boolean))];
  let updated = text;
  if (!current || /^(?:pending|tbd|none)$/i.test(current)) updated = setFrontmatterField(updated, "issue", JSON.stringify(urls[0]));
  return setFrontmatterField(updated, "issues", `[${urls.map((item) => JSON.stringify(item)).join(", ")}]`);
}

function reconcile(context, root) {
  const files = context?.files || context?.changedPaths;
  if (!context || !Number.isInteger(Number(context.number)) || Number(context.number) < 1 || !Array.isArray(files) || files.some((item) => typeof item !== "string")) throw new Error("merge context requires a positive number and string file paths");
  const changed = [];
  const number = Number(context.number);
  const title = String(context.title || "Merged change").replace(/\r?\n/g, " ").trim() || "Merged change";
  const journalFiles = new Set(files.filter((item) => item.startsWith("wiki/journal/") && item.endsWith(".md") && fs.existsSync(path.join(root, item))));
  const repository = remoteSlug(root);
  const pullUrl = String(context.url || (repository ? `https://github.com/${repository}/pull/${number}` : `#${number}`));
  const issues = closingIssues(context.body || "", repository);
  const journalDir = path.join(root, "wiki", "journal");
  if (fs.existsSync(journalDir)) {
    for (const name of fs.readdirSync(journalDir).filter((item) => item.endsWith(".md")).sort()) {
      const relative = `wiki/journal/${name}`;
      if (journalFiles.has(relative)) continue;
      const parsed = splitFrontmatter(fs.readFileSync(path.join(root, relative), "utf8"));
      if ([scalar(parsed.raw, "pr"), scalar(parsed.raw, "follow_up_pr")].includes(pullUrl)) journalFiles.add(relative);
    }
  }
  if (substantive(files) && !journalFiles.size) {
    const date = String(context.merged_at || context.mergedAt || new Date().toISOString()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("merge context has an invalid merged_at date");
    const file = path.join(root, "wiki", "journal", `${date}-pr-${number}-${slugify(title)}.md`);
    if (!ensureInside(path.join(root, "wiki", "journal"), file) || hasSymlinkComponent(root, file)) throw new Error("merge journal path is unsafe");
    const commits = (context.commits || []).map((item) => String(item.subject || item.message || "").trim()).filter(Boolean).slice(0, 12);
    const body = [
      "---", `pr: ${JSON.stringify(pullUrl)}`, ...(issues.length ? [`issue: ${JSON.stringify(issues[0].url)}`, `issues: [${issues.map((item) => JSON.stringify(item.url)).join(", ")}]`] : []),
      "topics: []", "plans: []", "draft: github-reconciliation", "---", "", `# PR #${number}: ${title}`, "",
      "## Why", "", "- Auto-drafted from the merged pull request; add durable rationale when the PR does not carry it.", "",
      "## What changed", "", ...(commits.length ? commits.map((item) => `- ${item}`) : ["- See the merged pull request."]), "",
      "## Files", "", ...files.slice(0, 20).map((item) => `- ${item}`), "",
    ].join("\n");
    if (!fs.existsSync(file)) { atomicWrite(file, body); changed.push(path.relative(root, file)); }
  }
  for (const relative of [...journalFiles].sort()) {
    const file = path.join(root, relative);
    if (!ensureInside(root, file) || hasSymlinkComponent(root, file)) throw new Error(`unsafe journal path: ${relative}`);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, "utf8");
    let updated = original.replace(/^(\s*(?:pr|follow_up_pr)):\s*(?:pending|TBD)\s*$/gim, `$1: ${pullUrl}`);
    updated = mergeIssueEvidence(updated, issues);
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
module.exports = { reconcile, mergeIssueEvidence, setFrontmatterField, main };
