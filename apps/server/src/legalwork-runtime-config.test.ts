import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildLegalworkRuntimeConfigObject,
  keepLegalworkRuntimeConfigFileFresh,
  legalworkRuntimeConfigFilePath,
  writeLegalworkRuntimeConfigFile,
} from "./legalwork-runtime-config.js";
import { GLOBAL_TOOL_PERMISSIONS_ID, writeRuntimeOpencodeConfig } from "./runtime-opencode-config-store.js";
import type { ServerConfig } from "./types.js";

const roots: string[] = [];
const cleanups: Array<() => void> = [];
let previousDb: string | undefined;

afterEach(async () => {
  while (cleanups.length) cleanups.pop()?.();
  while (roots.length) await rm(roots.pop()!, { recursive: true, force: true });
  if (previousDb === undefined) delete process.env.LEGALWORK_RUNTIME_DB;
  else process.env.LEGALWORK_RUNTIME_DB = previousDb;
});

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "legalwork-runtime-config-file-"));
  roots.push(root);
  previousDb = process.env.LEGALWORK_RUNTIME_DB;
  process.env.LEGALWORK_RUNTIME_DB = join(root, "runtime.sqlite");
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 0,
    token: "owt_test_token",
    hostToken: "owt_host_token",
    approval: { mode: "auto", timeoutMs: 1000 },
    corsOrigins: ["*"],
    workspaces: [
      { id: "ws_1", name: "Workspace", path: root, preset: "starter", workspaceType: "local" },
    ],
    authorizedRoots: [root],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "cli",
    hostTokenSource: "cli",
    logFormat: "pretty",
    logRequests: false,
  };
  return { root, config };
}

async function readConfigFile(config: ServerConfig): Promise<Record<string, unknown>> {
  const raw = await readFile(legalworkRuntimeConfigFilePath(config), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} was not an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} was not a string`);
  return value;
}

describe("legalwork runtime config file", () => {
  test("injects the Axleo internal legal and compliance persona into the default agent", async () => {
    const parsed = await buildLegalworkRuntimeConfigObject();
    const agents = recordValue(parsed.agent, "agent");
    const legalwork = recordValue(agents.legalwork, "agent.legalwork");
    const prompt = stringValue(legalwork.prompt, "agent.legalwork.prompt");

    expect(stringValue(legalwork.description, "agent.legalwork.description")).toBe(
      "Axleo internal legal and compliance assistant",
    );
    expect(prompt).toContain("Leo, Axleo Systems' internal legal and compliance assistant");
    expect(prompt).toContain("Axleo company legal operations");
    expect(prompt).toContain("SaaS client contracts");
    expect(prompt).toContain("DPAs");
    expect(prompt).toContain("NDAs");
    expect(prompt).toContain("call recording/transcription");
    expect(prompt).toContain("UK automotive retail and dealership compliance");
    expect(prompt).toContain("CONC");
    expect(prompt).toContain("PRIN 2A Consumer Duty");
    expect(prompt).toContain("Consumer Credit Act 1974");
    expect(prompt).toContain("Consumer Rights Act 2015");
    expect(prompt).toContain("UK GDPR and Data Protection Act 2018");
    expect(prompt).toContain("ASA CAP Code");
    expect(prompt).toContain("Do not make uncited legal claims");
    expect(prompt).toContain("recommend human legal or compliance review");
    expect(prompt).toContain("draft final-ready wording");
    expect(prompt).not.toContain("inside a law firm");
    expect(prompt).not.toContain("litigation");
    expect(prompt).not.toContain("engagement letters");
  });

  test("writes runtime-DB MCPs and legalwork defaults into the file", async () => {
    const { config } = await setup();
    await writeRuntimeOpencodeConfig(config, "ws_1", (current) => ({
      ...current,
      mcp: { posthog: { type: "remote", url: "https://mcp.posthog.com/mcp", enabled: true } },
      agent: { reviewer: { mode: "subagent", model: "opencode/big-pickle" } },
    }));

    const path = await writeLegalworkRuntimeConfigFile(config, "ws_1");
    expect(path).toBe(legalworkRuntimeConfigFilePath(config));

    const parsed = await readConfigFile(config);
    const mcp = parsed.mcp as Record<string, Record<string, unknown>>;
    expect(mcp.posthog?.enabled).toBe(true);
    expect(parsed.default_agent).toBe("legalwork");
    expect(Array.isArray(parsed.plugin)).toBe(true);
    const agents = parsed.agent as Record<string, Record<string, unknown>>;
    expect(agents.reviewer?.model).toBe("opencode/big-pickle");
  });

  test("keepLegalworkRuntimeConfigFileFresh rewrites the file on runtime-DB writes", async () => {
    const { config } = await setup();
    await writeLegalworkRuntimeConfigFile(config, "ws_1");
    cleanups.push(keepLegalworkRuntimeConfigFileFresh(config, "ws_1"));

    await writeRuntimeOpencodeConfig(config, "ws_1", (current) => ({
      ...current,
      mcp: { stripe: { type: "remote", url: "https://mcp.stripe.com", enabled: false } },
    }));

    // The refresh is fire-and-forget; poll briefly for the rewrite.
    let mcp: Record<string, Record<string, unknown>> = {};
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const parsed = await readConfigFile(config);
      mcp = (parsed.mcp ?? {}) as Record<string, Record<string, unknown>>;
      if (mcp.stripe) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(mcp.stripe?.enabled).toBe(false);
  });

  test("writes for other workspaces do not rewrite the primary file", async () => {
    const { config } = await setup();
    await writeLegalworkRuntimeConfigFile(config, "ws_1");
    cleanups.push(keepLegalworkRuntimeConfigFileFresh(config, "ws_1"));

    await writeRuntimeOpencodeConfig(config, "ws_other", (current) => ({
      ...current,
      mcp: { other: { type: "remote", url: "https://example.com/mcp", enabled: true } },
    }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const parsed = await readConfigFile(config);
    const mcp = (parsed.mcp ?? {}) as Record<string, Record<string, unknown>>;
    expect(mcp.other).toBeUndefined();
  });

  test("global tool permissions land in every workspace's file and rewrite it on change", async () => {
    const { config } = await setup();
    await writeRuntimeOpencodeConfig(config, "ws_1", (current) => ({
      ...current,
      permission: { external_directory: { "/tmp/shared/*": "allow" } },
    }));
    await writeLegalworkRuntimeConfigFile(config, "ws_1");
    cleanups.push(keepLegalworkRuntimeConfigFileFresh(config, "ws_1"));

    // A write to the reserved global row must rebuild this workspace's file.
    await writeRuntimeOpencodeConfig(config, GLOBAL_TOOL_PERMISSIONS_ID, (current) => ({
      ...current,
      permission: { bash: "ask" },
    }));

    let permission: Record<string, unknown> = {};
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const parsed = await readConfigFile(config);
      permission = (parsed.permission ?? {}) as Record<string, unknown>;
      if (permission.bash) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    // Global tool key + this workspace's own external_directory, merged.
    expect(permission.bash).toBe("ask");
    expect(permission.external_directory).toEqual({ "/tmp/shared/*": "allow" });
  });
});
