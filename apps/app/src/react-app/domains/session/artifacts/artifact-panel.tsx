/** @jsxImportSource react */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, ExternalLink, FileText, FolderOpen, X } from "lucide-react";
import { marked } from "marked";

import type { LegalworkServerClient } from "@/app/lib/legalwork-server";
import { getDesktopFileIcon, openDesktopPath, revealDesktopItemInDir } from "@/app/lib/desktop";
import { isElectronRuntime } from "@/app/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatFileSize } from "@/lib/utils";
import type { DocxEditorApi } from "./artifact-docx-editor";
import { type ArtifactPanelTab, usePanelTabStore } from "../panel/panel-tab-store";
import { isCollectibleArtifactTarget, type BinaryData, type Data, type OpenTarget, type TextData } from "./open-target";
import { HTMLPreview, ImagePreview, MarkdownPreview, PdfPreview, PlainText, PreviewError, PreviewLoading, PreviewUnavailable } from "./preview";

const ArtifactTextEditor = lazy(() =>
  import("./artifact-text-editor").then((module) => ({ default: module.ArtifactTextEditor })),
);
const ArtifactSpreadsheetEditor = lazy(() =>
  import("./artifact-spreadsheet-editor").then((module) => ({ default: module.ArtifactSpreadsheetEditor })),
);
const ArtifactDocxEditor = lazy(() =>
  import("./artifact-docx-editor").then((module) => ({ default: module.ArtifactDocxEditor })),
);

const EMPTY_TRANSCRIPT_TARGETS: OpenTarget[] = [];

type ArtifactPanelProps = {
  sessionId: string;
  tab: ArtifactPanelTab;
  client: LegalworkServerClient | null;
  workspaceId: string | null;
  workspaceRoot: string;
  isRemoteWorkspace?: boolean;
  onClose: () => void;
};

type ArtifactPanelViewProps = {
  client: LegalworkServerClient;
  workspaceId: string;
  workspaceRoot: string;
  isRemoteWorkspace?: boolean;
  target: OpenTarget;
  onClose: () => void;
};

type ArtifactQueryState =
  | (TextData & { updatedAt: number | null })
  | (BinaryData & { contentType: string | null; updatedAt: number | null });

type SaveArtifactInput = Data & { baseUpdatedAt: number | null };

