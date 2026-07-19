import { delimiter } from "node:path";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLED_REFERENCE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "resources", "axleo-legal-reference");

export const ORGANISATION_REFERENCE_ENV_KEYS = [
  "LEGALWORK_ORGANISATION_REFERENCE_DIR",
  "AXLEO_LEGAL_REFERENCE_DIR",
  "LEGALWORK_AXLEO_REFERENCE_DIR",
];

function splitEnvPaths(value: string | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  return trimmed
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function uniqueResolved(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of paths) {
    const resolved = resolve(expandHome(item));
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}

export function resolveOrganisationReferenceRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = ORGANISATION_REFERENCE_ENV_KEYS.flatMap((key) => splitEnvPaths(env[key]));
  return uniqueResolved([
    ...configured,
    BUNDLED_REFERENCE_DIR,
  ]);
}

export function organisationReferenceExternalDirectoryEntries(env: NodeJS.ProcessEnv = process.env): Record<string, "allow"> {
  return Object.fromEntries(resolveOrganisationReferenceRoots(env).map((root) => [`${root}/*`, "allow"]));
}

// Compatibility exports for integrations compiled against the earlier Axleo-only names.
export const AXLEO_REFERENCE_ENV_KEYS = ORGANISATION_REFERENCE_ENV_KEYS;
export const resolveAxleoReferenceRoots = resolveOrganisationReferenceRoots;
export const axleoReferenceExternalDirectoryEntries = organisationReferenceExternalDirectoryEntries;
