import type { ServerConfig } from "./types.js";
import { readLegalworkWorkspaceConfig } from "./legalwork-workspace-config-store.js";

export const ORGANISATION_PROFILE_MODES = [
  "dealership",
  "dealer-group",
  "axleo-internal",
] as const;

export type OrganisationProfileMode = (typeof ORGANISATION_PROFILE_MODES)[number];

export type OrganisationProfile = {
  name: string;
  mode: OrganisationProfileMode;
  description: string;
  approvalLabel: string;
  instructions: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function organisationMode(value: unknown): OrganisationProfileMode {
  return ORGANISATION_PROFILE_MODES.find((mode) => mode === value) ?? "dealership";
}

function defaultDescription(mode: OrganisationProfileMode): string {
  switch (mode) {
    case "dealer-group":
      return "a UK motor dealer group operating across multiple dealerships";
    case "axleo-internal":
      return "Axleo Systems, a UK SaaS company building AI call intelligence and connected workflow products for UK motor dealerships";
    default:
      return "a UK motor dealership";
  }
}

export function normalizeOrganisationProfile(
  value: unknown,
  fallbackName = "your organisation",
): OrganisationProfile {
  const record = isRecord(value) ? value : {};
  const name = optionalText(record.name) || fallbackName.trim() || "your organisation";
  const mode = organisationMode(record.mode);
  return {
    name,
    mode,
    description: optionalText(record.description) || defaultDescription(mode),
    approvalLabel: optionalText(record.approvalLabel) || (name === "your organisation"
      ? "organisation approval"
      : `${name} approval`),
    instructions: optionalText(record.instructions),
  };
}

export async function resolveOrganisationProfile(
  config?: ServerConfig,
  workspaceId?: string,
): Promise<OrganisationProfile> {
  if (!config || !workspaceId) return normalizeOrganisationProfile(undefined);
  const workspace = config.workspaces.find((item) => item.id === workspaceId);
  const stored = await readLegalworkWorkspaceConfig(config, workspaceId);
  return normalizeOrganisationProfile(stored.organisation, workspace?.name || "your organisation");
}

export function organisationProfilePrompt(profile: OrganisationProfile): string {
  const internalContext = profile.mode === "axleo-internal"
    ? `This workspace is for Axleo internal legal operations. Support SaaS client contracts, order forms, terms, DPAs, NDAs, supplier and partnership agreements, privacy notices, sales wording, procurement/security questionnaires, and internal approval notes.`
    : `This workspace is for ${profile.mode === "dealer-group" ? "dealer-group" : "dealership"} compliance and legal operations. Apply the organisation's own policies, commercial positions, and escalation rules when they are supplied.`;
  const additionalInstructions = profile.instructions
    ? `\n\n## Organisation-specific instructions\n\n${profile.instructions}`
    : "";

  return `## Organisation profile

- Organisation: ${profile.name}
- Operating context: ${profile.description}
- Profile mode: ${profile.mode}
- Approval label: ${profile.approvalLabel}

${internalContext}

Treat this profile as operating context, not as evidence for a legal or compliance claim. Never assume another organisation's policies, templates, folders, or commercial positions apply here.${additionalInstructions}`;
}
