import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OFFICECLI_VERSION = "1.0.138";
const OFFICECLI_EXECUTABLE = process.platform === "win32" ? "officecli.exe" : "officecli";

function officeCliExecutablePath() {
  const explicitBinary = process.env.LEGALWORK_OFFICECLI_BINARY?.trim();
  const candidates = [
    explicitBinary,
    process.resourcesPath ? path.join(process.resourcesPath, "officecli", OFFICECLI_EXECUTABLE) : null,
    path.resolve(__dirname, "..", "resources", "officecli", OFFICECLI_EXECUTABLE),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function getOfficeCliMcpCommand() {
  const executable = officeCliExecutablePath();
  if (executable) return [executable, "mcp"];

  if (app.isPackaged) {
    throw new Error("Office Documents is missing from this Counsel build. Reinstall the app.");
  }
  throw new Error("OfficeCLI is not prepared. Run pnpm --filter @counsel/desktop prepare:officecli, then try again.");
}

function getOfficeCliMcpEnvironment() {
  return {
    OFFICECLI_SKIP_UPDATE: "1",
    OFFICECLI_NO_AUTO_RESIDENT: "1",
    OFFICECLI_RESIDENT_FLUSH: "each",
  };
}

function getOfficeCliStatus() {
  const executable = officeCliExecutablePath();
  if (!executable) {
    return { installed: false, expectedVersion: OFFICECLI_VERSION, path: null, version: null };
  }

  const result = spawnSync(executable, ["--version"], { encoding: "utf8", timeout: 5_000 });
  const version = result.status === 0 ? result.stdout.trim() || result.stderr.trim() : null;
  return {
    installed: result.status === 0,
    expectedVersion: OFFICECLI_VERSION,
    path: executable,
    version,
    error: result.status === 0 ? null : result.stderr.trim() || "OfficeCLI could not be started.",
  };
}

export { getOfficeCliMcpCommand, getOfficeCliMcpEnvironment, getOfficeCliStatus };
