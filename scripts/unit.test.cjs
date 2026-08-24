#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const SKILL = path.resolve(__dirname, "..");
const WIKI_SCRIPTS = path.join(SKILL, "assets", "repository", "scripts", "wiki");
const common = require(path.join(WIKI_SCRIPTS, "lib", "common.cjs"));
const dates = require(path.join(WIKI_SCRIPTS, "lib", "dates.cjs"));
const frontmatter = require(path.join(WIKI_SCRIPTS, "lib", "frontmatter.cjs"));
const plans = require(path.join(WIKI_SCRIPTS, "lib", "plans.cjs"));
const github = require(path.join(WIKI_SCRIPTS, "lib", "github-refs.cjs"));
const routing = require(path.join(WIKI_SCRIPTS, "routing.cjs"));
const installer = require(path.join(SKILL, "scripts", "init-repository.cjs"));

function temp(t, name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `wiki-unit-${name}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function git(root, args, env = {}) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makeGit(t, name) {
  const root = temp(t, name);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Wiki Unit Test"]);
  git(root, ["config", "user.email", "wiki-unit@example.test"]);
  return root;
}

test("common normalizes hashes, slugs, and wiki paths", () => {
  assert.equal(common.digest("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(common.slugify("  Add CJS: Unit Tests!  "), "add-cjs-unit-tests");
  assert.equal(common.slugify("---"), "plan");
  assert.equal(common.slugify("a".repeat(100)), "a".repeat(72));
  assert.equal(common.slash(path.join("wiki", "topics", "runtime.md")), "wiki/topics/runtime.md");
  assert.equal(common.wikiPath("/repo", path.join("/repo", "wiki", "INDEX.md")), "wiki/INDEX.md");
});

test("common contains paths and detects symbolic-link components", (t) => {
  const root = temp(t, "common-paths");
  const outside = temp(t, "common-outside");
  write(path.join(root, "safe", "file.txt"), "safe\n");
  fs.symlinkSync(outside, path.join(root, "linked"), "dir");

  assert.equal(common.ensureInside(root, root), true);
  assert.equal(common.ensureInside(root, path.join(root, "safe", "file.txt")), true);
  assert.equal(common.ensureInside(root, path.join(root, "..", "escape.txt")), false);
  assert.equal(common.hasSymlinkComponent(root, path.join(root, "safe", "future.txt")), false);
  assert.equal(common.hasSymlinkComponent(root, path.join(root, "linked", "secret.txt")), true);
  assert.equal(common.hasSymlinkComponent(root, path.join(outside, "secret.txt")), true);
});

test("common walks deterministically and identifies substantive changes", (t) => {
  const root = temp(t, "common-walk");
  write(path.join(root, "z.txt"), "z\n");
  write(path.join(root, "nested", "a.txt"), "a\n");

  assert.deepEqual(common.walk(root), [path.join(root, "nested", "a.txt"), path.join(root, "z.txt")]);
  assert.equal(common.substantive(["wiki/INDEX.md", "scripts/wiki/check.cjs", ".github/workflows/wiki-sync.yml", "pnpm-lock.yaml", "README.md"]), false);
  assert.equal(common.substantive(["src/runtime.js"]), true);
  assert.equal(common.substantive(["AGENTS.md"]), true);
  assert.equal(common.substantive(["CLAUDE.md"]), true);
});

test("common atomicWrite sets requested bytes and mode without temporary residue", (t) => {
  const root = temp(t, "common-atomic");
  const file = path.join(root, "nested", "result.txt");
  common.atomicWrite(file, "first\n", { mode: 0o600 });

  assert.equal(fs.readFileSync(file, "utf8"), "first\n");
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ["result.txt"]);
});

test("common resolves Git roots and GitHub remote slugs", (t) => {
  const root = makeGit(t, "common-git");
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  git(root, ["remote", "add", "origin", "git@github.com:Example/Context-Wiki.git"]);

  assert.equal(common.repoRoot(nested), fs.realpathSync(root));
  assert.equal(common.remoteSlug(root), "example/context-wiki");
  git(root, ["remote", "set-url", "origin", "https://gitlab.com/example/context-wiki.git"]);
  assert.equal(common.remoteSlug(root), "");
});

test("frontmatter splits BOM-prefixed CRLF documents", () => {
  const parsed = frontmatter.splitFrontmatter("\uFEFF---\r\ntitle: \"Demo\"\r\ntopics: [\"one\", \"two\"]\r\n---\r\n# Body\r\n");
  assert.equal(frontmatter.scalar(parsed.raw, "title"), "Demo");
  assert.deepEqual(frontmatter.list(parsed.raw, "topics"), ["one", "two"]);
  assert.equal(parsed.body, "# Body\r\n");
  assert.equal(frontmatter.splitFrontmatter("\uFEFF# Plain\n").body, "# Plain\n");
});

test("frontmatter reads scalar, inline, fallback, and block lists", () => {
  const raw = [
    'a.b: "literal"',
    'topics: ["one", " two ", 3]',
    "owners:",
    '  - "alice"',
    "  - 'bob'",
    "fallback: [one, 'two']",
    "single: team",
  ].join("\n");

  assert.equal(frontmatter.scalar(raw, "a.b"), "literal");
  assert.deepEqual(frontmatter.list(raw, "topics"), ["one", "two", "3"]);
  assert.deepEqual(frontmatter.list(raw, "owners"), ["alice", "bob"]);
  assert.deepEqual(frontmatter.list(raw, "fallback"), ["one", "two"]);
  assert.deepEqual(frontmatter.list(raw, "single"), ["team"]);
  assert.deepEqual(frontmatter.list(raw, "missing"), []);
});

test("frontmatter renders deterministic metadata and titles", () => {
  const rendered = frontmatter.render(
    { status: "implemented", executed: true, topics: ["runtime", "tests"] },
    " \n# Demo\n\nBody \n",
  );
  assert.equal(rendered, [
    "---",
    'status: "implemented"',
    "executed: true",
    'topics: ["runtime", "tests"]',
    "---",
    "",
    "# Demo",
    "",
    "Body",
    "",
  ].join("\n"));
  const parsed = frontmatter.splitFrontmatter(rendered);
  assert.equal(frontmatter.scalar(parsed.raw, "status"), "implemented");
  assert.deepEqual(frontmatter.list(parsed.raw, "topics"), ["runtime", "tests"]);
  assert.equal(frontmatter.titleFromBody(parsed.body), "Demo");
  assert.equal(frontmatter.titleFromBody("No heading\n", "Fallback"), "Fallback");
});

test("dates derives plan, session, and file modification dates", (t) => {
  const root = temp(t, "dates-files");
  const file = path.join(root, "draft.md");
  write(file, "# Draft\n");
  fs.utimesSync(file, new Date("2026-02-03T12:00:00Z"), new Date("2026-02-03T12:00:00Z"));

  assert.equal(dates.dateFromPlanBasename("/plans/2026-04-02-demo.plan.md"), "2026-04-02");
  assert.equal(dates.dateFromPlanBasename("/plans/demo.plan.md"), "");
  assert.equal(dates.dateFromSessionPath("/sessions/2026/03/09/rollout.jsonl"), "2026-03-09");
  assert.equal(dates.dateFromSessionPath("/sessions/rollout.jsonl"), "");
  assert.equal(dates.fileMtimeDate(file), "2026-02-03");
  assert.equal(dates.fileMtimeDate(path.join(root, "missing.md")), "");
  assert.deepEqual(dates.sourcePathDates(root, { sources: [{ source: file }] }), ["2026-02-03"]);
});

test("dates prefers explicit source dates and status-appropriate Git evidence", (t) => {
  const root = makeGit(t, "dates-git");
  write(path.join(root, "README.md"), "first\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-qm", "first"], { GIT_AUTHOR_DATE: "2026-01-02T12:00:00Z", GIT_COMMITTER_DATE: "2026-01-02T12:00:00Z" });
  const first = git(root, ["rev-parse", "HEAD"]);
  write(path.join(root, "README.md"), "second\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-qm", "second"], { GIT_AUTHOR_DATE: "2026-03-04T12:00:00Z", GIT_COMMITTER_DATE: "2026-03-04T12:00:00Z" });
  const second = git(root, ["rev-parse", "HEAD"]);
  const evidence = [`commit ${first}`, `PR #2 branch feat/tests merge ${second}`];
  const draft = path.join(root, "draft.md");
  write(draft, "# Draft\n");
  fs.utimesSync(draft, new Date("2026-02-03T12:00:00Z"), new Date("2026-02-03T12:00:00Z"));

  assert.deepEqual(dates.evidenceDates(root, evidence), ["2026-01-02", "2026-03-04"]);
  assert.equal(dates.inferPlanDate(root, { sources: [{ source: "/plans/2025-12-01-demo.plan.md" }] }, evidence, "implemented"), "2025-12-01");
  assert.equal(dates.inferPlanDate(root, { sources: [] }, evidence, "implemented"), "2026-03-04");
  assert.equal(dates.inferPlanDate(root, { sources: [{ source: draft }] }, evidence, "not-implemented"), "2026-02-03");
});

