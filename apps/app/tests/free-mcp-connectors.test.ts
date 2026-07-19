import { describe, expect, test } from "bun:test";

import { MCP_QUICK_CONNECT } from "../src/app/constants";

describe("free local MCP connectors", () => {
  test("Companies House collects its free API key and runs locally", () => {
    const entry = MCP_QUICK_CONNECT.find((candidate) => candidate.serverName === "companies-house");

    expect(entry).toMatchObject({
      name: "Companies House",
      type: "local",
      command: ["npx", "-y", "companies-house-mcp"],
      oauth: false,
      requiredEnvironment: [
        {
          key: "COMPANIES_HOUSE_API_KEY",
          secret: true,
        },
      ],
    });
  });

  test("Playwright uses Microsoft's local MCP package without credentials", () => {
    const entry = MCP_QUICK_CONNECT.find((candidate) => candidate.serverName === "playwright");

    expect(entry).toMatchObject({
      name: "Playwright",
      type: "local",
      command: ["npx", "-y", "@playwright/mcp@latest"],
      oauth: false,
    });
    expect(entry?.requiredEnvironment).toBeUndefined();
  });
});
