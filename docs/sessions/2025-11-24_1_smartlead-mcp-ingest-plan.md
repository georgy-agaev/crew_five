# Session Plan – 2025-11-24 10:42:00

## Overview
Use Smartlead MCP in an ingest-first mode to avoid building a custom Smartlead connector. Deliver a thin MCP client, CLI entry points to list campaigns and pull events, and route pulled events into the existing `event:ingest` pipeline. No legacy fallback work.

## Tasks
- Completed: Add a typed Smartlead MCP client wrapper with `dryRun` support and single-summary logging.
- Completed: Add CLI commands (`smartlead:campaigns:list`, `smartlead:events:pull`) that call the wrapper; pipe pulled events into `event:ingest` for normalization/dedupe.
- Completed: Update docs (`README.md`, `docs/Setup_smartlead_mcp.md`) with usage examples and clarify `.env` keys; add changelog entry after implementation.
- Completed: Add Vitest coverage with mocked MCP responses for success/failure/dry-run and idempotent ingest.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – MCP client wrapper with typed methods and `dryRun`.
- `src/commands/smartleadCampaignsList.ts`, `src/commands/smartleadEventsPull.ts`, `src/cli.ts` – CLI wiring to list campaigns and pull events into `event:ingest`.
- `tests/smartleadMcp.test.ts`, `tests/cli.test.ts` – MCP wrapper and CLI behavior (dry-run, error paths, ingest piping).
- `README.md`, `docs/Setup_smartlead_mcp.md`, `CHANGELOG.md`, `docs/sessions/` – document setup/usage and log the changes.

## Functions
- `buildSmartleadMcpClient(config)` – constructs a client with base URL/token and optional workspace; returns typed methods for campaigns/events with `dryRun` guard.
- `listCampaigns(client, options)` – fetches campaigns via MCP, supports `dryRun`, returns normalized list with a single summary log.
- `pullEvents(client, options)` – fetches recent events via MCP, supports `dryRun`, returns normalized events for ingest.
- `smartleadCampaignsListCommand(args)` – CLI handler to list campaigns using the wrapper and print JSON/text summaries.
- `smartleadEventsPullCommand(args)` – CLI handler to pull events and pass them into `event:ingest` with idempotency on `provider_event_id`.

## Tests
- `smartleadMcp.client_calls_endpoints_with_auth` – ensures wrapper sets URL/token headers.
- `smartleadMcp.dry_run_skips_remote_calls` – dry-run avoids network, returns stub summary.
- `smartleadMcp.pull_events_normalizes_for_ingest` – normalizes events and preserves `provider_event_id`.
- `cli.smartlead_campaigns_list_outputs_summary` – CLI prints campaigns summary (json/text).
- `cli.smartlead_events_pull_calls_event_ingest` – CLI pulls events and invokes ingest with dedupe and `dryRun` pass-through.
