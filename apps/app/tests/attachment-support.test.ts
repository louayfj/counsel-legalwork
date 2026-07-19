import { describe, expect, test } from "bun:test";

import {
  resolveModelReadableAttachmentMime,
  shouldStageAttachmentInWorkspace,
} from "../src/react-app/domains/session/sync/attachment-support";

describe("attachment support", () => {
  test.each([
    ["application/pdf", "contract.pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "contract.docx"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "figures.xlsx"],
    ["", "legacy.doc"],
    ["application/octet-stream", "legacy.xls"],
  ])("stages workspace document %s (%s)", (mimeType, fileName) => {
    expect(shouldStageAttachmentInWorkspace(mimeType, fileName)).toBe(true);
  });

  test.each([
    ["image/png", "scan.png"],
    ["text/plain", "notes.txt"],
    ["application/json", "data.json"],
  ])("keeps provider-readable attachment %s (%s) direct", (mimeType, fileName) => {
    expect(shouldStageAttachmentInWorkspace(mimeType, fileName)).toBe(false);
    expect(resolveModelReadableAttachmentMime(mimeType, fileName)).toBe(mimeType);
  });
});
