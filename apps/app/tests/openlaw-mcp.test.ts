import { describe, expect, test } from "bun:test";

import { MCP_QUICK_CONNECT } from "../src/app/constants";

describe("OpenLaw MCP catalog entry", () => {
  test("uses the public no-auth Streamable HTTP endpoint", () => {
    const entry = MCP_QUICK_CONNECT.find((candidate) => candidate.serverName === "openlaw");

    expect(entry).toMatchObject({
      name: "OpenLaw",
      serverName: "openlaw",
      url: "https://openlawmcp.legalaispace.com/v1/mcp",
      type: "remote",
      oauth: false,
      kind: "mcp",
      preview: true,
    });
    expect(entry?.requiresToken).toBeUndefined();
    expect(entry?.requiresOauthClient).toBeUndefined();
  });
});
