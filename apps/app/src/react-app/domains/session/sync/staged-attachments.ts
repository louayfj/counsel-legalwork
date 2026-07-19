import type { UIMessage } from "ai";
import { resolveModelReadableAttachmentMime } from "./attachment-support";

const WORKSPACE_ATTACHMENTS_PREFIX = "[[legalwork-workspace-attachments:v1]]";
const LEGACY_WORKSPACE_ATTACHMENTS_PREFIX = "Attached documents are available inside the active workspace:\n";

export type StagedWorkspaceAttachment = {
  name: string;
  path: string;
  mimeType: string;
};

export function buildStagedWorkspaceAttachmentContext(items: StagedWorkspaceAttachment[]) {
  return [
    WORKSPACE_ATTACHMENTS_PREFIX,
    JSON.stringify(items),
    "The attached documents are available at these workspace paths. Use the appropriate Word, spreadsheet, or PDF tools to inspect them; do not treat their binary contents as plain text.",
  ].join("\n");
}

export function parseStagedWorkspaceAttachmentContext(text: string): StagedWorkspaceAttachment[] | null {
  const prefix = `${WORKSPACE_ATTACHMENTS_PREFIX}\n`;
  if (!text.startsWith(prefix)) return parseLegacyStagedWorkspaceAttachmentContext(text);
  const payloadStart = prefix.length;
  const payloadEnd = text.indexOf("\n", payloadStart);
  const payload = text.slice(payloadStart, payloadEnd === -1 ? undefined : payloadEnd);

  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const name = Reflect.get(item, "name");
      const path = Reflect.get(item, "path");
      const mimeType = Reflect.get(item, "mimeType");
      if (typeof name !== "string" || !name.trim()) return [];
      if (typeof path !== "string" || !path.trim()) return [];
      if (typeof mimeType !== "string" || !mimeType.trim()) return [];
      return [{ name: name.trim(), path: path.trim(), mimeType: mimeType.trim() }];
    });
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function parseLegacyStagedWorkspaceAttachmentContext(text: string): StagedWorkspaceAttachment[] | null {
  if (!text.startsWith(LEGACY_WORKSPACE_ATTACHMENTS_PREFIX)) return null;
  const items = text.slice(LEGACY_WORKSPACE_ATTACHMENTS_PREFIX.length).split("\n").flatMap((line) => {
    const match = line.match(/^- (".*"): (".*")$/);
    if (!match?.[1] || !match[2]) return [];
    try {
      const name: unknown = JSON.parse(match[1]);
      const path: unknown = JSON.parse(match[2]);
      if (typeof name !== "string" || typeof path !== "string") return [];
      const mimeType = resolveModelReadableAttachmentMime("", name) ?? "application/octet-stream";
      return [{ name, path, mimeType }];
    } catch {
      return [];
    }
  });
  return items.length > 0 ? items : null;
}

export function stagedWorkspaceAttachmentUIParts(
  text: string,
  sourcePartId: string,
): UIMessage["parts"] | null {
  const items = parseStagedWorkspaceAttachmentContext(text);
  if (!items) return null;
  return items.map((item, index) => ({
    type: "file",
    url: `workspace-file://${encodeURIComponent(item.path)}`,
    filename: item.name,
    mediaType: item.mimeType,
    providerMetadata: {
      opencode: {
        partId: `${sourcePartId}:workspace-attachment:${index}`,
        source: { type: "file", path: item.path },
      },
    },
  }));
}