test("plans removes Cursor-private frontmatter without losing a useful title", () => {
  const privatePlan = "---\nname: Demo plan\noverview: private\ntodos: []\nisProject: true\n---\n\nChange things.\n";
  const headedPlan = privatePlan.replace("Change things.", "# Existing title\n\nChange things.");
  const publicPlan = "---\nowner: team\n---\n\n# Keep metadata\n";

  assert.equal(plans.cleanCursor(privatePlan), "# Demo plan\n\nChange things.\n");
  assert.equal(plans.cleanCursor(headedPlan), "# Existing title\n\nChange things.\n");
  assert.equal(plans.cleanCursor(publicPlan), publicPlan.trim() + "\n");
});

test("plans extracts only assistant plans and keeps the last titled revision", (t) => {
  const root = temp(t, "plans-jsonl");
  const file = path.join(root, "session.jsonl");
  write(file, [
    JSON.stringify({ type: "session_meta", payload: { cwd: "/repo/demo" } }),
    "malformed{json",
    JSON.stringify({ type: "response_item", payload: { role: "user", content: [{ text: "<proposed_plan># User plan\n\nIgnore.</proposed_plan>" }] } }),
    JSON.stringify({ type: "response_item", payload: { role: "assistant", content: [{ text: "<proposed_plan># Demo plan\n\nFirst.</proposed_plan>" }] } }),
    JSON.stringify({ type: "event_msg", payload: { item: { type: "Plan", text: "# Other plan\n\nOther." } } }),
    JSON.stringify({ type: "event_msg", payload: { item: { type: "Plan", text: "# Demo plan\n\nFinal." } } }),
    JSON.stringify({ type: "event_msg", payload: { message: { role: "assistant", content: [{ text: "<proposed_plan># Nested plan\n\nNested.</proposed_plan>" }] } } }),
  ].join("\n") + "\n");

  const found = plans.proposedPlans(file);
  assert.equal(found.length, 3);
  assert.equal(found.find((item) => item.body.startsWith("# Demo plan")).body, "# Demo plan\n\nFinal.\n");
  assert.ok(found.every((item) => item.cwd === "/repo/demo"));
  assert.ok(!found.some((item) => item.body.includes("User plan")));
});

