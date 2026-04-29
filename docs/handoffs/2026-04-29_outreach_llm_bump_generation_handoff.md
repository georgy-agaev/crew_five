# Handoff: Outreach LLM Bump Generation Bridge

**Date:** 2026-04-29
**Audience:** Outreach maintainers
**Owner on `crew_five` side:** backend / web adapter
**Status:** Ready for Outreach implementation

## Purpose

`crew_five` auto bump generation now correctly decides which contacts are eligible for a follow-up
message and calls `OUTREACH_GENERATE_BUMPS_CMD` with an exact contact allowlist.

The current Outreach bridge still generates bump drafts from a static template. This creates almost
identical bump messages across recipients and companies.

This handoff upgrades the existing bump bridge so live bump generation uses the Outreach LLM
batch-per-company path instead of the template-only CLI path.

## Current Wiring In `crew_five`

In live mode, `crew_five` uses:

```bash
OUTREACH_GENERATE_BUMPS_CMD=/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh
```

The web adapter calls:

```bash
generate_bumps_cli.sh \
  --campaign-id <campaign-id> \
  --contact-ids '["uuid1","uuid2"]' \
  --limit 25
```

Implementation references on the `crew_five` side:

- [generateBumpsTrigger.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/generateBumpsTrigger.ts)
- [campaignBumpAutoGeneration.ts](/Users/georgyagaev/crew_five/src/services/campaignBumpAutoGeneration.ts)
- [campaignAutoSend.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSend.ts)

`crew_five` owns:

- follow-up eligibility
- delay/reply/bounce/unsubscribe checks
- active bump duplicate checks before calling Outreach
- exact `contactIds` allowlist
- review/send workflow after drafts are created

`Outreach` owns:

- LLM generation of bump draft text
- preserving one draft per eligible recipient
- saving generated bump drafts back into `crew_five`

## Root Cause

The current live command points to:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh
```

In real-run mode that file uses a hardcoded template:

```python
# Generate bump drafts - simple template (no LLM subagent in CLI mode)
bump_body = f"{greeting_name}, добрый день!\n\nПисал вам на прошлой неделе..."
metadata["model"] = "template"
```

Live drafts confirm this:

- `metadata.source = "outreach-pipeline-v2"`
- `metadata.model = "template"`
- body text is the same except greeting and subject

There is already a richer Outreach path:

- `/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_orchestrator.py`
- `/Users/georgyagaev/Projects/Outreach/scripts/prompts/cold_bump_express_v2.md`
- `/Users/georgyagaev/Projects/Outreach/scripts/draft_helpers.py batch-bump`

But the current live bridge bypasses it.

## Target Runtime

Keep `generate_bumps_cli.sh` as the stable command path for `crew_five`, but make it a thin wrapper
around the LLM bump orchestrator.

Recommended shape:

```text
generate_bumps_cli.sh
  -> parse bridge flags
  -> call generate_bumps_orchestrator.py
  -> stream or relay logs
  -> print final canonical JSON as the last stdout line
