import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { classifyRemoteUrl, detectActiveRemote } from "../scripts/lib/git-remote-detection.js";

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  await execFileAsync("git", args, { cwd });
}

async function createRepoFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gitlab-remote-detection-"));
  const repoPath = path.join(root, "repo");

  await git(root, ["init", "--initial-branch=main", repoPath]);
  await git(repoPath, ["config", "user.name", "Codex Test"]);
  await git(repoPath, ["config", "user.email", "codex@example.com"]);
  await fs.writeFile(path.join(repoPath, "README.md"), "# fixture\n");
  await git(repoPath, ["add", "README.md"]);
  await git(repoPath, ["commit", "-m", "Initial commit"]);

  return { root, repoPath };
}

test("classifyRemoteUrl recognizes gitlab.com and github.com", () => {
  assert.equal(classifyRemoteUrl("git@gitlab.com:group/project.git").provider, "gitlab");
  assert.equal(classifyRemoteUrl("https://github.com/openai/plugins").provider, "github");
});

test("classifyRemoteUrl supports configured self-managed GitLab hosts", () => {
  const classified = classifyRemoteUrl("ssh://git@code.company.internal/group/project.git", {
    knownGitLabHosts: ["code.company.internal"]
  });

  assert.equal(classified.provider, "gitlab");
  assert.equal(classified.host, "code.company.internal");
});

test("detectActiveRemote prefers the current branch remote", async () => {
  const { repoPath } = await createRepoFixture();

  await git(repoPath, ["remote", "add", "origin", "git@github.com:owner/repo.git"]);
  await git(repoPath, ["remote", "add", "upstream", "git@gitlab.com:group/project.git"]);
  await git(repoPath, ["config", "branch.main.remote", "upstream"]);

  const detected = await detectActiveRemote(repoPath);

  assert.equal(detected.remoteName, "upstream");
  assert.equal(detected.fetch.provider, "gitlab");
  assert.equal(detected.isGitLab, true);
});

test("detectActiveRemote falls back to origin when no branch remote is configured", async () => {
  const { repoPath } = await createRepoFixture();

  await git(repoPath, ["remote", "add", "origin", "git@gitlab.com:group/project.git"]);
  await git(repoPath, ["remote", "add", "backup", "git@github.com:owner/repo.git"]);

  const detected = await detectActiveRemote(repoPath);

  assert.equal(detected.remoteName, "origin");
  assert.equal(detected.fetch.provider, "gitlab");
});
