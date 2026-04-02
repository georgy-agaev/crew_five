# Handoff: Outreach Draft-Generation Bridge For Builder / Campaigns

**Date:** 2026-04-01  
**Audience:** Outreach maintainers  
**Owner on `crew_five` side:** backend / web adapter  
**Status:** Ready for Outreach implementation

## Purpose

`crew_five` web surfaces now assume that draft generation is owned by `Outreach`.

This handoff defines the exact command-line contract that the `crew_five` web adapter
expects when a user clicks:

- `Draft generation` in Builder V2
- draft generation actions in Campaigns / legacy draft surfaces

The goal is to make the integration deterministic and safe:

- preview must not persist drafts
- real generation must persist drafts
- the web adapter must receive a stable summary payload

## Current Wiring In `crew_five`

In live mode:

- `POST /api/drafts/generate`
- calls the live adapter dependency `generateDrafts`
- which now delegates to `OUTREACH_GENERATE_DRAFTS_CMD`

Implementation references:

- [generateDraftsTrigger.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/generateDraftsTrigger.ts)
- [liveDeps.ts](/Users/georgyagaev/crew_five/src/web/liveDeps.ts)
- [campaignRoutes.ts](/Users/georgyagaev/crew_five/src/web/routes/campaignRoutes.ts)

Required env on `crew_five` side:

```bash
OUTREACH_GENERATE_DRAFTS_CMD=/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh
```

## Why This Handoff Exists

The button path was previously wired to local `crew_five` draft generation, which no longer matches
the execution split.

The agreed split is:

- `crew_five` owns execution/runtime surfaces
- `Outreach` owns draft generation / review / regeneration runtime

So the web adapter now acts as a bridge only.

## Non-Negotiable Behavioral Rules

### 1. `--dry-run` must be safe

If the request includes `--dry-run`:

- the Outreach script must **not** persist drafts
- it should only calculate how many drafts would be generated
- it must still return a normal summary JSON payload

This is required because Builder/Campaigns use dry-run as a preview step.

If `--dry-run` creates drafts, the preview button becomes destructive and the operator flow breaks.

### 2. Real generation must persist drafts

If `--dry-run` is absent:

- the Outreach script should perform real generation
- save drafts back into the normal `crew_five` draft flow
- return a summary describing what happened

### 3. The last line of stdout must be canonical JSON

The `crew_five` bridge reads the **last non-empty stdout line** and parses it as JSON.

Any logs / debug lines may appear before that, but the final line must be the summary object.

### 4. Non-zero exit code means failure

If the script exits non-zero:

- `crew_five` treats it as an error
- stderr is surfaced back to the operator

So human-readable stderr matters.

## Command Contract Expected By `crew_five`

The bridge may pass the following flags.

### Required now

- `--campaign-id <id>`
- `--dry-run` for preview requests
- `--limit <n>` when the UI limits the batch

### Optional now, but the script must not break on them

- `--interaction-mode express|coach`
- `--data-quality-mode strict|graceful`
- `--icp-profile-id <id>`
- `--icp-hypothesis-id <id>`
- `--coach-prompt-step <step>`
- `--explicit-coach-prompt-id <id>`
- `--provider <provider>`
- `--model <model>`

### Important compatibility rule

If Outreach does not yet use the optional arguments internally, that is acceptable.

But the script must either:

- accept and ignore them safely, or
- use a wrapper that strips unknown flags before invoking internal logic

It must **not** fail just because `crew_five` sends one of these fields.

## Exact Shell Shape Used By `crew_five`

Example preview request:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh \
  --campaign-id 'dad76931-0ef5-4144-a84a-eaa4ae759334' \
  --dry-run \
  --limit 5 \
  --interaction-mode 'express' \
  --data-quality-mode 'strict'
```

Example real run:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh \
  --campaign-id 'dad76931-0ef5-4144-a84a-eaa4ae759334' \
  --limit 5 \
  --interaction-mode 'express' \
  --data-quality-mode 'strict'
```

## Output Contract Required By `crew_five`

The last stdout line must be JSON with this minimum shape:

```json
{
  "generated": 3,
  "dryRun": false,
  "failed": 0,
  "skipped": 0
}
```

### Recommended full shape

```json
{
  "generated": 3,
  "dryRun": false,
  "failed": 0,
  "skipped": 0,
  "error": null
}
```

### Field semantics

- `generated`
  - number of drafts created in real mode
  - number of drafts that would be created in dry-run mode