```

This avoids changing `crew_five` env and keeps the existing bridge stable.

## Required CLI Contract

`generate_bumps_cli.sh` must accept:

- `--campaign-id <uuid>`: required
- `--contact-ids '<json-array>'`: exact contact allowlist from `crew_five`
- `--dry-run`: preview only, no LLM, no save
- `--limit <n>`: maximum recipients to process

It may also silently accept future compatibility flags already used in other Outreach bridges:

- `--sender`
- `--interaction-mode`
- `--data-quality-mode`
- `--provider`
- `--model`

## Required Behavior

### 1. `--contact-ids` Is A Hard Allowlist

Outreach must generate only for contacts included in `--contact-ids`.

If a sent/approved intro exists for a contact but that contact is not in `--contact-ids`, it must be
skipped before any LLM call.

Recommended reason:

```text
not_in_allowlist
```

### 2. Prefilter Before LLM

Before calling LLM, Outreach should:

- load campaign context
- load sent/approved intro drafts
- filter to `--contact-ids`
- skip contacts that already have an active non-rejected bump
- skip contacts without matching intro
- group remaining recipients by company

LLM must see only eligible recipients, not the whole company audience.

### 3. Batch-Per-Company LLM Generation

For each company batch, use the existing bump prompt:

```text
scripts/prompts/cold_bump_express_v2.md
```

Each request should include:

- company context
- offer / hypothesis / messaging angle
- sender
- recipients array
- per recipient:
  - contact id
  - full name
  - role
  - greeting name
  - direct/generic email flag
  - original intro subject/body
  - role angle if available

The LLM response should be a JSON array with one bump draft per recipient.

### 4. Save Drafts With LLM Metadata

Saved bump drafts should include:

```json
{
  "source": "outreacher-generate-bumps",
  "model": "<actual model>",
  "coach_prompt_id": "cold_bump_express_v2",
  "draft_pattern": "<pattern>",
  "parent_intro_draft_id": "<intro draft id>"
}
```

Do not use `metadata.model = "template"` for LLM-generated drafts.

### 5. Dry-Run Is Cheap

`--dry-run` should not call LLM and should not save drafts.

It should only run the prefilter and return preview counts.

Example:

```json
{
  "status": "ok",
  "generated": 0,
  "dryRun": true,
  "failed": 0,
  "skipped": 12,
  "preview": {
    "eligibleContacts": 4,
    "companies": 3,
    "alreadyHaveBumps": 8,
    "totalIntros": 16
  }
}
```

## Final Output Contract

The last non-empty stdout line must be a JSON object.

Successful real run:

```json
{
  "status": "ok",
  "generated": 3,
  "dryRun": false,
  "failed": 0,
  "skipped": 2,
  "skipped_by_reason": {
    "not_in_allowlist": 1,
    "bump_exists": 1
  },
  "results": []
}
```

No eligible recipients is still a successful no-op:

```json
{
  "status": "ok",
  "generated": 0,
  "dryRun": false,
  "failed": 0,
  "skipped": 0,
  "preview": {
    "eligibleContacts": 0,
    "companies": 0
  }
}
```

Fatal error:

```json
{
  "status": "error",
  "error": "missing_context",
  "error_code": "missing_context",
  "message": "Campaign is missing offer or hypothesis context"
}
```

Use exit code `1` for fatal errors. Use exit code `0` for normal skipped/no-op outcomes.

## Acceptance Criteria

- `generate_bumps_cli.sh` still works as the command configured in `OUTREACH_GENERATE_BUMPS_CMD`.
- `--contact-ids` is enforced as a hard allowlist before LLM.
- `--dry-run` does not call LLM, does not save drafts, and returns a valid final JSON summary.
- Real mode calls the LLM bump path, not the template path.
- Saved bump drafts have `metadata.model != "template"`.
- Saved bump drafts have `metadata.parent_intro_draft_id`.
- Re-running for the same contact does not create duplicate active bump drafts.
- The final stdout line remains parseable by the existing `crew_five` bridge.

## Verification Plan

### 1. Dry-Run Smoke

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh \
  --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 \
  --contact-ids '["<eligible-contact-id>"]' \
  --dry-run \
  --limit 1
```

Expected:

- exit code `0`
- last line is valid JSON
- `dryRun: true`
- `generated: 0`
- no drafts created

### 2. Real Small Run

Use a test campaign or one safe eligible contact:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh \
  --campaign-id <test-campaign-id> \
  --contact-ids '["<eligible-contact-id>"]' \
  --limit 1
```

Expected:

- exit code `0`
- final JSON has `generated: 1`
- saved draft has `email_type = "bump"`
- saved draft has `metadata.model != "template"`
- saved draft has `metadata.parent_intro_draft_id`
- body is not the old static template
- body references the original intro / recipient context

### 3. Duplicate Guard

Run the same command again for the same contact.

Expected:

- `generated: 0`
- `skipped_by_reason.bump_exists >= 1`
- no duplicate active bump draft

### 4. `crew_five` Integration Check

After Outreach updates the bridge:

1. Restart `pnpm dev:web:live`.
2. Let auto bump generation run, or trigger a controlled sweep.
3. Open Campaign Builder V2.
4. Inspect generated bump drafts.

Expected:

- bump drafts appear in review
- `metadata.model` is the real LLM model
- multiple bump bodies are not identical except signature
- after approval, preflight counts them as sendable bump drafts

## Notes For Later

This handoff does not require changing `crew_five` code if `generate_bumps_cli.sh` preserves the
same command-line contract.

If Outreach wants to expose progress JSONL for bump generation later, mirror the already-implemented
draft generation bridge:

- `--progress-jsonl`
- `started`
- `company_started`
- `recipient_started`
- `draft_created`
- `skipped`
- `failed`
- `completed`

That is useful, but not required for this fix.
