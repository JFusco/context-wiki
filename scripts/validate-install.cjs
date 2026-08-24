#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function main() {
  const root = path.resolve(__dirname, "..");
  const errors = [];
  const required = [
    "SKILL.md", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "commitlint.config.cjs", ".env.example", ".github/workflows/quality.yml", ".github/workflows/commitlint.yml", ".github/workflows/pr.yml", ".husky/commit-msg", ".husky/prepare-commit-msg",
    "agents/openai.yaml", "scripts/init-repository.cjs", "scripts/update-repository.cjs", "scripts/test.cjs", "assets/repository/wiki/INDEX.md",
    "assets/repository/scripts/wiki/discover-plans.cjs", "assets/repository/scripts/wiki/archive-plan.cjs",
    "assets/repository/scripts/wiki/build-graph.cjs", "assets/repository/scripts/wiki/check.cjs",
    "assets/repository/scripts/wiki/navigate.cjs", "assets/repository/scripts/wiki/routing.cjs", "assets/repository/scripts/wiki/routing-policy.json",
    "assets/repository/scripts/wiki/lib/github-refs.cjs", "assets/repository/scripts/wiki/lib/wiki-graph.cjs",
    "assets/repository/scripts/wiki/graph/viewer/routing.js",
    "assets/repository/scripts/wiki/graph/viewer/vendor/sigma.min.js",
    "assets/repository/.github/workflows/wiki-check.yml", "assets/repository/.github/workflows/wiki-sync.yml",
    "assets/repository/.github/workflows/wiki-issue-sync.yml",
  ];
  for (const relative of required) if (!fs.existsSync(path.join(root, relative))) errors.push(`missing ${relative}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (manifest.devDependencies?.["@verndale/ai-commit"] !== "2.7.0") errors.push("@verndale/ai-commit must be pinned to 2.7.0 as the sole Commitlint provider");
  if (manifest.scripts?.["verify:push"] !== "pnpm run validate" || manifest.scripts?.["verify:ci"] !== "pnpm run test:unit && pnpm run validate") errors.push("repository verification aliases are incomplete");
  if (manifest.devDependencies?.["@verndale/ai-pr"] !== "1.3.5" || manifest.scripts?.["pr:create"] !== "ai-pr") errors.push("the source repository PR helper must remain pinned and callable");
  const prWorkflow = fs.readFileSync(path.join(root, ".github/workflows/pr.yml"), "utf8");
  if (!prWorkflow.includes("- bot/wiki-**") || !prWorkflow.includes("if: ${{ !startsWith(github.ref_name, 'bot/wiki-') }}")) errors.push("the generic PR workflow must ignore wiki bot branches for push and manual dispatch");
  const qualityWorkflow = fs.readFileSync(path.join(root, ".github/workflows/quality.yml"), "utf8");
  if (!qualityWorkflow.includes("run: pnpm run verify:ci") || /run: pnpm (?:run )?validate/.test(qualityWorkflow)) errors.push("Quality must invoke only verify:ci");
  const commitlintWorkflow = fs.readFileSync(path.join(root, ".github/workflows/commitlint.yml"), "utf8");
  const wikiWorkflows = [
    fs.readFileSync(path.join(root, ".github/workflows/wiki-check.yml"), "utf8"),
    fs.readFileSync(path.join(root, ".github/workflows/wiki-sync.yml"), "utf8"),
    fs.readFileSync(path.join(root, ".github/workflows/wiki-issue-sync.yml"), "utf8"),
  ];
  if (!wikiWorkflows[1].includes('--arg repository "$GITHUB_REPOSITORY"') || !wikiWorkflows[1].includes("{schemaVersion: 1, repository: $repository") || !wikiWorkflows[1].includes("mergedAt: $pr.merged_at, changedPaths: $files")) errors.push("Sync context wiki must emit the canonical versioned merge context");
  for (const workflow of [qualityWorkflow, commitlintWorkflow, ...wikiWorkflows]) {
    if (!workflow.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true') || !workflow.includes('node-version: "24.14.0"') || !workflow.includes("corepack enable")) errors.push("every canonical workflow must use Node 24.14.0 and the declared pnpm via Corepack");
  }
  for (const workflow of wikiWorkflows) if (!workflow.includes("pnpm install --frozen-lockfile")) errors.push("every portable wiki workflow must use the repository frozen lockfile");
  if ((wikiWorkflows[0].match(/run: pnpm run /g) || []).length !== 1 || !wikiWorkflows[0].includes("run: pnpm run wiki:check")) errors.push("Wiki integrity must use wiki:check as its only validation command");
  if (fs.readFileSync(path.join(root, "commitlint.config.cjs"), "utf8") !== 'module.exports = require("@verndale/ai-commit");\n') errors.push("commitlint.config.cjs must be the canonical one-line provider config");
  if (!/publicHoistPattern:\s*\n\s+- ["']@commitlint\/cli["']/.test(fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"))) errors.push("pnpm workspace must narrowly public-hoist @commitlint/cli");
  const skill = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
  if (!/^---\nname: wiki\ndescription: .+\n---\n/.test(skill)) errors.push("SKILL.md frontmatter is invalid");
  if (skill.split(/\r?\n/).length > 500) errors.push("SKILL.md exceeds 500 lines");
  const metadata = fs.readFileSync(path.join(root, "agents/openai.yaml"), "utf8");
  if (!metadata.includes("$wiki") || !metadata.includes("allow_implicit_invocation: true")) errors.push("openai.yaml invocation metadata is incomplete");
  const mirrored = [
    ".github/workflows/wiki-check.yml", ".github/workflows/wiki-sync.yml", ".github/workflows/wiki-issue-sync.yml",
    "scripts/wiki/build-graph.cjs", "scripts/wiki/check.cjs", "scripts/wiki/navigate.cjs", "scripts/wiki/routing.cjs", "scripts/wiki/routing-policy.json",
    "scripts/wiki/on-merge-sync.cjs", "scripts/wiki/pre-commit.cjs", "scripts/wiki/refresh-issue-state.cjs", "scripts/wiki/serve-graph.cjs",
    "scripts/wiki/lib/github-refs.cjs", "scripts/wiki/lib/wiki-graph.cjs",
    "scripts/wiki/graph/viewer/index.html", "scripts/wiki/graph/viewer/viewer.css", "scripts/wiki/graph/viewer/viewer.js", "scripts/wiki/graph/viewer/routing.js",
  ];
  for (const relative of mirrored) {
    const source = path.join(root, relative);
    const asset = path.join(root, "assets", "repository", relative);
    if (!fs.existsSync(source) || !fs.existsSync(asset) || !fs.readFileSync(source).equals(fs.readFileSync(asset))) errors.push(`root/asset mirror drift: ${relative}`);
  }
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
