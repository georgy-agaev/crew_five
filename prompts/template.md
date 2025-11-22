# Prompt Template

Use this template for new prompt drafts. Do not add secrets, keys, or customer data.

## Context
- Product area and current goal:
- Key constraints or modes (strict/graceful, interaction mode, etc.):
- Data sources available (segments, snapshots, enrichment):

## Persona & Audience
- Sender persona (role, tone):
- Recipient profile (role, industry, pain points):

## Inputs
- Required variables: `<segment_name>`, `<company>`, `<contact_name>`, ...
- Optional variables and defaults:
- Safety rules or exclusions:

## Output Requirements
- Format (e.g., JSON fields, plain text, subject + body):
- Style/tone (e.g., concise, pattern breaker allowed/forbidden):
- Length and call-to-action guidance:

## Steps / Logic
1) Validate required inputs and abort with a clear message if missing.
2) Summarize relevant context (segment intent, product value) in 1–2 sentences.
3) Draft content following the output requirements and safety rules.
4) Provide a brief rationale or alternative if confidence is low.

## Guardrails
- Never invent data; only use provided inputs.
- Keep PII and credentials out of outputs.
- Avoid hallucinating SMTP/sending behavior—generate drafts only.
