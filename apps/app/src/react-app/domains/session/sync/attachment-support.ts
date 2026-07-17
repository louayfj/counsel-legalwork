/**
 * Which attachment media types can be sent to the model as file parts.
 *
 * Providers (via opencode + the AI SDK) accept images, PDFs, text, and the
 * Office formats this app knows how to route through LegalWork document tools.
 * Anything else (e.g. Keynote `application/x-iwork-keynote-sffkey`) is rejected by the provider with an UnsupportedFunctionalityError
 * — and because the file part lives in server-side session history, every
 * later message in the session replays the failure. Blocking these at attach
 * time prevents poisoning the session.
 *
 * Empty / `application/octet-stream` types are allowed: browsers report them
 * for plain source/code files, which are sent as `text/plain`.
 */
const OFFICE_MIME_BY_EXTENSION: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const OFFICE_MIMES = new Set(Object.values(OFFICE_MIME_BY_EXTENSION));

function extensionFromName(fileName: string | undefined) {
  const match = fileName?.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function resolveModelReadableAttachmentMime(mimeType: string, fileName?: string) {
  const mime = mimeType.toLowerCase();
  if (OFFICE_MIMES.has(mime)) return mime;
  const officeMime = OFFICE_MIME_BY_EXTENSION[extensionFromName(fileName)];
  if (officeMime) return officeMime;
  if (mime === "" || mime === "application/octet-stream") return "text/plain";
  if (mime.startsWith("image/") || mime.startsWith("text/")) return mime;
  if (mime === "application/pdf" || mime === "application/json") return mime;
  if (mime.endsWith("+json") || mime.endsWith("+xml") || mime === "application/xml" || mime === "application/javascript") return mime;
  return null;
}

export function isModelReadableAttachment(mimeType: string, fileName?: string) {
  return resolveModelReadableAttachmentMime(mimeType, fileName) !== null;
}
