import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(repoPath, args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  } catch (error) {
    if (typeof error.stdout === "string") {
      return error.stdout.trim();
    }
    return "";
  }
}

function parseHostFromRemoteUrl(remoteUrl) {
  if (!remoteUrl) {
    return null;
  }

  const sshScpStyle = remoteUrl.match(/^[^@]+@([^:]+):.+$/);
  if (sshScpStyle) {
    return sshScpStyle[1].toLowerCase();
  }

  try {
    const parsed = new URL(remoteUrl);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyRemoteUrl(remoteUrl, options = {}) {
  const host = parseHostFromRemoteUrl(remoteUrl);
  const knownGitLabHosts = new Set((options.knownGitLabHosts ?? []).map((value) => value.toLowerCase()));

  let provider = "unknown";
  if (host === "gitlab.com" || knownGitLabHosts.has(host) || host?.includes("gitlab")) {
    provider = "gitlab";
  } else if (host === "github.com" || host?.includes("github")) {
    provider = "github";
  } else if (host?.includes("bitbucket")) {
    provider = "bitbucket";
  }

  return {
    url: remoteUrl ?? null,
    host,
    provider,
    isGitLab: provider === "gitlab"
  };
}

export async function detectActiveRemote(repoPath, options = {}) {
  const branch = await git(repoPath, ["branch", "--show-current"]);
  const remotesText = await git(repoPath, ["remote"]);
  const remotes = remotesText ? remotesText.split("\n").map((value) => value.trim()).filter(Boolean) : [];

  let remoteName = null;

  if (branch) {
    remoteName = await git(repoPath, ["config", "--get", `branch.${branch}.remote`]);
  }

  if (!remoteName) {
    remoteName = await git(repoPath, ["config", "--get", "remote.pushDefault"]);
  }

  if (!remoteName && remotes.includes("origin")) {
    remoteName = "origin";
  }

  if (!remoteName && remotes.length > 0) {
    remoteName = remotes[0];
  }

  if (!remoteName) {
    return {
      branch: branch || null,
      remoteName: null,
      remotes: [],
      fetch: classifyRemoteUrl(null, options),
      push: classifyRemoteUrl(null, options),
      isGitLab: false
    };
  }

  const fetchUrl = await git(repoPath, ["remote", "get-url", remoteName]);
  const pushUrl = await git(repoPath, ["remote", "get-url", "--push", remoteName]);
  const fetch = classifyRemoteUrl(fetchUrl, options);
  const push = classifyRemoteUrl(pushUrl || fetchUrl, options);

  return {
    branch: branch || null,
    remoteName,
    remotes,
    fetch,
    push,
    isGitLab: fetch.isGitLab || push.isGitLab
  };
}
