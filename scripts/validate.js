#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateWorkspace } from "./lib/validation.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const { issues } = validateWorkspace(workspaceRoot);

if (issues.length > 0) {
  console.error("Validation failed.\n");
  for (const issue of issues) {
    console.error(`- ${issue.file}: ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  console.log("Validation passed.");
}
