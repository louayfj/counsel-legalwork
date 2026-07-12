import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { z } from "zod";

import { resolveAxleoReferenceRoots } from "../axleo-reference.js";

type OpenCodeContext = {
  agent?: string;
  sessionID?: string;
  messageID?: string;
  directory?: string;
  worktree?: string;
};

type SearchHit = {
  source: string;
  locator: string;
  title: string;
  snippet: string;
  score: number;
};

type PdfJs = {
  getDocument: (options: Record<string, unknown>) => { promise: Promise<PdfDocument> };
};

type PdfDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

type PdfPage = {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
};

type PdfTextItem = {
  str?: unknown;
  hasEOL?: unknown;
};

const AXLEO_REFERENCE_INSTRUCTION = `## Axleo legal reference and citation discipline
For Axleo internal legal/compliance answers, use axleo_reference_search before answering when the question turns on Axleo private templates/playbooks, SaaS contracts, DPAs, NDAs, privacy/GDPR/PECR, call recording/transcription, FCA rules, CONC, PRIN 2A Consumer Duty, Consumer Credit Act 1974, Consumer Rights Act 2015, ASA CAP Code, PS26/3, or Axleo reference-folder material.

Every legal or compliance claim must cite a source in the answer. Cite the most specific locator available: rule, section, paragraph, page, ruling, notice, or source-file location. If you cannot find authority, say that and do not invent it.

Before your final response on a legal/compliance answer, call axleo_citation_log with the answer summary, risk level, escalation flag, and the citations you relied on. For real enforcement, liability, redress, regulatory notification, or customer-harm risk, flag human compliance/legal review.`;

const searchArgsSchema = z.object({
  query: z.string().min(2).max(300).describe("Search query for the Axleo legal reference folder."),
  max_results: z.number().int().min(1).max(10).optional().describe("Maximum hits to return. Defaults to 5."),
});

const optionalTextSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}, z.string().optional());

const citationSchema = z.object({
  source: optionalTextSchema.describe("Source name or path, such as CONC.pdf or FCA Handbook PRIN 2A."),
  locator: optionalTextSchema.describe("Specific rule, section, paragraph, page, or file location."),
  claim: optionalTextSchema.describe("Short claim supported by this citation."),
});

const citationLogArgsSchema = z.object({
  answer_summary: optionalTextSchema.describe("Short summary of the cited answer."),
  answerSummary: optionalTextSchema.describe("Short summary of the cited answer."),
  risk_level: optionalTextSchema.describe("Risk level of the answer: low, medium, or high."),
  riskLevel: optionalTextSchema.describe("Risk level of the answer: low, medium, or high."),
  escalation_required: z.boolean().optional().describe("True if human legal/compliance review is recommended."),
  escalationRequired: z.boolean().optional().describe("True if human legal/compliance review is recommended."),
  citations: z.array(z.union([citationSchema, z.string()])).max(30).optional().default([]).describe("Citations relied on in the answer. If none were found, pass an empty array."),
}).passthrough();

type CitationInput = z.infer<typeof citationLogArgsSchema>["citations"][number];

function normalizeRiskLevel(value: string | undefined): "low" | "medium" | "high" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "low" || normalized === "medium" || normalized === "high" ? normalized : "medium";
}

function citationFromInput(input: CitationInput): { source: string; locator?: string; claim?: string } | null {
  if (typeof input === "string") {
    const source = input.trim();
    return source ? { source } : null;
  }
  if (!input.source) return null;
  return {
    source: input.source,
    locator: input.locator,
    claim: input.claim,
  };
}

function normalizeCitationInputs(inputs: CitationInput[]) {
  return inputs.flatMap((input) => {
    const citation = citationFromInput(input);
    return citation ? [citation] : [];
  });
}

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".jsonl",
  ".xml",
  ".html",
  ".htm",
  ".yml",
  ".yaml",
]);

const MAX_FILES = 2_000;
const MAX_TEXT_BYTES = 5_000_000;

function contextPayload(context: OpenCodeContext) {
  return {
    agent: context.agent,
    sessionId: context.sessionID,
    messageId: context.messageID,
    directory: context.directory,
    worktree: context.worktree,
  };
}

function serverUrl(): string {
  return String(process.env.LEGALWORK_SERVER_URL || "").replace(/\/$/, "");
}

function serverToken(): string {
  return String(process.env.LEGALWORK_SERVER_TOKEN || "");
}

function requireLegalWorkServer(): { url: string; token: string } {
  const url = serverUrl();
  const token = serverToken();
  if (!url || !token) {
    throw new Error("Axleo citation logging is only available when OpenCode is launched by LegalWork.");
  }
  return { url, token };
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return { message: text };
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const message = Reflect.get(payload, "message");
  if (typeof message === "string" && message.trim()) return message;
  const code = Reflect.get(payload, "code");
  return typeof code === "string" && code.trim() ? code : fallback;
}

function termsFor(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9.]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function scoreText(text: string, query: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = lower.includes(query.toLowerCase()) ? 8 : 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 1;
  }
  return score;
}

