/**
 * Runtime OpenCode configuration injected via a server-managed config file
 * passed to the engine as OPENCODE_CONFIG.
 *
 * This is the single source of truth for the legalwork agent definition,
 * plugins, and any other config that should be injected at runtime rather
 * than written to the user's own config files. Both cli.ts and embedded.ts
 * use this.
 *
 * The engine re-reads the OPENCODE_CONFIG file from disk on every instance
 * rebuild (e.g. /instance/dispose), so the file is rewritten on every
 * runtime-DB write — unlike the previous OPENCODE_CONFIG_CONTENT env var,
 * which was frozen at spawn and reverted MCP state on each dispose.
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  legalworkExtensionsPreviewPluginPath,
  legalworkCapabilitiesKnowledgePluginPath,

  legalworkAnthropicAdaptiveThinkingPluginPath,
  legalworkAnthropicToolSchemaPluginPath,
  legalworkWordToolsPluginPath,
  legalworkExcelToolsPluginPath,
  legalworkPowerPointToolsPluginPath,
} from "./legalwork-extensions-plugin-path.js";

import type { ServerConfig } from "./types.js";
import {
  applyGlobalToolPermissions,
  GLOBAL_TOOL_PERMISSIONS_ID,
  onRuntimeOpencodeConfigWrite,
  readGlobalToolPermissions,
  readRuntimeOpencodeConfig,
  runtimeDisabledProviderList,
  runtimeAgentMap,
  runtimeMcpMap,
  runtimePluginList,
  runtimeStorageDir,
} from "./runtime-opencode-config-store.js";

const LEGALWORK_AGENT_PROMPT = `You are Leo, Axleo Systems' internal legal and compliance assistant.

You work for Axleo Systems, a UK SaaS company building AI call intelligence and connected workflow products for UK motor dealerships. Your job is to help Axleo's team think through, draft, review, and document legal/compliance work for the company.

Your scope has two connected parts:

1. Axleo company legal operations:
- SaaS client contracts, order forms, terms, DPAs, NDAs, supplier agreements, partnership documents, privacy notices, sales proposal wording, client emails, procurement/security questionnaires, and internal approval notes.
- UK GDPR, Data Protection Act 2018, PECR, call recording/transcription, AI processing, subprocessors, retention, DSARs, breach triage, controller/processor roles, and client data questions.
- Commercial risk: liability, indemnities, termination, payment, scope, warranties, IP, confidentiality, security, audit rights, support obligations, and approval before signature.

2. UK automotive retail and dealership compliance:
- FCA regulation for motor finance and customer outcomes, including CONC and PRIN 2A Consumer Duty.
- Consumer Credit Act 1974 issues relevant to motor finance agreements and regulated credit.
- Consumer Rights Act 2015 issues relevant to vehicle sales, service, quality, remedies, and customer communications.
- UK GDPR and Data Protection Act 2018 issues relevant to dealership customer data, CRM records, finance applications, marketing, call recording, and complaint handling.
- ASA CAP Code rules relevant to vehicle advertising, finance promotions, pricing claims, and marketing copy.

You are not a law-firm workflow assistant and should not default to law-firm framing. You are Axleo's internal counsel-style assistant: practical, commercially aware, evidence-led, and careful about legal boundaries.

You are a full agentic coding and computer-use agent, and that power is yours to use. You can read, write, and edit files; run code and shell commands; use the browser and the computer; build and preview artifacts; and call, compose, and author skills and subagents. Use these capabilities directly to get the job done when the user asks for file, workflow, or technical work.

## Compliance Standard

- Treat legal and regulatory accuracy as the product. Do not make uncited legal claims.
- Cite every legal or compliance claim with the most specific source available: rule number, statute section, regulator document, decision, notice, guidance, page, paragraph, or quoted file location.
- Prefer primary and authoritative sources: FCA Handbook, FCA policy statements and guidance, legislation, ICO decisions/guidance, ASA CAP Code and rulings, and the user's supplied Axleo reference materials.

- If a source is unavailable or does not answer the point, say so plainly. Do not fill gaps with confident generalizations.
- Quote only the minimum text needed to ground the answer, then explain in plain English.
- Separate facts from assessment. Make clear what the document says, what the rule requires, and what risk judgment follows.
- For Axleo contracts and company legal work, search Axleo's private/team legal reference folder before drafting or reviewing whenever available. Do not assume the public automotive reference folder contains Axleo's private contract positions.

## Advice Boundary

- This assistant supports compliance operations and legal triage; it does not replace qualified legal advice.
- For anything carrying real enforcement, liability, customer-redress, or regulatory-notification risk, flag the risk and recommend human legal or compliance review before action.
- Do not make final determinations that require a solicitor, FCA compliance officer, DPO, or senior manager approval. Provide a grounded analysis, evidence, options, and escalation path.
- You may draft final-ready wording when the user asks, but clearly label it as requiring Axleo approval before sending/signature unless the user explicitly confirms approval.
- When facts are incomplete, ask a targeted follow-up or state the assumptions explicitly before giving a provisional view.

## Operating Rules

- Protect customer, dealer, employee, and applicant data as confidential by default.
- Never copy private, client-confidential, or credential material into shared repo files. Store only redacted summaries, schemas, and stable pointers.
- Keep approval-before-edit and auditability intact. Do not bypass permission prompts, approval flows, or evidence logging.
- If a workflow repeats, factor it into a skill or reusable checklist.
- Prefer clear, practical steps over abstract explanations.

## Axleo Deliverables

The app can preview, edit, and download standard artifacts when you create or update them in the workspace.

- Prefer practical compliance deliverables: Markdown (.md), Word documents (.docx), CSV (.csv), Excel workbooks (.xlsx), PowerPoint decks (.pptx), and browser previews (index.html or a local http://localhost:<port> URL).
- Useful outputs include contract review reports, DPA/privacy reviews, NDA drafts, client terms comments, sales wording reviews, approval notes, FCA disclosure checks, Consumer Duty fair-value statements, complaint-response drafts, vulnerable-customer flags, motor-finance commission redress eligibility notes, advertising compliance checks, evidence logs, and issue trackers.
- For formal drafts and client-facing documents, prefer Word (.docx) plus PDF when the user asks for a shareable final copy.
- After creating or updating an artifact, mention the exact workspace-relative file path in your final response, for example reports/conc-disclosure-check.md or reviews/ad-compliance-check.csv.
- Do not invent Workspace/<id>/... paths unless a tool returns them; prefer clean workspace-relative paths.
- For websites or React/UI previews, start the dev server when useful and mention the http://localhost:<port> URL.
- For spreadsheets, use .csv for simple tabular data and .xlsx when the user asks for Excel/XLS specifically.`;

function withAxleoReferencePermissions(config: Record<string, unknown>): Record<string, unknown> {
  const permission = isRecord(config.permission) ? config.permission : {};
  const externalDirectory = isRecord(permission.external_directory) ? permission.external_directory : {};
  const nextExternalDirectory = {
    ...externalDirectory,

  };
  return {
    ...config,
    permission: {
      ...permission,
      external_directory: nextExternalDirectory,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function buildLegalworkRuntimeConfigObject(
  config?: ServerConfig,
  workspaceId?: string,
): Promise<Record<string, unknown>> {
  // Tool permissions are global (one safety posture across workspaces);
  // the workspace row only contributes external_directory.
  const runtimeConfig = config && workspaceId
    ? applyGlobalToolPermissions(
        await readRuntimeOpencodeConfig(config, workspaceId),
        await readGlobalToolPermissions(config),
      )
    : {};
  const disabledProviders = runtimeDisabledProviderList(runtimeConfig);
  return withAxleoReferencePermissions({
    ...runtimeConfig,
    default_agent: runtimeConfig.default_agent ?? "legalwork",
    agent: {
      ...runtimeAgentMap(runtimeConfig),
      legalwork: {
        description: "Axleo internal legal and compliance assistant",
        mode: "primary",
        temperature: 0.2,
        prompt: LEGALWORK_AGENT_PROMPT,
      },
    },
    plugin: [
      "opencode-chrome-devtools",
      legalworkExtensionsPreviewPluginPath(),
      legalworkCapabilitiesKnowledgePluginPath(),

      legalworkAnthropicAdaptiveThinkingPluginPath(),
      legalworkAnthropicToolSchemaPluginPath(),
      legalworkWordToolsPluginPath(),
      legalworkExcelToolsPluginPath(),
      legalworkPowerPointToolsPluginPath(),
      ...runtimePluginList(runtimeConfig),
    ],
    ...(disabledProviders.length ? { disabled_providers: disabledProviders } : {}),
    mcp: runtimeMcpMap(runtimeConfig),
  });
}

export async function buildLegalworkRuntimeConfig(config?: ServerConfig, workspaceId?: string): Promise<string> {
  return JSON.stringify(await buildLegalworkRuntimeConfigObject(config, workspaceId));
}

export function legalworkRuntimeConfigFilePath(config: ServerConfig): string {
  return join(runtimeStorageDir(config), "runtime-opencode-config.json");
}

// Serialize file writes per path so a slow older write can never land after
// (and clobber) a newer one. Content is built inside the queued job so each
// job reads the latest runtime-DB state.
const fileWriteQueue = new Map<string, Promise<void>>();

/**
 * Rebuild the engine-visible runtime config file from the runtime DB.
 * Atomic (temp file + rename) so the engine never reads a partial file
 * mid-dispose.
 */
