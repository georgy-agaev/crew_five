# Session Plan – 2025-11-27 Smartlead Direct API Wiring (In Progress)

## Overview
- Goal: Replace the Smartlead MCP dependency with a minimal, direct Smartlead HTTP API integration that supports the flows we actually need now: (1) selecting campaigns, (2) pushing leads (names/emails) into a chosen campaign, and (3) syncing message subjects/bodies into Smartlead campaign sequences.
- Scope: Keep the existing CLI/web shape (`smartlead:*` commands, Supabase as the spine) while introducing a thin Smartlead API client that calls only the endpoints we need. Avoid legacy MCP fallbacks unless a test or existing code path absolutely depends on them.

## High-Level Plan (This Session)
- Implement a Smartlead API-backed client for campaigns, leads, and sequences, controlled via `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY`.
- Add CLI commands to:
  - list campaigns (already working),
  - push leads from Supabase into a Smartlead campaign,
  - sync a primary email sequence (subject/body) into a Smartlead campaign.
- Ensure the web adapter shows Smartlead readiness correctly based on API envs.
- Add targeted tests that validate URL construction, payload shapes, and CLI wiring without calling the real API.

## Files to Touch
- `src/integrations/smartleadMcp.ts`
  - Extend the existing client to support:
    - `listCampaigns` via Smartlead analytics API (already partially wired).
    - `addLeadsToCampaign(campaignId, leads, options)` – POST `/api/v1/campaigns/{campaign_id}/leads?api_key=...`.
    - `saveCampaignSequences(campaignId, sequences)` – POST `/api/v1/campaigns/{campaign_id}/sequences?api_key=...`.
  - Keep behaviour behind the existing `SmartleadMcpClient` type so current CLI/web wiring remains valid.

- `src/commands/smartleadCampaignsList.ts`
  - Confirm it still works with the new API-backed `listCampaigns` and adapt summary fields if needed.

- `src/commands/smartleadLeadsPush.ts` (new)
  - New CLI command handler to:
    - Pull contacts from Supabase (e.g., from `segment_members`/`employees`),
    - Map them into Smartlead `lead_list` objects,
    - Call `client.addLeadsToCampaign`.

- `src/commands/smartleadSequencesSync.ts` (new)
  - New CLI command handler to:
    - Select a base message (subject/body) for a campaign (e.g., from a draft or template),
    - Build a minimal `sequences` payload for Smartlead,
    - Call `client.saveCampaignSequences`.

- `src/commands/smartleadSend.ts`
  - Decide on short-term behaviour:
    - Either keep as-is but **document as experimental**, or
    - Make it a thin wrapper over `smartleadLeadsPush` + a simple “campaign is ready to run in Smartlead” summary.
  - For this session, avoid expanding send semantics until leads + sequences are stable.

- `src/cli.ts`
  - Confirm `getSmartleadClient` prefers `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY` (already adjusted).
  - Wire new commands:
    - `smartlead:leads:push`
    - `smartlead:sequences:sync`
  - Keep error formatting (`--error-format json`) consistent with existing CLI patterns.

- `src/web/server.ts`
  - Ensure `buildSmartleadClientFromEnv` uses `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY` and marks `smartleadReady` correctly.
  - No new web endpoints in this session; just keep readiness signals accurate for the UI.

- `tests/smartleadMcp.test.ts`
  - Add coverage for:
    - `addLeadsToCampaign` (URL, query, payload shape).
    - `saveCampaignSequences` (URL, query, payload, success/error handling).

- `tests/cli.test.ts`
  - Add CLI wiring tests for:
    - `smartlead:leads:push`
    - `smartlead:sequences:sync`
  - Ensure these commands:
    - Validate required flags,
    - Call the client with the right arguments,
    - Respect `--dry-run` and `--error-format json`.

- `docs/Setup_smartlead_mcp.md`
  - Keep the new “Smartlead Integration” framing.
  - Document new commands and env usage for direct API, without introducing MCP-specific fallbacks.

- `README.md`
  - Add a short “Smartlead Direct API” subsection that:
    - Lists `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY`,
    - Documents `smartlead:campaigns:list`, `smartlead:leads:push`, `smartlead:sequences:sync`.

## Functions to Implement / Update

- `buildSmartleadMcpClient(config: SmartleadMcpConfig): SmartleadMcpClient`
  - Existing factory; extend it so that when `config.url` points at `https://server.smartlead.ai/api/v1`, it:
    - Uses `api_key` query params instead of bearer headers where required,
    - Exposes `addLeadsToCampaign` and `saveCampaignSequences` methods.

- `addLeadsToCampaign(campaignId: string, leads: SmartleadLeadInput[], options?: SmartleadLeadSettings)`
  - New helper in `src/integrations/smartleadMcp.ts`.
  - Calls `POST /api/v1/campaigns/{campaign_id}/leads?api_key=token` with a `lead_list` array and optional `settings`, returns summary/lead IDs.

