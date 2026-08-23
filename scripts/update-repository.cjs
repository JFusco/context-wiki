#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const installer = path.join(__dirname, "init-repository.cjs");
const result = spawnSync(process.execPath, [installer, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status === null ? 2 : result.status);
