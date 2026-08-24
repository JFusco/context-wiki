#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const SKILL = path.resolve(__dirname, "..");
const INIT = path.join(SKILL, "scripts", "init-repository.cjs");

function temp(name) { return fs.mkdtempSync(path.join(os.tmpdir(), `wiki-${name}-`)); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options, env: { ...process.env, ...(options.env || {}) } });
}
function node(script, args = [], options = {}) { return run(process.execPath, [script, ...args], options); }
function init(root, args = []) { return node(INIT, ["--repo", root, ...args], { cwd: root }); }
function git(root, args) { const result = run("git", args, { cwd: root }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); }
function makeGit(name, remote = "") {
  const root = temp(name);
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.name", "Wiki Test"]);
  git(root, ["config", "user.email", "wiki@example.test"]);
  if (remote) git(root, ["remote", "add", "origin", remote]);
  return root;
}
function write(file, body) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); }

test("package manifest exposes the Sigma graph workflow", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SKILL, "package.json"), "utf8"));
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "commonjs");
  assert.equal(manifest.dependencies.sigma, "3.0.3");
  assert.equal(manifest.dependencies.graphology, "0.26.0");
  assert.equal(manifest.devDependencies["@verndale/ai-commit"], "2.7.0");
  assert.equal(manifest.devDependencies["@verndale/ai-pr"], "1.3.5");
  assert.equal(manifest.engines.node, ">=24.14.0");
  assert.equal(manifest.scripts["graph:build"], "node scripts/wiki/build-graph.cjs");
  assert.equal(manifest.scripts["graph:view"], "node scripts/wiki/serve-graph.cjs");
  assert.equal(manifest.scripts["verify:push"], "pnpm run validate");
  assert.equal(manifest.scripts["verify:ci"], "pnpm run test:unit && pnpm run validate");
  assert.equal(manifest.scripts.commit, "ai-commit run");
  assert.equal(manifest.scripts["pr:create"], "ai-pr");
  assert.equal(manifest.scripts.prepare, "husky");
  assert.equal(fs.readFileSync(path.join(SKILL, "commitlint.config.cjs"), "utf8"), 'module.exports = require("@verndale/ai-commit");\n');
  assert.match(fs.readFileSync(path.join(SKILL, "pnpm-workspace.yaml"), "utf8"), /publicHoistPattern:\n  - "@commitlint\/cli"/);
  for (const relative of [".env.example", ".github/workflows/quality.yml", ".github/workflows/commitlint.yml", ".husky/commit-msg", ".husky/prepare-commit-msg"]) {
    assert.ok(fs.existsSync(path.join(SKILL, relative)), relative);
  }
  const prWorkflow = fs.readFileSync(path.join(SKILL, ".github/workflows/pr.yml"), "utf8");
  assert.match(prWorkflow, /- bot\/wiki-\*\*/);
  assert.match(prWorkflow, /if: \$\{\{ !startsWith\(github\.ref_name, 'bot\/wiki-'\) \}\}/);
  const quality = fs.readFileSync(path.join(SKILL, ".github/workflows/quality.yml"), "utf8");
  assert.match(quality, /fetch-depth: 0/);
  assert.match(quality, /run: pnpm run verify:ci/);
  assert.doesNotMatch(quality, /run: pnpm (?:run )?validate/);
});

test("a clean pnpm fixture exposes commitlint through ai-commit without a direct CLI dependency", () => {
  const root = temp("commitlint-hoist");
  for (const relative of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "commitlint.config.cjs"]) fs.copyFileSync(path.join(SKILL, relative), path.join(root, relative));
  const install = run("pnpm", ["install", "--prefer-offline", "--frozen-lockfile", "--ignore-scripts"], { cwd: root });
  assert.equal(install.status, 0, install.stderr);
  const version = run("pnpm", ["exec", "commitlint", "--version"], { cwd: root });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /@commitlint\/cli@20\.5\.3/);
  const valid = run("pnpm", ["exec", "commitlint"], { cwd: root, input: "fix(wiki): Preserve route evidence\n" });
  const invalid = run("pnpm", ["exec", "commitlint"], { cwd: root, input: "bad title\n" });
  assert.equal(valid.status, 0, valid.stderr);
  assert.notEqual(invalid.status, 0);
});

test("global validation accepts a persistent checkout reached through discovery symlinks", () => {
  const home = temp("global-links");
  const agents = path.join(home, ".agents", "skills");
  const claude = path.join(home, ".claude", "skills");
  fs.mkdirSync(agents, { recursive: true });
  fs.mkdirSync(claude, { recursive: true });
  fs.symlinkSync(SKILL, path.join(agents, "wiki"), "dir");
  fs.symlinkSync(SKILL, path.join(claude, "wiki"), "dir");
  const result = node(path.join(SKILL, "scripts", "validate-install.cjs"), ["--global"], { cwd: SKILL, env: { HOME: home } });
  assert.equal(result.status, 0, result.stderr);
});

test("non-Git initialization is complete, valid, and idempotent", () => {
  const root = temp("nongit");
  const first = init(root);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stderr, /not a Git repository/);
  for (const relative of ["wiki/INDEX.md", "wiki/MECHANICS.md", "wiki/plans/INDEX.md", "wiki/topics", "wiki/journal", "scripts/wiki/graph/data/graph.json", "AGENTS.md", "CLAUDE.md"]) assert.ok(fs.existsSync(path.join(root, relative)), relative);
  assert.ok(!fs.existsSync(path.join(root, ".cursor/rules/wiki.mdc")), "wiki cursor rule should not be installed");
  for (const [name, needle] of [["AGENTS.md", "## Context wiki"], ["CLAUDE.md", "@AGENTS.md"]]) {
    assert.match(fs.readFileSync(path.join(root, name), "utf8"), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  assert.match(agents, /direct single-topic history or rationale/);
  assert.match(agents, /Only for a cross-page question/);
  assert.match(agents, /Never bulk-load `wiki\/` or `scripts\/wiki\/graph\/data\/graph\.json`/);
  assert.match(agents, /ask one focused question/);
  assert.ok(!fs.existsSync(path.join(root, ".github")));
  const before = fs.readFileSync(path.join(root, "wiki/.wiki-kit.json"), "utf8");
  const ledger = path.join(root, "wiki/plans/INDEX.md");
  fs.appendFileSync(ledger, "\nAuthored ledger content.\n");
  const second = init(root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(path.join(root, "wiki/.wiki-kit.json"), "utf8"), before);
  assert.match(fs.readFileSync(ledger, "utf8"), /Authored ledger content/);
  assert.ok(!JSON.parse(before).files["wiki/plans/INDEX.md"], "the authored plan ledger must not be checksum-managed");
  assert.equal(node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root }).status, 0);
});

