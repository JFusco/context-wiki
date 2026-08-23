#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function main() {
  const root = path.resolve(__dirname, "..");
  const errors = [];
  const required = [
    "SKILL.md", "package.json", "pnpm-lock.yaml", ".env.example", ".github/workflows/pr.yml", ".husky/commit-msg", ".husky/prepare-commit-msg",
    "agents/openai.yaml", "scripts/init-repository.cjs", "scripts/update-repository.cjs", "scripts/test.cjs", "assets/repository/wiki/INDEX.md",
    "assets/repository/scripts/wiki/discover-plans.cjs", "assets/repository/scripts/wiki/archive-plan.cjs",
    "assets/repository/scripts/wiki/build-graph.cjs", "assets/repository/scripts/wiki/check.cjs",
    "assets/repository/scripts/wiki/graph/viewer/vendor/sigma.min.js",
    "assets/repository/.github/workflows/wiki-check.yml", "assets/repository/.github/workflows/wiki-sync.yml",
    "assets/repository/.github/workflows/wiki-issue-sync.yml",
  ];
  for (const relative of required) if (!fs.existsSync(path.join(root, relative))) errors.push(`missing ${relative}`);
  const skill = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
  if (!/^---\nname: wiki\ndescription: .+\n---\n/.test(skill)) errors.push("SKILL.md frontmatter is invalid");
  if (skill.split(/\r?\n/).length > 500) errors.push("SKILL.md exceeds 500 lines");
  const metadata = fs.readFileSync(path.join(root, "agents/openai.yaml"), "utf8");
  if (!metadata.includes("$wiki") || !metadata.includes("allow_implicit_invocation: true")) errors.push("openai.yaml invocation metadata is incomplete");
  if (process.argv.includes("--global")) {
    const canonical = path.join(os.homedir(), ".agents", "skills", "wiki");
    const claude = path.join(os.homedir(), ".claude", "skills", "wiki");
    try {
      if (fs.realpathSync(root) !== fs.realpathSync(canonical)) errors.push(`skill does not resolve from canonical path ${canonical}`);
    } catch { errors.push(`canonical skill path is missing or unreadable: ${canonical}`); }
    try {
      if (!fs.lstatSync(claude).isSymbolicLink() || fs.realpathSync(claude) !== fs.realpathSync(root)) errors.push("Claude skill link does not target the canonical skill");
    } catch { errors.push("Claude skill link is missing or unreadable"); }
  }
  if (errors.length) { errors.forEach((error) => console.error(`FAIL ${error}`)); return 2; }
  console.log(`PASS wiki skill validation: ${root}`);
  return 0;
}
if (require.main === module) process.exit(main());
module.exports = { main };
