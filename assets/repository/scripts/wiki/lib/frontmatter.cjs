"use strict";

function splitFrontmatter(text) {
  const normalized = String(text).replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match
    ? { raw: match[1], body: normalized.slice(match[0].length), full: match[0] }
    : { raw: "", body: normalized, full: "" };
}

function scalar(raw, key) {
  const match = raw.match(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.*?)\\s*$`, "m"));
  if (!match) return "";
  return match[1].replace(/^['"]|['"]$/g, "");
}

function list(raw, key) {
  const inline = scalar(raw, key);
  if (inline.startsWith("[") && inline.endsWith("]")) {
    try {
      const parsed = JSON.parse(inline);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {}
    return inline.slice(1, -1).split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*$`).test(line));
  if (start < 0) return inline ? [inline] : [];
  const values = [];
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^\s+-\s+(.*)$/);
    if (!match) break;
    values.push(match[1].trim().replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function titleFromBody(body, fallback = "Untitled") {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function quote(value) {
  return JSON.stringify(String(value));
}

function render(fields, body) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) lines.push(`${key}: [${value.map(quote).join(", ")}]`);
    else if (typeof value === "boolean") lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${quote(value)}`);
  }
  return `${lines.join("\n")}\n---\n\n${String(body).replace(/^\s+/, "").replace(/\s+$/, "")}\n`;
}

module.exports = { splitFrontmatter, scalar, list, titleFromBody, render };