test("plans classifies repository associations by strongest available evidence", () => {
  const repo = { root: "/work/context-wiki", slug: "example/context-wiki", tracked: ["src/runtime.js", "README.md"] };

  assert.deepEqual(plans.association("No repository text.", repo.root, repo), { state: "matched", reasons: ["session cwd"] });
  assert.deepEqual(plans.association(`Change ${repo.root}/scripts.`, "", repo), { state: "matched", reasons: ["repository path"] });
  assert.deepEqual(plans.association("Update example/context-wiki.", "", repo), { state: "matched", reasons: ["GitHub repository"] });
  assert.deepEqual(plans.association("Modify src/runtime.js.", "", repo), { state: "matched", reasons: ["tracked paths: src/runtime.js"] });
  assert.deepEqual(plans.association("Work in context-wiki.", "", repo), { state: "ambiguous", reasons: ["repository basename only"] });
  assert.deepEqual(plans.association("Unrelated repository.", "", repo), { state: "unmatched", reasons: [] });
});

test("plans collapses normalized titles to the latest and then longest revision", () => {
  const timestamp = "rollout-2026-02-02T10-00-00-session.jsonl";
  const selected = { title: "demo plan", digest: "selected", body: "the longest final body\n", sources: [{ source: timestamp }] };
  const collapsed = plans.collapseByTitle([
    { title: " Demo   Plan ", digest: "old", body: "old\n", sources: [{ source: "rollout-2026-01-01T10-00-00-session.jsonl" }] },
    { title: "DEMO PLAN", digest: "new", body: "new\n", sources: [{ source: timestamp }] },
    selected,
    { title: "", digest: "untitled-a", body: "a\n", sources: [] },
    { title: "", digest: "untitled-b", body: "b\n", sources: [] },
  ]);

  assert.equal(plans.normalizeTitle(" Demo   Plan "), "demo plan");
  assert.equal(collapsed.length, 3);
  assert.ok(collapsed.includes(selected));
});

