#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { cloneRepository, pullRepository, pushRepository } from "./lib/git-operations.js";

const nullableString = z.string().nullable();
const remoteSchema = z.object({
  name: z.string(),
  fetchUrl: nullableString,
  pushUrl: nullableString
});

function resultText(lines) {
  return lines.filter(Boolean).join("\n");
}

function repoSummaryLines(summary) {
  return [
    summary.repositoryRoot ? `Repository: ${summary.repositoryRoot}` : null,
    summary.branch ? `Branch: ${summary.branch}` : null,
    summary.upstream ? `Upstream: ${summary.upstream}` : null,
    summary.head ? `HEAD: ${summary.head}` : null
  ];
}

function cloneStructuredContent({ ok, message, repository, directory, command, summary }) {
  return {
    ok,
    message,
    repository,
    directory,
    repositoryRoot: summary?.repositoryRoot ?? directory,
    branch: summary?.branch ?? null,
    upstream: summary?.upstream ?? null,
    head: summary?.head ?? null,
    status: summary?.status ?? null,
    remotes: summary?.remotes ?? [],
    stdout: command?.stdout ?? null,
    stderr: command?.stderr ?? null
  };
}

function pullStructuredContent({ ok, message, strategy, command, summary, changed }) {
  return {
    ok,
    message,
    strategy,
    changed,
    repositoryRoot: summary?.repositoryRoot ?? null,
    branch: summary?.branch ?? null,
    upstream: summary?.upstream ?? null,
    head: summary?.head ?? null,
    status: summary?.status ?? null,
    remotes: summary?.remotes ?? [],
    ahead: summary?.ahead ?? 0,
    behind: summary?.behind ?? 0,
    stdout: command?.stdout ?? null,
    stderr: command?.stderr ?? null
  };
}

function pushStructuredContent({ ok, message, remote, command, summary, pushed, setUpstream }) {
  return {
    ok,
    message,
    remote,
    pushed,
    setUpstream,
    repositoryRoot: summary?.repositoryRoot ?? null,
    branch: summary?.branch ?? null,
    upstream: summary?.upstream ?? null,
    head: summary?.head ?? null,
    status: summary?.status ?? null,
    remotes: summary?.remotes ?? [],
    ahead: summary?.ahead ?? 0,
    behind: summary?.behind ?? 0,
    stdout: command?.stdout ?? null,
    stderr: command?.stderr ?? null
  };
}

const server = new McpServer(
  {
    name: "gitlab",
    version: "0.2.0"
  },
  {
    capabilities: {
      logging: {}
    }
  }
);

