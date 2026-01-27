# Session: Draft generation persists to Supabase (Live mode)

> Timestamp: 2026-01-21 18:30:00 +0100

## Overview

The Pipeline Draft step reported Live generation success, but `public.drafts` remained empty. This session hardens the
draft generator to reliably persist drafts in production data and makes the built web adapter runnable so we can
reproduce issues deterministically.

## Completed

- Confirmed the failure mode in Live:
  - `POST /api/drafts/generate` returned `generated=1` but also `failed=1`, leaving `public.drafts` empty.
- Fixed root cause: AI draft metadata could be incomplete (missing `email_type`, `language`, `pattern_mode`, etc.),
  which violates `public.drafts` NOT NULL constraints.
  - Generator now falls back to request/campaign-derived defaults for required fields before insert.
- Added unit coverage:
  - Draft generation falls back to request metadata when AI metadata is incomplete.
  - Draft generation reports insert errors back to the caller (summary includes `failed` + `error` message).
- Verified Live insertion against Supabase:
  - `drafts_total` incremented after calling `POST /api/drafts/generate` with `dryRun=false`.
- Improved Draft UX for troubleshooting:
  - Draft summary now includes `failed` and `skippedNoEmail` counts.
  - Live mode no longer auto-advances to Send unless drafts were successfully saved.

## Notes / Findings

- Current production data for `First Campaign`:
  - 235 segment members, but only 19 have non-empty `work_email`.
  - Draft generation is therefore capped by the number of eligible contacts with email.
- When Live generation returns `generated=0` it is almost always one of:
  - no eligible contacts with email, or
  - insert failures (now surfaced via `failed` + `error`).

## To Do

- Add an e2e smoke test for Draft generation (Live mode stubbed, Mock mode deterministic).
