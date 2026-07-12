---
name: axleo-contract-reviewer
description: >-
  Use when reviewing, summarizing, negotiating, or risk-scoring Axleo client,
  supplier, partner, SaaS, NDA, DPA, order form, terms, or commercial contract
  documents.
---

# Axleo Contract Reviewer

Use this for internal Axleo legal/commercial contract review.

## Required grounding

1. Search Axleo's private/team legal reference folder first for relevant
   templates, playbooks, prior positions, DPAs, NDAs, terms, privacy materials,
   and approved fallback wording.
2. Use authoritative UK sources where the issue turns on law or regulation,
   including UK GDPR/DPA, PECR, FCA rules, Consumer Duty, contract law, or
   sector-specific dealership compliance.
3. Cite every legal/regulatory point and cite private source documents by file
   name/location where used.
4. Call `axleo_citation_log` before the final answer when legal/compliance
   claims are made.

## Workflow

1. Identify document type, parties, governing law, commercial purpose, and
   negotiation posture.
2. Separate business risk, legal risk, data-protection risk, FCA/dealership
   compliance risk, and operational risk.
3. Mark each issue as `accept`, `negotiate`, `reject`, or `needs solicitor
   review`.
4. Suggest practical fallback wording only where the evidence supports it.
5. Do not pretend to give solicitor advice. For high-value, unusual, liability,
   indemnity, IP, data breach, regulatory, or termination issues, recommend
   human legal review.

## Output

Return:

- Executive summary.
- Key issues table: clause, risk, why it matters, recommendation, fallback
  wording, citation/source.
- Negotiation position: must-have, preferred, acceptable compromise.
- Open questions and missing documents.
- Approval/escalation note before signature or client use.
