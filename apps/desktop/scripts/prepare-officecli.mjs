import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(__dirname, "..");
const VERSION = "1.0.138";
const RELEASE_BASE_URL = `https://github.com/iOfficeAI/OfficeCLI/releases/download/v${VERSION}`;
const SOURCE_BASE_URL = `https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/v${VERSION}`;

const ASSETS = {
  "darwin-arm64": {
    name: "officecli-mac-arm64",
    sha256: "761d9c2a6778d3932883bce7b8741284ad22f05f737a444b1e05b21c368f780a",
  },
  "darwin-x64": {
    name: "officecli-mac-x64",
    sha256: "a4a18e16c757576a343f18963bb1494a8dc490794d7e6c9bc379f906915a8e8b",
  },
  "linux-arm64": {
    name: "officecli-linux-arm64",
    sha256: "2c43eec01356cf29f67e7ac0ca4ac51ccd8b4cf49e2a184b0201f1556403c601",
  },
  "linux-x64": {
    name: "officecli-linux-x64",
    sha256: "c784d89fdadfa3c6adc70b6f74bff7a6a04f7cc2b105a764369e266cca885b2b",
  },
  "win32-arm64": {
    name: "officecli-win-arm64.exe",
    sha256: "46816377c63cc805352597b035cb46236f5ebec2a95d6b1c4e87f57bcdc68b0f",
  },
  "win32-x64": {
    name: "officecli-win-x64.exe",
    sha256: "6b07e14a38b4a379bb3ca37df254b979364c5cea212e0257c3600e775622aa25",
  },
};

function readArg(name) {
  const args = process.argv.slice(2);
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const target = `${process.platform}-${process.arch}`;
const asset = ASSETS[target];
if (!asset) {
  throw new Error(`OfficeCLI does not publish a binary for ${target}.`);
}

const outDir = resolve(readArg("--outdir") ?? join(desktopRoot, "resources", "officecli"));
const binaryName = process.platform === "win32" ? "officecli.exe" : "officecli";
const binaryPath = join(outDir, binaryName);
const metadataPath = join(outDir, "version.json");
const force = process.argv.includes("--force") || process.env.LEGALWORK_OFFICECLI_FORCE_DOWNLOAD === "1";

async function ensureAttributionFiles() {
  for (const name of ["LICENSE", "NOTICE", "THIRD-PARTY-NOTICES.txt"]) {
    const targetPath = join(outDir, name);
    if (!force && existsSync(targetPath)) continue;
    const response = await fetch(`${SOURCE_BASE_URL}/${name}`, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`OfficeCLI attribution download failed for ${name} (${response.status} ${response.statusText}).`);
    }
    writeFileSync(targetPath, await response.text(), "utf8");
  }
}

mkdirSync(outDir, { recursive: true });
await ensureAttributionFiles();

if (!force && existsSync(binaryPath) && sha256(readFileSync(binaryPath)) === asset.sha256) {
  process.stdout.write(`${JSON.stringify({ ok: true, cached: true, version: VERSION, binaryPath }, null, 2)}\n`);
  process.exit(0);
}

const response = await fetch(`${RELEASE_BASE_URL}/${asset.name}`, { redirect: "follow" });
if (!response.ok) {
  throw new Error(`OfficeCLI download failed (${response.status} ${response.statusText}).`);
}

const bytes = Buffer.from(await response.arrayBuffer());
const actualSha256 = sha256(bytes);
if (actualSha256 !== asset.sha256) {
  throw new Error(`OfficeCLI checksum mismatch: expected ${asset.sha256}, received ${actualSha256}.`);
}

const temporaryPath = `${binaryPath}.download`;
rmSync(temporaryPath, { force: true });
writeFileSync(temporaryPath, bytes, { mode: 0o755 });
renameSync(temporaryPath, binaryPath);
if (process.platform !== "win32") chmodSync(binaryPath, 0o755);
writeFileSync(metadataPath, `${JSON.stringify({ version: VERSION, asset: asset.name, sha256: asset.sha256 }, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({ ok: true, cached: false, version: VERSION, binaryPath }, null, 2)}\n`);
