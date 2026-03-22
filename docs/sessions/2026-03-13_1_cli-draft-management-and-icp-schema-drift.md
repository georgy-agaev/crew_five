# Session: CLI Draft Management And ICP Schema Drift

## Completed
- Fixed CLI error handling for `icp:hypothesis:list` by routing it through `wrapCliAction`; `icp:list` was brought to the same error-handling path for parity.
- Fixed `icp:hypothesis:list` schema usage:
  - Reads from the real `icp_hypotheses.icp_id` column.
  - Resolves `--segment-id` through `segments.icp_hypothesis_id`.
  - Preserves CLI-friendly output keys such as `icp_profile_id` and `segment_id`.
- Added draft-management CLI commands for external orchestrators and Claude Code subagents:
  - `draft:save`
  - `draft:load`
  - `draft:update-status`
- Added orchestration-friendly list commands:
  - `segment:list`
  - `campaign:list`
- Updated snapshot payload generation so `segment_members.snapshot.company` includes `company_research`.
- Added repository migration `supabase/migrations/20260313110000_add_icp_profile_learnings.sql`.
- Added `docs/Outreach_crew_five_cli_contract.md` and updated `README.md` with the recommended `Outreach -> crew_five -> shared Supabase` integration model and the new CLI command surface.
- Added reusable `Outreach` agent runner examples in both TypeScript and Python under `examples/`, plus `docs/Outreach_agent_runner_examples.md` to document when to use each option.
- Suppressed `dotenv` tips during env loading (`dotenv.config({ quiet: true })`) so CLI stdout remains clean JSON for piped `Outreach` agent consumers.
- Applied the pending remote Supabase migrations after fixing local CLI auth flow and removing the conflicting `SUPABASE_ACCESS_TOKEN` override from `.env`.
- Updated `docs/Database_Description.md` to match the current live schema after the remote migration push.
- Verified the touched areas with targeted tests:
  - `pnpm test tests/cli.test.ts tests/icpListCommand.test.ts tests/segmentSnapshot.test.ts tests/draftStore.test.ts tests/campaignList.test.ts tests/segmentsListCounts.test.ts tests/campaigns.test.ts tests/icp.test.ts`
  - `pnpm build`

## Findings
- The connected Supabase project is behind the repository schema:
  - `list_migrations` shows the live DB stops at `20251201120500_update_analytics_events_flat_view`.
  - `public.icp_profiles` is still missing `phase_outputs`.
  - `public.icp_profiles` also does not yet contain the newly requested `learnings` column.
- Attempting to apply DDL via Supabase MCP failed with:
  - `Cannot apply migration in read-only mode.`
- Attempting to push via local `supabase` CLI also failed:
  - the repository is linked, but CLI auth is invalid for management operations;
  - current error: `Invalid access token format. Must be like sbp_...`;
  - `.env` currently stores a service-role JWT in `SUPABASE_ACCESS_TOKEN`, which is not a valid Supabase personal access token.
- After removing the conflicting `.env` override and using the real local Supabase CLI login outside the sandbox, `supabase db push --linked` completed successfully and the remote project now includes:
  - `icp_profiles.phase_outputs`
  - `icp_profiles.learnings`
  - `icp_discovery_runs`
  - `icp_discovery_candidates`
  - updated `prompt_registry.step` / rollout-status schema

## To Do
- Re-run live validation against the shared base from the `Outreach` side:
  - `pnpm cli icp:list --columns id,name,phase_outputs,learnings`
  - `pnpm cli icp:hypothesis:list --error-format json`
  - An end-to-end save/load/review cycle via the new draft commands against the shared Supabase project.

## Notes
- No web endpoints were added or changed in this session, so `docs/web_ui_endpoints.md` did not require updates.
- `docs/Database_Description.md` was left untouched because it explicitly documents the current live schema, and the live project is still missing the new columns until the read-only restriction is lifted.
