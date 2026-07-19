---
name: tabular-review
description: >-
  UK automotive tabular compliance document review. Extract a defined set of fields (columns) across a set of documents
  (rows) and produce an interactive, source-cited review table. Use whenever the user
  wants to review/compare/extract across MANY documents at once: FCA disclosure checks,
  complaint packs, ad substantiation, vulnerable-customer reviews, "make a table of X
  across these files", "build a compliance review grid", or "extract these fields from
  every document".
---

# Tabular Review

This skill is how Counsel runs **tabular compliance document review**: documents are **rows**, the fields you care about are
**columns**, and every cell is an independent, source-cited extraction. Unlike the
generic document-review SaaS, this runs on the user's chosen models and local infrastructure, the column logic
lives in organisation-owned **doctype skills**, and the output is a self-contained artifact the organisation keeps.

You are the **orchestrator**. You do not read the documents yourself. You define the
grid, fan out one `document-extractor` subagent per document, then assemble the results
into one HTML artifact.

## The shape of the job

```
                 CONC issue   Disclosure gap   Evidence   Risk ...   ← columns (fields)
  finance-a.pdf   [cell]      [cell]           [cell]     [cell]
  complaint-b.pdf [cell]      [cell]           [cell]     [cell]      ← rows (documents)
  ...
```

Each cell = a short `value` (what shows in the grid) plus, behind a click, a longer
`reason`, one verbatim `quote` sentence, and the cited PDF `page` rendered with that
sentence highlighted. Every value is grounded in a quote from that document or it is
"Not found". No hallucinated cells.

---

## Workflow

### 1. Resolve the document set (rows)

Find the files to review. They may be attached, referenced by `@path`, named in the
prompt, or sitting in a folder ("review the finance disclosures in `./finance-packs`"). Use `glob`/`list` to
expand folders. Confirm the list with the user if it's ambiguous or large (>~20).

Sniff the **document type** of each file (from filename and, if cheap, a first-page
peek). You'll use this both to pick columns and to tell each extractor what it's looking
at. A set can be mixed (some agreements, complaints, adverts, and disclosures) — that's fine; group by type.

### 2. Resolve the columns (fields) — THIS IS THE BRANCH POINT

Columns can come from three places, in priority order:

1. **The user already specified them.** ("Extract disclosure gaps, relevant CONC rules,
   evidence, and risk rating.") Use those verbatim; only add a column if you ask first.
2. **A loaded doctype skill.** Look for a skill named `doctype-<type>` (e.g.
   `doctype-finance-disclosure`, `doctype-complaint-pack`). If one matches the documents, **load it
   with the `skill` tool** and use its recommended columns as the default set. List
   available skills first if unsure what exists.
3. **Neither → ASK THE USER. Do not invent a column set silently.** Detect the doc
   types, then ask what to extract and **propose a starter set based on those types**,
   using the suggestion library below. Make it a one-tap decision: offer the suggested
   columns and let them add/remove. Example:

   > These look like **motor finance disclosure packs**. What should I pull into the
   > review table? A common starting set: **Product type · Lender · Dealer/broker role ·
   > Pre-contract disclosure present · Commission disclosure · APR/total payable ·
   > Customer signature/date · Missing evidence · Risk rating**. Want this set, a subset, or your own
   > columns?

   If the documents are mixed types, suggest the union and note which columns apply to
   which type.

Normalize the final columns into objects you'll pass down and render:
`{ key, label, question, hint? }` — `key` is a short slug (`governing_law`), `label` is
the header (`Governing law`), `question` is the precise instruction the extractor
answers, `hint` is optional (format/where to look).

### 3. Fan out — one subagent per document, in parallel

For each document, spawn the **`document-extractor`** subagent with the **Task tool**.
Issue the calls **in parallel** (multiple Task calls in a single turn) so the grid fills
concurrently — this is the whole point of the fan-out.

Default granularity is **one extractor per file**: it reads the document once and fills
that file's entire row across all columns. (This is cheaper and more consistent than one
subagent per cell, because the document is read a single time.) **Escalate to a
per-cell extractor** only for a column that is high-stakes and came back `low`
confidence or conflicted — re-run just that (file, column) pair with a focused prompt.

Give each extractor exactly this:

```
FILE: <path to the one document>
DOC_TYPE: <Finance Agreement | Complaint Record | Advertisement | ... | unknown>
COLUMNS:
  1. key: parties
     question: Who are the parties to this agreement (full legal names)?
     hint: Check the preamble and signature block.
  2. key: governing_law
     question: Which jurisdiction's law governs?
  ... (every column, with key + question, hints where useful)

Return ONLY the strict JSON object defined in your instructions.
```

Each extractor returns a JSON object: `{ file, title, docType, summary, cells: [ {key,
value, reason, quote, page, location, confidence} ] }`. Remember: `value` is short (it's
a table cell), `reason` is the longer sidebar explanation, `quote` is one verbatim
sentence, and `page` is the 1-based page that sentence is on.

### 4. Collect and assemble the data file

Parse each extractor's JSON (read the last ```json block). If one fails to parse or the
subagent errored, keep the row with that file's cells set to `value: "Error"`,
`confidence: "low"` — never drop a document silently; the grid must account for every
file. Convert each extractor's `cells` array into a map keyed by `key`.

Write a data file `<matter-slug>-review.data.json` in the workspace with this shape.
Give each row BOTH paths so the viewer works in the app and when opened from disk:
- **`file`** — the **workspace-relative** path (e.g. `ndas/acme.pdf`). The in-app viewer
  asks the app for this file over the bridge, so it must be workspace-relative.