test("GitHub evidence is full-URL-only, repo-qualified, and deterministic", () => {
  const text = [
    "PR #7",
    "https://github.com/Example/Alpha/issues/7",
    "https://github.com/example/alpha/issues/7",
    "https://github.com/Example/Beta/pull/7",
    "https://evil.example/github.com/example/alpha/issues/99",
    "https://evil.example/?next=https://github.com/example/alpha/issues/100",
    "```md",
    "https://github.com/example/fenced/issues/101",
    "```",
  ].join("\n");
  assert.deepEqual(github.githubRefs(text, { repository: "Owner/Current" }), [
    { repository: "example/alpha", kind: "issue", number: 7, url: "https://github.com/example/alpha/issues/7" },
    { repository: "example/beta", kind: "pull-request", number: 7, url: "https://github.com/example/beta/pull/7" },
    { repository: "owner/current", kind: "pull-request", number: 7, url: "https://github.com/owner/current/pull/7" },
  ]);
  assert.deepEqual(github.githubRefs("issue #9"), []);
  assert.deepEqual(github.closingIssues([
    "Fixes #2, Other/Repo#2, and https://github.com/Third/Repo/issues/3.",
    "Resolves #8 & Other/Repo#9.",
    "Mentions https://github.com/ignored/repo/issues/4.",
    "```",
    "Fixes https://github.com/fenced/repo/issues/5.",
    "```",
    "~~~md",
    "Fixes https://github.com/fenced/repo/issues/6.",
    "~~~",
    "````md",
    "```",
    "Fixes https://github.com/fenced/repo/issues/7.",
    "```js",
    "````",
  ].join("\n"), "Owner/Current").map((item) => item.url), [
    "https://github.com/owner/current/issues/2",
    "https://github.com/other/repo/issues/2",
    "https://github.com/third/repo/issues/3",
    "https://github.com/owner/current/issues/8",
    "https://github.com/other/repo/issues/9",
  ]);
  assert.equal(github.normalizeRepository("https://github.com/Owner/Repo.git"), "owner/repo");
  assert.equal(github.ref("owner/repo", "issue", "9007199254740993"), null);
  assert.equal(github.normalizeGithubQuery("https://github.com/owner/repo/issues/9007199254740993?x=1"), "https://github.com/owner/repo/issues/9007199254740993?x=1");
  assert.equal(github.withoutFencedCode("````md\n```\ninside\n```js\n````\noutside"), "outside");
});

