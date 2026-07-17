---
name: motor-finance-redress-checker
description: >-
  Use when checking motor-finance commission, discretionary commission arrangement
  (DCA), or PS26/3 redress eligibility and evidence requirements.
---

# Motor Finance Commission Redress Checker

Use this for motor-finance commission/DCA redress triage.

## Required grounding

1. Search Axleo's reference folder for `PS26/3`, `motor finance commission`,
   `DCA`, `redress scheme`, and the agreement/product terms.
2. Use Legal Data Hunter MCP for FCA final notices, related legislation, and
   current enforcement context where relevant.
3. Cite exact PS26/3 paragraphs/rules, agreement clauses, dates, and evidence.
4. Call `axleo_citation_log` before final.

## Workflow

1. Establish product, lender/broker/dealer, agreement date, commission model,
   customer status, complaint status, and available documents.
2. Identify whether there is evidence of DCA or relevant commission practice.
3. Separate eligibility, evidence gaps, limitation/time issues, potential redress,
   and operational next steps.
4. Do not promise compensation. Give a grounded triage view.
5. High-risk or live customer-facing determinations require human review.

## Output

Return:

- Eligibility view: `likely in scope`, `possibly in scope`, `unlikely on current evidence`,
  or `not enough information`.
- Evidence table with citations.
- Missing documents/questions.
- Redress/process risk notes.
- Customer/dealer next-step checklist.
