import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveOrganisationReferenceRoots } from "./axleo-reference.js";
import { LegalWorkAxleoReferenceTools } from "./opencode-plugins/legalwork-axleo-reference-tools.js";

const roots: string[] = [];
let previousReferenceDir: string | undefined;
let previousDataDir: string | undefined;
let previousRuntimeDb: string | undefined;
let previousServerUrl: string | undefined;
let previousServerToken: string | undefined;
const originalFetch = globalThis.fetch;

afterEach(async () => {
  if (previousReferenceDir === undefined) delete process.env.AXLEO_LEGAL_REFERENCE_DIR;
  else process.env.AXLEO_LEGAL_REFERENCE_DIR = previousReferenceDir;
  if (previousDataDir === undefined) delete process.env.LEGALWORK_DATA_DIR;
  else process.env.LEGALWORK_DATA_DIR = previousDataDir;
  if (previousRuntimeDb === undefined) delete process.env.LEGALWORK_RUNTIME_DB;
  else process.env.LEGALWORK_RUNTIME_DB = previousRuntimeDb;
  if (previousServerUrl === undefined) delete process.env.LEGALWORK_SERVER_URL;
  else process.env.LEGALWORK_SERVER_URL = previousServerUrl;
  if (previousServerToken === undefined) delete process.env.LEGALWORK_SERVER_TOKEN;
  else process.env.LEGALWORK_SERVER_TOKEN = previousServerToken;
  globalThis.fetch = originalFetch;
  while (roots.length) await rm(roots.pop()!, { recursive: true, force: true });
});

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

describe("Axleo reference helpers", () => {
  test("includes configured and default reference roots", async () => {
    const configured = await tempRoot("axleo-reference-configured-");
    previousReferenceDir = process.env.AXLEO_LEGAL_REFERENCE_DIR;
    process.env.AXLEO_LEGAL_REFERENCE_DIR = configured;

    const roots = resolveOrganisationReferenceRoots();
    expect(roots[0]).toBe(configured);
    expect(roots.some((root) => root.endsWith("Documents/axleo-private-legal-reference"))).toBe(false);
    expect(roots.some((root) => root.endsWith("resources/axleo-legal-reference"))).toBe(true);
  });

  test("reference search finds text files in the standing folder", async () => {
    const referenceRoot = await tempRoot("axleo-reference-search-");
    previousReferenceDir = process.env.AXLEO_LEGAL_REFERENCE_DIR;
    process.env.AXLEO_LEGAL_REFERENCE_DIR = referenceRoot;
    await writeFile(
      join(referenceRoot, "conc-notes.md"),
      "CONC 4.2.5 requires clear pre-contract disclosure for the finance journey.\n",
      "utf8",
    );

    const plugin = await LegalWorkAxleoReferenceTools();
    const searchTool = plugin.tool.organisation_reference_search;
    const result = await searchTool.execute({ query: "CONC 4.2.5 disclosure", max_results: 3 }, {});

    expect(result.results[0]?.source).toBe("conc-notes.md");
    expect(result.results[0]?.snippet).toContain("pre-contract disclosure");
  });

  test("exports plain JSON Schema properties for the OpenCode tool registry", async () => {
    const plugin = await LegalWorkAxleoReferenceTools();

    expect(plugin.tool.organisation_reference_search.args).toMatchObject({
      query: {
        type: "string",
        minLength: 2,
        maxLength: 300,
      },
      max_results: {
        type: "integer",
        minimum: 1,
        maximum: 10,
      },
    });
    expect(JSON.stringify(plugin.tool.organisation_reference_search.args)).not.toContain("_zod");
  });

  test("plugin injects citation and escalation discipline", async () => {
    const plugin = await LegalWorkAxleoReferenceTools();
    const output: { system: string[] } = { system: [] };

    await plugin["experimental.chat.system.transform"](null, output);

    const system = output.system.join("\n");
    expect(system).toContain("organisation_reference_search");
    expect(system).toContain("compliance_citation_log");
    expect(system).toContain("human compliance/legal review");
  });

  test("citation log tolerates empty citations and records audit warning", async () => {
    const calls: Array<{ input: Parameters<typeof fetch>[0]; init?: RequestInit }> = [];
    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push({ input, init });
        return Response.json({ ok: true, citations: 0 });
      },
      originalFetch,
    );
    previousServerUrl = process.env.LEGALWORK_SERVER_URL;
    previousServerToken = process.env.LEGALWORK_SERVER_TOKEN;
    process.env.LEGALWORK_SERVER_URL = "http://127.0.0.1:14567/";
    process.env.LEGALWORK_SERVER_TOKEN = "test-token";

    const plugin = await LegalWorkAxleoReferenceTools();
    const result = await plugin.tool.compliance_citation_log.execute({
      answer_summary: "Draft complaint response",
      risk_level: "high",
      escalation_required: true,
      citations: [],
    }, { directory: "/tmp/workspace" });

    const body = calls[0]?.init?.body;
    if (typeof body !== "string") throw new Error("expected JSON request body");
    const sent = JSON.parse(body);

    expect(sent.citations).toEqual([]);
    expect(sent.citation_warning).toContain("No valid citations");
    expect(sent.escalation_required).toBe(true);
    expect(result).toEqual({
      ok: true,
      citations: 0,
      warning: "No valid citations were provided; logged an uncited compliance answer for audit follow-up.",
    });
  });

  test("citation log normalizes camelCase fields and malformed citation entries", async () => {
    const calls: Array<{ input: Parameters<typeof fetch>[0]; init?: RequestInit }> = [];
    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push({ input, init });
        return Response.json({ ok: true, citations: 2 });
      },
      originalFetch,
    );
    previousServerUrl = process.env.LEGALWORK_SERVER_URL;
    previousServerToken = process.env.LEGALWORK_SERVER_TOKEN;
    process.env.LEGALWORK_SERVER_URL = "http://127.0.0.1:14567/";
    process.env.LEGALWORK_SERVER_TOKEN = "test-token";

    const plugin = await LegalWorkAxleoReferenceTools();
    await plugin.tool.compliance_citation_log.execute({
      answerSummary: "Used car rejection response",
      riskLevel: "HIGH",
      citations: [
        { source: "CRA 2015", locator: "s.22(3)", claim: "30-day rejection window" },
        { locator: "missing source" },
        "DISP 1.6.2R",
      ],
    }, { directory: "/tmp/workspace" });

    const body = calls[0]?.init?.body;
    if (typeof body !== "string") throw new Error("expected JSON request body");
    const sent = JSON.parse(body);

    expect(sent.answer_summary).toBe("Used car rejection response");
    expect(sent.risk_level).toBe("high");
    expect(sent.escalation_required).toBe(false);
    expect(sent.citations).toEqual([
      { source: "CRA 2015", locator: "s.22(3)", claim: "30-day rejection window" },
      { source: "DISP 1.6.2R" },
    ]);
  });
});