- `dryRun`
  - `true` when the command ran in preview mode
  - `false` when the command performed real generation
- `failed`
  - count of generation attempts that failed
- `skipped`
  - count of contacts intentionally skipped
- `error`
  - optional top-level error summary for partial-failure cases

## Current Outreach Output Is Not Yet Compatible

Current Outreach output was reported as:

```json
{
  "ok": true,
  "campaign_id": "...",
  "drafts_generated": 5,
  "companies_processed": 4,
  "duration_sec": 21,
  "errors": []
}
```

This is not sufficient for the current `crew_five` web contract because:

- `generated` is missing
- `dryRun` is missing
- `failed` is missing
- `skipped` is missing
- preview semantics are unclear

Outreach can still keep its richer internal payload if useful, but it should normalize the final JSON
line to the contract above.

## Minimal Required Outreach Upgrade

Outreach does **not** need to fully support every optional flag immediately.

The minimum safe upgrade is:

1. Support `--campaign-id`
2. Support `--dry-run`
3. Support `--limit`
4. Accept and safely ignore extra flags
5. Emit final JSON with:
   - `generated`
   - `dryRun`
   - `failed`
   - `skipped`

That is enough to make the web flow operational.

## Recommended Wrapper Strategy

If the current internal draft-generation script already works and only the bridge contract is missing,
the cleanest fix is to keep current logic and add a thin wrapper in Outreach:

1. Parse the `crew_five` flags
2. Map supported flags to current internal runner
3. Ignore unsupported optional flags
4. Implement dry-run behavior explicitly
5. Normalize the final JSON summary

This is preferable to changing the whole Outreach generation runtime at once.

## Example Normalization Logic

If current internal output is:

```json
{
  "ok": true,
  "campaign_id": "camp-1",
  "drafts_generated": 4,
  "companies_processed": 3,
  "duration_sec": 19,
  "errors": []
}
```

the wrapper should emit a final line like:

```json
{
  "generated": 4,
  "dryRun": false,
  "failed": 0,
  "skipped": 0,
  "error": null
}
```

If there were per-company or per-contact failures:

```json
{
  "generated": 3,
  "dryRun": false,
  "failed": 1,
  "skipped": 0,
  "error": "1 contact failed during generation"
}
```

## Expected Failure Behavior

### Configuration / argument errors

Use non-zero exit code and readable stderr, for example:

```text
Missing required argument: --campaign-id
```

### Runtime crash

Use non-zero exit code and stderr with a short actionable message, for example:

```text
Generation failed: campaign detail fetch failed for camp-1
```

### Partial success

Return exit code `0` and encode the partial failure in JSON:

```json
{
  "generated": 7,
  "dryRun": false,
  "failed": 2,
  "skipped": 1,
  "error": "2 contacts failed"
}
```

## Validation Checklist For Outreach

Before handing back to `crew_five`, Outreach should verify all three cases.

### 1. Preview mode

Run:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh \
  --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 \
  --dry-run \
  --limit 3
```

Expected:

- exit code `0`
- no drafts persisted
- final JSON includes `"dryRun": true`

### 2. Real generation mode

Run:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh \
  --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 \
  --limit 3
```

Expected:

- exit code `0`
- drafts persisted
- final JSON includes `"dryRun": false`

### 3. Unknown optional flags

Run:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh \
  --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 \
  --dry-run \
  --limit 3 \
  --interaction-mode express \
  --data-quality-mode strict \
  --provider anthropic \
  --model claude-sonnet
```

Expected:

- exit code `0`
- no crash on extra flags
- final JSON still valid

## `crew_five` Validation After Outreach Updates

After Outreach updates the script, `crew_five` side validation is:

1. Set env:

```bash
OUTREACH_GENERATE_DRAFTS_CMD=/Users/georgyagaev/Projects/Outreach/scripts/generate_drafts_cli.sh
```

2. Restart the web adapter
3. In Builder / Campaigns:
   - click preview
   - confirm no drafts were created
   - click real generate
   - confirm drafts appear normally

## Implementation Boundary Reminder

This handoff is deliberately narrow.

It does **not** require Outreach to finish the full canonical-context generation upgrade in one step.

It only requires Outreach to make the current draft-generation command bridge operational and safe for:

- Builder V2
- Campaigns
- preview + real generation

Once this bridge is stable, higher-level generation-quality work continues on top of it.
