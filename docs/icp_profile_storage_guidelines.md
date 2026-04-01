# ICP Profile Storage Guidelines

**Date:** 2026-03-25  
**Status:** Active guidance

## Purpose

This document defines how `icp_profiles` should be used when new projects and
new ICPs are created.

The key rule is simple:

- keep `description` as a human-readable narrative brief
- keep runtime-relevant structure in the existing structured fields

This avoids two bad extremes:

1. storing everything only in one long prose field
2. prematurely splitting one ICP into many narrow database columns

## Current ICP Model

`icp_profiles` already supports both narrative and structured storage:

- `name`
- `description`
- `project_id`
- `company_criteria`
- `persona_criteria`
- `offering_domain`
- `phase_outputs`
- `learnings`

## Canonical Storage Rules

### `description`

Use `description` for:

- operator-facing narrative summary
- compact LLM briefing context
- readable explanation of the ICP in prose

Do not use `description` as the canonical source of truth for runtime logic.

Good content for `description`:

- short value proposition
- high-level ICP summary
- high-level persona summary
- compact objections or motivations

Bad content for `description`:

- the only copy of critical targeting constraints
- the only copy of role lists or disqualifiers
- fields that downstream logic must parse reliably

### `company_criteria`

Use `company_criteria` as the canonical account-level structure.

This is the right place for:

- industries
- company sizes
- geography
- example companies
- pains / challenges
- disqualifiers
- success factors

If a campaign, discovery flow, or generation flow needs stable company-level
context, it should read `company_criteria`, not re-parse `description`.

### `persona_criteria`

Use `persona_criteria` as the canonical buyer/persona structure.

This is the right place for:

- buyer personas
- decision makers
- structured target roles and role-specific search hints
- role-specific concerns
- cycle / budget / context notes when they are stable enough to be structured

If generation or targeting needs stable persona-level context, it should read
`persona_criteria`.

#### Recommended Structured Fields (2026-03-27)

To avoid downstream hardcoding and role guessing in pipelines (collect/analyze/generation),
store role targeting in structured form:

- `persona_criteria.target_roles`: array of objects
  - `role` (string, required): human-facing role label, e.g. `"IT-директор"`
  - `priority` (`"P1"|"P2"|"P3"`, required): relative importance for assignment and focus
  - `search_patterns` (string[], required): regex-like patterns used to find role mentions in scraped text
  - `angle` (string|null, optional): role-specific messaging angle for draft generation
  - optional informational fields: `budget_range`, `decision_cycle`
- `persona_criteria.excluded_roles`: string[] of disqualifying/junior/support roles to ignore
- `persona_criteria.office_qualification_rules` (optional): ICP-specific More/Less include/exclude rules

`target_roles` is intended to be used by external pipeline steps (Outreach) and should be treated
as pass-through contract in `crew_five` read models (for example, `campaign:detail`).

### `offering_domain`

Use `offering_domain` to anchor the ICP to the relevant product / offering
boundary.

This should be set whenever the ICP is tied to a specific product family or
offering domain and should not be inferred later from prompt text.

### `learnings`

Use `learnings` for compact post-run messaging rules and quality corrections.

This is the right place for things like:

- wording to avoid
- framing that performed poorly
- domain-specific language that should be preferred
- objections or themes learned after real campaigns

`learnings` should remain concise and operational. It is not a replacement for
the full ICP brief.

### `phase_outputs`

Use `phase_outputs` for optional derived artifacts from the coach/discovery
pipeline, not as the main runtime contract.

This is the right place for:

- raw or semi-structured coach phase outputs
- intermediate discovery artifacts
- future derived summaries if needed

If additional structure is needed later, prefer adding it here or adding one
new derived JSON block before creating many new columns.

## Recommended Workflow for New Projects and New ICPs

### Option 1: Keep Everything in `description`

Pros:

- fastest to write

Cons:

- weak for runtime use
- hard to validate
- causes repeated re-parsing and drift

Recommendation:

- not recommended

### Option 2: Narrative + Existing Structured Fields

Pros:

- matches the current schema
- keeps operator readability
- gives generation and targeting stable inputs
- avoids unnecessary migrations

Cons:

- requires discipline when creating ICPs

Recommendation:

- recommended default

### Option 3: Full Normalization into Many Columns

Pros:

- strongest schema-level rigidity

Cons:

- high migration cost
- brittle early in the product
- encourages over-modeling before the patterns stabilize

Recommendation:

- not recommended at the current stage

## Recommended Default for New ICP Creation

When creating a new ICP for a new or existing project:

1. Write a concise narrative `description`
   - 1 short value proposition paragraph
   - 1 compact ICP summary
   - 1 compact buyer/persona summary
2. Put all stable account-level constraints into `company_criteria`
3. Put all stable buyer/persona structure into `persona_criteria`
4. Set `offering_domain` when the ICP belongs to a specific product boundary
5. Add `learnings` only after real campaign feedback exists
6. Use `phase_outputs` only for derived or transitional coach artifacts

## Practical Authoring Rule

If a fact answers one of these questions, it should usually be structured:

- can this be used for filtering or targeting?
- can this be reused across campaigns?
- does generation need it in a stable shape?
- would we regret having it only in prose?

If the answer is yes, it belongs in `company_criteria`, `persona_criteria`, or
another structured field, not only in `description`.

If the content is mainly explanatory, contextual, or helpful for operators and
LLMs to read as prose, it can stay in `description`.

## When Schema Evolution Is Justified

Do not add a new dedicated column just because one ICP description contains a
new subsection.

Schema evolution is justified only when the same field is:

- reused across multiple ICPs
- needed in runtime logic or filtering
- hard to validate when stored only in JSON/prose
- clearly stable as a product concept

Before adding several new columns, prefer one of these:

1. refine `company_criteria`
2. refine `persona_criteria`
3. add a compact derived JSON structure in `phase_outputs`

## Working Rule for `crew_five` and `Outreach`

- `description` = narrative brief
- structured fields = operational contract

Neither `crew_five` nor `Outreach` should treat `description` as the only
authoritative source for generation, targeting, or campaign runtime behavior.