test("weighted routing is deterministic, byte-aware, and returns compact candidates", () => {
  const graph = {
    nodes: [
      { id: "wiki/a.md", label: "Start", type: "journal", aliases: [], bytes: 100, degree: 2 },
      { id: "wiki/b.md", label: "Small route", type: "topic", aliases: ["middle"], githubRefs: [{ repository: "example/repo", kind: "issue", number: 7, url: "https://github.com/example/repo/issues/7" }], bytes: 100, degree: 2 },
      { id: "wiki/e.md", label: "Evidence journal", type: "journal", aliases: [], githubRefs: [{ repository: "example/repo", kind: "issue", number: 7, url: "https://github.com/example/repo/issues/7" }], bytes: 80, degree: 0 },
      { id: "wiki/c.md", label: "Target", type: "plan", aliases: [], bytes: 200, degree: 2 },
      { id: "wiki/d.md", label: "Target", type: "plan", aliases: [], bytes: 20000, degree: 2 },
    ],
    edges: [
      { source: "wiki/a.md", target: "wiki/b.md", type: "topic" },
      { source: "wiki/b.md", target: "wiki/c.md", type: "plan" },
      { source: "wiki/a.md", target: "wiki/d.md", type: "link" },
      { source: "wiki/d.md", target: "wiki/c.md", type: "link" },
    ],
  };
  const result = routing.route(graph, { intent: "wiring", from: "wiki/a.md", to: "wiki/c.md", maxBytes: 250 });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.itinerary.map((item) => item.id), ["wiki/a.md", "wiki/b.md", "wiki/c.md"]);
  assert.equal(result.totalBytes, 400);
  assert.equal(result.overBudget, true);
  assert.equal(result.routeAuthority, "wiki/a.md → wiki/c.md");
  assert.ok(result.itinerary.every((item) => item.authority && item.authority !== item.type));
  assert.match(routing.formatRoute(result), /3 file\(s\).*400 B.*exceeds 250 B[\s\S]*Authority: wiki\/a\.md → wiki\/c\.md[\s\S]*query match[\s\S]*source: wiki\/a\.md[\s\S]*Total bytes: 400 B/);
  assert.equal(routing.resolveNode(graph, "middle").node.id, "wiki/b.md");
  assert.equal(routing.resolveNode(graph, "example/repo issue #7").node.id, "wiki/e.md");
  assert.equal(routing.resolveNode(graph, "https://github.com/example/repo/issues/7?x=1#note").node.id, "wiki/e.md");
  const ambiguous = routing.resolveNode(graph, "Target");
  assert.equal(ambiguous.node, null);
  assert.deepEqual(ambiguous.candidates.map((item) => item.id), ["wiki/c.md", "wiki/d.md"]);
  const loadedPolicy = routing.loadPolicy();
  assert.deepEqual(routing.policyProblems({ ...loadedPolicy, excludedIntermediateTypes: "index" }, graph), ["excludedIntermediateTypes must be an array"]);
  assert.deepEqual(routing.policyProblems({ ...loadedPolicy, excludedIntermediateTypes: [null] }, graph), ["excludedIntermediateTypes must contain non-empty strings"]);
  assert.ok(routing.policyProblems({ ...loadedPolicy, intents: { ...loadedPolicy.intents, why: { ...loadedPolicy.intents.why, preferredSourceTypes: [null] } } }, graph).some((problem) => /non-empty string array/.test(problem)));
  assert.ok(routing.policyProblems({ ...loadedPolicy, edgeCosts: { plan: 1 } }, graph).some((problem) => /missing edge cost/.test(problem)));
});

test("installer parses supported arguments and rejects unknown flags", () => {
  assert.deepEqual(installer.parseArgs([]), { repo: process.cwd(), dryRun: false, github: "auto", wikiRoot: "wiki", headlessNavigation: false, agentsOnly: false });
  assert.deepEqual(installer.parseArgs(["--repo", "/tmp/demo", "--dry-run", "--github"]), { repo: "/tmp/demo", dryRun: true, github: "on", wikiRoot: "wiki", headlessNavigation: false, agentsOnly: false });
  assert.equal(installer.parseArgs(["--no-github"]).github, "off");
  assert.deepEqual(installer.parseArgs(["--headless-navigation", "--wiki-root", "docs/context"]), { repo: process.cwd(), dryRun: false, github: "auto", wikiRoot: "docs/context", headlessNavigation: true, agentsOnly: false });
  assert.equal(installer.parseArgs(["--agents-only"]).agentsOnly, true);
  assert.equal(installer.normalizeWikiRoot("./docs/context/"), "docs/context");
  assert.throws(() => installer.normalizeWikiRoot("../outside"), /safe repository-relative/);
  assert.equal(installer.parseArgs(["--help"]).help, true);
  assert.throws(() => installer.parseArgs(["--unknown"]), /unknown argument/);
});

