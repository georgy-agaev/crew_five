# Design: Outreach Project Bootstrap Wizard

**Date:** 2026-03-25  
**Status:** To Do  
**Owners:** `crew_five` + `Outreach`

## Purpose

Allow `Outreach` to create and populate the full canonical `crew_five`
environment for a **new project with a new ICP**, so that the existing
`/launch-campaign` wizard can then launch campaign waves without having to
rebuild missing context ad hoc.

This design is not about transport or generation runtime.
It is about **canonical setup of business context**.

## Canonical Hierarchy

The operational hierarchy should be treated as:

- `project`
- `icp_profile`
- `offer`
- `icp_hypothesis`
- `segment`
- `campaign`

This is stricter than the current `Outreach /launch-campaign` flow, which still
asks for `hypothesis` before `offer`.

### Why this matters

The business meaning is:

- one `project` may contain multiple ICPs
- one `icp_profile` may eventually have more than one offer
- one `offer` may have multiple hypotheses
- hypotheses define targeting and messaging assumptions
- segments are selections produced under ICP/hypothesis assumptions
- campaigns are concrete execution waves over real companies/contacts

Therefore the safe canonical order is:

`project -> ICP -> offer -> hypothesis -> segment -> campaign`

## Options

### Option 1 — New orchestration CLI with manifest

Add one new command in `crew_five`:

```bash
pnpm cli project:bootstrap --manifest ./bootstrap.json --upsert --error-format json
```

Behavior:

- create or upsert `project`
- create or upsert `icp_profile`
- create or upsert `offer`
- create or upsert `icp_hypothesis`
- optionally link to existing `segment`
- optionally link to existing `campaign`
- return canonical ids and readiness summary

Pros:

- repeatable
- scriptable
- no giant flag list
- good fit for `Outreach`

Cons:

- requires one new orchestration command

### Option 2 — Expand `/launch-campaign` to also bootstrap missing context

Keep one wizard in `Outreach` and let it create:

- project
- ICP
- offer
- hypothesis
- segment
- campaign

Pros:

- one user-visible skill

Cons:

- mixes **environment setup** with **campaign launch**
- becomes too large and stateful
- worse reuse

### Option 3 — Keep only primitive commands and add an Outreach-side wrapper

Do not add new `crew_five` command.
Let `Outreach` call:

- `project:create`
- `icp:create`
- `offer:create`
- `icp:hypothesis:create`
- existing segment / launch commands

Pros:

- no new backend command

Cons:

- orchestration logic drifts into `Outreach`
- harder to keep canonical and testable
- harder to reuse outside that skill

## Recommendation

Use **Option 1**.

Add a new canonical orchestration command in `crew_five`, and build a new
`Outreach` wizard skill around that command.

Do **not** overload `/launch-campaign` with full project/ICP bootstrap.

Instead:

- new `Outreach` skill: prepares environment
- existing `/launch-campaign`: uses that environment

## Recommended New Outreach Skill

Suggested skill name:

- `/bootstrap-project-context`

Alternative names:

- `/setup-project`
- `/create-project-context`

Recommended meaning:

- build the canonical `project -> ICP -> offer -> hypothesis` environment
- optionally create or link a segment
- stop before campaign launch

After successful bootstrap, operator moves into the existing
`/launch-campaign` flow.

## Recommended New crew_five CLI Command

### Name

```bash
pnpm cli project:bootstrap --manifest <path> [--upsert] [--dry-run] [--error-format json]
```

### Responsibilities

The command should:

1. validate the manifest
2. create or upsert `project`
3. create or upsert `icp_profile`
4. create or upsert `offer`
5. create or upsert `icp_hypothesis`
6. optionally attach `icp_profile` / `icp_hypothesis` to an existing segment
7. optionally attach `project` / `offer` / `hypothesis` to an existing campaign
8. return canonical ids and readiness summary

### Explicit non-responsibilities

The command should **not**:

- create sender plans
- create mailbox assignments
- send mail
- generate drafts
- infer missing structure from `description`

## Manifest Shape

Recommended shape:

