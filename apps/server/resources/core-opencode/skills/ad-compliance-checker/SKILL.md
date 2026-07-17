---
name: ad-compliance-checker
description: >-
  Use when reviewing UK vehicle marketing copy, finance promotions, pricing claims,
  website listings, social posts, or ads against ASA CAP Code and FCA expectations.
---

# Ad Compliance Checker

Use this for UK automotive advertising and finance-promotion review.

## Required grounding

1. Search Axleo's reference folder for `ASA CAP Code`, `vehicle advertising`,
   `finance promotion`, `price claims`, and the claim type.
2. Use Legal Data Hunter MCP for ASA rulings and FCA enforcement examples where helpful.
3. Cite CAP Code rules, ASA rulings, FCA/CONC sources, and exact ad text.
4. Call `axleo_citation_log` before final.

## Workflow

1. Identify the channel, audience, vehicle/product, finance terms, price claims,
   savings claims, availability, emissions/range/fuel claims, and mandatory
   disclaimers.
2. Mark each claim as supported, unsupported, unclear, or high risk.
3. Check prominence and proximity of qualifications.
4. Avoid rewriting into an approved financial promotion unless the evidence supports it.
5. Escalate regulated finance promotions and high-risk misleading claims.

## Output

Return:

- Overall rating: `low risk`, `needs changes`, or `do not publish yet`.
- Claim-by-claim table with citations.
- Suggested safer wording.
- Missing substantiation/disclaimer list.
- Human approval/escalation recommendation.