function absoluteWorkspacePath(root: string, path: string) {
  const cleanRoot = root.trim().replace(/[/\\]+$/, "");
  const cleanPath = path.trim().replace(/^\.\//, "");
  
  return cleanRoot ? `${cleanRoot}/${cleanPath}` : cleanPath;
}

function isTextContent(target: OpenTarget): boolean {
  return ["markdown", "text", "sheet", "html"].includes(target.preview) && !/\.(xlsx|xls|ods)$/i.test(target.value);
}

type ArtifactDownloadFormat = "original" | "markdown" | "text" | "html" | "pdf";

const TEXT_DOWNLOAD_FORMATS: Array<{ value: ArtifactDownloadFormat; label: string }> = [
  { value: "original", label: "Original file" },
  { value: "markdown", label: "Markdown (.md)" },
  { value: "text", label: "Text (.txt)" },
  { value: "html", label: "HTML (.html)" },
  { value: "pdf", label: "PDF (.pdf)" },
];

function splitFileName(name: string) {
  const lastSlash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const basename = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
  const dot = basename.lastIndexOf(".");
  const stem = dot > 0 ? basename.slice(0, dot) : basename;

  return { stem: stem || "artifact" };
}

function downloadBlob(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?|\n?```/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s-]*[-*+]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]/g, "")
    .trim();
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<pre>${escaped}</pre>`;
}

function artifactHtmlDocument(title: string, body: string) {
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapedTitle}</title>
  <style>
    body { color: #111827; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; margin: 40px; max-width: 820px; }
    pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    h1, h2, h3 { line-height: 1.2; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
    code { background: #f3f4f6; border-radius: 4px; padding: 1px 4px; }
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

function cleanMarkdownInline(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function encodePdfText(value: string) {
  const normalized = value
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "-");

  return normalized.replace(/[\\()]/g, "\\$&").replace(/[^\x09\x0a\x0d\x20-\x7e£]/g, "?");
}

function wrapPdfLine(line: string, maxChars: number) {
  const words = line.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function wrapPdfText(text: string, width: number, fontSize: number) {
  const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.52)));

  return text.split(/\r?\n/).flatMap((line) => wrapPdfLine(line, maxChars));
}

function parseMarkdownTableRow(line: string) {
  const trimmed = line.trim();

  if (!trimmed.includes("|")) {
    return null;
  }

  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = withoutEdges.split("|").map((cell) => cleanMarkdownInline(cell));

  return cells.length > 1 ? cells : null;
}

function isMarkdownTableSeparator(line: string) {
  const row = parseMarkdownTableRow(line);

  return row !== null && row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

type PdfBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "metadata"; rows: Array<{ label: string; value: string }> }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "rule" };

function parseMetadataLine(line: string) {
  const match = /^\*\*([^*]+):\*\*\s*(.+?)\s*$/.exec(line.trim());

  return match ? { label: cleanMarkdownInline(match[1]), value: cleanMarkdownInline(match[2]) } : null;
}

function parseMarkdownBlocks(markdown: string): PdfBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: PdfBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const metadata = parseMetadataLine(trimmed);
    if (metadata) {
      const rows = [metadata];
      index += 1;
      while (index < lines.length) {
        const nextMetadata = parseMetadataLine(lines[index] ?? "");
        if (!nextMetadata) break;
        rows.push(nextMetadata);
        index += 1;
      }
      blocks.push({ kind: "metadata", rows });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [cleanMarkdownInline(trimmed.replace(/^>\s?/, ""))];
      index += 1;
      while (index < lines.length && (lines[index] ?? "").trim().startsWith(">")) {
        quoteLines.push(cleanMarkdownInline((lines[index] ?? "").trim().replace(/^>\s?/, "")));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test((lines[index] ?? "").trim())) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ kind: "paragraph", text: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: cleanMarkdownInline(heading[2]) });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (parseMarkdownTableRow(trimmed) && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      const header = parseMarkdownTableRow(trimmed);
      const rows: string[][] = header ? [header] : [];
      index += 2;
      while (index < lines.length) {
        const row = parseMarkdownTableRow(lines[index] ?? "");
        if (!row) break;
        rows.push(row);
        index += 1;
      }
      blocks.push({ kind: "table", rows });
      continue;
    }

    const listMatch = /^((?:[-*+])|\d+\.)\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items = [cleanMarkdownInline(listMatch[2])];
      index += 1;
      while (index < lines.length) {
        const next = /^((?:[-*+])|\d+\.)\s+(.+)$/.exec((lines[index] ?? "").trim());
        if (!next) break;
        items.push(cleanMarkdownInline(next[2]));
        index += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = (lines[index] ?? "").trim();
      if (!next || /^(#{1,6})\s+/.test(next) || /^((?:[-*+])|\d+\.)\s+/.test(next) || (parseMarkdownTableRow(next) && isMarkdownTableSeparator(lines[index + 1] ?? ""))) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: cleanMarkdownInline(paragraphLines.join(" ")) });
  }

  return blocks;
}

function textToPdf(text: string, title: string, markdown = false) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const topContentY = pageHeight - 82;
  const bottomContentY = 70;
  const contentWidth = pageWidth - margin * 2;
  const pages: string[][] = [[]];
  let y = topContentY;
  const currentPage = () => pages[pages.length - 1];
  type PdfColor = readonly [number, number, number];
  const colors = {
    ink: [0.08, 0.08, 0.08] as const,
    muted: [0.43, 0.43, 0.43] as const,
    border: [0.87, 0.86, 0.84] as const,
    tableHeader: [0.97, 0.96, 0.94] as const,
    tableAlt: [0.99, 0.99, 0.98] as const,
    titleBg: [0.98, 0.97, 0.95] as const,
    panelBg: [0.995, 0.995, 0.99] as const,
    accent: [0.10, 0.22, 0.20] as const,
  } satisfies Record<string, PdfColor>;
  const color = (value: PdfColor) => value.map((part) => part.toFixed(3)).join(" ");

  const addCommand = (command: string) => {
    currentPage().push(command);
  };
  const ensureSpace = (height: number) => {
    if (y - height >= bottomContentY) {
      return;
    }
    pages.push([]);
    y = topContentY;
  };
  const drawTextLine = (line: string, x: number, baseline: number, font: "regular" | "bold", fontSize: number, textColor: PdfColor = colors.ink) => {
    const fontName = font === "bold" ? "F2" : "F1";
    addCommand(`BT ${color(textColor)} rg /${fontName} ${fontSize} Tf ${x} ${baseline} Td (${encodePdfText(line)}) Tj ET`);
  };
  const drawLine = (x1: number, y1: number, x2: number, y2: number, lineColor: PdfColor = colors.border, width = 0.5) => {
    addCommand(`q ${color(lineColor)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  };
  const drawRect = (x: number, rectY: number, width: number, height: number, options: { fill?: PdfColor; stroke?: PdfColor; lineWidth?: number }) => {
    if (options.fill) {
      addCommand(`q ${color(options.fill)} rg ${x} ${rectY} ${width} ${height} re f Q`);
    }
    if (options.stroke) {
      addCommand(`q ${color(options.stroke)} RG ${options.lineWidth ?? 0.5} w ${x} ${rectY} ${width} ${height} re S Q`);
    }
  };
  const addWrappedText = (value: string, options: { x?: number; width?: number; font?: "regular" | "bold"; fontSize?: number; lineHeight?: number; gapAfter?: number; color?: PdfColor }) => {
    const x = options.x ?? margin;
    const width = options.width ?? contentWidth;
    const font = options.font ?? "regular";
    const fontSize = options.fontSize ?? 10.5;
    const lineHeight = options.lineHeight ?? 15;
    const lines = wrapPdfText(value, width, fontSize);

    ensureSpace(lines.length * lineHeight + (options.gapAfter ?? 0));
    for (const line of lines) {
      drawTextLine(line, x, y, font, fontSize, options.color);
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 0;
  };
  const renderTitle = (textValue: string) => {
    const lines = wrapPdfText(textValue, contentWidth - 34, 18);
    const boxHeight = lines.length * 24 + 32;

    ensureSpace(boxHeight + 18);
    drawRect(margin, y - boxHeight, contentWidth, boxHeight, { fill: colors.titleBg, stroke: colors.border });
    drawRect(margin, y - boxHeight, 5, boxHeight, { fill: colors.accent });
    let titleY = y - 27;
    for (const line of lines) {
      drawTextLine(line, margin + 20, titleY, "bold", 18, colors.ink);
      titleY -= 24;
    }
    y -= boxHeight + 18;
  };
  const renderHeading = (block: Extract<PdfBlock, { kind: "heading" }>) => {
    const size = block.level === 1 ? 17 : block.level === 2 ? 13.5 : 11.5;
    const lineHeight = block.level === 1 ? 22 : 17;

    addWrappedText(block.text, { font: "bold", fontSize: size, lineHeight, gapAfter: block.level === 1 ? 10 : 7 });
    if (block.level <= 2) {
      drawLine(margin, y + 2, margin + contentWidth, y + 2, colors.border);
      y -= 6;
    }
  };
  const renderMetadata = (rows: Array<{ label: string; value: string }>) => {
    const fontSize = 9.5;
    const lineHeight = 12.5;
    const labelWidth = 92;
    const valueX = margin + 130;
    const valueWidth = contentWidth - 144;
    const preparedRows = rows.map((row) => {
      const labelLines = wrapPdfText(row.label, labelWidth, fontSize);
      const valueLines = wrapPdfText(row.value, valueWidth, fontSize);
      const rowHeight = Math.max(labelLines.length, valueLines.length) * lineHeight + 5;

      return { labelLines, row, rowHeight, valueLines };
    });
    const boxHeight = preparedRows.reduce((total, row) => total + row.rowHeight, 18);
    ensureSpace(boxHeight + 12);
    drawRect(margin, y - boxHeight, contentWidth, boxHeight, { fill: colors.panelBg, stroke: colors.border });
    let rowY = y - 15;
    for (const prepared of preparedRows) {
      let labelY = rowY;
      for (const line of prepared.labelLines) {
        drawTextLine(line, margin + 14, labelY, "bold", fontSize, colors.muted);
        labelY -= lineHeight;
      }
      let valueY = rowY;
      for (const line of prepared.valueLines) {
        drawTextLine(line, valueX, valueY, "regular", fontSize, colors.ink);
        valueY -= lineHeight;
      }
      rowY -= prepared.rowHeight;
    }
    y -= boxHeight + 14;
  };
  const renderQuote = (value: string) => {
    const lines = wrapPdfText(value, contentWidth - 26, 10);
    const height = lines.length * 14 + 12;
    ensureSpace(height + 10);
    drawRect(margin, y - height, 3, height, { fill: colors.accent });
    let quoteY = y - 12;
    for (const line of lines) {
      drawTextLine(line, margin + 16, quoteY, "regular", 10, colors.muted);
      quoteY -= 14;
    }
    y -= height + 10;
  };
  const renderTable = (rows: string[][]) => {
    if (rows.length === 0) return;
    const columnCount = Math.max(...rows.map((row) => row.length));
    const columnWidths = columnCount === 2
      ? [contentWidth * 0.34, contentWidth * 0.66]
      : Array.from({ length: columnCount }, () => contentWidth / columnCount);
    const cellPadding = 8;
    const fontSize = 8.8;
    const lineHeight = 12.5;
    let currentTableY = y;

    rows.forEach((row, rowIndex) => {
      const cellLines = columnWidths.map((width, columnIndex) =>
        wrapPdfText(row[columnIndex] ?? "", width - cellPadding * 2, fontSize),
      );
      const rowHeight = Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + cellPadding * 2;
      ensureSpace(rowHeight);
      currentTableY = y;
      if (rowIndex === 0) {
        drawRect(margin, currentTableY - rowHeight, contentWidth, rowHeight, { fill: colors.tableHeader });
      } else if (rowIndex % 2 === 0) {
        drawRect(margin, currentTableY - rowHeight, contentWidth, rowHeight, { fill: colors.tableAlt });
      }

      let x = margin;
      columnWidths.forEach((width, columnIndex) => {
        const lines = cellLines[columnIndex] ?? [""];
        const font = rowIndex === 0 || columnIndex === 0 ? "bold" : "regular";
        let textY = currentTableY - cellPadding - fontSize;
        for (const line of lines) {
          drawTextLine(line, x + cellPadding, textY, font, fontSize, rowIndex === 0 ? colors.ink : colors.ink);
          textY -= lineHeight;
        }
        drawRect(x, currentTableY - rowHeight, width, rowHeight, { stroke: colors.border });
        x += width;
      });
      y -= rowHeight;
    });
    drawLine(margin, y, margin + contentWidth, y);
    y -= 18;
  };

  const plainBlocks: PdfBlock[] = [
    { kind: "heading", level: 1, text: cleanMarkdownInline(title) },
    ...text.split(/\n{2,}/).filter(Boolean).map((paragraph): PdfBlock => ({ kind: "paragraph", text: paragraph.trim() })),
  ];
  const blocks: PdfBlock[] = markdown ? parseMarkdownBlocks(text) : plainBlocks;

  let titleRendered = false;
  for (const block of blocks) {
    if (block.kind === "heading") {
      if (!titleRendered && block.level === 1) {
        renderTitle(block.text);
        titleRendered = true;
      } else {
        renderHeading(block);
      }
    } else if (block.kind === "metadata") {
      renderMetadata(block.rows);
    } else if (block.kind === "paragraph") {
      addWrappedText(block.text, { gapAfter: 9 });
    } else if (block.kind === "quote") {
      renderQuote(block.text);
    } else if (block.kind === "list") {
      block.items.forEach((item, index) => {
        const prefix = block.ordered ? `${index + 1}.` : "-";
        addWrappedText(`${prefix} ${item}`, { x: margin + 14, width: contentWidth - 14, gapAfter: 2 });
      });
      y -= 6;
    } else if (block.kind === "table") {
      renderTable(block.rows);
    } else {
      ensureSpace(12);
      drawLine(margin, y, margin + contentWidth, y);
      y -= 12;
    }
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogRef = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesRef = addObject("");
  const fontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageRefs: number[] = [];

  const drawPageChrome = (pageIndex: number) => [
    `q 1 1 1 rg 0 0 ${pageWidth} ${pageHeight} re f Q`,
    `BT ${color(colors.muted)} rg /F2 9 Tf ${margin} ${pageHeight - 36} Td (axleo legal work) Tj ET`,
    `BT ${color(colors.muted)} rg /F1 8.5 Tf ${pageWidth - margin - 66} ${pageHeight - 36} Td (PDF export) Tj ET`,
    `q ${color(colors.accent)} RG 1.2 w ${margin} ${pageHeight - 50} m ${pageWidth - margin} ${pageHeight - 50} l S Q`,
    `q ${color(colors.border)} RG 0.5 w ${margin} 47 m ${pageWidth - margin} 47 l S Q`,
    `BT ${color(colors.muted)} rg /F1 8.5 Tf ${margin} 31 Td (Generated from Axleo canvas) Tj ET`,
    `BT ${color(colors.muted)} rg /F1 8.5 Tf ${pageWidth - margin - 38} 31 Td (Page ${pageIndex + 1}) Tj ET`,
  ];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const stream = [...drawPageChrome(pageIndex), ...pages[pageIndex]].join("\n");
    const contentRef = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageRef = addObject(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRef} 0 R /F2 ${boldFontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`);
    pageRefs.push(pageRef);
  }

  objects[pagesRef - 1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] >>`;

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }

  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const binary = chunks.join("");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index) & 0xff;
  }

  return bytes;
}

export function ArtifactPanel({ sessionId, tab, client, workspaceId, workspaceRoot, isRemoteWorkspace = false, onClose }: ArtifactPanelProps) {
  const transcriptTargets = usePanelTabStore((state) => state.transcriptArtifactTargets[sessionId] ?? EMPTY_TRANSCRIPT_TARGETS);
  const artifactTargets = useMemo(() => transcriptTargets.filter(isCollectibleArtifactTarget), [transcriptTargets]);
  // Tabs opened from the workspace file browser carry their own path, so they
  // stay viewable even when the transcript never mentioned the file.
  const target = artifactTargets.find((item) => item.id === tab.id) ?? (tab.value ? {
    id: tab.id,
    kind: "file",
    value: tab.value,
    name: tab.label,
    preview: tab.preview,
    confidence: 100,
    reason: "workspace file",
    exists: true,
    size: tab.size,
    updatedAt: tab.updatedAt,
  } satisfies OpenTarget : null);

  if (!target || !client || !workspaceId) {
    return null;
  }

  return (
    <ArtifactPanelView
      client={client}
      workspaceId={workspaceId}
      workspaceRoot={workspaceRoot}
      isRemoteWorkspace={isRemoteWorkspace}
      target={target}
      onClose={onClose}
    />
  );
}

function ArtifactPanelView({ client, workspaceId, workspaceRoot, isRemoteWorkspace = false, target, onClose }: ArtifactPanelViewProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  // Markdown renders by default (MarkdownPreview); the "Edit" button toggles to raw source.
  const isDirectTextEdit = false;
  const externalPath = useMemo(() => target.kind === "file" ? absoluteWorkspacePath(workspaceRoot, target.value) : target.value, [target.kind, target.value, workspaceRoot]);

  const { data: fileIcon } = useQuery<string | null>({
    queryKey: ["desktop-file-icon", externalPath] as const,
    queryFn: async () => getDesktopFileIcon(externalPath, "small"),
    enabled: target.kind === "file" && !isRemoteWorkspace && isElectronRuntime(),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const { data, error, isError, isLoading } = useQuery<ArtifactQueryState>({
    queryKey: ["artifact-panel", workspaceId, target.id] as const,
    queryFn: async () => {
      if (target.kind === "url") {
        throw new Error("URLs open in browser tabs.");
      }
      else if (target.exists === false) {
        throw new Error("File not found in this workspace.");
      }

      if (isTextContent(target)) {
        const result = await client.readWorkspaceFile(workspaceId, target.value);
        
        return { kind: "text", data: result.content, updatedAt: result.updatedAt ?? null };
      }

      const result = await client.downloadWorkspaceFile(workspaceId, target.value);

      return { kind: "binary", data: result.data, contentType: result.contentType, updatedAt: target.updatedAt ?? null };
    },
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const [binaryObjectUrl, setBinaryObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data || data.kind !== "binary") {
      setBinaryObjectUrl(null);

      return;
    }

    // Force application/pdf for PDF targets so the browser renders it inline
    // instead of treating an octet-stream blob as a download.
    const blobType = target.preview === "pdf" ? "application/pdf" : data.contentType ?? "application/octet-stream";
    const url = URL.createObjectURL(new Blob([data.data], { type: blobType }));

    setBinaryObjectUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [data, target.preview]);

  // Bridge for sandboxed HTML artifacts (e.g. the tabular-review PDF viewer): the iframe
  // cannot read local files, so it postMessages a request and we return the bytes.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const request = event.data as { type?: unknown; path?: unknown; id?: unknown } | null;
      if (!request || request.type !== "legalwork:pdf-request" || typeof request.path !== "string") {
        return;
      }
      const source = event.source as Window | null;
      if (!source) {
        return;
      }
      const path = request.path;
      const id = typeof request.id === "string" ? request.id : path;
      void (async () => {
        try {
          const result = await client.downloadWorkspaceFile(workspaceId, path);
          source.postMessage(
            { type: "legalwork:pdf-response", id, path, ok: true, contentType: result.contentType, data: result.data },
            "*",
          );
        } catch (cause) {
          source.postMessage(
            { type: "legalwork:pdf-response", id, path, ok: false, error: cause instanceof Error ? cause.message : "Failed to load file" },
            "*",
          );
        }
      })();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [client, workspaceId]);

  useEffect(() => {
    setEditing(false);
    setDraft("");
    setDownloadMenuOpen(false);
  }, [target.id, workspaceId]);

  useEffect(() => {
    if (data?.kind === "text") {
      setDraft(data.data);
    }
  }, [data]);

  const { mutate, mutateAsync, isPending: isSaving } = useMutation({
    mutationFn: async (input: SaveArtifactInput) => {
      if (target.kind !== "file") {
        throw new Error("Cannot save non-file artifact.");
      }

      if (input.kind === "text") {
        return client.writeWorkspaceFile(workspaceId, { path: target.value, content: input.data, baseUpdatedAt: input.baseUpdatedAt });
      }

      return client.writeWorkspaceBinaryFile(workspaceId, { path: target.value, data: input.data, baseUpdatedAt: input.baseUpdatedAt });
    },
    onSuccess: (result, input) => {
      queryClient.setQueryData<ArtifactQueryState>(
        ["artifact-panel", workspaceId, target.id] as const,
        input.kind === "text"
          ? { kind: "text", data: input.data, updatedAt: result.updatedAt ?? null }
          : { kind: "binary", data: input.data, contentType: data?.kind === "binary" ? data.contentType : null, updatedAt: result.updatedAt ?? null },
      );

      if (input.kind === "text") {
        setDraft(input.data);
      }
    },
  });

  const download = async () => {
    if (target.kind === "url") {
      return;
    }
    
    const result = await client.downloadWorkspaceFile(workspaceId, target.value);
    downloadBlob(result.data, target.name, result.contentType ?? "application/octet-stream");
  };

  const downloadTextArtifact = async (format: ArtifactDownloadFormat) => {
    if (target.kind !== "file" || data?.kind !== "text") {
      return;
    }

    if (format === "original") {
      await download();

      return;
    }

    const content = editing ? draft : data.data;
    const { stem } = splitFileName(target.name);

    if (format === "markdown") {
      downloadBlob(content, `${stem}.md`, "text/markdown;charset=utf-8");

      return;
    }

    if (format === "text") {
      downloadBlob(target.preview === "markdown" ? markdownToPlainText(content) : content, `${stem}.txt`, "text/plain;charset=utf-8");

      return;
    }

    if (format === "html") {
      const body = target.preview === "markdown" ? marked.parse(content, { async: false }) : textToHtml(content);
      downloadBlob(artifactHtmlDocument(target.name, body), `${stem}.html`, "text/html;charset=utf-8");

      return;
    }

    downloadBlob(textToPdf(content, target.name, target.preview === "markdown"), `${stem}.pdf`, "application/pdf");
  };

  const openExternal = async () => {
    if (target.kind === "url") {
      window.open(target.value, "_blank", "noopener,noreferrer");

      return;
    }
    else if (!isRemoteWorkspace) {
      void openDesktopPath(externalPath);

      return;
    }

    await download();
  };

  const revealExternal = async () => {
    if (target.kind !== "file" || isRemoteWorkspace) return;
    await revealDesktopItemInDir(externalPath);
  };

  const save = () => {
    if (target.kind !== "file" || !isTextContent(target) || data?.kind !== "text") {
      return;
    }

    mutate(
      {
        kind: "text",
        data: draft,
        baseUpdatedAt: data.updatedAt,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const saveSpreadsheetContent = async (payload: Data) => {
    if (target.kind !== "file") {
      return;
    }

    await mutateAsync({
      ...payload,
      baseUpdatedAt: data?.kind === payload.kind ? data.updatedAt : target.updatedAt ?? null,
    });
  };

  const saveDocxContent = async (buffer: ArrayBuffer) => {
    if (target.kind !== "file") {
      return;
    }

    await mutateAsync({
      kind: "binary",
      data: buffer,
      baseUpdatedAt: data?.kind === "binary" ? data.updatedAt : target.updatedAt ?? null,
    });
  };

  const docxApi = useRef<DocxEditorApi | null>(null);
  const [docxSaving, setDocxSaving] = useState(false);
  const saveDocx = async () => {
    setDocxSaving(true);
    try {
      const ok = await docxApi.current?.save();
      if (ok) toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save document.");
    } finally {
      setDocxSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-background mac:bg-background/80 mac:backdrop-blur-2xl mac:backdrop-saturate-150">
        <div className="flex h-10 items-center gap-2 pe-2 ps-4">
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            {fileIcon ? (
              <img src={fileIcon} alt="" className="h-4 w-4 shrink-0 object-contain" />
            ) : null}
            <h3 className="text-sm font-medium text-foreground">
              <span className="truncate">{target.name}</span>
            </h3>
            <span className="truncate text-xs text-muted-foreground">
              {target.exists === false ? "missing" : target.size !== undefined ? `${formatFileSize(target.size)}` : ""}
            </span>
          </div>
          {isTextContent(target) && data?.kind === "text" ? (
            editing || isDirectTextEdit ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={(
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (data?.kind === "text") {
                            setDraft(data.data);
                          }
                          setEditing(false);
                        }}
                        disabled={isSaving}
                      >
                        Discard
                      </Button>
                    )}
                  />
                  <TooltipContent>Discard changes</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(
                      <Button variant="default" size="sm" onClick={() => void save()} disabled={isSaving || draft === data.data}>{isSaving ? "Saving" : "Save"}</Button>
                    )}
                  />
                  <TooltipContent>Save changes</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                  )}
                />
                <TooltipContent>Edit artifact</TooltipContent>
              </Tooltip>
            )
          ) : null}
          {target.preview === "word" && data?.kind === "binary" && target.kind === "file" && !isRemoteWorkspace ? (
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button variant="default" size="sm" onClick={() => void saveDocx()} disabled={docxSaving || isSaving}>
                    {docxSaving || isSaving ? "Saving" : "Save"}
                  </Button>
                )}
              />
              <TooltipContent>Save changes to the document</TooltipContent>
            </Tooltip>
          ) : null}
          {target.kind === "file" && data?.kind === "text" ? (
            <div className="relative flex items-center">
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDownloadMenuOpen(false);
                        void download();
                      }}
                      aria-label="Download original artifact"
                    >
                      <Download />
                    </Button>
                  )}
                />
                <TooltipContent>Download original file</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDownloadMenuOpen((open) => !open);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={downloadMenuOpen}
                      aria-label="Choose download format"
                    >
                      <ChevronDown />
                    </Button>
                  )}
                />
                <TooltipContent>Choose download format</TooltipContent>
              </Tooltip>
              {downloadMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                >
                  <div className="px-3 py-2 text-xs text-muted-foreground">Download as</div>
                  {TEXT_DOWNLOAD_FORMATS.map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      role="menuitem"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        "[&_svg]:size-4 [&_svg]:shrink-0",
                      )}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDownloadMenuOpen(false);
                        void downloadTextArtifact(format.value);
                      }}
                    >
                      <FileText />
                      {format.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : target.kind === "file" ? (
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button variant="ghost" size="icon-sm" onClick={() => void download()} aria-label="Download artifact">
                    <Download />
                  </Button>
                )}
              />
              <TooltipContent>Download artifact</TooltipContent>
            </Tooltip>
          ) : null}
          {target.kind === "file" && !isRemoteWorkspace ? (
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button variant="ghost" size="icon-sm" onClick={() => void revealExternal()} aria-label="Show in folder">
                    <FolderOpen />
                  </Button>
                )}
              />
              <TooltipContent>Show in folder</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={(
                <Button variant="ghost" size="icon-sm" onClick={() => void openExternal()} aria-label={isRemoteWorkspace ? "Download artifact" : "Open externally"}>
                  <ExternalLink />
                </Button>
              )}
            />
            <TooltipContent>{isRemoteWorkspace ? "Download artifact" : "Open externally"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={(
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close artifact">
                  <X />
                </Button>
              )}
            />
            <TooltipContent>Close artifact</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {isLoading || (data?.kind === "binary" && !binaryObjectUrl) ? (
          <PreviewLoading />
        ) : isError ? (
          <PreviewError message={error instanceof Error ? error.message : "Failed to load artifact" } />
        ) : data?.kind === "text" && (editing || isDirectTextEdit) ? (
          <TextEditor value={draft} language={target.preview === "markdown" ? "markdown" : "text"} onChange={setDraft} />
        ) : target.preview === "markdown" && data?.kind === "text" ? (
          <MarkdownPreview content={data.data} />
        ) : target.preview === "sheet" ? (
          <SheetEditor
            name={target.name}
            content={data ?? { kind: "binary", data: new ArrayBuffer(0) }}
            saving={isSaving}
            onSave={saveSpreadsheetContent}
          />
        ) : target.preview === "word" && data?.kind === "binary" ? (
          <DocxView
            key={target.id}
            name={target.name}
            content={data.data}
            readOnly={isRemoteWorkspace || target.kind !== "file"}
            onSave={saveDocxContent}
            apiRef={docxApi}
          />
        ) : target.preview === "html" && data?.kind === "text" ? (
          <HTMLPreview type="text" title={target.name} content={data.data} />
        ) : target.preview === "image" && data?.kind === "binary" && binaryObjectUrl ? (
          <ImagePreview src={binaryObjectUrl} alt={target.name} />
        ) : target.preview === "pdf" && data?.kind === "binary" && binaryObjectUrl ? (
          <PdfPreview url={binaryObjectUrl} title={target.name} />
        ) : data?.kind === "binary" && binaryObjectUrl && target.preview === "html" ? (
          <HTMLPreview type="binary" title={target.name} url={binaryObjectUrl} />
        ) : data?.kind === "text" ? (
          <PlainText content={data.data} />
        ) : (
          <PreviewUnavailable />
        )}
      </div>
    </div>
  );
}

interface TextEditorProps extends React.ComponentProps<typeof ArtifactTextEditor> {
  value: string;
  language: "markdown" | "text";
  onChange: (value: string) => void;
}

function TextEditor({ value, language, onChange, ...props }: TextEditorProps) {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <ArtifactTextEditor value={value} language={language} onChange={onChange} {...props} />
    </Suspense>
  );
}

interface SheetEditorProps extends React.ComponentProps<typeof ArtifactSpreadsheetEditor> {
  
}

function SheetEditor({ className, ...props }: SheetEditorProps) {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <ArtifactSpreadsheetEditor
        className={className}
        {...props}
      />
    </Suspense>
  );
}

function DocxView(props: React.ComponentProps<typeof ArtifactDocxEditor>) {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <ArtifactDocxEditor {...props} />
    </Suspense>
  );
}
