---
name: complaint-response-drafter
description: >-
  Use when drafting or reviewing a UK automotive retail complaint response,
  including motor finance, vehicle quality, data protection, advertising, or
  Consumer Duty complaints.
---

# Complaint-Response Drafter

Use this for UK automotive retail complaint triage and response drafting.

## Required grounding

1. Search Axleo's reference folder for the relevant source: DISP/complaints,
   CONC, PRIN 2A, Consumer Rights Act 2015, UK GDPR/DPA, ASA CAP Code, or PS26/3.
2. Use Legal Data Hunter MCP for current legislation, FCA/ICO/ASA decisions, and
   enforcement examples where needed.
3. Cite every legal/regulatory point and call `axleo_citation_log` before final.

## Workflow

1. Identify complaint type, regulated entity, product, date received, customer
   vulnerability indicators, and deadline/status.
2. Separate facts, customer allegations, evidence available, missing evidence,
   regulatory duties, and proposed outcome.
3. Do not assert a final liability position unless the evidence supports it.
4. For high-risk complaints, recommend human review before sending.

## Output

Return:

- Triage summary and response deadline assumptions.
- Evidence checklist.
- Draft response in a clear customer-facing tone.
- Remediation/redress options where appropriate.
- Internal notes explaining risk and citations.
- Escalation flag if final-response, FOS, regulatory, data breach, redress, or
  vulnerable-customer risk is present.