- **`fileAbs`** — the **absolute** path on disk (e.g. `/Users/.../ndas/acme.pdf`). Used
  for the "open the PDF at this page" link when the saved `.html` is opened standalone.

```json
{
  "matter": "<short matter/review name>",
  "generatedAt": "<current ISO 8601 timestamp>",
  "columns": [ { "key": "...", "label": "...", "question": "..." } ],
  "rows": [
    {
      "file": "ndas/acme.pdf", "fileAbs": "/abs/path/to/ndas/acme.pdf",
      "title": "...", "docType": "...", "summary": "...",
      "cells": {
        "<key>": { "value": "<short>", "reason": "<longer>", "quote": "<one sentence>", "page": 3, "location": "§7.2", "confidence": "high" }
      }
    }
  ]
}
```

### 5. Build the artifact (run the builder — do NOT hand-write the HTML)

Run the bundled builder. It injects a pdf.js viewer + the Eigenwelt theme + your JSON and
writes a `.html` artifact. **No PDF is embedded** — the artifact loads each source PDF
dynamically from its local file at view time and highlights the `quote` string on the
cited `page`. So the artifact is a small, fixed size no matter how many or how large the
source documents are.

```bash
node .opencode/skills/tabular-review/assets/build-review.mjs "<matter-slug>-review.data.json" --out "<matter-slug>-review.html"
```

(If your CWD is the skill dir, adjust the path; the builder also accepts `--template` and
`--vendor` overrides.) The builder is deterministic — you just produce good JSON.

Writing the `.html` makes the app surface it automatically as a previewable HTML artifact
(sandboxed iframe, scripts enabled): the grid shows the short `value` per cell; clicking a
cell opens a liquid-glass sidebar with the `reason`, the verbatim `quote`, and a **pdf.js
viewer** that opens the source PDF to the cited page with the sentence highlighted (with
page navigation). Filter and CSV export are built in.

How the viewer reads the local PDF (no embedding):
- **In the app**: the viewer asks the app for the file bytes over a postMessage bridge
  using `row.file` (workspace-relative), and renders + highlights inline.
- **Opened standalone from disk (`file://`)**: browsers block pages from auto-loading
  local files, so the viewer shows an **Open page N in the PDF** link (built from
  `row.fileAbs`) that opens it in the native viewer, plus a file picker to load it into
  the highlighting viewer. This is why `fileAbs` matters — without it that link is dead.
- No poppler or other system tools are required — pdf.js renders in the browser.

### 6. Summarize in chat

After building the artifact, give a short readout: how many documents × columns, the name
of the artifact file, and — most useful to a lawyer — the **exceptions**: cells that came
back `low` confidence, conflicts, "Not found" where you'd expect a value, and any
`reason` worth surfacing (auto-renewals, unusual carve-outs, missing signatures). The
table is for scanning; your summary is for triage.

---

## Column suggestion library (used in step 2.3 when no doctype skill is loaded)

Starter columns by document type. Offer these as the proposed set, then let the user
edit. Prefer a loaded `doctype-*` skill over this list when one exists.

- **Motor finance disclosure pack** — Product type · Lender · Dealer/broker role ·
  Pre-contract disclosure present · Commission disclosure · APR/total payable ·
  Customer signature/date · Missing evidence · Risk rating.
- **Complaint pack** — Customer issue · Product · Date received · Vulnerability flags ·
  Evidence available · Missing evidence · Proposed outcome · Deadline/risk.
- **Advert / marketing copy** — Channel · Vehicle/product · Price claim · Finance claim ·
  Qualification/disclaimer · Substantiation · CAP/FCA risk · Safer wording.
- **Consumer Duty / fair value** — Product/service · Target market · Price/fees ·
  Customer benefit · MI evidence · Foreseeable harm · Vulnerable-customer impact · Gaps.
- **Motor finance commission/redress** — Agreement date · Lender · Dealer/broker ·
  Commission evidence · DCA indicator · Complaint status · Missing evidence · Scope view.
- **Unknown / mixed** — Document type · Customer/product · Key issue · Evidence found ·
  Missing evidence · Relevant rule/source · Notable risks. (Then refine with the user.)

---

## The doctype-skill convention

A **doctype skill** is a normal skill named `doctype-<type>` whose job is to define the
review columns (and where to look) for one kind of document. When an organisation reviews a new
document type often, capture its column logic as a `doctype-*` skill so this orchestrator
can load it automatically instead of asking every time. Each one should provide a
`## Columns` section: a list of `key`, `label`, `question`, and a `where to look` hint.
Example packs (`doctype-finance-disclosure`, `doctype-complaint-pack`, …) live in the **LegalWork
Hub** — the organisation installs the ones it needs from Settings → Extensions → Skills. If none
is installed, the suggestion library above is the fallback.

## Notes & guardrails

- **Open models, organisation-owned logic.** Don't hardcode a model — extractors inherit the
  configured model. The value here is that the column logic and corrections stay in
  organisation's skills and artifacts.
- **Never fabricate a cell.** A blank, source-cited grid beats a confident wrong one.
  This is the one bar that matters; everything else is convenience.
- **Account for every file.** Each input document is exactly one row, even on error.
- **Scale check.** Many files × parallel subagents is fine, but if the set is very large
  (say >30), confirm scope with the user and consider batching.
