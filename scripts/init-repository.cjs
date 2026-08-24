#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const VERSION = 2;
const SKILL_ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(SKILL_ROOT, "assets", "repository");
const BLOCK_START = "<!-- wiki-skill:start -->";
const BLOCK_END = "<!-- wiki-skill:end -->";
const HOOK_START = "# wiki-skill:start";
const HOOK_END = "# wiki-skill:end";
const AUTHORED_SEED_FILES = new Set(["wiki/plans/INDEX.md"]);
const HEADLESS_ASSETS = new Set([
  "scripts/wiki/navigate.cjs",
  "scripts/wiki/routing.cjs",
  "scripts/wiki/routing-policy.json",
  "scripts/wiki/lib/common.cjs",
  "scripts/wiki/lib/frontmatter.cjs",
  "scripts/wiki/lib/github-refs.cjs",
  "scripts/wiki/lib/wiki-graph.cjs",
]);

function parseArgs(argv) {
  const out = { repo: process.cwd(), dryRun: false, github: "auto", wikiRoot: "wiki", headlessNavigation: false, agentsOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") out.repo = argv[++i];
    else if (argv[i] === "--dry-run") out.dryRun = true;
    else if (argv[i] === "--github") out.github = "on";
    else if (argv[i] === "--no-github") out.github = "off";
    else if (argv[i] === "--wiki-root") out.wikiRoot = argv[++i];
    else if (argv[i] === "--headless-navigation") out.headlessNavigation = true;
    else if (argv[i] === "--agents-only") out.agentsOnly = true;
    else if (argv[i] === "--help") out.help = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return out;
}

function managedBlockProblem(file, start, end) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const starts = text.split(start).length - 1;
  const ends = text.split(end).length - 1;
  if (starts === 0 && ends === 0) return null;
  if (starts !== 1 || ends !== 1 || text.indexOf(end) < text.indexOf(start)) return "malformed or duplicate managed markers";
  return null;
}

function normalizeWikiRoot(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === "." || path.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../") || normalized === ".git" || normalized.startsWith(".git/") || normalized.split("/").includes("..")) {
    throw new Error("--wiki-root must be a safe repository-relative directory");
  }
  return normalized;
}

function runGit(args, cwd, options = {}) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...options }).trim();
  } catch {
    return null;
  }
}

function resolveProject(start) {
  const requested = path.resolve(start);
  const git = runGit(["rev-parse", "--show-toplevel"], requested);
  const root = git ? path.resolve(git) : requested;
  return { root: fs.existsSync(root) ? fs.realpathSync(root) : root, isGit: Boolean(git) };
}

function sha(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function atomicWrite(file, bytes, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.wiki-tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`);
  try {
    fs.writeFileSync(temporary, bytes, { mode });
    fs.chmodSync(temporary, mode);
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, base));
    else if (entry.isFile()) out.push(path.relative(base, abs).split(path.sep).join("/"));
  }
  return out.sort();
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith(".." + path.sep) && rel !== "..");
}

function hasSymlinkComponent(root, target) {
  if (!isInside(root, target)) return true;
  const relative = path.relative(root, target);
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) return true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return false;
}

function navigationGuidance(wikiRoot, includeWikiRoot = false) {
  const commandRoot = includeWikiRoot ? ` --wiki-root ${JSON.stringify(wikiRoot)}` : "";
  return [
    "- For an exact current-code, file, symbol, or command question, inspect the named source or use targeted source `rg`; do not load history.",
    `- For a direct single-topic history or rationale question, start at \`${wikiRoot}/INDEX.md\` when it exists and open only the page it routes to.`,
    `- Only for a cross-page why, wiring, ownership, or impact question, run \`node scripts/wiki/navigate.cjs${commandRoot} --intent why --query "<terms>"\` before opening wiki pages. Use \`wiring\` for ownership/dependencies and \`impact\` for change scope.`,
    "- Query with exact slugs, identifiers, symbols, or repository-qualified GitHub references. Never use a bare issue or PR number such as `#123`.",
    "- When both endpoints are known, use exact `--from` and `--to` node IDs.",
    "- Trust the router's deterministic weighted shortest route, which accounts for relationship cost, hubs, and page bytes. Open only its itinerary; never add candidates, neighbors, or adjacent pages.",
    "- Read itinerary pages sequentially, never speculatively in parallel, and stop as soon as the answer is grounded.",
    "- If resolution is ambiguous, rerun with one returned exact ID; never open every candidate.",
    `- Never use \`grep\`, \`find\`, or recursive \`rg\` as initial wiki discovery. After a router miss, run at most one root-scoped exact search: \`rg -n --fixed-strings "<exact term>" ${wikiRoot}/\`. If it fails, inspect one known source path or ask one focused question; never widen the search.`,
    "- Never read generated graph JSON directly.",
  ];
}