```json
{
  "project": {
    "key": "voicexpert-vks",
    "name": "VoiceXpert ВКС и переговорные",
    "description": "Canonical workspace for VoiceXpert meeting-room offers.",
    "status": "active"
  },
  "icp_profile": {
    "name": "Комплекты для видеоконференций в переговорные комнаты",
    "description": "Narrative ICP brief for operators and LLMs.",
    "offering_domain": "voicexpert.ru",
    "company_criteria": {},
    "persona_criteria": {},
    "learnings": [],
    "phase_outputs": null,
    "created_by": "outreach"
  },
  "offer": {
    "title": "Комплекты для видеоконференций в переговорные комнаты",
    "description": "Room-fit kits for negotiation and hybrid meeting rooms.",
    "status": "active"
  },
  "hypothesis": {
    "label": "Оборудование переговорных комнат для небольших компаний",
    "status": "active",
    "messaging_angle": "Стандартизация переговорных комнат под размер помещения и сценарий ВКС без универсальных шаблонов.",
    "notes": "Primary operational hypothesis for this offer.",
    "search_config": {},
    "targeting_defaults": {},
    "pattern_defaults": {}
  },
  "segment": {
    "attach_to_existing_segment_id": null
  },
  "campaign_context": {
    "attach_to_existing_campaign_id": null
  }
}
```

## Required Fields

### Required for `project`

- `project.key`
- `project.name`

### Required for `icp_profile`

- `icp_profile.name`
- `icp_profile.description`
- `icp_profile.company_criteria`
- `icp_profile.persona_criteria`

### Required for `offer`

- `offer.title`

### Required for `hypothesis`

- `hypothesis.label`

## Validation Rules

### Structural rules

- `project.key` must be unique
- `company_criteria` must be a non-empty object
- `persona_criteria` must be a non-empty object
- `description` is narrative only and cannot replace missing structured fields

### Consistency rules

- `icp_profile.project_id` must match the created/resolved project
- `offer.project_id` must match the created/resolved project
- `hypothesis.offer_id` must point to the created/resolved offer
- if segment linking is requested:
  - `segments.icp_profile_id` must be set
  - `segments.icp_hypothesis_id` must be set
- if campaign linking is requested:
  - `campaign.project_id`
  - `campaign.offer_id`
  - `campaign.icp_hypothesis_id`
    must be updated together

### Error classes

Fatal consistency errors should remain aligned with existing conventions:

- `CAMPAIGN_PROJECT_MISMATCH`
- `ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH`
- `CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH`

## Upsert Strategy

`--upsert` should resolve rows by canonical keys:

- `project` by `key`
- `icp_profile` by `(project_id, name)`
- `offer` by `(project_id, title)`
- `hypothesis` by `(icp_id, hypothesis_label)`

If a row already exists:

- update only explicitly managed fields
- do not erase existing populated JSON with empty replacements

## Dry-Run

`--dry-run` should:

- validate the manifest
- resolve existing rows if possible
- show `create` vs `update` plan
- return readiness summary
- not write to the database

Example output:

```json
{
  "ok": true,
  "mode": "dry_run",
  "plan": {
    "project": "create",
    "icp_profile": "create",
    "offer": "create",
    "hypothesis": "create",
    "segment_link": "skip",
    "campaign_link": "skip"
  },
  "readiness": {
    "project": true,
    "icp_profile": true,
    "company_criteria": true,
    "persona_criteria": true,
    "offer": true,
    "hypothesis": true
  }
}
```

## Apply Output

Successful execution should return:

```json
{
  "ok": true,
  "project_id": "uuid",
  "icp_profile_id": "uuid",
  "offer_id": "uuid",
  "icp_hypothesis_id": "uuid",
  "segment_id": "uuid or null",
  "campaign_id": "uuid or null",
  "readiness": {
    "project": true,
    "icp_profile": true,
    "company_criteria": true,
    "persona_criteria": true,
    "offer": true,
    "hypothesis": true
  }
}
```

## Outreach Wizard Flow

Recommended wizard phases for the new setup skill:

1. `Project`
2. `ICP`
3. `Offer`
4. `Hypothesis`
5. `Optional segment link`
6. `Confirmation`
7. `Run project:bootstrap`
8. `Suggest next step: /launch-campaign`

### Important

This new wizard should **not** ask for:

- sender plan
- send policy
- mailbox accounts
- campaign name

Those remain in `/launch-campaign`.

## Relationship With Existing /launch-campaign

### Current problem

The current `Outreach /launch-campaign` wizard already creates missing pieces,
but it mixes:

- business context bootstrap
- launch-time campaign decisions

This is acceptable for quick ad hoc use, but not ideal for canonical
multi-project operation.

### Recommended split

#### `/bootstrap-project-context`

Owns:

- project
- ICP
- offer
- hypothesis
- optional segment link

#### `/launch-campaign`

Owns:

- choose project / ICP / hypothesis / segment / offer from canonical registry
- preview
- sender plan
- send policy
- launch campaign
- next steps

## Practical Outcome

With this split, `Outreach` gains full access to `crew_five` capabilities
without reproducing business-context bootstrap logic locally.

That means:

- `crew_five` remains the canonical system of record
- `Outreach` remains the conversational orchestrator
- `/launch-campaign` becomes simpler and safer over time
- new projects and new ICPs become repeatable and auditable
