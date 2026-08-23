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
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Wiki Test"]);
  git(root, ["config", "user.email", "wiki@example.test"]);
  if (remote) git(root, ["remote", "add", "origin", remote]);
  return root;
}
function write(file, body) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); }

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
  assert.ok(!fs.existsSync(path.join(root, ".github")));
  const before = fs.readFileSync(path.join(root, "wiki/.wiki-kit.json"), "utf8");
  const second = init(root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(path.join(root, "wiki/.wiki-kit.json"), "utf8"), before);
  assert.equal(node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root }).status, 0);
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
  const sync = fs.readFileSync(path.join(root, ".github/workflows/wiki-sync.yml"), "utf8");
  const issueSync = fs.readFileSync(path.join(root, ".github/workflows/wiki-issue-sync.yml"), "utf8");
  assert.match(sync, /^name: Sync context wiki$/m);
  assert.match(issueSync, /^name: Sync wiki issue state$/m);
  assert.doesNotMatch(sync, /slack|@verndale\/ai-pr/i);
  for (const workflow of [sync, issueSync]) {
    assert.match(workflow, /GRAPHIFY_SKIP_HOOK: "1"/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /gh auth setup-git/);
    assert.match(workflow, /PR_BOT_TOKEN/);
  }
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
  const goodAudit = path.join(root, ".good.json"); write(goodAudit, JSON.stringify({ entries: [
    { id: hash(bodyA), status: "implemented", evidence: ["test:fixture | passed"], topics: [] },
    { id: "b", status: "implemented", evidence: ["test:fixture-2"], topics: [] },
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
  const hash = (body) => require("node:crypto").createHash("sha256").update(body).digest("hex");
  const first = "# First\n\nBody.\n"; const second = "# Second\n\nBody.\n";
  const manifest = { candidates: [
    { id: "first", digest: hash(first), title: "First", body: first, source_tool: "claude", sources: [{ source: "a" }], association: "matched" },
    { id: "second", digest: hash(second), title: "Second", body: second, source_tool: "codex", sources: [{ source: "b" }], association: "matched" },
  ] };
  const manifestFile = path.join(root, "manifest.json"); write(manifestFile, JSON.stringify(manifest));
  const auditFile = path.join(root, "audit.json"); write(auditFile, JSON.stringify({ entries: [
    { id: "first", status: "implemented", evidence: ["ok"], topics: [] },
    { id: "second", status: "implemented", evidence: ["ok"], topics: [], date: "../../escape" },
  ] }));
  const before = fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8");
  const result = node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", auditFile, "--repo", root], { cwd: root });
  assert.equal(result.status, 2); assert.match(result.stderr, /invalid date/);
  assert.equal(fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8"), before);
  assert.deepEqual(fs.readdirSync(path.join(root, "wiki/plans")), ["INDEX.md"]);
  manifest.candidates[0].digest = "0".repeat(64); write(manifestFile, JSON.stringify(manifest));
  write(auditFile, JSON.stringify({ entries: [{ id: "first", status: "implemented", evidence: ["ok"], topics: [] }] }));
  assert.equal(node(path.join(root, "scripts/wiki/apply-plan-audit.cjs"), ["--manifest", manifestFile, "--audit", auditFile, "--repo", root], { cwd: root }).status, 2);
});

test("graph is wiki-only, byte-stable, typed, and rejects dangling relationships", () => {
  const root = temp("graph"); assert.equal(init(root).status, 0);
  write(path.join(root, "code.md"), "# Code must not be a node\n");
  write(path.join(root, "wiki/topics/runtime.md"), "# Runtime\n");
  write(path.join(root, "wiki/journal/2026-01-01-runtime.md"), "---\ntopics: [runtime]\nplans: []\n---\n\n# Runtime journal\n\nSee [mechanics](../MECHANICS.md), the non-node [code](../../code.md), [local URI](file:///etc/passwd), and ![an image](../image.png).\n");
  const build = path.join(root, "scripts/wiki/build-graph.cjs");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  const first = fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  assert.equal(fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8"), first);
  const graph = JSON.parse(first);
  assert.ok(graph.nodes.every((item) => item.id.startsWith("wiki/")));
  assert.ok(!graph.nodes.some((item) => item.id === "code.md"));
  assert.ok(new Set(graph.nodes.map((item) => item.type)).has("topic"));
  assert.ok(new Set(graph.nodes.map((item) => item.type)).has("journal"));
  write(path.join(root, "wiki/journal/broken.md"), "---\ntopics: [missing]\n---\n\n# Broken\n");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 2);
  fs.unlinkSync(path.join(root, "wiki/journal/broken.md"));
  fs.symlinkSync(path.join(root, "code.md"), path.join(root, "wiki/topics/linked.md"));
  const linked = node(build, ["--repo", root], { cwd: root });
  assert.equal(linked.status, 2); assert.match(linked.stderr, /symbolic links are not allowed/);
  const viewer = fs.readFileSync(path.join(root, "scripts/wiki/graph/viewer/index.html"), "utf8");
  for (const type of ["index", "topic", "journal", "plan"]) assert.match(viewer, new RegExp(`value="${type}"`));
});

test("archived plan repo-file links do not break graph build", () => {
  const root = temp("plan-repo-links");
  assert.equal(init(root).status, 0);
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
    "topics: []",
    `digest: "${planDigest}"`,
    "---",
    "",
    body.trim(),
    "",
  ].join("\n"));
  const marker = "<!-- wiki-plan-rows -->";
  const index = fs.readFileSync(path.join(root, "wiki/plans/INDEX.md"), "utf8");
  const row = `| 2026-01-01 | [Add CONTRIBUTING](./2026-01-01-contributing.md) | implemented | CONTRIBUTING.md shipped | — <!-- plan:${planDigest} --> |`;
  fs.writeFileSync(path.join(root, "wiki/plans/INDEX.md"), index.replace(marker, `${row}\n${marker}`));
  const build = path.join(root, "scripts/wiki/build-graph.cjs");
  assert.equal(node(build, ["--repo", root], { cwd: root }).status, 0);
  const graph = JSON.parse(fs.readFileSync(path.join(root, "scripts/wiki/graph/data/graph.json"), "utf8"));
  assert.ok(graph.edges.some((edge) => edge.source.startsWith("wiki/plans/") && edge.target === "wiki/MECHANICS.md"));
  assert.ok(!graph.nodes.some((node) => node.id === "wiki/plans/CONTRIBUTING.md"));
  assert.equal(node(path.join(root, "scripts/wiki/check.cjs"), ["--repo", root], { cwd: root }).status, 0);
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
  const root = temp("helpers"); assert.equal(init(root).status, 0);
  const { reconcile } = require(path.join(root, "scripts/wiki/on-merge-sync.cjs"));
  const context = { number: 42, title: "Add runtime", url: "https://github.com/example/repo/pull/42", merged_at: "2026-01-02T00:00:00Z", files: ["src/runtime.js"] };
  assert.equal(reconcile(context, root).length, 1); assert.equal(reconcile(context, root).length, 0);
  const { issueRefs, markClosed, setIssueState } = require(path.join(root, "scripts/wiki/refresh-issue-state.cjs"));
  const issue = "https://github.com/example/repo/issues/7";
  assert.equal(issueRefs(issue).length, 1);
  assert.equal(markClosed(markClosed(issue, issue), issue), `${issue} — closed`);
  assert.equal(setIssueState(`${issue} — closed`, issue, "open"), issue);
  assert.throws(() => reconcile({ ...context, number: "../../escape" }, root), /positive number/);
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
});

test("Sigma viewer loads all four wiki node types and applies search/type filters", async () => {
  const source = fs.readFileSync(path.join(SKILL, "assets/repository/scripts/wiki/graph/viewer/viewer.js"), "utf8");
  const listeners = {};
  const elements = {
    graph: {}, search: { value: "", addEventListener(name, fn) { listeners[`search:${name}`] = fn; } },
    details: { textContent: "" },
  };
  const checks = ["index", "topic", "journal", "plan"].map((value) => ({ value, checked: true, addEventListener(name, fn) { listeners[`${value}:${name}`] = fn; } }));
  class Graph {
    constructor() { this.nodes = new Map(); }
    addNode(id, attrs) { this.nodes.set(id, attrs); }
    addEdgeWithKey() {}
    getNodeAttributes(id) { return this.nodes.get(id); }
  }
  let renderer;
  class Sigma {
    constructor(graph) { this.graph = graph; this.settings = {}; this.handlers = {}; renderer = this; }
    setSetting(name, value) { this.settings[name] = value; }
    refresh() {}
    on(name, fn) { this.handlers[name] = fn; }
  }
  const nodes = ["index", "topic", "journal", "plan"].map((type, i) => ({ id: `wiki/${type}-${i}.md`, label: type, type, x: i, y: i, size: 8 }));
  vm.runInNewContext(source, {
    fetch: async () => ({ ok: true, json: async () => ({ nodes, edges: [] }) }), graphology: { Graph }, Sigma,
    document: { getElementById: (id) => elements[id], querySelectorAll: () => checks }, console,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(renderer.graph.nodes.size, 4);
  elements.search.value = "topic"; listeners["search:input"]();
  assert.equal(renderer.settings.nodeReducer("wiki/plan-3.md", renderer.graph.nodes.get("wiki/plan-3.md")).hidden, true);
  checks.find((item) => item.value === "topic").checked = false; listeners["topic:change"]();
  assert.equal(renderer.settings.nodeReducer("wiki/topic-1.md", renderer.graph.nodes.get("wiki/topic-1.md")).hidden, true);
  renderer.handlers.clickNode({ node: "wiki/topic-1.md" });
  assert.equal(elements.details.textContent, "topic\nwiki/topic-1.md\nType: topic");
  assert.doesNotMatch(source, /innerHTML/);
});