test("generated agent guidance shares one deterministic route-first contract", (t) => {
  const full = installer.managedAgentsText();
  const headless = installer.managedAgentsText({ wikiRoot: "wiki", headlessNavigation: true });
  const custom = installer.managedAgentsText({ wikiRoot: "wiki/site", headlessNavigation: true });
  const required = [
    /exact current-code, file, symbol, or command question/,
    /deterministic weighted shortest route/,
    /sequentially, never speculatively in parallel/,
    /rerun with one returned exact ID/,
    /rg -n --fixed-strings/,
    /Never read generated graph JSON directly/,
  ];

  for (const pattern of required) {
    assert.match(full, pattern);
    assert.match(headless, pattern);
    assert.match(custom, pattern);
  }
  assert.match(headless, /--wiki-root "wiki" --intent why/);
  assert.match(custom, /--wiki-root "wiki\/site" --intent why/);
  assert.match(custom, /rg -n --fixed-strings "<exact term>" wiki\/site\//);
  assert.equal(full.includes("navigation only"), false);
  assert.match(headless, /navigation only/);

  const root = temp(t, "installer-marker-validation");
  const file = path.join(root, "AGENTS.md");
  write(file, "<!-- wiki-skill:start -->\nmissing end\n");
  assert.match(installer.managedBlockProblem(file, "<!-- wiki-skill:start -->", "<!-- wiki-skill:end -->"), /malformed/);
  write(file, "<!-- wiki-skill:start -->\na\n<!-- wiki-skill:end -->\n<!-- wiki-skill:start -->\nb\n<!-- wiki-skill:end -->\n");
  assert.match(installer.managedBlockProblem(file, "<!-- wiki-skill:start -->", "<!-- wiki-skill:end -->"), /duplicate/);
});

test("installer resolves projects and protects path and atomic-write boundaries", (t) => {
  const root = makeGit(t, "installer-project");
  const nested = path.join(root, "nested");
  const outside = temp(t, "installer-outside");
  fs.mkdirSync(nested);
  fs.symlinkSync(outside, path.join(root, "linked"), "dir");
  const resolved = installer.resolveProject(nested);
  const executable = path.join(root, "bin", "wiki.cjs");
  installer.atomicWrite(executable, "#!/usr/bin/env node\n", 0o700);

  assert.deepEqual(resolved, { root: fs.realpathSync(root), isGit: true });
  assert.equal(installer.resolveProject(outside).isGit, false);
  assert.equal(installer.sha("abc"), common.digest("abc"));
  assert.equal(installer.isInside(root, path.join(root, "nested")), true);
  assert.equal(installer.isInside(root, path.join(root, "..", "escape")), false);
  assert.equal(installer.hasSymlinkComponent(root, path.join(root, "linked", "secret")), true);
  assert.equal(fs.statSync(executable).mode & 0o777, 0o700);
  assert.deepEqual(fs.readdirSync(path.dirname(executable)), ["wiki.cjs"]);
});

test("installer upserts managed blocks idempotently and honors dry-run", (t) => {
  const root = temp(t, "installer-upsert");
  const file = path.join(root, "AGENTS.md");
  const dryFile = path.join(root, "CLAUDE.md");
  const start = "<!-- managed:start -->";
  const end = "<!-- managed:end -->";
  const first = `${start}\nfirst\n${end}`;
  const second = `${start}\nsecond\n${end}`;
  write(file, "# Authored\n");
  fs.chmodSync(file, 0o600);

  const created = [];
  installer.upsertBlock(file, first, start, end, false, created);
  assert.equal(fs.readFileSync(file, "utf8"), `# Authored\n\n${first}\n`);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(created.length, 1);

  const updated = [];
  installer.upsertBlock(file, second, start, end, false, updated);
  assert.equal(fs.readFileSync(file, "utf8"), `# Authored\n\n${second}\n`);
  assert.equal(updated.length, 1);

  const unchanged = [];
  installer.upsertBlock(file, second, start, end, false, unchanged);
  assert.deepEqual(unchanged, []);

  const dryRun = [];
  installer.upsertBlock(dryFile, first, start, end, true, dryRun);
  assert.equal(fs.existsSync(dryFile), false);
  assert.equal(dryRun.length, 1);
});

test("installer preserves a standalone CLAUDE import and manages other content", (t) => {
  const root = temp(t, "installer-claude-import");
  const standalone = path.join(root, "CLAUDE.md");
  const authored = path.join(root, "AUTHORED-CLAUDE.md");
  write(standalone, "@AGENTS.md\n");
  write(authored, "# Claude-only guidance\n");

  const standaloneChanges = [];
  installer.upsertClaudeImport(standalone, false, standaloneChanges);
  assert.equal(fs.readFileSync(standalone, "utf8"), "@AGENTS.md\n");
  assert.deepEqual(standaloneChanges, []);

  const authoredChanges = [];
  installer.upsertClaudeImport(authored, false, authoredChanges);
  assert.match(fs.readFileSync(authored, "utf8"), /# Claude-only guidance\n\n<!-- wiki-skill:start -->\n@AGENTS\.md\n<!-- wiki-skill:end -->/);
  assert.equal(authoredChanges.length, 1);
});
