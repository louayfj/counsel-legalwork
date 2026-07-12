// Computer-use helper integration: locating the bundled ComputerUse.app,
// permission checks (spawn --check for a fresh TCC read), running-app
// listing for @App mentions, and opening the permission-setup GUI.
// Extracted from main.mjs; consumed only by the desktop IPC registry.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMPUTER_USE_HELPER_APP_NAME = "Axleo Computer Use.app";
const COMPUTER_USE_HELPER_EXECUTABLE = "ComputerUse";
const COMPUTER_USE_HELPER_BUNDLE_ID = "com.axleosystems.legalwork.computer-use";
const LEGACY_COMPUTER_USE_HELPER_BUNDLE_ID = "com.eigenweltlabs.legalwork.computer-use";

function computerUseHelperExecutablePath() {
  const appPath = computerUseHelperAppPath();
  const explicitBinary = process.env.LEGALWORK_COMPUTER_USE_BINARY?.trim();
  const candidates = [
    explicitBinary,
    appPath ? path.join(appPath, "Contents", "MacOS", COMPUTER_USE_HELPER_EXECUTABLE) : null,
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function computerUseHelperAppPath() {
  const explicitApp = process.env.LEGALWORK_COMPUTER_USE_APP?.trim();
  const candidates = [
    explicitApp,
    process.resourcesPath ? path.join(process.resourcesPath, "helpers", COMPUTER_USE_HELPER_APP_NAME) : null,
    path.resolve(__dirname, "..", "resources", "helpers", COMPUTER_USE_HELPER_APP_NAME),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function getComputerUseMcpCommand() {
  const helperExecutable = computerUseHelperExecutablePath();
  if (helperExecutable) return [helperExecutable, "mcp"];

  if (app.isPackaged) {
    throw new Error("Axleo Computer Use is missing from this Axleo Legal Work build.");
  }

  if (process.env.LEGALWORK_DEV_MODE === "1") {
    return ["node", path.resolve(__dirname, "../../..", "packages/handsfree/bin/legalwork-handsfree-computer-use.mjs"), "mcp"];
  }
  return ["npx", "-y", "@legalwork/handsfree", "mcp"];
}

// ---------------------------------------------------------------------------
// Permission checks — spawn the binary with --check, read stdout, done.
// Fresh process = fresh TCC read = always accurate. No HTTP server needed.
// ---------------------------------------------------------------------------

function resolveComputerUseExecutable() {
  // 1. Explicit env override.
  const explicit = process.env.LEGALWORK_COMPUTER_USE_BINARY?.trim();
  if (explicit && existsSync(explicit)) return explicit;

  // 2. .app bundle (packaged builds + pnpm dev).
  const appPath = computerUseHelperAppPath();
  if (appPath) {
    const bin = path.join(appPath, "Contents", "MacOS", COMPUTER_USE_HELPER_EXECUTABLE);
    if (existsSync(bin)) return bin;
  }

  // 3. Dev fallback — raw Swift build output.
  if (!app.isPackaged) {
    const swiftPkg = path.resolve(__dirname, "../../..", "packages/handsfree/native/HandsFree");
    const devCandidates = [
      path.join(swiftPkg, ".build", "release", "HandsFreeComputerUse"),
      path.join(swiftPkg, ".build", "arm64-apple-macosx", "release", "HandsFreeComputerUse"),
      path.join(swiftPkg, ".build", "debug", "HandsFreeComputerUse"),
      path.join(swiftPkg, ".build", "arm64-apple-macosx", "debug", "HandsFreeComputerUse"),
    ];
    for (const c of devCandidates) {
      if (existsSync(c)) return c;
    }
  }

  return null;
}

async function checkComputerUsePermissions() {
  // Spawn binary --check → read JSON from stdout → exit. Always fresh.
  const bin = resolveComputerUseExecutable();
  if (!bin) {
    return { ok: false, accessibility: false, screenRecording: false, error: "Helper binary not found. Run pnpm dev to build it." };
  }
  return spawnCheckPermissions(bin);
}

function spawnCheckPermissions(bin) {
  return new Promise((resolve) => {
    let stdout = "";
    const child = spawn(bin, ["--check"], { stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => resolve({ ok: false, accessibility: false, screenRecording: false, error: "Failed to run permission check." }));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({
          ok: parsed?.ok === true,
          accessibility: parsed?.accessibility === true,
          screenRecording: parsed?.screenRecording === true,
        });
      } catch {
        resolve({ ok: false, accessibility: false, screenRecording: false, error: "Permission check returned invalid output." });
      }
    });
  });
}

async function listRunningApps() {
  // Spawn binary --list-apps → read JSON from stdout → exit. Needs no TCC
  // permissions, so this works before Computer Use setup is complete.
  if (process.platform !== "darwin") return { ok: false, apps: [] };
  const bin = resolveComputerUseExecutable();
  if (!bin) return { ok: false, apps: [] };
  return new Promise((resolve) => {
    let stdout = "";
    const child = spawn(bin, ["--list-apps"], { stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => resolve({ ok: false, apps: [] }));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        const apps = Array.isArray(parsed?.apps) ? parsed.apps.filter((name) => typeof name === "string" && name.trim()) : [];
        resolve({ ok: parsed?.ok === true, apps });
      } catch {
        resolve({ ok: false, apps: [] });
      }
    });
  });
}

async function openComputerUseSetupApp() {
  // Open the same executable path used by --check and MCP. macOS TCC can treat
  // a bundle-opened .app and its raw executable as different permission targets.
  const bin = resolveComputerUseExecutable();
  if (!bin) throw new Error("Helper binary not found. Run pnpm dev to build it.");
  const child = spawn(bin, [], { detached: true, stdio: "ignore" });
  child.unref();
}

async function resetComputerUsePermissions() {
  if (process.platform !== "darwin") {
    return { ok: false, accessibility: false, screenRecording: false, error: "Computer Use permissions are macOS only." };
  }

  for (const bundleId of [COMPUTER_USE_HELPER_BUNDLE_ID, LEGACY_COMPUTER_USE_HELPER_BUNDLE_ID]) {
    spawnSync("tccutil", ["reset", "Accessibility", bundleId], { stdio: "ignore" });
    spawnSync("tccutil", ["reset", "ScreenCapture", bundleId], { stdio: "ignore" });
  }

  return checkComputerUsePermissions();
}

export {
  checkComputerUsePermissions,
  getComputerUseMcpCommand,
  listRunningApps,
  openComputerUseSetupApp,
  resetComputerUsePermissions,
};
