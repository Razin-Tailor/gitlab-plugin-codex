import fs from "node:fs";
import path from "node:path";

const REQUIRED_COMMAND_SECTIONS = [
  "Preflight",
  "Plan",
  "Commands",
  "Verification",
  "Summary",
  "Next Steps"
];

const ALLOWED_INSTALL_POLICIES = new Set([
  "NOT_AVAILABLE",
  "AVAILABLE",
  "INSTALLED_BY_DEFAULT"
]);

const ALLOWED_AUTH_POLICIES = new Set(["ON_INSTALL", "ON_USE"]);

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function readText(targetPath) {
  return fs.readFileSync(targetPath, "utf8");
}

function readJson(targetPath) {
  return JSON.parse(readText(targetPath));
}

function listFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true });
}

function addIssue(issues, file, message) {
  issues.push({ file, message });
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return null;
  }

  const body = match[1];
  const entries = {};

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    entries[key] = value;
  }

  return entries;
}

function validateCommandFile(commandPath, issues, workspaceRoot) {
  const markdown = readText(commandPath);
  const frontmatter = parseFrontmatter(markdown);
  const relativePath = path.relative(workspaceRoot, commandPath);

  if (!frontmatter) {
    addIssue(issues, relativePath, "missing YAML frontmatter");
  } else if (!frontmatter.description) {
    addIssue(issues, relativePath, "frontmatter must include a description");
  }

  for (const section of REQUIRED_COMMAND_SECTIONS) {
    if (!markdown.includes(`## ${section}`)) {
      addIssue(issues, relativePath, `missing required section: ${section}`);
    }
  }
}

function validateSkillDirectory(skillDirPath, issues, workspaceRoot) {
  const relativePath = path.relative(workspaceRoot, skillDirPath);
  const skillPath = path.join(skillDirPath, "SKILL.md");

  if (!exists(skillPath)) {
    addIssue(issues, relativePath, "skill directory is missing SKILL.md");
    return;
  }

  const markdown = readText(skillPath);
  const frontmatter = parseFrontmatter(markdown);

  if (!frontmatter) {
    addIssue(issues, path.relative(workspaceRoot, skillPath), "skill file is missing YAML frontmatter");
    return;
  }

  if (!frontmatter.name) {
    addIssue(issues, path.relative(workspaceRoot, skillPath), "skill frontmatter must include name");
  }

  if (!frontmatter.description) {
    addIssue(issues, path.relative(workspaceRoot, skillPath), "skill frontmatter must include description");
  }
}