function managedAgentsText({ wikiRoot = "wiki", headlessNavigation = false } = {}) {
  const navigation = navigationGuidance(wikiRoot, headlessNavigation);
  if (headlessNavigation) return [
    BLOCK_START,
    "## Context wiki navigation",
    "",
    `Use \`${wikiRoot}/\` as this repository's existing context source. Never bulk-load that directory.`,
    "",
    ...navigation,
    "- This installation owns navigation only. Preserve this repository's existing wiki authoring, validation, hooks, workflows, and generated-data conventions.",
    "",
    "This managed block is shared by Codex, Cursor, and Claude (via `@AGENTS.md` in `CLAUDE.md`).",
    BLOCK_END,
  ].join("\n");
  return [
    BLOCK_START,
    "## Context wiki",
    "",
    "Use `wiki/` as this repository's durable record of executed plans, decisions, and substantive change history. Never bulk-load `wiki/`.",
    "",
    ...navigation,
    "- After executing a Claude, Codex, or Cursor plan, archive it and add the journal/topic updates in the same delivery per `wiki/MECHANICS.md`.",
    "- Run `node scripts/wiki/discover-plans.cjs` to recover missed plans, `node scripts/wiki/build-graph.cjs` after wiki edits, and `node scripts/wiki/check.cjs` before completion.",
    "- The Sigma.js graph indexes only Markdown under `wiki/`; never add code nodes.",
    "",
    "This managed block was installed for Codex, Cursor, and Claude (via `@AGENTS.md` in `CLAUDE.md`).",
    BLOCK_END,
  ].join("\n");
}

function managedClaudeText() {
  return [BLOCK_START, "@AGENTS.md", BLOCK_END].join("\n");
}

function upsertClaudeImport(file, dryRun, changes) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8").trim() === "@AGENTS.md") return;
  upsertBlock(file, managedClaudeText(), BLOCK_START, BLOCK_END, dryRun, changes);
}

function upsertBlock(file, body, start, end, dryRun, changes) {
  const exists = fs.existsSync(file);
  const original = exists ? fs.readFileSync(file, "utf8") : "";
  const startAt = original.indexOf(start);
  const endAt = original.indexOf(end);
  let next;
  if (startAt !== -1 && endAt > startAt) {
    next = original.slice(0, startAt) + body + original.slice(endAt + end.length);
  } else {
    next = original.replace(/\s*$/, "") + (original.trim() ? "\n\n" : "") + body + "\n";
  }
  if (next === original) return;
  changes.push(`${exists ? "updated" : "created"} ${path.relative(process.cwd(), file)}`);
  if (!dryRun) {
    const mode = exists && fs.lstatSync(file).isFile() ? fs.statSync(file).mode & 0o777 : 0o644;
    atomicWrite(file, next, mode);
  }
}

function githubRemote(root) {
  const remote = runGit(["remote", "get-url", "origin"], root) || "";
  return /(?:^|@|:\/\/)github\.com[:/]/i.test(remote);
}

function readManifest(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data && typeof data.files === "object" ? data : { version: 0, files: {} };
  } catch {
    return { version: 0, files: {} };
  }
}