server.registerTool(
  "gitlab_clone",
  {
    title: "GitLab Clone",
    description: "Clone a GitLab repository through glab into an explicit directory path.",
    inputSchema: {
      repository: z.string().describe("Repository identifier such as group/project, full URL, or project ID."),
      directory: z
        .string()
        .describe("Destination directory. Use an explicit path to avoid ambiguity about the server working directory."),
      branch: z.string().optional().describe("Optional branch to clone."),
      depth: z.number().int().positive().max(1000).optional().describe("Optional shallow clone depth."),
      host: z.string().optional().describe("Optional GitLab hostname for self-managed instances.")
    },
    outputSchema: {
      ok: z.boolean(),
      message: z.string(),
      repository: z.string(),
      directory: z.string(),
      repositoryRoot: z.string(),
      branch: nullableString,
      upstream: nullableString,
      head: nullableString,
      status: nullableString,
      remotes: z.array(remoteSchema),
      stdout: nullableString,
      stderr: nullableString
    }
  },
  async ({ repository, directory, branch, depth, host }) => {
    try {
      const result = await cloneRepository({ repository, directory, branch, depth, host });
      const message = `Cloned ${repository} into ${result.directory}`;
      const structuredContent = cloneStructuredContent({
        ok: true,
        message,
        repository,
        directory: result.directory,
        command: result.command,
        summary: result.summary
      });

      return {
        content: [
          {
            type: "text",
            text: resultText([message, ...repoSummaryLines(result.summary)])
          }
        ],
        structuredContent
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const structuredContent = cloneStructuredContent({
        ok: false,
        message,
        repository,
        directory,
        command: null,
        summary: null
      });

      return {
        content: [{ type: "text", text: message }],
        structuredContent,
        isError: true
      };
    }
  }
);

server.registerTool(
  "gitlab_pull",
  {
    title: "GitLab Pull",
    description: "Pull the current branch from its upstream using a safe default strategy.",
    inputSchema: {
      repositoryPath: z
        .string()
        .describe("Path to an existing local repository checkout."),
      strategy: z
        .enum(["ff-only", "rebase"])
        .default("ff-only")
        .describe("Pull strategy. Fast-forward only is the default and safest option.")
    },
    outputSchema: {
      ok: z.boolean(),
      message: z.string(),
      strategy: z.enum(["ff-only", "rebase"]),
      changed: z.boolean(),
      repositoryRoot: nullableString,
      branch: nullableString,
      upstream: nullableString,
      head: nullableString,
      status: nullableString,
      remotes: z.array(remoteSchema),
      ahead: z.number(),
      behind: z.number(),
      stdout: nullableString,
      stderr: nullableString
    }
  },
  async ({ repositoryPath, strategy = "ff-only" }) => {
    try {
      const result = await pullRepository({ repositoryPath, strategy });
      const message = result.changed ? "Pulled latest changes successfully." : "Repository is already up to date.";
      const structuredContent = pullStructuredContent({
        ok: true,
        message,
        strategy,
        changed: result.changed,
        command: result.command,
        summary: result.after
      });

      return {
        content: [
          {
            type: "text",
            text: resultText([message, ...repoSummaryLines(result.after)])
          }
        ],
        structuredContent
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const structuredContent = pullStructuredContent({
        ok: false,
        message,
        strategy,
        changed: false,
        command: null,
        summary: null
      });

      return {
        content: [{ type: "text", text: message }],
        structuredContent,
        isError: true
      };
    }
  }
);

server.registerTool(
  "gitlab_push",
  {
    title: "GitLab Push",
    description: "Push the current branch to its remote, setting upstream automatically when needed.",
    inputSchema: {
      repositoryPath: z
        .string()
        .describe("Path to an existing local repository checkout."),
      remote: z.string().default("origin").describe("Remote name to push to."),
      setUpstream: z
        .boolean()
        .default(true)
        .describe("When true, configure the upstream automatically if the branch does not have one.")
    },
    outputSchema: {
      ok: z.boolean(),
      message: z.string(),
      remote: z.string(),
      pushed: z.boolean(),
      setUpstream: z.boolean(),
      repositoryRoot: nullableString,
      branch: nullableString,
      upstream: nullableString,
      head: nullableString,
      status: nullableString,
      remotes: z.array(remoteSchema),
      ahead: z.number(),
      behind: z.number(),
      stdout: nullableString,
      stderr: nullableString
    }
  },
  async ({ repositoryPath, remote = "origin", setUpstream = true }) => {
    try {
      const result = await pushRepository({ repositoryPath, remote, setUpstream });
      const message = result.pushed
        ? `Pushed ${result.after.branch ?? "current branch"} to ${remote}.`
        : "No local commits need to be pushed.";
      const structuredContent = pushStructuredContent({
        ok: true,
        message,
        remote,
        pushed: result.pushed,
        setUpstream: result.usedSetUpstream,
        command: result.command,
        summary: result.after
      });

      return {
        content: [
          {
            type: "text",
            text: resultText([message, ...repoSummaryLines(result.after)])
          }
        ],
        structuredContent
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const structuredContent = pushStructuredContent({
        ok: false,
        message,
        remote,
        pushed: false,
        setUpstream,
        command: null,
        summary: null
      });

      return {
        content: [{ type: "text", text: message }],
        structuredContent,
        isError: true
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitLab MCP server running on stdio");
}

main().catch((error) => {
  console.error("GitLab MCP server failed:", error);
  process.exit(1);
});
