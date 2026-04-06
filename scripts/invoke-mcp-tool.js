#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolvePluginMcpServerConfig } from "./lib/plugin-mcp.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const [commandName, rawArguments] = process.argv.slice(2);

if (!commandName) {
  console.error("Usage: node scripts/invoke-mcp-tool.js <list-tools|tool-name> [json-arguments]");
  process.exit(1);
}

async function main() {
  const serverConfig = resolvePluginMcpServerConfig(workspaceRoot, "gitlab");
  const client = new Client(
    {
      name: "gitlab-plugin-smoke-client",
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
    env: serverConfig.env,
    stderr: "pipe"
  });

  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
  }

  try {
    await client.connect(transport);

    if (commandName === "list-tools") {
      const toolList = await client.listTools();
      process.stdout.write(`${JSON.stringify(toolList, null, 2)}\n`);
      return;
    }

    const argumentsObject = rawArguments ? JSON.parse(rawArguments) : {};
    const result = await client.callTool({
      name: commandName,
      arguments: argumentsObject
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