function installAssets({ root, includeGithub, dryRun, changes, conflicts, headlessNavigation = false }) {
  const manifestPath = headlessNavigation ? path.join(root, "scripts", "wiki", ".navigation-kit.json") : path.join(root, "wiki", ".wiki-kit.json");
  const previous = readManifest(manifestPath);
  const nextFiles = {};
  for (const rel of walk(ASSET_ROOT)) {
    if (headlessNavigation && !HEADLESS_ASSETS.has(rel)) continue;
    if (rel.startsWith(".github/") && !includeGithub) {
      if (previous.files[rel]) nextFiles[rel] = previous.files[rel];
      continue;
    }
    const source = path.join(ASSET_ROOT, rel);
    const target = path.join(root, rel);
    const sourceBytes = fs.readFileSync(source);
    const sourceHash = sha(sourceBytes);
    if (AUTHORED_SEED_FILES.has(rel)) {
      if (hasSymlinkComponent(root, target)) conflicts.push(`${rel} (symlink path)`);
      else if (!fs.existsSync(target)) {
        changes.push(`created ${rel}`);
        if (!dryRun) atomicWrite(target, sourceBytes);
      } else if (!fs.lstatSync(target).isFile()) conflicts.push(`${rel} (not a regular file)`);
      continue;
    }
    if (hasSymlinkComponent(root, target)) {
      conflicts.push(`${rel} (symlink path)`);
      if (previous.files[rel]) nextFiles[rel] = previous.files[rel];
      continue;
    }
    if (!fs.existsSync(target)) {
      changes.push(`created ${rel}`);
      if (!dryRun) {
        atomicWrite(target, sourceBytes, sourceBytes.slice(0, 2).toString() === "#!" ? 0o755 : 0o644);
      }
      nextFiles[rel] = sourceHash;
      continue;
    }
    if (!fs.lstatSync(target).isFile()) {
      conflicts.push(`${rel} (not a regular file)`);
      if (previous.files[rel]) nextFiles[rel] = previous.files[rel];
      continue;
    }
    const currentHash = sha(fs.readFileSync(target));
    if (currentHash === sourceHash) {
      nextFiles[rel] = sourceHash;
      if (sourceBytes.slice(0, 2).toString() === "#!" && !(fs.statSync(target).mode & 0o111)) {
        changes.push(`fixed executable mode ${rel}`);
        if (!dryRun) fs.chmodSync(target, 0o755);
      }
      continue;
    }
    if (previous.files[rel] && previous.files[rel] === currentHash) {
      changes.push(`updated ${rel}`);
      if (!dryRun) {
        atomicWrite(target, sourceBytes, sourceBytes.slice(0, 2).toString() === "#!" ? 0o755 : 0o644);
      }
      nextFiles[rel] = sourceHash;
      continue;
    }
    conflicts.push(rel);
    if (previous.files[rel]) nextFiles[rel] = previous.files[rel];
  }
  for (const rel of Object.keys(previous.files)) {
    if (nextFiles[rel] || AUTHORED_SEED_FILES.has(rel)) continue;
    const target = path.join(root, rel);
    if (!fs.existsSync(target)) continue;
    if (hasSymlinkComponent(root, target)) {
      conflicts.push(`${rel} (removed from kit; symlink path)`);
      continue;
    }
    if (!fs.lstatSync(target).isFile()) continue;
    const currentHash = sha(fs.readFileSync(target));
    if (previous.files[rel] !== currentHash) {
      conflicts.push(`${rel} (removed from kit; local modifications)`);
      continue;
    }
    changes.push(`removed ${rel}`);
    if (!dryRun) fs.unlinkSync(target);
  }
  if (hasSymlinkComponent(root, manifestPath)) {
    conflicts.push(`${path.relative(root, manifestPath)} (symlink path)`);
  } else if (!dryRun) {
    atomicWrite(manifestPath, JSON.stringify({ version: VERSION, files: nextFiles }, null, 2) + "\n");
  }
}

function hookBody(dispatchLegacy) {
  const lines = ["#!/usr/bin/env sh"];
  if (dispatchLegacy) {
    lines.push(
      "legacy_hook=\"$(git rev-parse --git-dir)/hooks/pre-commit\"",
      "if [ -x \"$legacy_hook\" ] && [ \"$legacy_hook\" != \"$0\" ]; then",
      "  \"$legacy_hook\" \"$@\" || exit $?",
      "fi",
      ""
    );
  }
  lines.push(managedHookBlock());
  return lines.join("\n");
}