function validatePluginManifest(pluginRoot, manifestPath, marketplaceEntry, issues, workspaceRoot) {
  const manifest = readJson(manifestPath);
  const relativeManifestPath = path.relative(workspaceRoot, manifestPath);
  const folderName = path.basename(pluginRoot);

  if (manifest.name !== marketplaceEntry.name) {
    addIssue(issues, relativeManifestPath, "manifest name must match marketplace entry name");
  }

  if (manifest.name !== folderName) {
    addIssue(issues, relativeManifestPath, "manifest name must match plugin folder name");
  }

  if (!manifest.version) {
    addIssue(issues, relativeManifestPath, "manifest version is required");
  }

  if (!manifest.description) {
    addIssue(issues, relativeManifestPath, "manifest description is required");
  }

  if (!manifest.license) {
    addIssue(issues, relativeManifestPath, "manifest license is required");
  }

  if (!manifest.repository) {
    addIssue(issues, relativeManifestPath, "manifest repository URL is required");
  }

  if (!manifest.homepage) {
    addIssue(issues, relativeManifestPath, "manifest homepage URL is required");
  }

  if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
    addIssue(issues, relativeManifestPath, "manifest should include at least one keyword");
  }

  if (!manifest.interface || typeof manifest.interface !== "object") {
    addIssue(issues, relativeManifestPath, "manifest interface block is required");
    return;
  }

  for (const field of [
    "displayName",
    "shortDescription",
    "longDescription",
    "developerName",
    "category",
    "websiteURL",
    "privacyPolicyURL",
    "termsOfServiceURL",
    "brandColor"
  ]) {
    if (!manifest.interface[field]) {
      addIssue(issues, relativeManifestPath, `interface.${field} is required`);
    }
  }

  if (!Array.isArray(manifest.interface.capabilities)) {
    addIssue(issues, relativeManifestPath, "interface.capabilities must be an array");
  }

  if (manifest.interface.category && manifest.interface.category !== marketplaceEntry.category) {
    addIssue(issues, relativeManifestPath, "interface.category must match marketplace category");
  }

  const promptList = manifest.interface.defaultPrompt;
  if (!Array.isArray(promptList) || promptList.length === 0 || promptList.length > 3) {
    addIssue(issues, relativeManifestPath, "interface.defaultPrompt must contain between 1 and 3 prompts");
  } else {
    for (const prompt of promptList) {
      if (typeof prompt !== "string" || prompt.length === 0 || prompt.length > 128) {
        addIssue(issues, relativeManifestPath, "each default prompt must be a non-empty string no longer than 128 characters");
      }
    }
  }

  for (const assetField of ["composerIcon", "logo"]) {
    const assetPath = manifest.interface[assetField];
    if (!assetPath) {
      addIssue(issues, relativeManifestPath, `interface.${assetField} is required`);
      continue;
    }

    const resolvedAssetPath = path.join(pluginRoot, assetPath.replace(/^\.\//, ""));
    if (!exists(resolvedAssetPath)) {
      addIssue(issues, relativeManifestPath, `interface.${assetField} points to a missing asset: ${assetPath}`);
    }
  }

  if (!manifest.skills) {
    addIssue(issues, relativeManifestPath, "manifest skills path is required");
  } else {
    const skillsRoot = path.join(pluginRoot, manifest.skills.replace(/^\.\//, ""));
    if (!exists(skillsRoot)) {
      addIssue(issues, relativeManifestPath, `skills path does not exist: ${manifest.skills}`);
    } else {
      for (const entry of listFiles(skillsRoot)) {
        if (entry.isDirectory()) {
          validateSkillDirectory(path.join(skillsRoot, entry.name), issues, workspaceRoot);
        }
      }
    }
  }

  const pluginReadmePath = path.join(pluginRoot, "README.md");
  if (!exists(pluginReadmePath)) {
    addIssue(issues, path.relative(workspaceRoot, pluginRoot), "plugin root should include README.md");
  }

  const commandRoot = path.join(pluginRoot, "commands");
  if (exists(commandRoot)) {
    const conventionsPath = path.join(commandRoot, "_conventions.md");
    if (!exists(conventionsPath)) {
      addIssue(issues, path.relative(workspaceRoot, commandRoot), "commands directory should include _conventions.md");
    }

    for (const entry of listFiles(commandRoot)) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name.startsWith("_")) {
        continue;
      }

      validateCommandFile(path.join(commandRoot, entry.name), issues, workspaceRoot);
    }
  }
}

export function validateWorkspace(workspaceRoot) {
  const issues = [];
  const marketplacePath = path.join(workspaceRoot, ".agents", "plugins", "marketplace.json");

  if (!exists(marketplacePath)) {
    addIssue(issues, ".agents/plugins/marketplace.json", "marketplace.json is required");
    return { issues };
  }

  const marketplace = readJson(marketplacePath);
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    addIssue(issues, ".agents/plugins/marketplace.json", "marketplace must contain at least one plugin entry");
    return { issues };
  }

  const seenPluginNames = new Set();

  for (const pluginEntry of marketplace.plugins) {
    if (!pluginEntry.name) {
      addIssue(issues, ".agents/plugins/marketplace.json", "every marketplace entry must include a name");
      continue;
    }

    if (seenPluginNames.has(pluginEntry.name)) {
      addIssue(issues, ".agents/plugins/marketplace.json", `duplicate plugin entry: ${pluginEntry.name}`);
      continue;
    }
    seenPluginNames.add(pluginEntry.name);

    if (pluginEntry.source?.source !== "local") {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: source.source must be "local"`);
    }

    const expectedPath = `./plugins/${pluginEntry.name}`;
    if (pluginEntry.source?.path !== expectedPath) {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: source.path must be ${expectedPath}`);
    }

    if (!ALLOWED_INSTALL_POLICIES.has(pluginEntry.policy?.installation)) {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: invalid policy.installation`);
    }

    if (!ALLOWED_AUTH_POLICIES.has(pluginEntry.policy?.authentication)) {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: invalid policy.authentication`);
    }

    if (!pluginEntry.category) {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: category is required`);
    }

    const pluginRoot = path.join(workspaceRoot, "plugins", pluginEntry.name);
    const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
    if (!exists(pluginRoot)) {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: plugin directory is missing`);
      continue;
    }

    if (!exists(manifestPath)) {
      addIssue(issues, ".agents/plugins/marketplace.json", `${pluginEntry.name}: .codex-plugin/plugin.json is missing`);
      continue;
    }

    validatePluginManifest(pluginRoot, manifestPath, pluginEntry, issues, workspaceRoot);
  }

  const rootReadme = path.join(workspaceRoot, "README.md");
  const contributing = path.join(workspaceRoot, "CONTRIBUTING.md");
  const security = path.join(workspaceRoot, "SECURITY.md");
  const license = path.join(workspaceRoot, "LICENSE");
  const packageJson = path.join(workspaceRoot, "package.json");
  const ciWorkflow = path.join(workspaceRoot, ".github", "workflows", "ci.yml");

  if (!exists(rootReadme)) {
    addIssue(issues, ".", "repository should include README.md");
  }

  if (!exists(contributing)) {
    addIssue(issues, ".", "repository should include CONTRIBUTING.md");
  }

  if (!exists(security)) {
    addIssue(issues, ".", "repository should include SECURITY.md");
  }

  if (!exists(license)) {
    addIssue(issues, ".", "repository should include LICENSE");
  }

  if (!exists(packageJson)) {
    addIssue(issues, ".", "repository should include package.json");
  }

  if (!exists(ciWorkflow)) {
    addIssue(issues, ".", "repository should include .github/workflows/ci.yml");
  }

  return { issues };
}
