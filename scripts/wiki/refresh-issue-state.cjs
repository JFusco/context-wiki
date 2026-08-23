#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { repoRoot, walk } = require("./lib/common.cjs");

function issueRefs(text) {
  const refs = [...text.matchAll(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/g)].map((match) => ({ url: match[0], owner: match[1], repo: match[2], number: match[3] }));
  return [...new Map(refs.map((item) => [item.url, item])).values()];
}
function setIssueState(text, url, state) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})(?:\\s+—\\s+closed)?`, "g"), state === "closed" ? "$1 — closed" : "$1");
}
function markClosed(text, url) { return setIssueState(text, url, "closed"); }
function main() {
  try {
    const repoAt = process.argv.indexOf("--repo");
    const root = repoRoot(repoAt >= 0 ? process.argv[repoAt + 1] : process.cwd());
    let changed = 0;
    for (const file of walk(path.join(root, "wiki", "topics"), (item) => item.endsWith(".md"))) {
      let text = fs.readFileSync(file, "utf8");
      const original = text;
      for (const issue of issueRefs(text)) {
        const state = execFileSync("gh", ["api", `repos/${issue.owner}/${issue.repo}/issues/${issue.number}`, "--jq", ".state"], { encoding: "utf8" }).trim();
        text = setIssueState(text, issue.url, state);
      }
      if (text !== original) { fs.writeFileSync(file, text); changed++; }
    }
    console.log(`PASS issue-state refresh: ${changed} topic(s) changed`);
    return 0;
  } catch (error) { console.error(`FAIL ${error.message}`); return 2; }
}
if (require.main === module) process.exit(main());
module.exports = { issueRefs, setIssueState, markClosed, main };
