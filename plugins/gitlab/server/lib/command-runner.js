import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function trimOutput(value) {
  return value ? value.trimEnd() : "";
}

function quoteArg(arg) {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}

export function formatCommand(command, args = []) {
  return [command, ...args].map(quoteArg).join(" ");
}

export async function runCommand(command, args = [], options = {}) {
  const commandLine = formatCommand(command, args);

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env
      },
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024
    });

    return {
      ok: true,
      code: 0,
      stdout: trimOutput(stdout),
      stderr: trimOutput(stderr),
      commandLine
    };
  } catch (error) {
    return {
      ok: false,
      code: typeof error.code === "number" ? error.code : null,
      stdout: trimOutput(error.stdout),
      stderr: trimOutput(error.stderr),
      signal: error.signal ?? null,
      message: error.message,
      commandLine
    };
  }
}
