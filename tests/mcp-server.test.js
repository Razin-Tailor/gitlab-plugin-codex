import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolvePluginMcpServerConfig } from "../scripts/lib/plugin-mcp.js";

const execFileAsync = promisify(execFile);

async function run(command, args, options = {}) {
  await execFileAsync(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env
    }
  });
}

async function configureRepoUser(repoPath) {
  await run("git", ["config", "user.name", "Codex Test"], { cwd: repoPath });
  await run("git", ["config", "user.email", "codex@example.com"], { cwd: repoPath });
}

async function createRemoteFixture() {
  const fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "gitlab-plugin-mcp-"));
  const remotePath = path.join(fixtureRoot, "remote.git");
  const seedPath = path.join(fixtureRoot, "seed");

  await run("git", ["init", "--bare", "--initial-branch=main", remotePath]);
  await run("git", ["clone", remotePath, seedPath]);
  await configureRepoUser(seedPath);
  await fsp.writeFile(path.join(seedPath, "README.md"), "# fixture\n");
  await run("git", ["add", "README.md"], { cwd: seedPath });
  await run("git", ["commit", "-m", "Initial commit"], { cwd: seedPath });
  await run("git", ["push", "-u", "origin", "main"], { cwd: seedPath });

  return {
    fixtureRoot,
    remotePath
  };
}

async function createFakeGlabBinary(binDir) {
  const fakeGlabPath = path.join(binDir, "glab");
  const script = `#!/bin/sh
set -eu

if [ "$#" -ge 2 ] && [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "fake glab auth ok"
  exit 0
fi

if [ "$#" -ge 4 ] && [ "$1" = "repo" ] && [ "$2" = "clone" ]; then
  REPO="$3"
  DIR="$4"
  shift 4
  if [ "$#" -ge 1 ] && [ "$1" = "--" ]; then
    shift
  fi
  exec git clone "$REPO" "$DIR" "$@"
fi

echo "unsupported fake glab command: $*" >&2
exit 1
`;

  await fsp.writeFile(fakeGlabPath, script, { mode: 0o755 });
}

async function connectClient(extraEnv = {}) {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(testDir, "..");
  const serverConfig = resolvePluginMcpServerConfig(workspaceRoot, "gitlab");
  const client = new Client(
    {
      name: "gitlab-plugin-test-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    cwd: serverConfig.cwd,
    env: {
      ...serverConfig.env,
      ...extraEnv
    },
    stderr: "pipe"
  });

  await client.connect(transport);
  await client.listTools();

  return { client, transport };
}

test("gitlab MCP server advertises the expected tools", async () => {
  const { client, transport } = await connectClient();

  try {
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["gitlab_clone", "gitlab_pull", "gitlab_push"]);
  } finally {
    await transport.close();
  }
});

test("gitlab MCP server supports clone, pull, and push through the tool interface", async () => {
  const { fixtureRoot, remotePath } = await createRemoteFixture();
  const fakeBinDir = path.join(fixtureRoot, "bin");
  await fsp.mkdir(fakeBinDir, { recursive: true });
  await createFakeGlabBinary(fakeBinDir);

  const { client, transport } = await connectClient({
    PATH: `${fakeBinDir}:${process.env.PATH}`
  });

  const workingClone = path.join(fixtureRoot, "working-clone");
  const collaboratorClone = path.join(fixtureRoot, "collaborator-clone");

  try {
    const cloneResult = await client.callTool({
      name: "gitlab_clone",
      arguments: {
        repository: remotePath,
        directory: workingClone
      }
    });

    assert.equal(cloneResult.isError, undefined);
    assert.equal(cloneResult.structuredContent.ok, true);
    assert.equal(cloneResult.structuredContent.directory, workingClone);

    await run("git", ["clone", remotePath, collaboratorClone]);
    await configureRepoUser(collaboratorClone);
    await fsp.writeFile(path.join(collaboratorClone, "README.md"), "# collaborator update\n");
    await run("git", ["add", "README.md"], { cwd: collaboratorClone });
    await run("git", ["commit", "-m", "Collaborator update"], { cwd: collaboratorClone });
    await run("git", ["push", "origin", "main"], { cwd: collaboratorClone });

    const pullResult = await client.callTool({
      name: "gitlab_pull",
      arguments: {
        repositoryPath: workingClone
      }
    });

    assert.equal(pullResult.isError, undefined);
    assert.equal(pullResult.structuredContent.ok, true);
    assert.equal(pullResult.structuredContent.changed, true);

    await configureRepoUser(workingClone);
    await fsp.writeFile(path.join(workingClone, "feature.txt"), "pushed from plugin\n");
    await run("git", ["add", "feature.txt"], { cwd: workingClone });
    await run("git", ["commit", "-m", "Plugin push test"], { cwd: workingClone });

    const pushResult = await client.callTool({
      name: "gitlab_push",
      arguments: {
        repositoryPath: workingClone
      }
    });

    assert.equal(pushResult.isError, undefined);
    assert.equal(pushResult.structuredContent.ok, true);
    assert.equal(pushResult.structuredContent.pushed, true);

    const remoteHead = (await execFileAsync("git", ["rev-parse", "main"], { cwd: remotePath })).stdout.trim();
    const localHead = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: workingClone })).stdout.trim();
    assert.equal(remoteHead, localHead);
  } finally {
    await transport.close();
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
