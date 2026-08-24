"use strict";

// GitHub evidence is keyed by repository as well as number. Issue #7 in one
// repository must never collide with issue #7 in another repository.

const URL_RE = /(?<![A-Za-z0-9_./:=?&%+-])https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(pull|issues)\/(\d+)\b[^\s<>"'`)\]]*/gi;
const LABELED_RE = /\b(PR|pull request|issue)\s+#(\d+)\b/gi;

function normalizeRepository(value) {
  const parts = String(value || "").trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "").split("/");
  return parts.length === 2 && parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
    ? parts.join("/").toLowerCase()
    : "";
}

function ref(repository, kind, number) {
  const normalized = normalizeRepository(repository);
  const numeric = Number(number);
  if (!normalized || !Number.isInteger(numeric) || numeric < 1) return null;
  const normalizedKind = ["pull", "pr", "pull-request"].includes(kind) ? "pull-request" : ["issue", "issues"].includes(kind) ? "issue" : "";
  if (!normalizedKind) return null;
  const segment = normalizedKind === "pull-request" ? "pull" : "issues";
  return {
    repository: normalized,
    kind: normalizedKind,
    number: numeric,
    url: `https://github.com/${normalized}/${segment}/${numeric}`,
  };
}

function withoutFencedCode(text) {
  const kept = [];
  let fence = "";
  for (const line of String(text || "").split(/\r?\n/)) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1]?.[0] || "";
    if (marker) {
      if (!fence) fence = marker;
      else if (fence === marker) fence = "";
      continue;
    }
    if (!fence) kept.push(line);
  }
  return kept.join("\n");
}

function key(item) {
  return `${item.repository}\u0000${item.kind}\u0000${item.number}`;
}

function githubRefs(text, { repository = "", includeLabeled = true, includeFencedCode = false } = {}) {
  const source = includeFencedCode ? String(text || "") : withoutFencedCode(text);
  const found = [];
  for (const match of source.matchAll(URL_RE)) {
    const item = ref(`${match[1]}/${match[2]}`, match[3].toLowerCase(), match[4]);
    if (item) found.push(item);
  }
  const fallback = normalizeRepository(repository);
  if (includeLabeled && fallback) {
    for (const match of source.matchAll(LABELED_RE)) {
      const item = ref(fallback, /^issue$/i.test(match[1]) ? "issue" : "pull-request", match[2]);
      if (item) found.push(item);
    }
  }
  return [...new Map(found.map((item) => [key(item), item])).values()]
    .sort((a, b) => a.repository.localeCompare(b.repository) || a.kind.localeCompare(b.kind) || a.number - b.number);
}

function closingIssues(text, repository = "") {
  const fallback = normalizeRepository(repository);
  const source = withoutFencedCode(text);
  const found = [];
  const seen = new Set();
  const keyword = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\s*:?\s+/gi;
  const token = /^(?:https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/(\d+)\b|([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)\b|#(\d+)\b)/i;
  while (keyword.exec(source) !== null) {
    let cursor = keyword.lastIndex;
    let first = true;
    while (cursor < source.length) {
      if (!first) {
        const separator = source.slice(cursor).match(/^(?:\s*,\s*(?:and\s+)?|\s+(?:and|&)\s+|\s+)/i);
        if (!separator) break;
        cursor += separator[0].length;
      }
      const match = source.slice(cursor).match(token);
      if (!match) break;
      const item = ref(match[1] || match[3] || fallback, "issue", match[2] || match[4] || match[5]);
      if (item && !seen.has(key(item))) {
        seen.add(key(item));
        found.push(item);
      }
      cursor += match[0].length;
      first = false;
      if (/^[.!?;]/.test(source.slice(cursor))) break;
    }
    keyword.lastIndex = Math.max(keyword.lastIndex, cursor);
  }
  return found;
}

module.exports = { githubRefs, closingIssues, withoutFencedCode, normalizeRepository, ref, key };
