# 2026-03-15 Session 1 - Offering Domain And Draft Provenance

> Version: v0.1 (2026-03-15)

## Context

`Outreach` needs to stop hardcoding the selected offering and instead read it from `icp_profiles`.
At the same time, simply storing `offering_domain` on the ICP is not enough for historical replay,
because the underlying Marketing2025 offering JSON can change over time.

We selected the balanced provenance model:

- `icp_profiles.offering_domain`
- `drafts.metadata.offering_domain`
- `drafts.metadata.offering_hash`
- `drafts.metadata.offering_summary`
- `email_outbound.metadata` inherits the same fields from `drafts.metadata`

This keeps the ICP -> offering routing simple while preserving enough information to understand which
offer version influenced a given draft/send.

## Options Considered

### Option 1 - Domain only

- Store only `icp_profiles.offering_domain`

Pros:
- Smallest change
- Unblocks ICP -> offering lookup

Cons:
- No historical reproducibility if offering JSON changes

### Option 2 - Balanced provenance

- Store `offering_domain + offering_hash + offering_summary`

Pros:
- Good audit/replay signal without storing full JSON in every draft
- Works well with current `Outreach -> crew_five -> imap_mcp` architecture

Cons:
- Requires `Outreach` to compute hash + summary

### Option 3 - Full snapshot table

- Introduce a dedicated `offering_snapshots` table and reference it from drafts/outbound

Pros:
- Strongest historical replay model

Cons:
- More schema and orchestration work than needed now

## Chosen Direction

Option 2 for this session.

`crew_five` responsibilities:

- store `icp_profiles.offering_domain`
- expose it in CLI outputs
- persist provenance in `drafts.metadata`
- propagate provenance into `email_outbound.metadata`

`Outreach` responsibilities:

- load the offering JSON from Marketing2025 using `offering_domain`
- compute `offering_hash`
- build `offering_summary`
- pass those fields when saving/generating drafts

## Completed

- Added migration `supabase/migrations/20260315093000_add_icp_profile_offering_domain.sql`
- Applied the migration to the linked shared Supabase
- Backfilled all 4 current ICP rows with `offering_domain = 'voicexpert.ru'`
- Extended `icp_profiles` service types/creation flow with `offering_domain`
- Added `--offering-domain` to:
  - `icp:create`
  - `icp:coach:profile`
- Updated `icp:list` to support and default-include `offering_domain`
- Extended `draft:generate` so it:
  - reads `icp_profiles.offering_domain`
  - persists `metadata.offering_domain`
  - persists `metadata.offering_hash` / `metadata.offering_summary` when present in request context
  - falls back to a compact summary from `request.brief.offer` if no explicit summary is supplied
- Verified that `email:record-outbound` already inherits draft metadata into `email_outbound.metadata`
- Updated docs:
  - `docs/Outreach_crew_five_cli_contract.md`
  - `docs/Database_Description.md`
  - `README.md`
  - `docs/tasks/add_offering_domain_to_icp_profiles.md`
- Added/updated tests for:
  - CLI ICP wiring
  - draft provenance persistence
  - outbound provenance propagation
- Verified with:
  - `pnpm test tests/cli.test.ts tests/drafts.test.ts tests/emailOutboundRecorder.test.ts tests/draftStore.test.ts`
  - `pnpm build`

## To Do

- Decide whether `Outreach` should treat missing `offering_hash` as a hard error or a warning
- If future replay needs become stricter, revisit a dedicated `offering_snapshots` table
