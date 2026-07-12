const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const afterPack = require("../scripts/electron-after-pack.cjs");

test("removes Finder metadata before signing the copied helper", { skip: process.platform !== "darwin" }, () => {
  const root = mkdtempSync(join(tmpdir(), "legalwork-after-pack-"));
  const helper = join(root, "ComputerUse");
  writeFileSync(helper, "helper");
  execFileSync("xattr", ["-wx", "com.apple.FinderInfo", "0000000000000000000000000000000000000000000000000000000000000000", helper]);

  try {
    assert.equal(typeof afterPack.cleanCodeSignMetadata, "function");
    afterPack.cleanCodeSignMetadata(helper);
    assert.throws(() => execFileSync("xattr", ["-p", "com.apple.FinderInfo", helper], { stdio: "pipe" }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
