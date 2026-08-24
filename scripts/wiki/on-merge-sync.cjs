#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { repoRoot, remoteSlug, slugify, substantive, ensureInside, hasSymlinkComponent, atomicWrite } = require("./lib/common.cjs");
const { splitFrontmatter, scalar, list } = require("./lib/frontmatter.cjs");
const { closingIssues, normalizeRepository, parseGithubQuery, ref } = require("./lib/github-refs.cjs");

function normalizeChangedPaths(context) {
  const source = Array.isArray(context?.changedPaths) ? context.changedPaths : Array.isArray(context?.files) ? context.files : null;
  if (!source) throw new Error("merge context requires string changedPaths or files");
  return source.map((value) => {
    if (typeof value !== "string" || !value || value.includes("\\") || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.split("/").some((part) => part === "." || part === "..")) throw new Error("merge context paths must be normalized repository-relative strings");
    return value;
  });
}

function normalizeCommits(context) {
  if (context?.commits == null) return [];
  if (!Array.isArray(context.commits)) throw new Error("merge context commits must be an array");
  return context.commits.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("merge context commits require string hash and subject fields");
    const hash = item.hash ?? item.sha;
    const subject = item.subject ?? item.message;
    if (typeof hash !== "string" || !hash.trim() || typeof subject !== "string" || !subject.split("\n")[0].trim()) throw new Error("merge context commits require string hash and subject fields");
    return { hash: hash.trim(), subject: subject.split("\n")[0].trim() };
  });
}

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
  if (!context || (context.schemaVersion != null && context.schemaVersion !== 1)) throw new Error("merge context schemaVersion must be 1 when present");
  if (context.title != null && typeof context.title !== "string") throw new Error("merge context title must be a string when provided");
  if (context.body != null && typeof context.body !== "string") throw new Error("merge context body must be a string when provided");
  const mergedAt = context.mergedAt ?? context.merged_at ?? null;
  if (mergedAt != null && (typeof mergedAt !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(mergedAt) || !Number.isFinite(Date.parse(mergedAt)))) throw new Error("merge context mergedAt must be a parseable ISO date string or null");
  const files = normalizeChangedPaths(context);
  const commits = normalizeCommits(context);
  if (!Number.isSafeInteger(Number(context.number)) || Number(context.number) < 1) throw new Error("merge context requires a positive safe integer number");
  const changed = [];
  const number = Number(context.number);
  const title = (context.title || "Merged change").replace(/\r?\n/g, " ").trim() || "Merged change";
  const journalDir = path.join(root, "wiki", "journal");
  const journalFiles = new Set();
  for (const item of files) {
    if (!item.startsWith("wiki/journal/") || !item.endsWith(".md")) continue;
    const target = path.resolve(root, item);
    if (!ensureInside(journalDir, target) || hasSymlinkComponent(root, target)) throw new Error(`unsafe journal path: ${item}`);
    if (!fs.existsSync(target)) continue;
    if (!fs.lstatSync(target).isFile()) throw new Error(`unsafe journal path: ${item}`);
    journalFiles.add(item);
  }
  const provided = parseGithubQuery(context.url);
  const declaredRepository = context.repository == null ? "" : normalizeRepository(context.repository);
  if (context.repository != null && !declaredRepository) throw new Error("merge context repository must be an owner/repo slug");
  const repository = declaredRepository || provided?.repository || remoteSlug(root);
  const expected = ref(repository, "pull-request", number);
  if (typeof context.url !== "string" || !context.url.trim() || !expected || !provided || provided.kind !== "pull-request" || provided.repository !== expected.repository || provided.number !== expected.number) throw new Error("merge context URL must match its repository and pull request number");
  const pullUrl = expected.url;
  const issues = closingIssues(context.body || "", repository);
  if (fs.existsSync(journalDir)) {
    for (const name of fs.readdirSync(journalDir).filter((item) => item.endsWith(".md")).sort()) {
      const relative = `wiki/journal/${name}`;
      if (journalFiles.has(relative)) continue;
      const candidate = path.join(root, relative);
      if (!fs.lstatSync(candidate).isFile()) continue;
      const parsed = splitFrontmatter(fs.readFileSync(candidate, "utf8"));
      if ([scalar(parsed.raw, "pr"), scalar(parsed.raw, "follow_up_pr")].includes(pullUrl)) journalFiles.add(relative);
    }
  }
  if (substantive(files) && !journalFiles.size) {
    const date = String(mergedAt || new Date().toISOString()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("merge context has an invalid merged_at date");
    const file = path.join(root, "wiki", "journal", `${date}-pr-${number}-${slugify(title)}.md`);
    if (!ensureInside(path.join(root, "wiki", "journal"), file) || hasSymlinkComponent(root, file)) throw new Error("merge journal path is unsafe");
    const body = [
      "---", `pr: ${JSON.stringify(pullUrl)}`, ...(issues.length ? [`issue: ${JSON.stringify(issues[0].url)}`, `issues: [${issues.map((item) => JSON.stringify(item.url)).join(", ")}]`] : []),
      "topics: []", "plans: []", "draft: github-reconciliation", "---", "", `# PR #${number}: ${title}`, "",
      "## Why", "", "- Auto-drafted from the merged pull request; add durable rationale when the PR does not carry it.", "",
      "## What changed", "", ...(commits.length ? commits.slice(0, 12).map((item) => `- ${item.subject}`) : ["- See the merged pull request."]), "",
      "## Files", "", ...files.slice(0, 20).map((item) => `- ${item}`), "",
    ].join("\n");
    if (!fs.existsSync(file)) { atomicWrite(file, body); changed.push(path.relative(root, file)); }
  }
  for (const relative of [...journalFiles].sort()) {
    const file = path.join(root, relative);
    if (!ensureInside(journalDir, file) || hasSymlinkComponent(root, file)) throw new Error(`unsafe journal path: ${relative}`);
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