- `saveCampaignSequences(campaignId: string, sequences: SmartleadSequenceInput[])`
  - New helper in `src/integrations/smartleadMcp.ts`.
  - Calls `POST /api/v1/campaigns/{campaign_id}/sequences?api_key=token` with a minimal `sequences` array (first step + variant(s)), returns Ok/error.

- `smartleadLeadsPushCommand(client: SmartleadMcpClient, supabase: SupabaseClient, options: { campaignId: string; limit?: number; dryRun?: boolean; segmentId?: string; })`
  - New command handler that:
    - Reads contacts from Supabase (e.g., via `segment_members` joined to `employees`),
    - Builds Smartlead lead objects (first_name, last_name, email, company_name, custom_fields),
    - In dry-run mode: prints a summary only; otherwise calls `addLeadsToCampaign`.

- `smartleadSequencesSyncCommand(client: SmartleadMcpClient, supabase: SupabaseClient, options: { campaignId: string; variant?: string; step?: number; dryRun?: boolean; })`
  - New command handler that:
    - Resolves a base subject/body (e.g., from the first generated draft or a canonical template),
    - Builds a single-step sequence payload with a single variant to keep behaviour predictable,
    - In dry-run mode: prints the would-be payload; otherwise calls `saveCampaignSequences`.

- `createProgram(deps: CliDependencies)` (in `src/cli.ts`)
  - Extend the CLI to register:
    - `smartlead:leads:push` with options for `--campaign-id`, `--segment-id`, `--limit`, `--dry-run`, `--error-format`,
    - `smartlead:sequences:sync` with options for `--campaign-id`, `--variant`, `--step`, `--dry-run`, `--error-format`.

- `buildSmartleadClientFromEnv()` (in `src/web/server.ts`)
  - Already updated to use API envs; just ensure it continues to type-compatibly return a `SmartleadMcpClient` and that we do not accidentally override new methods.

### Draft Pattern & User Edit Tracking (extension)

- `generateDrafts(...)` (in `src/services/drafts.ts`)
  - Enriches `drafts.metadata` with:
    - `draft_pattern` – composite of `coach_prompt_id`, `pattern_mode`, and variant (e.g., `Cold_Bump_Email_Coach_v2_Enhanced:reverse_psychology:A`).
    - `user_edited` – boolean flag, default `false` on initial AI generation.
  - This ensures Prompt Pack + Pattern Breaker + variant choices are traceable per draft.

## Tests to Add / Update

- `smartleadMcp.add_leads_uses_correct_url_and_payload`
  - Ensures `/api/v1/campaigns/{id}/leads?api_key=...` and body `lead_list` shape.

- `smartleadMcp.save_sequences_uses_correct_url_and_payload`
  - Ensures `/api/v1/campaigns/{id}/sequences?api_key=...` and minimal `sequences` payload.

- `smartleadMcp.add_leads_handles_4xx_and_error_body_snippet`
  - Verifies error message includes status and truncated body snippet.

- `cli.smartlead_leads_push_builds_leads_from_supabase_rows`
  - Mocks Supabase rows and confirms `addLeadsToCampaign` is called with expected lead objects.

- `cli.smartlead_leads_push_respects_dry_run_and_error_format_json`
  - Validates that in `--dry-run` + `--error-format json`, no API call is made and JSON summary is printed.

- `cli.smartlead_sequences_sync_builds_sequence_from_draft_or_template`
  - Mocks a draft/template and ensures `saveCampaignSequences` receives subject/body, sequence number, and variant label.

- `cli.smartlead_sequences_sync_respects_dry_run_and_missing_campaign_errors`
  - Covers dry-run behaviour, required `--campaign-id`, and propagated errors when the campaign is not found.

## Completed vs To Do (for this session)

- Completed:
  - Clarified direct Smartlead API base (`SMARTLEAD_API_BASE`, `SMARTLEAD_API_KEY`) and confirmed `smartlead:campaigns:list` against your tenant.
  - Updated env wiring in `src/cli.ts`, `src/web/server.ts`, `README.md`, and `docs/Setup_smartlead_mcp.md` to prefer the direct API.
  - Implemented `addLeadsToCampaign` and `saveCampaignSequences` in `src/integrations/smartleadMcp.ts` with targeted tests in `tests/smartleadMcp.test.ts`.
  - Added `smartleadLeadsPushCommand` and `smartleadSequencesSyncCommand` plus CLI wiring in `src/cli.ts`, with coverage in `tests/cli.test.ts`.
  - Updated docs (`README.md`, `docs/Setup_smartlead_mcp.md`) to describe the new direct Smartlead API commands and envs.
  - Enriched `generateDrafts` so each draft records a stable `draft_pattern` (prompt pack + pattern_mode + variant) and a `user_edited` flag in `drafts.metadata`.
  - Introduced a requirements ID scheme in `docs/Requirements_ID_Scheme.md` and cross-referenced it from PRD v0.2 and the v0.3/v0.4 roadmaps for future traceability.

- To Do (this session):
  - Optionally extend tests to cover additional Smartlead error paths (4xx/5xx) if we see specific failure modes in practice.
  - Decide how/when to evolve `smartlead:send` now that leads + sequences are API-backed (out of scope for this session).
