import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkspace } from "../scripts/lib/validation.js";

function writeJson(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, value);
}

function createFixtureWorkspace() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-plugin-codex-"));

  writeFile(path.join(workspaceRoot, "README.md"), "# Fixture\n");
  writeFile(path.join(workspaceRoot, "CONTRIBUTING.md"), "# Contributing\n");
  writeFile(path.join(workspaceRoot, "SECURITY.md"), "# Security\n");
  writeFile(path.join(workspaceRoot, "LICENSE"), "MIT\n");

  writeJson(path.join(workspaceRoot, ".agents/plugins/marketplace.json"), {
    name: "local-plugins",
    interface: {
      displayName: "Local Plugins"
    },
    plugins: [
      {
        name: "gitlab",
        source: {
          source: "local",
          path: "./plugins/gitlab"
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_USE"
        },
        category: "Coding"
      }
    ]
  });

  writeJson(path.join(workspaceRoot, "plugins/gitlab/.codex-plugin/plugin.json"), {
    name: "gitlab",
    version: "0.1.0",
    description: "Fixture plugin",
    homepage: "https://github.com/example/gitlab-plugin-codex",
    repository: "https://github.com/example/gitlab-plugin-codex",
    license: "MIT",
    keywords: ["gitlab"],
    skills: "./skills/",
    mcpServers: "./.mcp.json",
    interface: {
      displayName: "GitLab",
      shortDescription: "Fixture",
      longDescription: "Fixture plugin",
      developerName: "Example",
      category: "Coding",
      capabilities: ["Interactive", "Write"],
      websiteURL: "https://github.com/example/gitlab-plugin-codex",
      privacyPolicyURL: "https://example.com/privacy",
      termsOfServiceURL: "https://example.com/terms",
      defaultPrompt: ["Clone a GitLab repo with glab"],
      composerIcon: "./assets/gitlab-small.svg",
      logo: "./assets/gitlab-small.svg",
      screenshots: [],
      brandColor: "#FC6D26"
    }
  });

  writeFile(path.join(workspaceRoot, "plugins/gitlab/README.md"), "# GitLab\n");
  writeJson(path.join(workspaceRoot, "plugins/gitlab/.mcp.json"), {
    mcpServers: {
      gitlab: {
        command: "node",
        args: ["./server/index.js"],
        cwd: "."
      }
    }
  });
  writeFile(
    path.join(workspaceRoot, "plugins/gitlab/assets/gitlab-small.svg"),
    "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n"
  );
  writeFile(
    path.join(workspaceRoot, "plugins/gitlab/server/index.js"),
    "console.error('fixture mcp server');\n"
  );
  writeFile(
    path.join(workspaceRoot, "plugins/gitlab/skills/gitlab/SKILL.md"),
    [
      "---",
      "name: gitlab",
      "description: Fixture skill",
      "---",
      "",
      "# GitLab",
      ""
    ].join("\n")
  );
  writeFile(
    path.join(workspaceRoot, "plugins/gitlab/commands/_conventions.md"),
    "# Conventions\n"
  );
  writeFile(
    path.join(workspaceRoot, "plugins/gitlab/commands/gitlab-clone.md"),
    [
      "---",
      "description: Fixture command",
      "---",
      "",
      "# GitLab Clone",
      "",
      "## Preflight",
      "",
      "## Plan",
      "",
      "## Commands",
      "",
      "## Verification",
      "",
      "## Summary",
      "",
      "## Next Steps",
      ""
    ].join("\n")
  );

  return workspaceRoot;
}

test("current workspace passes validation", () => {
  const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const { issues } = validateWorkspace(workspaceRoot);
  assert.deepEqual(issues, []);
});

test("validator flags missing command sections", () => {
  const fixtureRoot = createFixtureWorkspace();
  writeFile(
    path.join(fixtureRoot, "plugins/gitlab/commands/gitlab-clone.md"),
    [
      "---",
      "description: Broken command",
      "---",
      "",
      "# GitLab Clone",
      "",
      "## Preflight",
      ""
    ].join("\n")
  );

  const { issues } = validateWorkspace(fixtureRoot);
  assert.ok(
    issues.some(
      (issue) =>
        issue.file === "plugins/gitlab/commands/gitlab-clone.md" &&
        issue.message === "missing required section: Plan"
    )
  );
});