test("standalone CLAUDE import remains byte-identical and installer-clean", () => {
  const root = temp("standalone-claude-import");
  const claude = path.join(root, "CLAUDE.md");
  write(claude, "@AGENTS.md\n");
  const first = init(root);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(fs.readFileSync(claude, "utf8"), "@AGENTS.md\n");
  const dryRun = init(root, ["--dry-run"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(fs.readFileSync(claude, "utf8"), "@AGENTS.md\n");
});

test("headless custom-root install adds navigation without replacing repository mechanics", () => {
  const root = makeGit("headless", "https://github.com/example/custom-wiki.git");
  const existingHook = path.join(root, ".githooks", "pre-commit");
  const existingWorkflow = path.join(root, ".github", "workflows", "owned.yml");
  const existingMechanics = path.join(root, "docs", "context", "MECHANICS.md");
  write(path.join(root, "docs/context/INDEX.md"), "# Existing context\n\n[Decision](./decision.md)\n");
  write(path.join(root, "docs/context/decision.md"), "# Decision\n\nExisting rationale.\n");
  write(existingMechanics, "# Owned mechanics\n");
  write(existingHook, "#!/usr/bin/env sh\necho owned\n");
  write(existingWorkflow, "name: Owned\n");
  git(root, ["config", "--local", "core.hooksPath", ".githooks"]);
  const result = init(root, ["--headless-navigation", "--wiki-root", "docs/context", "--github"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /preserved existing hooks, workflows, wiki mechanics, viewer, graph output, and plan ledger/);
  assert.equal(fs.readFileSync(existingHook, "utf8"), "#!/usr/bin/env sh\necho owned\n");
  assert.equal(fs.readFileSync(existingWorkflow, "utf8"), "name: Owned\n");
  assert.equal(fs.readFileSync(existingMechanics, "utf8"), "# Owned mechanics\n");
  for (const relative of ["scripts/wiki/navigate.cjs", "scripts/wiki/routing.cjs", "scripts/wiki/routing-policy.json", "scripts/wiki/lib/wiki-graph.cjs", "scripts/wiki/.navigation-kit.json"]) assert.ok(fs.existsSync(path.join(root, relative)), relative);
  for (const relative of ["scripts/wiki/build-graph.cjs", "scripts/wiki/graph", "wiki/plans/INDEX.md", ".github/workflows/wiki-check.yml"]) assert.ok(!fs.existsSync(path.join(root, relative)), relative);
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  assert.match(agents, /--wiki-root "docs\/context" --intent why/);
  assert.match(agents, /navigation only/);
  assert.match(agents, /direct single-topic history or rationale/);
  assert.match(agents, /Only for a cross-page question/);
  assert.match(agents, /generated graph JSON/);
  assert.match(agents, /ask one focused question/);
  const route = node(path.join(root, "scripts/wiki/navigate.cjs"), ["--wiki-root", "docs/context", "--intent", "wiring", "--from", "docs/context/INDEX.md", "--to", "docs/context/decision.md"], { cwd: root });
  assert.equal(route.status, 0, route.stderr);
  assert.match(route.stdout, /2 file\(s\)/);
  assert.match(route.stdout, /docs\/context\/INDEX\.md/);
  assert.equal(init(root, ["--headless-navigation", "--wiki-root", "docs/context", "--dry-run"]).status, 0);
  assert.equal(init(root, ["--headless-navigation", "--wiki-root", "../escape"]).status, 2);
  assert.equal(init(root, ["--wiki-root", "docs/context"]).status, 2);
});

test("dry-run reports drift without writes and installer refuses symbolic-link escapes", () => {
  const dryRoot = temp("dry-run");
  const dry = init(dryRoot, ["--dry-run"]);
  assert.equal(dry.status, 1, dry.stderr);
  assert.ok(!fs.existsSync(path.join(dryRoot, "wiki")));
  const root = temp("symlink-install");
  const outside = temp("symlink-outside");
  const externalAgents = path.join(outside, "AGENTS.md"); write(externalAgents, "external\n");
  fs.symlinkSync(outside, path.join(root, "scripts"), "dir");
  fs.symlinkSync(outside, path.join(root, "wiki"), "dir");
  fs.symlinkSync(externalAgents, path.join(root, "AGENTS.md"));
  const result = init(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /symlink path/);
  assert.equal(fs.readFileSync(externalAgents, "utf8"), "external\n");
  assert.deepEqual(fs.readdirSync(outside).sort(), ["AGENTS.md"]);
});

test("Git initialization installs workflows and dispatches a legacy hook", () => {
  const root = makeGit("git", "git@github.com:example/wiki-fixture.git");
  const legacy = path.join(root, ".git/hooks/pre-commit");
  write(legacy, "#!/usr/bin/env sh\necho legacy\n"); fs.chmodSync(legacy, 0o755);
  const result = init(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(root, ["config", "--local", "core.hooksPath"]), ".githooks");
  const hook = fs.readFileSync(path.join(root, ".githooks/pre-commit"), "utf8");
  assert.match(hook, /legacy_hook/); assert.match(hook, /node scripts\/wiki\/pre-commit\.cjs/);
  assert.equal(fs.readFileSync(legacy, "utf8"), "#!/usr/bin/env sh\necho legacy\n");
  for (const workflow of ["wiki-check.yml", "wiki-sync.yml", "wiki-issue-sync.yml"]) assert.ok(fs.existsSync(path.join(root, ".github/workflows", workflow)));
  const check = fs.readFileSync(path.join(root, ".github/workflows/wiki-check.yml"), "utf8");
  const sync = fs.readFileSync(path.join(root, ".github/workflows/wiki-sync.yml"), "utf8");
  const issueSync = fs.readFileSync(path.join(root, ".github/workflows/wiki-issue-sync.yml"), "utf8");
  assert.match(check, /^name: Wiki integrity$/m);
  assert.match(check, /pull_request:\n    branches: \[main\]/);
  assert.match(check, /push:\n    branches: \[main\]/);
  assert.match(check, /workflow_dispatch: \{\}/);
  assert.match(check, /jobs:\n  check:/);
  assert.match(check, /group: wiki-integrity-/);
  assert.match(check, /fetch-depth: 0/);
  assert.doesNotMatch(check, /pull-requests: read/);
  assert.equal((check.match(/pnpm run wiki:check/g) || []).length, 1);
  assert.equal((check.match(/run: pnpm run /g) || []).length, 1);
  assert.doesNotMatch(check, /scripts\/wiki\/check\.cjs|gh api/);
  assert.match(sync, /^name: Sync context wiki$/m);
  assert.match(issueSync, /^name: Sync wiki issue state$/m);
  assert.doesNotMatch(sync, /slack|@verndale\/ai-pr/i);
  for (const workflow of [check, sync, issueSync]) {
    assert.match(workflow, /node-version: "24\.14\.0"/);
    assert.match(workflow, /corepack enable && corepack install/);
    assert.match(workflow, /pnpm install --frozen-lockfile/);
  }
  for (const workflow of [sync, issueSync]) {
    assert.match(workflow, /GRAPHIFY_SKIP_HOOK: "1"/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /gh auth setup-git/);
    assert.match(workflow, /PR_BOT_TOKEN/);
    assert.match(workflow, /jobs:\n  sync:/);
    assert.match(workflow, /--force-with-lease/);
    assert.match(workflow, /gh pr reopen/);
    assert.match(workflow, /github-actions\[bot\]/);
    assert.match(workflow, /41898282\+github-actions\[bot\]@users\.noreply\.github\.com/);
  }
  assert.match(sync, /workflow_dispatch:\n    inputs:\n      pr_number:/);
  assert.match(sync, /files\?per_page=100.*--paginate --slurp/);
  assert.match(sync, /commits\?per_page=100.*--paginate --slurp/);
  assert.match(sync, /--arg repository "\$GITHUB_REPOSITORY"/);
  assert.match(sync, /\{schemaVersion: 1, repository: \$repository,[^\n]+mergedAt: \$pr\.merged_at, changedPaths: \$files, commits: \$commits\}/);
  assert.doesNotMatch(sync, /\{[^\n]*merged_at: \$pr\.merged_at|\{[^\n]*files: \$files/);
  assert.match(sync, /branch="bot\/wiki-sync\/\$PR_NUMBER"/);
  assert.match(sync, /group: wiki-sync-\$\{\{ inputs\.pr_number \|\| github\.event\.pull_request\.number \}\}/);
  assert.match(sync, /PR_NUMBER: \$\{\{ inputs\.pr_number \|\| github\.event\.pull_request\.number \}\}/);
  assert.match(sync, /bot\/wiki-\*\)/);
  assert.match(issueSync, /cron: "30 11 \* \* \*" # Daily at 11:30 UTC/);
  assert.match(issueSync, /workflow_dispatch: \{\}/);
  git(root, ["add", "."]);
  const committed = run("git", ["commit", "-m", "wiki bootstrap"], { cwd: root, env: { WIKI_HOME: temp("hook-home") } });
  assert.equal(committed.status, 0, committed.stderr); assert.match(`${committed.stdout}${committed.stderr}`, /legacy/);
  assert.equal(init(root, ["--no-github"]).status, 0);
  const managed = JSON.parse(fs.readFileSync(path.join(root, "wiki/.wiki-kit.json"), "utf8")).files;
  assert.ok(Object.keys(managed).some((file) => file === ".github/workflows/wiki-sync.yml"));
});

test("Husky and safe custom hook paths are extended; external paths are untouched", () => {
  const huskyRoot = makeGit("husky");
  write(path.join(huskyRoot, ".husky/pre-commit"), "#!/usr/bin/env sh\necho husky\nfalse\n");
  assert.equal(init(huskyRoot).status, 0);
  const huskyHook = path.join(huskyRoot, ".husky/pre-commit");
  assert.match(fs.readFileSync(huskyHook, "utf8"), /wiki-skill:start/);
  const blocked = run(huskyHook, [], { cwd: huskyRoot, env: { WIKI_HOME: temp("hook-blocking-home") } });
  assert.equal(blocked.status, 1, "managed wiki work must not mask a preceding hook failure");
  write(huskyHook, fs.readFileSync(huskyHook, "utf8").replace("echo husky\nfalse", "echo husky\ntrue"));
  fs.unlinkSync(path.join(huskyRoot, "scripts/wiki/pre-commit.cjs"));
  const advisory = run(huskyHook, [], { cwd: huskyRoot, env: { WIKI_HOME: temp("hook-advisory-home") } });
  assert.equal(advisory.status, 0, "wiki lifecycle failures must remain advisory");
  assert.match(advisory.stderr, /warning: wiki lifecycle failed; continuing/);
  const husky9Root = makeGit("husky-9");
  write(path.join(husky9Root, ".husky/_/h"), "#!/usr/bin/env sh\nexit 0\n");
  write(path.join(husky9Root, ".husky/_/pre-commit"), "#!/usr/bin/env sh\n. \"$(dirname \"$0\")/h\"\n");
  git(husky9Root, ["config", "--local", "core.hooksPath", ".husky/_"]);
  const husky9 = init(husky9Root);
  assert.equal(husky9.status, 0, husky9.stderr);
  assert.equal(fs.readFileSync(path.join(husky9Root, ".husky/_/pre-commit"), "utf8"), "#!/usr/bin/env sh\n. \"$(dirname \"$0\")/h\"\n");
  assert.match(fs.readFileSync(path.join(husky9Root, ".husky/pre-commit"), "utf8"), /wiki-skill:start/);
  assert.match(husky9.stdout, /hook: \.husky\/pre-commit/);
  const customRoot = makeGit("custom");
  git(customRoot, ["config", "--local", "core.hooksPath", ".config/hooks"]);
  assert.equal(init(customRoot).status, 0);
  assert.ok(fs.existsSync(path.join(customRoot, ".config/hooks/pre-commit")));
  assert.match(fs.readFileSync(path.join(customRoot, ".config/hooks/pre-commit"), "utf8"), /^#!\/usr\/bin\/env sh/);
  const externalRoot = makeGit("external");
  const external = temp("hooks-outside");
  git(externalRoot, ["config", "--local", "core.hooksPath", external]);
  const result = init(externalRoot);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /outside the repository/);
  assert.equal(fs.readdirSync(external).length, 0);
  const linkedRoot = makeGit("linked-hook");
  const linkedOutside = temp("linked-hook-outside");
  fs.symlinkSync(linkedOutside, path.join(linkedRoot, ".hooklink"), "dir");
  git(linkedRoot, ["config", "--local", "core.hooksPath", ".hooklink"]);
  const linked = init(linkedRoot);
  assert.equal(linked.status, 0, linked.stderr);
  assert.match(linked.stderr, /symbolic link/);
  assert.equal(fs.readdirSync(linkedOutside).length, 0);
});

test("checksum protection preserves authored files and reports a conflict", () => {
  const root = temp("conflict");
  assert.equal(init(root).status, 0);
  const index = path.join(root, "wiki/INDEX.md");
  fs.appendFileSync(index, "\nAuthored content.\n");
  const result = init(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /conflict: wiki\/INDEX\.md/);
  assert.match(fs.readFileSync(index, "utf8"), /Authored content/);
});

test("plan discovery handles Claude, Cursor, active and archived Codex, malformed JSONL, wrong repos, and deduplication", () => {
  const root = makeGit("discovery", "https://github.com/example/alpha.web.git");
  write(path.join(root, "src/grounded.js"), "export {};\n");
  write(path.join(root, "plans/past.md"), "# Historical repository plan\n\nChange src/grounded.js.\n");
  git(root, ["add", "."]); git(root, ["commit", "-qm", "fixture"]);
  fs.unlinkSync(path.join(root, "plans/past.md")); git(root, ["add", "-u"]); git(root, ["commit", "-qm", "remove historical plan"]);
  assert.equal(init(root).status, 0);
  const home = temp("home");
  const shared = "# Shared plan\n\nChange src/grounded.js in example/alpha.web.\n";
  write(path.join(home, ".claude/plans/shared.md"), shared);
  write(path.join(home, ".cursor/plans/private.md"), `---\nname: Private cursor plan\noverview: secret\ntodos: []\nisProject: true\n---\n\n${shared}`);
  write(path.join(home, ".codex/sessions/active.jsonl"), [
    JSON.stringify({ type: "session_meta", payload: { cwd: root } }),
    "malformed{json",
    JSON.stringify({ type: "response_item", payload: { role: "user", content: [{ text: "<proposed_plan>ignore user plan</proposed_plan>" }] } }),
    JSON.stringify({ type: "response_item", payload: { role: "assistant", content: [{ text: `<proposed_plan>${shared.trim()}</proposed_plan>` }] } }),
  ].join("\n"));
  write(path.join(home, ".codex/archived_sessions/archive.jsonl"), [
    JSON.stringify({ type: "session_meta", payload: { cwd: { malformed: true } } }),
    JSON.stringify({ type: "response_item", payload: { role: "assistant", content: [{ text: "<proposed_plan># Archived plan\\n\\nUse src/grounded.js.</proposed_plan>" }] } }),
  ].join("\n"));
  write(path.join(home, ".claude/plans/wrong.md"), "# Other\n\nOnly /unrelated/project/omega is involved.\n");
  write(path.join(root, "supplemental/override.md"), "# Override plan\n\nExplicit plans directory.\n");
  const manifestFile = path.join(root, ".git/wiki-plan-candidates.json");
  const result = node(path.join(root, "scripts/wiki/discover-plans.cjs"), ["--repo", root, "--plans-dir", "supplemental", "--json", manifestFile], { cwd: home, env: { WIKI_HOME: home } });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  assert.equal(manifest.repository.slug, "example/alpha.web");
  assert.ok(manifest.candidates.some((item) => item.sources.some((source) => source.source.includes("archived_sessions"))));
  assert.ok(manifest.candidates.some((item) => item.source_tool === "repository-history"));
  assert.ok(manifest.candidates.some((item) => item.sources.length >= 2), "duplicate body provenance retained");
  assert.ok(manifest.candidates.some((item) => item.sources.some((source) => source.tool === "cursor") && !item.body.includes("isProject:")));
  assert.ok(manifest.summary.unmatched >= 1);
  assert.ok(!manifest.candidates.some((item) => item.body.includes("ignore user plan")));
  assert.ok(manifest.candidates.some((item) => item.body.includes("Explicit plans directory")));
  assert.equal(fs.statSync(manifestFile).mode & 0o777, 0o600);
  assert.equal(node(path.join(root, "scripts/wiki/discover-plans.cjs"), ["--repo", root, "--since-days", "-1"], { cwd: root, env: { WIKI_HOME: home } }).status, 2);
});

test("proposedPlans keeps the last Codex plan revision per title", () => {
  const { proposedPlans } = require(path.join(SKILL, "assets/repository/scripts/wiki/lib/plans.cjs"));
  const file = path.join(temp("codex-plans"), "session.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    JSON.stringify({ type: "session_meta", payload: { cwd: "/tmp/repo" } }),
    JSON.stringify({ type: "event_msg", payload: { item: { type: "Plan", text: "# Demo plan\n\nFirst draft.\n" } } }),
    JSON.stringify({ type: "event_msg", payload: { item: { type: "Plan", text: "# Demo plan\n\nFinal draft.\n" } } }),
  ].join("\n") + "\n");
  const plans = proposedPlans(file);
  assert.equal(plans.length, 1);
  assert.match(plans[0].body, /Final draft/);
});

test("audit requires evidence, archives executed bodies, keeps non-executed rows, and avoids title collisions", () => {
  const root = temp("audit"); assert.equal(init(root).status, 0);
  write(path.join(root, "wiki/topics/testing.md"), "# Testing\n");
  const bodyA = "# Same | [title]\n\nFirst body.\n"; const bodyB = "# Same | [title]\n\nSecond body.\n"; const bodyC = "# Skipped title\n\nThird body.\n";
  const hash = (body) => require("node:crypto").createHash("sha256").update(body).digest("hex");
  const manifest = { candidates: [
    { id: "a", digest: hash(bodyA), title: "Same | [title]", body: bodyA, source_tool: "claude", sources: [{ source: "claude/a" }], association: "matched" },
    { id: "b", digest: hash(bodyB), title: "Same | [title]", body: bodyB, source_tool: "cursor", sources: [{ source: "cursor/b" }], association: "matched" },
    { id: "c", digest: hash(bodyC), title: "Skipped title", body: bodyC, source_tool: "codex", sources: [{ source: "codex/c" }], association: "matched" },
  ] };
  const manifestFile = path.join(root, ".manifest.json"); write(manifestFile, JSON.stringify(manifest));
  const badAudit = path.join(root, ".bad.json"); write(badAudit, JSON.stringify({ entries: [{ id: "a", status: "implemented", evidence: [] }] }));
  assert.equal(node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", badAudit, "--repo", root], { cwd: root }).status, 2);
  const topiclessAudit = path.join(root, ".topicless.json"); write(topiclessAudit, JSON.stringify({ entries: [{ id: "a", status: "implemented", evidence: ["ok"], topics: [] }] }));
  const topicless = node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", topiclessAudit, "--repo", root], { cwd: root });
  assert.equal(topicless.status, 2); assert.match(topicless.stderr, /implemented requires at least one topic/);
  const goodAudit = path.join(root, ".good.json"); write(goodAudit, JSON.stringify({ entries: [
    { id: hash(bodyA), status: "implemented", evidence: ["test:fixture | passed"], topics: ["testing"] },
    { id: "b", status: "implemented", evidence: ["test:fixture-2"], topics: ["testing"] },
    { id: "c", status: "not-implemented", evidence: [], topics: [] },
  ] }));
  assert.equal(node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", goodAudit, "--repo", root], { cwd: root }).status, 0);
  const archives = fs.readdirSync(path.join(root, "wiki/plans")).filter((file) => file !== "INDEX.md");
  assert.equal(archives.length, 2);
  assert.equal(new Set(archives).size, 2);
  const archived = fs.readFileSync(path.join(root, "wiki/plans", archives[0]), "utf8");
  for (const key of ["status:", "executed:", "evidence:", "source_tool:", "source:", "topics:"]) assert.match(archived, new RegExp(key));
  const ledger = fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8");
  assert.match(ledger, /not-implemented/); assert.match(ledger, new RegExp(hash(bodyC)));
  assert.match(ledger, /Same \\| \\\[title\\\]/);
  for (const row of ledger.split(/\r?\n/).filter((line) => /^\| \d{4}-\d{2}-\d{2} /.test(line))) assert.equal(row.split(/(?<!\\)\|/).length, 7, row);
  assert.equal(node(path.join(root, "scripts/wiki/build-graph.cjs"), ["--repo", root], { cwd: root }).status, 0);
  assert.equal(node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root }).status, 0);
  fs.appendFileSync(path.join(root, "wiki/plans", archives[0]), "tampered\n");
  assert.equal(node(path.join(root, "scripts/wiki/build-graph.cjs"), ["--repo", root], { cwd: root }).status, 0);
  const tampered = node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root });
  assert.equal(tampered.status, 2); assert.match(tampered.stderr, /digest does not match/);
});

test("audit preflight is transactional and rejects forged digests and path-traversal dates", () => {
  const root = temp("audit-hostile"); assert.equal(init(root).status, 0);
  write(path.join(root, "wiki/topics/runtime.md"), "# Runtime\n");
  const hash = (body) => require("node:crypto").createHash("sha256").update(body).digest("hex");
  const first = "# First\n\nBody.\n"; const second = "# Second\n\nBody.\n";
  const manifest = { candidates: [
    { id: "first", digest: hash(first), title: "First", body: first, source_tool: "claude", sources: [{ source: "a" }], association: "matched" },
    { id: "second", digest: hash(second), title: "Second", body: second, source_tool: "codex", sources: [{ source: "b" }], association: "matched" },
  ] };
  const manifestFile = path.join(root, "manifest.json"); write(manifestFile, JSON.stringify(manifest));
  const auditFile = path.join(root, "audit.json"); write(auditFile, JSON.stringify({ entries: [
    { id: "first", status: "implemented", evidence: ["ok"], topics: ["runtime"] },
    { id: "second", status: "implemented", evidence: ["ok"], topics: ["runtime"], date: "../../escape" },
  ] }));
  const before = fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8");
  const result = node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", auditFile, "--repo", root], { cwd: root });
  assert.equal(result.status, 2); assert.match(result.stderr, /invalid date/);
  assert.equal(fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8"), before);
  assert.deepEqual(fs.readdirSync(path.join(root, "wiki/plans")), ["INDEX.md"]);
  manifest.candidates[0].digest = "0".repeat(64); write(manifestFile, JSON.stringify(manifest));
  write(auditFile, JSON.stringify({ entries: [{ id: "first", status: "implemented", evidence: ["ok"], topics: ["runtime"] }] }));
  assert.equal(node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", auditFile, "--repo", root], { cwd: root }).status, 2);
});

test("graph is wiki-only, byte-stable, typed, and rejects dangling relationships", () => {
  const root = temp("graph"); assert.equal(init(root).status, 0);
  write(path.join(root, "code.md"), "# Code must not be a node\n");
  write(path.join(root, "wiki/topics/runtime.md"), [
    "---", "aliases: [execution engine]", "---", "", "# Runtime", "",
    "https://github.com/Example/One/issues/7 and https://github.com/Example/Two/pull/7. Ignore https://evil.example/github.com/example/one/issues/8.",
    "", "````md", "```", "https://github.com/example/fenced/issues/9", "[missing](../topics/missing.md)", "```js", "````", "",
  ].join("\n"));
  write(path.join(root, "wiki/journal/2026-01-01-runtime.md"), "---\ntopics: [runtime]\nplans: []\n---\n\n# Runtime journal\n\nSee [mechanics](../MECHANICS.md), the non-node [code](../../code.md), [local URI](file:///etc/passwd), and ![an image](../image.png).\n");
  const build = path.join(root, "scripts/wiki/build-graph.cjs");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  const first = fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  assert.equal(fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8"), first);
  const graph = JSON.parse(first);
  assert.equal(graph.version, 1);
  assert.equal(graph.wikiRoot, "wiki");
  assert.ok(graph.nodes.every((item) => item.id.startsWith("wiki/")));
  assert.ok(!graph.nodes.some((item) => item.id === "code.md"));
  assert.ok(new Set(graph.nodes.map((item) => item.type)).has("topic"));
  assert.ok(new Set(graph.nodes.map((item) => item.type)).has("journal"));
  const runtime = graph.nodes.find((item) => item.id === "wiki/topics/runtime.md");
  assert.ok(runtime.bytes > 0);
  assert.ok(Number.isInteger(runtime.degree));
  assert.deepEqual(runtime.aliases, ["execution engine"]);
  assert.deepEqual(runtime.githubRefs.map((item) => `${item.repository}:${item.kind}:${item.number}`), ["example/one:issue:7", "example/two:pull-request:7"]);
  write(path.join(root, "wiki/journal/broken.md"), "---\ntopics: [missing]\n---\n\n# Broken\n");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 2);
  fs.unlinkSync(path.join(root, "wiki/journal/broken.md"));
  fs.symlinkSync(path.join(root, "code.md"), path.join(root, "wiki/topics/linked.md"));
  const linked = node(build, ["--repo", root], { cwd: root });
  assert.equal(linked.status, 2); assert.match(linked.stderr, /symbolic links are not allowed/);
  const viewer = fs.readFileSync(path.join(root, "scripts/wiki/graph/viewer/index.html"), "utf8");
  for (const id of ["controls", "search", "route-from", "route-to", "show-route", "route-status", "toggle-all", "legend", "reset", "graph", "panel", "p-neighbors", "p-route"]) {
    assert.match(viewer, new RegExp(`id="${id}"`));
  }
  for (const asset of ["/viewer/viewer.css", "/viewer/vendor/graphology.umd.min.js", "/viewer/vendor/graphology-library.min.js", "/viewer/vendor/sigma.min.js", "/viewer/routing.js", "/viewer/viewer.js"]) {
    assert.match(viewer, new RegExp(`(?:href|src)="${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("archived plan repo-file links remain safe and topicless archives fail validation", () => {
  const root = temp("plan-repo-links");
  assert.equal(init(root).status, 0);
  write(path.join(root, "wiki/topics/documentation.md"), "# Documentation\n");
  const crypto = require("node:crypto");
  const body = "# Add CONTRIBUTING\n\nCreate `[CONTRIBUTING.md](CONTRIBUTING.md)` and see [mechanics](../MECHANICS.md).\n";
  const planDigest = crypto.createHash("sha256").update(body).digest("hex");
  write(path.join(root, "wiki/plans/2026-01-01-contributing.md"), [
    "---",
    'status: "implemented"',
    "executed: true",
    'evidence: ["CONTRIBUTING.md shipped"]',
    'source_tool: "repository"',
    'source: "repository:test.plan.md"',
    "topics: [documentation]",
    `digest: "${planDigest}"`,
    "---",
    "",
    body.trim(),
    "",
  ].join("\n"));
  const marker = "<!-- wiki-plan-rows -->";
  const index = fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8");
  const row = `| 2026-01-01 | [Add CONTRIBUTING](./2026-01-01-contributing.md) | implemented | CONTRIBUTING.md shipped | documentation <!-- plan:${planDigest} --> |`;
  fs.writeFileSync(path.join(root, "wiki/plans/INDEX.md"), index.replace(marker, `${row}\n${marker}`));
  const build = path.join(root, "scripts/wiki/build-graph.cjs");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  const graph = JSON.parse(fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8"));
  assert.ok(graph.edges.some((edge) => edge.source.startsWith("wiki/plans/") && edge.target === "wiki/MECHANICS.md"));
  assert.ok(!graph.nodes.some((node) => node.id === "wiki/plans/CONTRIBUTING.md"));
  assert.equal(node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root }).status, 0);
  const archive = path.join(root, "wiki/plans/2026-01-01-contributing.md");
  fs.writeFileSync(archive, fs.readFileSync(archive, "utf8").replace("topics: [documentation]", "topics: []"));
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  const topicless = node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root });
  assert.equal(topicless.status, 2); assert.match(topicless.stderr, /at least one topic is required/);
});

test("audit-plan-candidates drafts matched rows using git without shell format strings", () => {
  const root = makeGit("audit-draft");
  write(path.join(root, "README.md"), "# Repo\n");
  write(path.join(root, "skills/demo/SKILL.md"), "# Demo skill\n");
  git(root, ["add", "."]);
  git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "feat(demo): Add demo skill for wiki audit"]);
  assert.equal(init(root).status, 0);
  const body = "# Add demo skill\n\nUpdate `skills/demo/SKILL.md` for the demo skill.\n";
  const digest = require("node:crypto").createHash("sha256").update(body.trim() + "\n").digest("hex");
  const manifest = {
    repository: { root, tracked: ["README.md", "skills/demo/SKILL.md"] },
    candidates: [{
      id: digest.slice(0, 16),
      digest,
      title: "Add demo skill",
      body: body.trim() + "\n",
      source_tool: "cursor",
      sources: [{ tool: "cursor", source: "cursor:test.plan.md" }],
      association: "matched",
      reasons: ["tracked paths: skills/demo/SKILL.md"],
    }],
  };
  const manifestFile = path.join(root, "manifest.json");
  write(manifestFile, JSON.stringify(manifest));
  const auditFile = path.join(root, "audit.json");
  const result = node(path.join(root, "scripts/wiki/audit-plan-candidates.cjs"), ["--manifest", manifestFile, "--audit", auditFile, "--repo", root], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].status, "partial");
  assert.match(audit.entries[0].evidence.join(" "), /no merged PR branch/i);
});

test("audit-plan-candidates marks implemented when a merged PR branch matches", () => {
  const { audit, prEvidence } = require(path.join(SKILL, "assets/repository/scripts/wiki/audit-plan-candidates.cjs"));
  const root = makeGit("audit-branch");
  write(path.join(root, "README.md"), "# Repo\n");
  git(root, ["add", "."]);
  git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "baseline"]);
  git(root, ["checkout", "-b", "feat/demo-skill"]);
  write(path.join(root, "skills/demo/SKILL.md"), "# Demo\n");
  git(root, ["add", "."]);
  git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "feat(demo): Add demo skill"]);
  git(root, ["checkout", "main"]);
  git(root, ["merge", "--no-ff", "-m", "Merge pull request #7 from example/feat/demo-skill", "feat/demo-skill"]);
  const body = "# Add demo skill\n\nDeliver on branch feat/demo-skill for issue #7.\n";
  const digest = require("node:crypto").createHash("sha256").update(body.trim() + "\n").digest("hex");
  const manifest = {
    repository: { root, tracked: ["README.md", "skills/demo/SKILL.md"] },
    candidates: [{
      id: digest.slice(0, 16),
      digest,
      title: "Add demo skill",
      body: body.trim() + "\n",
      source_tool: "cursor",
      sources: [{ tool: "cursor", source: "cursor:feat/demo-skill.plan.md" }],
      association: "matched",
      reasons: ["tracked paths: skills/demo/SKILL.md"],
    }],
  };
  const { entries } = audit(manifest, root, { baseBranch: "main" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, "implemented");
  assert.match(entries[0].evidence[0], /PR #7 branch feat\/demo-skill merge/);
  assert.match(prEvidence({ number: 7, branch: "feat/demo-skill", merge: "abc123def456" }), /PR #7 branch feat\/demo-skill merge abc123def456/);
});

test("audit-plan-candidates propagates branch evidence to sibling session plans", () => {
  const { audit, prEvidence } = require(path.join(SKILL, "assets/repository/scripts/wiki/audit-plan-candidates.cjs"));
  const root = makeGit("audit-sibling");
  write(path.join(root, "README.md"), "# Repo\n");
  git(root, ["add", "."]);
  git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "baseline"]);
  git(root, ["checkout", "-b", "feat/windows-env"]);
  write(path.join(root, ".env.example"), "TOKEN=\n");
  git(root, ["add", "."]);
  git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "feat(windows): Add env example"]);
  git(root, ["checkout", "main"]);
  git(root, ["merge", "--no-ff", "-m", "Merge pull request #12 from example/feat/windows-env", "feat/windows-env"]);
  const session = "codex:/Users/me/.codex/sessions/2026/08/20/rollout-test.jsonl";
  const issueBody = "# Create Windows credential permissions issue\n\nOpen issue #12 on branch feat/windows-env.\n";
  const implBody = "# Windows-compatible credential permissions\n\nAccept 0700 on Windows mounts.\n";
  const digest = (body) => require("node:crypto").createHash("sha256").update(body.trim() + "\n").digest("hex");
  const manifest = {
    repository: { root, tracked: ["README.md", ".env.example"] },
    candidates: [
      {
        id: digest(issueBody).slice(0, 16),
        digest: digest(issueBody),
        title: "Create Windows credential permissions issue",
        body: issueBody.trim() + "\n",
        source_tool: "codex",
        sources: [{ tool: "codex", source: session }],
        association: "matched",
        reasons: ["session cwd"],
      },
      {
        id: digest(implBody).slice(0, 16),
        digest: digest(implBody),
        title: "Windows-compatible credential permissions",
        body: implBody.trim() + "\n",
        source_tool: "codex",
        sources: [{ tool: "codex", source: session }],
        association: "matched",
        reasons: ["session cwd"],
      },
    ],
  };
  const { entries } = audit(manifest, root, { baseBranch: "main" });
  assert.equal(entries.length, 2);
  const impl = entries.find((entry) => entry.id === digest(implBody).slice(0, 16));
  assert.equal(impl.status, "implemented");
  assert.match(impl.evidence.join(" "), /PR #12 branch feat\/windows-env merge/);
});

test("audit-plan-candidates infers plan dates from delivery evidence and sources", () => {
  const { inferPlanDate } = require(path.join(SKILL, "assets/repository/scripts/wiki/lib/dates.cjs"));
  const root = makeGit("audit-dates");
  const body = "# Demo plan\n\nShip README.\n";
  const datedFile = path.join(root, "plans", "2026-04-02-demo.plan.md");
  fs.mkdirSync(path.dirname(datedFile), { recursive: true });
  write(datedFile, body);
  assert.equal(inferPlanDate(root, { sources: [{ source: datedFile }] }, [], "not-implemented"), "2026-04-02");
  const session = path.join(os.homedir(), ".codex", "sessions", "2026", "03", "09", "rollout-test.jsonl");
  assert.equal(inferPlanDate(root, { sources: [{ source: session }] }, [], "not-implemented"), "2026-03-09");
});

test("merge and issue helpers are deterministic", () => {
  const root = makeGit("helpers", "git@github.com:example/repo.git"); assert.equal(init(root).status, 0);
  const { reconcile } = require(path.join(root, "scripts/wiki/on-merge-sync.cjs"));
  const context = { schemaVersion: 1, repository: "example/repo", number: 42, title: "Add runtime", body: "Mentions https://github.com/example/ignored/issues/99. Fixes #7. Resolves example/other#7. Closes https://github.com/example/third/issues/8.", url: "https://github.com/example/repo/pull/42", mergedAt: "2026-01-02T00:00:00Z", changedPaths: ["src/runtime.js"], commits: [{ hash: "abc123", subject: "Add deterministic runtime" }] };
  assert.equal(reconcile(context, root).length, 1); assert.equal(reconcile(context, root).length, 0);
  const { CLOSED_SUFFIX, issueRefs, markClosed, setIssueState } = require(path.join(root, "scripts/wiki/refresh-issue-state.cjs"));
  const issue = "https://github.com/example/repo/issues/7";
  assert.equal(issueRefs(issue).length, 1);
  assert.equal(markClosed(markClosed(issue, issue), issue), `${issue}${CLOSED_SUFFIX}`);
  assert.equal(setIssueState(`${issue}${CLOSED_SUFFIX}`, issue, "open"), issue);
  assert.equal(setIssueState(`[issue](${issue})`, issue, "closed"), `[issue](${issue})${CLOSED_SUFFIX}`);
  assert.equal(setIssueState(`[authored](${issue}) — closed`, issue, "closed"), `[authored](${issue}) — closed`);
  assert.equal(setIssueState(`[authored](${issue}) — closed`, issue, "open"), `[authored](${issue}) — closed`);
  const journal = fs.readFileSync(path.join(root, "wiki/journal/2026-01-02-pr-42-add-runtime.md"), "utf8");
  assert.match(journal, /issue: "https:\/\/github\.com\/example\/repo\/issues\/7"/);
  assert.match(journal, /issues: \["https:\/\/github\.com\/example\/repo\/issues\/7", "https:\/\/github\.com\/example\/other\/issues\/7", "https:\/\/github\.com\/example\/third\/issues\/8"\]/);
  assert.doesNotMatch(journal, /ignored\/issues\/99/);
  assert.match(journal, /Add deterministic runtime/);
  assert.equal(issueRefs("https://evil.example/github.com/example/repo/issues/8").length, 0);
  assert.throws(() => reconcile({ ...context, number: "../../escape" }, root), /positive/);
  const escaped = path.join(root, ".github", "escaped.md");
  write(escaped, "# Must stay unchanged\n");
  assert.throws(() => reconcile({ ...context, changedPaths: ["wiki/journal/../../.github/escaped.md"] }, root), /normalized repository-relative/);
  assert.equal(fs.readFileSync(escaped, "utf8"), "# Must stay unchanged\n");
  assert.throws(() => reconcile({ ...context, url: "https://github.com/other/repo/pull/42" }, root), /URL must match/);
  assert.throws(() => reconcile({ ...context, commits: [{ hash: 7, subject: "bad" }] }, root), /string hash and subject/);
  assert.throws(() => reconcile({ ...context, title: 7 }, root), /title must be a string/);
  assert.throws(() => reconcile({ ...context, body: [] }, root), /body must be a string/);
  assert.throws(() => reconcile({ ...context, mergedAt: 1724400000 }, root), /parseable ISO date/);
  assert.throws(() => reconcile({ ...context, mergedAt: "not-an-iso-date" }, root), /parseable ISO date/);
  assert.throws(() => reconcile({ ...context, mergedAt: "2026" }, root), /parseable ISO date/);
  const { url: _omittedUrl, ...withoutUrl } = context;
  assert.throws(() => reconcile(withoutUrl, root), /URL must match/);
  const linkedTarget = path.join(root, ".github", "linked-journal.md");
  write(linkedTarget, "---\npr: pending\n---\n# Linked\n");
  fs.symlinkSync(linkedTarget, path.join(root, "wiki", "journal", "linked.md"));
  assert.throws(() => reconcile({ ...context, changedPaths: ["wiki/journal/linked.md"] }, root), /unsafe journal path/);
  assert.match(fs.readFileSync(linkedTarget, "utf8"), /pr: pending/);
});

test("merge reconciliation adds every closing issue to an existing journal", () => {
  const root = makeGit("merge-existing", "git@github.com:example/repo.git"); assert.equal(init(root).status, 0);
  const journal = path.join(root, "wiki/journal/existing.md");
  write(journal, "---\npr: pending\nissue: https://github.com/example/legacy/issues/1\ntopics: []\nplans: []\n---\n\n# Existing\n");
  const { reconcile } = require(path.join(root, "scripts/wiki/on-merge-sync.cjs"));
  const context = { number: 43, title: "Existing", body: "Fixes #2. Resolves example/other#2.", url: "https://github.com/example/repo/pull/43", merged_at: "2026-01-03T00:00:00Z", files: ["src/runtime.js", "wiki/journal/existing.md"], commits: [] };
  assert.deepEqual(reconcile(context, root), ["wiki/journal/existing.md"]);
  const text = fs.readFileSync(journal, "utf8");
  assert.match(text, /pr: https:\/\/github\.com\/example\/repo\/pull\/43/);
  assert.match(text, /issues: \["https:\/\/github\.com\/example\/legacy\/issues\/1", "https:\/\/github\.com\/example\/repo\/issues\/2", "https:\/\/github\.com\/example\/other\/issues\/2"\]/);
  assert.deepEqual(reconcile(context, root), []);
});

test("issue refresh scopes Open threads, caches lookups, and owns only its trailing marker", () => {
  const root = temp("issue-refresh"); assert.equal(init(root).status, 0);
  const modulePath = path.join(root, "scripts/wiki/refresh-issue-state.cjs");
  const { CLOSED_SUFFIX, refresh } = require(modulePath);
  const topics = path.join(root, "wiki", "topics");
  const one = "https://github.com/example/repo/issues/1";
  const two = "https://github.com/example/other/issues/2";
  const fenced = "https://github.com/example/fenced/issues/3";
  const first = path.join(topics, "first.md");
  const second = path.join(topics, "second.md");
  const outside = path.join(temp("issue-refresh-outside"), "linked.md");
  write(first, [
    "# First", "", "## Decisions", "", `- [decision](${one})`, "", "## Open threads", "",
    "```md", "## Decisions", `- [fenced](${fenced})`, "```", "",
    `- [one](${one}) and [two](${two})`, `- [authored](${two}) — closed`, "",
  ].join("\n"));
  write(second, `# Second\n\n## Open threads\n\n- [duplicate](${one})\n`);
  write(outside, `# Outside\n\n## Open threads\n\n- [linked](https://github.com/example/outside/issues/99)\n`);
  fs.symlinkSync(outside, path.join(topics, "linked.md"));
  write(path.join(topics, "third.md"), [
    "# Third", "", "## Decisions", "", "~~~md", "## Open threads", `- [fenced heading](${fenced})`, "~~~", "", `- [still a decision](${fenced})`, "",
  ].join("\n"));
  write(path.join(topics, "long-fence.md"), [
    "# Long fence", "", "## Open threads", "", "````md", "```", `- [nested](${fenced})`, "```js", "````", "",
  ].join("\n"));
  const calls = [];
  const closed = refresh(topics, (issue) => { calls.push(`${issue.repository}#${issue.number}`); return "closed"; });
  assert.deepEqual(calls, ["example/other#2", "example/repo#1"]);
  assert.doesNotMatch(fs.readFileSync(outside, "utf8"), /wiki-issue-state/);
  assert.equal(closed.warnings.length, 0);
  const closedText = fs.readFileSync(first, "utf8");
  assert.match(closedText, new RegExp(`\\[one\\]\\(${one.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\) and \\[two\\]`));
  assert.doesNotMatch(closedText, /issues\/1 — closed\)/);
  assert.doesNotMatch(closedText, /fenced\/issues\/3[^\n]*wiki-issue-state/);
  assert.match(closedText, new RegExp(`## Decisions[\\s\\S]*\\[decision\\]\\(${one.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\n\\n## Open threads`));
  assert.match(closedText, new RegExp(`${CLOSED_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  const reopened = refresh(topics, (issue) => issue.number === 1 ? "open" : "closed");
  assert.ok(reopened.changes.length >= 1);
  const reopenedText = fs.readFileSync(first, "utf8");
  assert.doesNotMatch(reopenedText.split("## Open threads")[1].split("\n")[2], /wiki-issue-state:closed/);
  assert.match(reopenedText, /\[authored\][^\n]+ — closed$/m);
  const failed = refresh(topics, (issue) => { if (issue.number === 1) throw new Error("offline"); return "closed"; });
  assert.equal(failed.warnings.length, 1);
  const mixed = path.join(topics, "mixed.md");
  const mixedBody = `# Mixed\n\n## Open threads\n\n- [open](https://github.com/example/mixed/issues/4) and [unknown](https://github.com/example/mixed/issues/5)${CLOSED_SUFFIX}\n`;
  write(mixed, mixedBody);
  const uncertain = refresh(topics, (issue) => {
    if (issue.repository === "example/mixed" && issue.number === 4) return "open";
    if (issue.repository === "example/mixed" && issue.number === 5) throw new Error("offline");
    return "closed";
  });
  assert.ok(uncertain.warnings.some((warning) => /example\/mixed issue #5/.test(warning)));
  assert.equal(fs.readFileSync(mixed, "utf8"), mixedBody);
  const linkedRoot = temp("issue-refresh-linked-root");
  const externalWiki = temp("issue-refresh-external-wiki");
  write(path.join(externalWiki, "topics", "outside.md"), `# Outside\n\n## Open threads\n\n- [outside](${one})\n`);
  fs.symlinkSync(externalWiki, path.join(linkedRoot, "wiki"), "dir");
  assert.throws(() => refresh(path.join(linkedRoot, "wiki", "topics"), () => "closed", linkedRoot), /symbolic link/);
  assert.doesNotMatch(fs.readFileSync(path.join(externalWiki, "topics", "outside.md"), "utf8"), /wiki-issue-state/);
});

test("pre-commit does not stage graph output derived from unstaged wiki content", () => {
  const root = makeGit("precommit"); assert.equal(init(root).status, 0);
  git(root, ["add", "."]); git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "baseline"]);
  const graphFile = path.join(root, "scripts/wiki/graph/data/graph.json");
  const before = fs.readFileSync(graphFile, "utf8");
  write(path.join(root, "wiki/topics/unstaged.md"), "# Unstaged\n");
  write(path.join(root, "code.js"), "export {};\n"); git(root, ["add", "code.js"]);
  const result = node(path.join(root, "scripts/wiki/pre-commit.cjs"), [], { cwd: root, env: { WIKI_HOME: temp("precommit-home") } });
  assert.equal(result.status, 0); assert.match(result.stderr, /unstaged wiki changes/);
  assert.equal(fs.readFileSync(graphFile, "utf8"), before);
  assert.equal(git(root, ["diff", "--cached", "--name-only"]), "code.js");
});

test("pre-commit rebuilds and stages the graph after a staged wiki deletion", () => {
  const root = makeGit("precommit-delete"); assert.equal(init(root).status, 0);
  const topic = path.join(root, "wiki/topics/deleted.md");
  write(topic, "# Deleted topic\n");
  assert.equal(node(path.join(root, "scripts/wiki/build-graph.cjs"), [], { cwd: root }).status, 0);
  git(root, ["add", "."]); git(root, ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "baseline"]);
  fs.unlinkSync(topic); git(root, ["add", "-u", "--", "wiki/topics/deleted.md"]);
  const result = node(path.join(root, "scripts/wiki/pre-commit.cjs"), [], { cwd: root, env: { WIKI_HOME: temp("precommit-delete-home") } });
  assert.equal(result.status, 0, result.stderr);
  const stagedGraph = JSON.parse(git(root, ["show", ":scripts/wiki/graph/data/graph.json"]));
  assert.ok(!stagedGraph.nodes.some((item) => item.id === "wiki/topics/deleted.md"));
  assert.match(git(root, ["diff", "--cached", "--name-only"]), /scripts\/wiki\/graph\/data\/graph\.json/);
});

test("graph server resolver refuses traversal and symbolic-link disclosure", () => {
  const root = temp("server"); assert.equal(init(root).status, 0);
  const graphRoot = fs.realpathSync(path.join(root, "scripts/wiki/graph"));
  const secret = path.join(temp("server-secret"), "secret.txt"); write(secret, "secret\n");
  const graphFile = path.join(graphRoot, "data/graph.json"); fs.unlinkSync(graphFile); fs.symlinkSync(secret, graphFile);
  const build = node(path.join(root, "scripts/wiki/build-graph.cjs"), ["--repo", root], { cwd: root });
  assert.equal(build.status, 2); assert.match(build.stderr, /output path contains a symbolic link/); assert.equal(fs.readFileSync(secret, "utf8"), "secret\n");
  fs.unlinkSync(graphFile); assert.equal(node(path.join(root, "scripts/wiki/build-graph.cjs"), ["--repo", root], { cwd: root }).status, 0);
  fs.symlinkSync(secret, path.join(graphRoot, "leak.txt"));
  const { resolveRequest } = require(path.join(root, "scripts/wiki/serve-graph.cjs"));
  assert.equal(resolveRequest(graphRoot, "/leak.txt"), null);
  assert.equal(resolveRequest(graphRoot, "/../../etc/passwd"), null);
  assert.equal(resolveRequest(graphRoot, "/data/graph.json"), path.join(graphRoot, "data/graph.json"));
  assert.equal(resolveRequest(graphRoot, "/viewer/viewer.css"), path.join(graphRoot, "viewer/viewer.css"));
  assert.equal(resolveRequest(graphRoot, "/viewer.css"), null);
});

test("graph server selects the next port unless a port was explicitly requested", async () => {
  const { EventEmitter } = require("node:events");
  const root = temp("server-port");
  assert.equal(init(root).status, 0);
  const graphRoot = fs.realpathSync(path.join(root, "scripts/wiki/graph"));
  const { listen } = require(path.join(root, "scripts/wiki/serve-graph.cjs"));
  class FakeServer extends EventEmitter {
    listen(port, host, callback) {
      this.port = port;
      queueMicrotask(() => {
        if (port === 4173) this.emit("error", Object.assign(new Error("occupied"), { code: "EADDRINUSE" }));
        else callback();
      });
    }
  }
  const fallback = await listen(graphRoot, 4173, true, () => new FakeServer());
  assert.equal(fallback.port, 4174);
  await assert.rejects(listen(graphRoot, 4173, false, () => new FakeServer()), (error) => error.code === "EADDRINUSE");
});

test("Sigma viewer matches the reference shell, runs ForceAtlas2, and applies search/type/focus reducers", async () => {
  const source = fs.readFileSync(path.join(SKILL, "assets/repository/scripts/wiki/graph/viewer/viewer.js"), "utf8");
  const routingSource = fs.readFileSync(path.join(SKILL, "assets/repository/scripts/wiki/graph/viewer/routing.js"), "utf8");
  function element() {
    const classes = new Set();
    return {
      value: "", textContent: "", className: "", dataset: {}, style: {}, children: [], listeners: {},
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name),
      },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, value) { this[name] = value; },
    };
  }
  const ids = ["stats", "search", "legend", "reset", "toggle-all", "panel-close", "panel", "graph", "p-label", "p-type", "p-meta", "p-neighbors", "route-from", "route-to", "show-route", "route-status", "node-panel", "route-panel", "p-route"];
  const elements = Object.fromEntries(ids.map((id) => [id, element()]));
  const document = {
    querySelector: (selector) => elements[selector.slice(1)],
    querySelectorAll: (selector) => selector === ".legend-item" ? elements.legend.children : [],
    createElement: () => element(),
  };
  class MultiGraph {
    constructor() { this.nodes = new Map(); this.edges = new Map(); }
    get order() { return this.nodes.size; }
    addNode(id, attrs) { this.nodes.set(id, attrs); }
    hasNode(id) { return this.nodes.has(id); }
    addEdgeWithKey(id, source, target, attrs) { this.edges.set(id, { source, target, attrs }); }
    degree(id) { return [...this.edges.values()].filter((edge) => edge.source === id || edge.target === id).length; }
    forEachNode(fn) { for (const [id, attrs] of this.nodes) fn(id, attrs); }
    setNodeAttribute(id, name, value) { this.nodes.get(id)[name] = value; }
    extremities(id) { const edge = this.edges.get(id); return [edge.source, edge.target]; }
  }
  let renderer, circularCalls = 0, forceCalls = 0;
  class Sigma {
    constructor(graph, target, settings) { this.graph = graph; this.target = target; this.settings = settings; this.handlers = {}; renderer = this; }
    refresh() {}
    on(name, fn) { this.handlers[name] = fn; }
    getCamera() { return { animate() {}, animatedReset() {} }; }
    getNodeDisplayData(id) { return this.graph.nodes.get(id); }
  }
  const nodes = ["index", "topic", "journal", "plan"].map((type, i) => ({ id: `wiki/${type}-${i}.md`, label: type, type, aliases: [], githubRefs: type === "topic" ? [{ repository: "example/repo", kind: "issue", number: 7, url: "https://github.com/example/repo/issues/7" }] : [], bytes: 100 + i, degree: type === "topic" || type === "plan" ? 1 : 0, x: i, y: i, size: 8 }));
  const edges = [{ id: "edge-1", source: "wiki/topic-1.md", target: "wiki/plan-3.md", type: "topic", relation: "topic" }];
  const policy = { edgeCosts: { topic: 1, plan: 1, link: 3 }, hubPenalty: 0.5, bytePenaltyPerKiB: 0.05, excludedIntermediateTypes: ["index"] };
  const window = {};
  const context = {
    fetch: async (url) => ({ ok: true, json: async () => String(url).includes("routing-policy") ? policy : ({ nodes, edges }) }),
    graphology: { MultiGraph },
    graphologyLibrary: {
      layout: { circular: { assign() { circularCalls++; } } },
      layoutForceAtlas2: { inferSettings: () => ({}), assign() { forceCalls++; } },
    },
    Sigma, document, window, console, Map, Set,
  };
  vm.runInNewContext(routingSource, context);
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(window.WikiRouting.normalizeGithubQuery("https://github.com/example/repo/issues/9007199254740993?x=1"), "https://github.com/example/repo/issues/9007199254740993?x=1");
  assert.equal(window.WikiRouting.validPolicy(policy, { nodes, edges }), true);
  assert.equal(window.WikiRouting.validPolicy({ ...policy, excludedIntermediateTypes: "index" }, { nodes, edges }), false);
  assert.equal(window.WikiRouting.validPolicy({ ...policy, excludedIntermediateTypes: [null] }, { nodes, edges }), false);
  assert.equal(window.WikiRouting.validPolicy({ ...policy, edgeCosts: { plan: 1 } }, { nodes, edges }), false);
  assert.equal(window.WikiRouting.shortestPath({ nodes, edges }, nodes[1].id, nodes[3].id, { ...policy, edgeCosts: { plan: 1 } }), null);
  assert.equal(renderer.graph.nodes.size, 4);
  assert.equal(circularCalls, 1);
  assert.equal(forceCalls, 1);
  elements.search.listeners.input({ target: { value: "https://github.com/Example/Repo/issues/7?x=1#note" } });
  assert.equal(renderer.settings.nodeReducer("wiki/topic-1.md", renderer.graph.nodes.get("wiki/topic-1.md")).label, "topic");
  assert.equal(renderer.settings.nodeReducer("wiki/plan-3.md", renderer.graph.nodes.get("wiki/plan-3.md")).label, "");
  elements.search.listeners.input({ target: { value: "example/repo#7" } });
  assert.equal(renderer.settings.nodeReducer("wiki/topic-1.md", renderer.graph.nodes.get("wiki/topic-1.md")).label, "topic");
  assert.equal(renderer.settings.nodeReducer("wiki/plan-3.md", renderer.graph.nodes.get("wiki/plan-3.md")).label, "");
  elements.search.listeners.input({ target: { value: "topic" } });
  assert.equal(renderer.settings.nodeReducer("wiki/plan-3.md", renderer.graph.nodes.get("wiki/plan-3.md")).label, "");
  const topicLegend = elements.legend.children.find((item) => item.dataset.type === "topic");
  topicLegend.listeners.click();
  assert.equal(renderer.settings.nodeReducer("wiki/topic-1.md", renderer.graph.nodes.get("wiki/topic-1.md")).hidden, true);
  renderer.handlers.clickNode({ node: "wiki/topic-1.md" });
  assert.equal(elements["p-label"].textContent, "topic");
  assert.equal(elements.panel.classList.contains("hidden"), false);
  assert.equal(window.WikiGraph.state.focus, "wiki/topic-1.md");
  elements["route-from"].value = "wiki/topic-1.md";
  elements["route-to"].value = "wiki/plan-3.md";
  elements["show-route"].listeners.click();
  assert.deepEqual([...window.WikiGraph.state.routeNodes], ["wiki/topic-1.md", "wiki/plan-3.md"]);
  assert.match(elements["route-status"].textContent, /Authority: wiki\/topic-1\.md → wiki\/plan-3\.md.*2 file\(s\).*204 B/);
  assert.match(elements["p-route"].children[0].textContent, /query match.*source: wiki\/topic-1\.md.*101 B/);
  assert.match(elements["p-route"].children[1].textContent, /→ topic.*target: wiki\/plan-3\.md.*103 B/);
  assert.doesNotMatch(source, /innerHTML/);
});

require("./unit.test.cjs");
