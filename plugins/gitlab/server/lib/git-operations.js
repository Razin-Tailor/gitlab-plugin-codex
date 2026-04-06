import fs from "node:fs/promises";
import path from "node:path";
import { formatCommand, runCommand } from "./command-runner.js";

function toolPath(inputPath) {
  return path.resolve(inputPath);
}

function remotesFromOutput(output) {
  const remotes = new Map();

  for (const line of output.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const [name, url, kind] = line.trim().split(/\s+/);
    if (!name || !url || !kind) {
      continue;
    }

    const current = remotes.get(name) ?? {
      name,
      fetchUrl: null,
      pushUrl: null
    };

    if (kind === "(fetch)") {
      current.fetchUrl = url;
    }

    if (kind === "(push)") {
      current.pushUrl = url;
    }

    remotes.set(name, current);
  }

  return [...remotes.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryHasEntries(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

function failureMessage(result, fallback) {
  return result.stderr || result.stdout || result.message || fallback;
}

async function getOptionalOutput(command, args, options = {}) {
  const result = await runCommand(command, args, options);
  return result.ok ? result.stdout : null;
}

export async function ensureGlabAuth({ cwd, host } = {}) {
  const args = ["auth", "status"];
  if (host) {
    args.push("--hostname", host);
  }

  const result = await runCommand("glab", args, { cwd, timeoutMs: 15_000 });
  if (!result.ok) {
    throw new Error(`glab authentication check failed: ${failureMessage(result, "glab auth status failed")}`);
  }
}

export async function ensureCloneTarget(directoryPath) {
  const resolvedPath = toolPath(directoryPath);
  const targetExists = await pathExists(resolvedPath);

  if (targetExists && (await directoryHasEntries(resolvedPath))) {
    throw new Error(`Clone target already exists and is not empty: ${resolvedPath}`);
  }

  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  return resolvedPath;
}

export async function getRepositorySummary(repositoryPath) {
  const resolvedPath = toolPath(repositoryPath);
  const rootResult = await runCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd: resolvedPath
  });

  if (!rootResult.ok) {
    throw new Error(failureMessage(rootResult, `Not a git repository: ${resolvedPath}`));
  }

  const repositoryRoot = rootResult.stdout.trim();

  const [branch, upstream, head, status, porcelain, remoteOutput] = await Promise.all([
    getOptionalOutput("git", ["branch", "--show-current"], { cwd: repositoryRoot }),
    getOptionalOutput("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
      cwd: repositoryRoot
    }),
    getOptionalOutput("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot }),
    getOptionalOutput("git", ["status", "-sb"], { cwd: repositoryRoot }),
    getOptionalOutput("git", ["status", "--porcelain"], { cwd: repositoryRoot }),
    getOptionalOutput("git", ["remote", "-v"], { cwd: repositoryRoot })
  ]);

  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const aheadBehind = await getOptionalOutput(
      "git",
      ["rev-list", "--left-right", "--count", `${upstream}...HEAD`],
      { cwd: repositoryRoot }
    );

    if (aheadBehind) {
      const [behindCount, aheadCount] = aheadBehind.split(/\s+/).map((value) => Number.parseInt(value, 10) || 0);
      behind = behindCount;
      ahead = aheadCount;
    }
  }

  const remotes = remotesFromOutput(remoteOutput ?? "");
  const origin = remotes.find((remote) => remote.name === "origin");

  return {
    repositoryRoot,
    branch: branch || null,
    upstream: upstream || null,
    head: head || null,
    status: status || null,
    remotes,
    originUrl: origin?.fetchUrl ?? origin?.pushUrl ?? null,
    isDirty: Boolean(porcelain),
    ahead,
    behind
  };
}

export async function cloneRepository({ repository, directory, branch, depth, host }) {
  const targetDirectory = await ensureCloneTarget(directory);
  await ensureGlabAuth({ host });

  const gitFlags = [];
  if (branch) {
    gitFlags.push("--branch", branch);
  }
  if (depth) {
    gitFlags.push("--depth", String(depth));
  }
  if (branch && depth) {
    gitFlags.push("--single-branch");
  }

  const args = ["repo", "clone", repository, targetDirectory];
  if (gitFlags.length > 0) {
    args.push("--", ...gitFlags);
  }

  const result = await runCommand("glab", args, {
    cwd: path.dirname(targetDirectory),
    env: host ? { GITLAB_HOST: host } : undefined,
    timeoutMs: 120_000
  });

  if (!result.ok) {
    throw new Error(`${formatCommand("glab", args)} failed: ${failureMessage(result, "clone failed")}`);
  }

  const summary = await getRepositorySummary(targetDirectory);
  return {
    command: result,
    summary,
    directory: targetDirectory
  };
}

export async function pullRepository({ repositoryPath, strategy }) {
  const before = await getRepositorySummary(repositoryPath);

  if (before.isDirty) {
    throw new Error(`Repository has uncommitted changes and cannot be pulled safely: ${before.repositoryRoot}`);
  }

  if (!before.upstream) {
    throw new Error(`Current branch has no upstream configured: ${before.repositoryRoot}`);
  }

  await ensureGlabAuth({ cwd: before.repositoryRoot });

  const args = ["pull", strategy === "rebase" ? "--rebase" : "--ff-only"];
  const result = await runCommand("git", args, {
    cwd: before.repositoryRoot,
    timeoutMs: 120_000
  });

  if (!result.ok) {
    throw new Error(`${formatCommand("git", args)} failed: ${failureMessage(result, "pull failed")}`);
  }

  const after = await getRepositorySummary(before.repositoryRoot);
  return {
    command: result,
    before,
    after,
    changed: before.head !== after.head
  };
}

export async function pushRepository({ repositoryPath, remote, setUpstream }) {
  const before = await getRepositorySummary(repositoryPath);

  if (!before.branch) {
    throw new Error(`Repository is in detached HEAD state: ${before.repositoryRoot}`);
  }

  const remoteName = remote ?? "origin";
  const remoteNames = new Set(before.remotes.map((remoteEntry) => remoteEntry.name));

  if (!remoteNames.has(remoteName)) {
    throw new Error(`Remote "${remoteName}" does not exist in ${before.repositoryRoot}`);
  }

  await ensureGlabAuth({ cwd: before.repositoryRoot });

  if (before.upstream && before.ahead === 0) {
    return {
      command: null,
      before,
      after: before,
      pushed: false,
      usedSetUpstream: false
    };
  }

  if (!before.upstream && setUpstream === false) {
    throw new Error(`Current branch has no upstream and setUpstream is disabled: ${before.branch}`);
  }

  const args = before.upstream
    ? ["push"]
    : ["push", "-u", remoteName, before.branch];

  const result = await runCommand("git", args, {
    cwd: before.repositoryRoot,
    timeoutMs: 120_000
  });

  if (!result.ok) {
    throw new Error(`${formatCommand("git", args)} failed: ${failureMessage(result, "push failed")}`);
  }

  const after = await getRepositorySummary(before.repositoryRoot);
  return {
    command: result,
    before,
    after,
    pushed: true,
    usedSetUpstream: !before.upstream
  };
}
