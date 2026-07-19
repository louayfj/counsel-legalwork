import { describe, expect, test } from "bun:test";

import { BUILT_IN_LEGALWORK_EXTENSION_MANIFESTS, extensionResource } from "../src/app/extensions";

describe("OfficeCLI extension manifest", () => {
  test("uses the bundled MCP runtime and safe connection contract", () => {
    const manifest = BUILT_IN_LEGALWORK_EXTENSION_MANIFESTS.find((entry) => entry.id === "officecli");
    expect(manifest).toBeDefined();
    expect(manifest?.platform).toEqual(["darwin", "linux", "windows"]);

    const mcp = extensionResource(manifest, "mcp");
    expect(mcp).toMatchObject({
      mcpServerName: "officecli",
      command: ["officecli", "mcp"],
      localCommandRef: "legalwork.officeCliMcp",
      required: true,
    });
    expect(extensionResource(manifest, "native-binary")?.packageName).toBe("iOfficeAI/OfficeCLI@v1.0.138");
  });
});
