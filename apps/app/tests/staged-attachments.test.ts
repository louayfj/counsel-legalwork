import { describe, expect, test } from "bun:test";

import {
  buildStagedWorkspaceAttachmentContext,
  parseStagedWorkspaceAttachmentContext,
  stagedWorkspaceAttachmentUIParts,
} from "../src/react-app/domains/session/sync/staged-attachments";

const attachment = {
  name: "sample.docx",
  path: ".opencode/legalwork/inbox/sample.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

describe("staged workspace attachments", () => {
  test("round-trips the hidden model context", () => {
    const context = buildStagedWorkspaceAttachmentContext([attachment]);
    expect(parseStagedWorkspaceAttachmentContext(context)).toEqual([attachment]);
  });

  test("renders staged context as a document file part", () => {
    const context = buildStagedWorkspaceAttachmentContext([attachment]);
    const parts = stagedWorkspaceAttachmentUIParts(context, "part-1");
    expect(parts).toHaveLength(1);
    expect(parts?.[0]).toMatchObject({
      type: "file",
      filename: "sample.docx",
      mediaType: attachment.mimeType,
      providerMetadata: {
        opencode: {
          source: { path: attachment.path },
        },
      },
    });
  });

  test("leaves ordinary text untouched", () => {
    expect(stagedWorkspaceAttachmentUIParts("Review this document", "part-1")).toBeNull();
  });

  test("upgrades the previous plain-text attachment format into a file card", () => {
    const legacy = [
      "Attached documents are available inside the active workspace:",
      "- \"sample.docx\": \".opencode/legalwork/inbox/sample.docx\"",
      "Use the appropriate Word, spreadsheet, or PDF tools to inspect these files.",
    ].join("\n");
    expect(parseStagedWorkspaceAttachmentContext(legacy)).toEqual([attachment]);
  });
});