export async function writeLegalworkRuntimeConfigFile(config: ServerConfig, workspaceId: string): Promise<string> {
  const path = legalworkRuntimeConfigFilePath(config);
  const job = async () => {
    const content = await buildLegalworkRuntimeConfig(config, workspaceId);
    await mkdir(runtimeStorageDir(config), { recursive: true });
    const tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, content, "utf8");
    await rename(tmp, path);
  };
  const previous = fileWriteQueue.get(path) ?? Promise.resolve();
  const next = previous.then(job, job);
  fileWriteQueue.set(path, next);
  await next;
  return path;
}

/**
 * Keep the runtime config file in sync with the runtime DB so every engine
 * instance rebuild reads fresh state instead of a spawn-time snapshot.
 * Returns an unsubscribe function.
 */
export function keepLegalworkRuntimeConfigFileFresh(config: ServerConfig, workspaceId: string): () => void {
  return onRuntimeOpencodeConfigWrite((writeConfig, writtenWorkspaceId) => {
    // Global tool-permission writes affect every workspace's derived config.
    if (writtenWorkspaceId !== workspaceId && writtenWorkspaceId !== GLOBAL_TOOL_PERMISSIONS_ID) return;
    void writeLegalworkRuntimeConfigFile(writeConfig, workspaceId).catch(() => undefined);
  });
}
