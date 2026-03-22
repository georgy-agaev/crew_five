# Outreacher Campaign Status And Enrichment Handoff

> Version: v0.2 (2026-03-19)

## Goal

Clarify the recommended operating boundary for:

- campaign status semantics
- campaign status transitions
- who owns draft generation
- how enrichment should be run before draft generation

This document is a handoff for the `Outreacher` team and should be read together with:

- [Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
- [Outreacher_operating_model.md](/Users/georgyagaev/crew_five/docs/Outreacher_operating_model.md)

## Current Source Of Truth In `crew_five`

Formal campaign transitions currently live in [status.ts](/Users/georgyagaev/crew_five/src/status.ts):

- `draft -> ready | review`
- `ready -> generating`
- `generating -> review | sending`
- `review -> ready | generating`
- `sending -> paused | complete`
- `paused -> sending | complete`

Important note:

- `crew_five` currently exposes the transition rules, but it does not yet provide a dedicated
  lifecycle command such as `campaign:prepare-draft-generation`
- `draft:generate` inside `crew_five` does not automatically move the campaign through statuses

So today there are two separate things:

1. the formal transition map in `crew_five`
2. the orchestration policy in `Outreacher`

## Three Operating Options

### Option 1 - Keep Generation Inside `Outreacher` And Use `crew_five` For Persistence

Recommended for now.

- `Outreacher` decides when generation starts
- `Outreacher` generates email drafts itself
- `Outreacher` persists drafts through `draft:save`
- `Outreacher` moves campaign statuses through `campaign:status`
- `crew_five` remains the shared GTM spine and source of truth

Why this is recommended:

- matches the current architecture already used by `Outreacher`
- keeps agent logic in one place
- avoids forcing `Outreacher` into `crew_five draft:generate`
- preserves a single persistence path for analytics and UI

### Option 2 - Use `crew_five draft:generate` As The Main Generator

Not recommended as the primary model right now.

- `Outreacher` becomes mostly an orchestrator around `draft:generate`
- more generation logic shifts back into `crew_five`
- simpler lifecycle coupling, but weaker separation of responsibilities

### Option 3 - Hybrid Generator Model

Keep both:

- `Outreacher` generates drafts in the main path
- `crew_five draft:generate` remains available as fallback, batch mode, or regression baseline

This is acceptable, but Option 1 should still be the main contract.

## Recommended Boundary

### `Outreacher` owns

- preflight decisions before generation
- whether enrichment should be refreshed now
- which enrichment providers to use now
- actual draft generation logic
- draft review decisions
- send timing
- mailbox selection
- planned sender-set selection and persistence through `campaign:mailbox-assignment:put`
- inbox polling and reply classification

### `crew_five` owns

- canonical campaign/segment/draft/outbound/event persistence
- campaign read models
- review-state persistence
- follow-up candidate calculation
- analytics
- deterministic mutation rules and status-transition validation

## Campaign Status Semantics

These are the recommended operational meanings for current statuses.

### `draft`

Meaning:

- campaign exists
- segment and segment snapshot are attached
- no completed generation cycle has been recorded yet

What should still happen before generation:

- operator/agent verifies the segment content
- enrichment preview and optional enrichment refresh
- contact/email coverage checks

### `ready`

Meaning:

- the next stage is allowed to start
- for generation flow, it means generation preflight is complete
- for send flow, it means review is complete and send preflight is complete

Important:

- `ready` is not currently enforced by `crew_five` as “enrichment definitely done”
- this meaning is an operational policy and should be enforced by `Outreacher`
- `ready -> sending` is not a valid transition in the current map
- send flow must still pass through `generating`

### `generating`

Meaning:

- draft generation is actively running

Do not treat it as a final state.

Expected next state:

- `review`

### `review`

Meaning:

- drafts have been generated
- operator/agent review is required or in progress

Expected next state:

- `ready`

### `sending`

Meaning:

- actual send execution is in progress
- outbound rows are being recorded

Expected next states:

- `paused`
- `complete`

### `paused`

Meaning:

- send execution was deliberately stopped

### `complete`

Meaning:

- the current send run is complete

This does not necessarily mean the campaign will never be used again, but it marks the current
send batch as finished.

## Recommended Generation Flow

Recommended flow for `Outreacher`:

1. `/launch-campaign`
   - create campaign
   - campaign starts in `draft`

2. Preflight before generation
   - inspect segment contents
   - inspect contact/email coverage
   - run enrichment preview
   - optionally run enrichment refresh

3. Generation run
   - `campaign:status draft -> ready`
   - `campaign:status ready -> generating`
   - `Outreacher` generates drafts itself
   - `draft:save`
   - `campaign:status generating -> review`

4. Review
   - `draft:load`
   - `draft:update-status`
   - once review is complete: `campaign:status review -> ready`

5. Send
   - `campaign:mailbox-assignment:put`
   - `campaign:status ready -> generating`
   - `campaign:status generating -> sending`
   - send via `imap_mcp`
   - `email:record-outbound`
   - `event:ingest`
   - `campaign:status sending -> complete`

## Important Transition Constraint

For the current `crew_five` transition map:

- `ready -> sending` is invalid
- the valid send path is `ready -> generating -> sending`

So if `Outreacher` starts a send run from a reviewed campaign, it should explicitly do:

1. `campaign:mailbox-assignment:put`
2. `campaign:status --status generating`
3. `campaign:status --status sending`

## Mailbox Assignment Requirement

Before a campaign can transition to `sending`, `crew_five` requires at least one planned mailbox
assignment for that campaign.

Recommended commands:

```bash
pnpm cli campaign:mailbox-assignment:get \
  --campaign-id <campaignId> \
  --error-format json
```

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}' \
  --error-format json