function snippetFor(text: string, query: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const queryIndex = lower.indexOf(query.toLowerCase());
  const termIndex = queryIndex >= 0 ? queryIndex : terms.map((term) => lower.indexOf(term)).find((index) => index >= 0) ?? 0;
  const start = Math.max(0, termIndex - 220);
  const end = Math.min(text.length, termIndex + 520);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function lineLocator(text: string, query: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const queryIndex = lower.indexOf(query.toLowerCase());
  const termIndex = queryIndex >= 0 ? queryIndex : terms.map((term) => lower.indexOf(term)).find((index) => index >= 0) ?? 0;
  const line = text.slice(0, termIndex).split(/\r?\n/).length;
  return `line ${line}`;
}

async function walkFiles(root: string, files: string[] = []): Promise<string[]> {
  if (files.length >= MAX_FILES) return files;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (files.length >= MAX_FILES) break;
    const name = String(entry.name);
    if (name.startsWith(".")) continue;
    const path = join(root, name);
    if (entry.isDirectory()) {
      await walkFiles(path, files);
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function pdfVendorDir(context: OpenCodeContext): string | null {
  const directory = context.directory?.trim();
  if (!directory) return null;
  const vendor = join(directory, ".opencode", "skills", "tabular-review", "assets", "vendor");
  return existsSync(join(vendor, "pdf.min.js")) && existsSync(join(vendor, "pdf.worker.min.js")) ? vendor : null;
}

function loadPdfJs(vendor: string): PdfJs | null {
  const require = createRequire(import.meta.url);
  require(join(vendor, "pdf.min.js"));
  require(join(vendor, "pdf.worker.min.js"));
  const candidate = Reflect.get(globalThis, "pdfjsLib");
  return isPdfJs(candidate) ? candidate : null;
}

function isPdfJs(value: unknown): value is PdfJs {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "getDocument") === "function";
}

async function extractPdfPages(path: string, context: OpenCodeContext): Promise<Array<{ page: number; text: string }>> {
  const vendor = pdfVendorDir(context);
  if (!vendor) return [];
  const pdfjs = loadPdfJs(vendor);
  if (!pdfjs) return [];
  const bytes = await readFile(path);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  try {
    const pages: Array<{ page: number; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => (typeof item.str === "string" ? item.str : "") + (item.hasEOL === true ? "\n" : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      pages.push({ page: pageNumber, text });
    }
    return pages;
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}

async function textHits(path: string, root: string, query: string, terms: string[]): Promise<SearchHit[]> {
  const info = await stat(path).catch(() => null);
  if (!info || info.size > MAX_TEXT_BYTES) return [];
  const text = await readFile(path, "utf8").catch(() => "");
  const score = scoreText(text, query, terms);
  if (score <= 0) return [];
  const source = relative(root, path) || basename(path);
  return [{
    source,
    locator: lineLocator(text, query, terms),
    title: basename(path),
    snippet: snippetFor(text, query, terms),
    score,
  }];
}

async function pdfHits(path: string, root: string, query: string, terms: string[], context: OpenCodeContext): Promise<SearchHit[]> {
  const pages = await extractPdfPages(path, context).catch(() => []);
  const source = relative(root, path) || basename(path);
  return pages.flatMap((page) => {
    const score = scoreText(page.text, query, terms);
    if (score <= 0) return [];
    return [{
      source,
      locator: `page ${page.page}`,
      title: basename(path),
      snippet: snippetFor(page.text, query, terms),
      score,
    }];
  });
}

async function searchReference(query: string, maxResults: number, context: OpenCodeContext) {
  const terms = termsFor(query);
  const roots = resolveAxleoReferenceRoots();
  const hits: SearchHit[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const files = await walkFiles(root);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        hits.push(...await textHits(file, root, query, terms));
      } else if (ext === ".pdf") {
        hits.push(...await pdfHits(file, root, query, terms, context));
      }
    }
  }
  return {
    roots,
    results: hits
      .sort((left, right) => right.score - left.score || left.source.localeCompare(right.source))
      .slice(0, maxResults)
      .map(({ score: _score, ...hit }) => hit),
  };
}

export const LegalWorkAxleoReferenceTools = async () => ({
  "experimental.chat.system.transform": async (_input: unknown, output: { system: string[] }) => {
    output.system.push(AXLEO_REFERENCE_INSTRUCTION);
  },
  tool: {
    axleo_reference_search: {
      description:
        "Search Axleo's standing legal reference folder for UK automotive retail compliance sources. Use before answering FCA Handbook, CONC, PRIN 2A, Consumer Duty, CCA, CRA, GDPR/DPA, ASA CAP Code, or PS26/3 questions.",
      // ponytail: .shape passes Zod v4 internals; OpenCode reads _def.typeName which is undefined in v4 → u.split crash
      args: (searchArgsSchema.toJSONSchema() as { properties?: Record<string, unknown> }).properties ?? {},
      async execute(rawArgs: unknown, context: OpenCodeContext) {
        const args = searchArgsSchema.parse(rawArgs);
        return searchReference(args.query, args.max_results ?? 5, context);
      },
    },
    axleo_citation_log: {
      description:
        "Log citations for a legal/compliance answer into the LegalWork audit trail. Call this before the final response whenever you make Axleo UK automotive retail compliance claims.",
      args: (citationLogArgsSchema.toJSONSchema() as { properties?: Record<string, unknown> }).properties ?? {},
      async execute(rawArgs: unknown, context: OpenCodeContext) {
        const args = citationLogArgsSchema.parse(rawArgs);
        const citations = normalizeCitationInputs(args.citations);
        const warning = citations.length
          ? undefined
          : "No valid citations were provided; logged an uncited compliance answer for audit follow-up.";
        const { url, token } = requireLegalWorkServer();
        const response = await fetch(`${url}/experimental/axleo/citations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answer_summary: args.answer_summary ?? args.answerSummary ?? "Logged compliance answer",
            risk_level: normalizeRiskLevel(args.risk_level ?? args.riskLevel),
            escalation_required: args.escalation_required ?? args.escalationRequired ?? citations.length === 0,
            citations,
            citation_warning: warning,
            context: contextPayload(context),
          }),
        });
        const payload = await parseResponse(response);
        if (!response.ok) throw new Error(errorMessage(payload, "Axleo citation log failed"));
        return warning && typeof payload === "object" && payload !== null ? { ...payload, warning } : payload;
      },
    },
  },
});