function managedHookBlock() {
  return [
    HOOK_START,
    "wiki_skill_previous_status=$?",
    "if ! node scripts/wiki/pre-commit.cjs; then",
    '  echo "warning: wiki lifecycle failed; continuing" >&2',
    "fi",
    'if [ "$wiki_skill_previous_status" -ne 0 ]; then',
    '  exit "$wiki_skill_previous_status"',
    "fi",
    "unset wiki_skill_previous_status",
    HOOK_END,
  ].join("\n");
}

function installHook(root, dryRun, changes, warnings) {
  const configured = runGit(["config", "--local", "--get", "core.hooksPath"], root);
  const husky = path.join(root, ".husky", "pre-commit");
  let target;
  let setHooksPath = false;
  let dispatchLegacy = false;

  if (configured) {
    const expanded = configured.startsWith("~/") ? path.join(require("node:os").homedir(), configured.slice(2)) : configured;
    const hookDir = path.isAbsolute(expanded) ? expanded : path.resolve(root, expanded);
    if (!isInside(root, hookDir)) {
      warnings.push(`active core.hooksPath is outside the repository; hook not changed: ${configured}`);
      return null;
    }
    const huskyRunner = path.join(hookDir, "h");
    const husky9Layout = path.basename(hookDir) === "_"
      && path.basename(path.dirname(hookDir)) === ".husky"
      && fs.existsSync(huskyRunner)
      && fs.lstatSync(huskyRunner).isFile()
      && !fs.lstatSync(huskyRunner).isSymbolicLink();
    target = husky9Layout
      ? path.join(path.dirname(hookDir), "pre-commit")
      : path.join(hookDir, "pre-commit");
  } else if (fs.existsSync(husky)) {
    target = husky;
  } else {
    target = path.join(root, ".githooks", "pre-commit");
    setHooksPath = true;
    dispatchLegacy = true;
  }

  if (hasSymlinkComponent(root, target)) {
    warnings.push(`hook path contains a symbolic link; hook not changed: ${path.relative(root, target)}`);
    return null;
  }

  if (fs.existsSync(target) && !fs.lstatSync(target).isFile()) {
    warnings.push(`hook target is not a regular file; hook not changed: ${path.relative(root, target)}`);
    return null;
  }

  if (!fs.existsSync(target)) {
    changes.push(`created ${path.relative(root, target)}`);
    if (!dryRun) {
      atomicWrite(target, hookBody(dispatchLegacy) + "\n", 0o755);
    }
  } else {
    upsertBlock(target, managedHookBlock(), HOOK_START, HOOK_END, dryRun, changes);
    if (!dryRun && fs.existsSync(target)) fs.chmodSync(target, 0o755);
  }
  if (setHooksPath) {
    changes.push("configured local core.hooksPath=.githooks");
    if (!dryRun) execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], { cwd: root });
  }
  return path.relative(root, target);
}