```

Semantics:

- whole-set replace
- planned sender state, not observed outbound history
- one row per sender identity
- this is the canonical place to persist campaign sender selection

Practical examples:

Single sender:

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-voicexpert-01","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}' \
  --error-format json
```

Two senders:

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-voicexpert-01","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"},{"mailboxAccountId":"mbox-voicexpert-02","senderIdentity":"team@voicexpert.ru","provider":"imap_mcp"}]}' \
  --error-format json
```

Clear the planned sender set:

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '{"source":"outreacher","assignments":[]}' \
  --error-format json
```

If no assignment exists, `campaign:status --status sending` is rejected with:

```json
{
  "code": "MAILBOX_ASSIGNMENT_REQUIRED",
  "message": "Assign at least one mailbox sender identity before sending"
}
```

## Does `Outreacher` Need To Use `draft:generate`?

No.

Recommended answer:

- `Outreacher` should not be forced to use `crew_five draft:generate`
- `Outreacher` may generate drafts itself and persist them via `draft:save`
- `crew_five draft:generate` can stay as fallback or reference path

Recommended practical rule:

- `Outreacher` owns generation
- `crew_five` owns persistence and lifecycle recording

## Enrichment Ownership

Enrichment is not a campaign-level status step.

It is a segment/company/contact data-preparation step that should usually happen before draft generation.

That means:

- enrichment should stay separate from campaign status semantics
- `ready` may operationally imply “generation preflight complete”
- but enrichment itself remains segment-scoped

## Recommended Enrichment Flow

### Step 1 - Preview

Use:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 25 \
  --max-age-days 90 \
  --dry-run \
  --error-format json
```

What this preview means:

- no writes
- no provider calls that mutate state
- shows freshness/eligibility counts
- `--limit` is interpreted as company-level limit

### Step 2 - Decide

`Outreacher` should decide whether to run enrichment now based on:

- stale or missing research counts
- campaign importance
- cost tolerance
- whether current company context is enough for copy quality

### Step 3 - Execute

Use:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 25 \
  --run-now \
  --error-format json
```

### Step 4 - Re-check

After enrichment, `Outreacher` should re-read campaign/segment context before generation when needed:

- `campaign:detail`
- `campaign:audit`

## Enrichment Rules Already Agreed

These are the current recommended rules:

- freshness is based on one shared timestamp per entity, not per provider
- default refresh threshold is `90` days
- `--force-refresh` ignores age
- provider combinations are treated as union
- `Outreacher` chooses the provider set at runtime

Meaning:

- it does not matter which provider enriched the company last time
- once the data is stale, `Outreacher` may choose whichever provider set is best now

## Recommended CLI Surfaces For `Outreacher`

### Before generation

- `segment:snapshot`
- `enrich:run --dry-run`
- `enrich:run --run-now`
- `campaign:audit`
- `campaign:detail`
- `campaign:status`

### During generation

- `draft:save`
- optionally `draft:load`

### During review

- `draft:load`
- `draft:update-status`

### During send

- `campaign:mailbox-assignment:get`
- `campaign:mailbox-assignment:put`
- `campaign:followup-candidates`
- `email:record-outbound`
- `event:ingest`
- `campaign:status`

## Recommended Draft Metadata From `Outreacher`

When `Outreacher` generates drafts itself, it should persist enough metadata for later analysis.

Recommended fields inside `drafts.metadata`:

- `source: "outreacher"`
- `provider`
- `model`
- `draft_pattern`
- `coach_prompt_id` or other prompt provenance
- `offering_domain`
- `offering_hash`
- `offering_summary`

This keeps generated drafts comparable with the rest of the GTM spine.

## Current Gap

The current status model works, but one thing is still missing:

- `crew_five` does not yet expose dedicated lifecycle commands for generation and send preparation

If lifecycle needs to become more canonical later, recommended future commands are:

- `campaign:prepare-draft-generation`
- `campaign:mark-generation-complete`
- `campaign:prepare-send`

Until then, `Outreacher` should keep owning the policy and use `campaign:status` for explicit transitions.
