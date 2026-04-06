import fs from "node:fs";
import path from "node:path";

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, "utf8"));
}

function resolveCommand(pluginRoot, command) {
  if (command.startsWith("./") || command.startsWith("../")) {
    return path.resolve(pluginRoot, command);
  }

  return command;
}

export function resolvePluginMcpServerConfig(workspaceRoot, pluginName, serverName = pluginName) {
  const pluginRoot = path.join(workspaceRoot, "plugins", pluginName);
  const configPath = path.join(pluginRoot, ".mcp.json");
  const mcpConfig = readJson(configPath);
  const serverConfig = mcpConfig.mcpServers?.[serverName];

  if (!serverConfig) {
    throw new Error(`MCP server "${serverName}" is not defined in ${configPath}`);
  }

  if (serverConfig.type && serverConfig.type !== "stdio") {
    throw new Error(`MCP server "${serverName}" is not a local stdio server`);
  }

  if (!serverConfig.command) {
    throw new Error(`MCP server "${serverName}" must define a command`);
  }

  return {
    pluginRoot,
    configPath,
    serverName,
    command: resolveCommand(pluginRoot, serverConfig.command),
    args: serverConfig.args ?? [],
    cwd: serverConfig.cwd ? path.resolve(pluginRoot, serverConfig.cwd) : pluginRoot,
    env: serverConfig.env ?? {}
  };
}