function runRepoScript(root, script, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "wiki", script), ...args], { cwd: root, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    args.wikiRoot = normalizeWikiRoot(args.wikiRoot);
    if (args.wikiRoot !== "wiki" && !args.headlessNavigation) throw new Error("--wiki-root requires --headless-navigation");
    if (args.agentsOnly && args.github !== "auto") throw new Error("--agents-only cannot be combined with --github or --no-github");
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    return 2;
  }
  if (args.help) {
    console.log("Usage: init-repository.cjs [--repo <path>] [--dry-run] [--github|--no-github] [--agents-only] [--headless-navigation --wiki-root <dir>]");
    return 0;
  }
  const project = resolveProject(args.repo);
  const includeGithub = !args.agentsOnly && !args.headlessNavigation && (args.github === "on" || (args.github === "auto" && project.isGit && githubRemote(project.root)));
  const changes = [];
  const conflicts = [];
  const warnings = [];

  if (args.headlessNavigation) {
    const wikiDirectory = path.join(project.root, args.wikiRoot);
    if (hasSymlinkComponent(project.root, wikiDirectory)) conflicts.push(`${args.wikiRoot}/ (symlink path)`);
    else if (!fs.existsSync(wikiDirectory) || !fs.statSync(wikiDirectory).isDirectory()) conflicts.push(`${args.wikiRoot}/ (missing custom wiki root)`);
  }
  if (!args.agentsOnly) {
    for (const relative of args.headlessNavigation ? [] : ["wiki/topics", "wiki/journal", "wiki/plans"]) {
      const directory = path.join(project.root, relative);
      if (hasSymlinkComponent(project.root, directory)) conflicts.push(`${relative}/ (symlink path)`);
      else if (!fs.existsSync(directory)) {
        changes.push(`created ${relative}/`);
        if (!args.dryRun) fs.mkdirSync(directory, { recursive: true });
      }
    }
    installAssets({ root: project.root, includeGithub, dryRun: args.dryRun, changes, conflicts, headlessNavigation: args.headlessNavigation });
  }
  const agentsFile = path.join(project.root, "AGENTS.md");
  const claudeFile = path.join(project.root, "CLAUDE.md");
  if (hasSymlinkComponent(project.root, agentsFile)) conflicts.push("AGENTS.md (symlink path)");
  else {
    const problem = managedBlockProblem(agentsFile, BLOCK_START, BLOCK_END);
    if (problem) conflicts.push(`AGENTS.md (${problem})`);
    else upsertBlock(agentsFile, managedAgentsText({ wikiRoot: args.wikiRoot, headlessNavigation: args.headlessNavigation }), BLOCK_START, BLOCK_END, args.dryRun, changes);
  }
  if (!args.agentsOnly) {
    if (hasSymlinkComponent(project.root, claudeFile)) conflicts.push("CLAUDE.md (symlink path)");
    else upsertClaudeImport(claudeFile, args.dryRun, changes);
  }
  const hook = project.isGit && !args.agentsOnly && !args.headlessNavigation ? installHook(project.root, args.dryRun, changes, warnings) : null;
  if (args.agentsOnly) warnings.push("agents-only mode preserved assets, hooks, workflows, graphs, and CLAUDE.md");
  else if (args.headlessNavigation) warnings.push("headless navigation mode preserved existing hooks, workflows, wiki mechanics, viewer, graph output, and plan ledger");
  else if (!project.isGit) warnings.push("not a Git repository; Git hooks and GitHub workflows were skipped");
  else if (args.github === "off") warnings.push("GitHub workflow installation was disabled by --no-github");
  else if (!includeGithub) warnings.push("no GitHub origin detected; GitHub workflows were skipped");

  if (!args.dryRun && conflicts.length === 0 && !args.agentsOnly && !args.headlessNavigation) {
    if (!runRepoScript(project.root, "build-graph.cjs")) conflicts.push("graph build failed");
    else if (!runRepoScript(project.root, "check.cjs")) conflicts.push("wiki validation failed");
  }

  const operation = args.agentsOnly ? "agent guidance" : args.headlessNavigation ? "navigation" : "kit";
  console.log(`${args.dryRun ? "CHECK" : "PASS"} wiki ${operation} ${args.dryRun ? "inspection" : "installation"}: ${project.root}`);
  for (const item of changes) console.log(`- ${item}`);
  for (const item of warnings) console.warn(`warning: ${item}`);
  for (const item of conflicts) console.error(`conflict: ${item}`);
  if (hook) console.log(`hook: ${hook}`);
  if (includeGithub) console.log("github: core workflows installed; configure PR_BOT_TOKEN");
  return conflicts.length ? 2 : (args.dryRun && changes.length ? 1 : 0);
}

if (require.main === module) process.exit(main());

module.exports = { parseArgs, normalizeWikiRoot, resolveProject, installAssets, installHook, managedAgentsText, navigationGuidance, managedBlockProblem, upsertBlock, upsertClaudeImport, sha, isInside, hasSymlinkComponent, atomicWrite };
