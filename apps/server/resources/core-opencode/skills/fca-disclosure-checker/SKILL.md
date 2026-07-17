---
name: fca-disclosure-checker
description: >-
  Use when checking a motor finance agreement, quote, pre-contract pack, sales
  journey, or disclosure wording against FCA CONC disclosure requirements.
---

# FCA Disclosure Checker

Use this for UK automotive retail motor-finance disclosure checks.

## Required grounding

1. Search Axleo's standing reference folder first:
   `axleo_reference_search` for `CONC pre-contract disclosure motor finance`,
   `CONC 4 disclosure`, and any product-specific term the user asks about.
2. Use Legal Data Hunter MCP for live legislation/enforcement precedent where relevant.
3. Every finding must cite a source, preferably a specific CONC rule, FCA document
   paragraph, agreement clause, or file location.
4. Before the final answer, call `axleo_citation_log` with every source relied on.

## Workflow

1. Identify the product and customer journey: hire purchase, PCP, conditional sale,
   personal loan, credit broking, or unknown.
2. Extract the disclosure materials from the user-provided file(s): agreement,
   SECCI/pre-contract information, finance quote, commission disclosure, distance sale
   text, dealer website copy, email/SMS scripts, and handover notes.
3. Build a checklist with columns:
   Requirement, Source rule, Evidence found, Gap/risk, Severity, Fix.
4. Do not invent missing documents. Mark them `Not provided`.
5. Separate document gaps from conduct/process gaps.
6. Flag anything that needs human compliance/legal review before customer use.

## Output

Give a concise compliance table plus:

- `Pass / Gap / Not enough information` overall result.
- Key issues in priority order.
- Exact citations for each legal/regulatory point.
- Practical remediation wording where the source supports it.
- Clear note: compliance support only, not legal advice.
