# Session Plan – 2025-11-24 17:05:00

## Overview
Plan the rollout of a minimal but functional Web UI that mirrors current CLI flows: view campaigns/drafts/outbound/events, trigger draft generation and Smartlead send, and surface reply patterns. Keep scope tight; no legacy fallback.

## Sessions

1) **UI Scaffold & API bridge**
- Tasks: Add a lightweight React/Vite app in `web/`; set up a small API layer that calls existing CLI/service handlers via a server adapter (no new business logic). Add `.env` for Supabase/Smartlead keys (client-safe).
- Files: `web/` scaffold, `README.md`, `CHANGELOG.md`.
- Functions: `apiClient.fetchCampaigns()`, `apiClient.triggerDraftGenerate()`, `apiClient.triggerSmartleadSend()`.
- Tests: `apiClient.calls_cli_endpoints_mocked` – stub fetch to CLI adapter.

2) **Campaigns & Drafts Views**
- Tasks: Campaign list/detail, drafts list filtered by status; buttons to run draft generation (dry-run + limit).
- Files: `web/src/pages/Campaigns.tsx`, `web/src/components/DraftTable.tsx`, API calls.
- Functions: `useCampaigns()`, `useDrafts(campaignId)`.
- Tests: `campaigns.renders_and_calls_api`, `drafts.triggers_generate_action`.

3) **Send Control & Summaries**
- Tasks: UI to run Smartlead send with dry-run/batch size; show summary; guard if no drafts.
- Files: `web/src/pages/Send.tsx`, API call wrapper.
- Functions: `useSendSmartlead(opts)`, `SendSummaryCard`.
- Tests: `send.calls_api_with_dry_run`, `send.shows_summary`.

4) **Events & Reply Patterns**
- Tasks: Show events feed (recent) and reply pattern counts; optional since/limit filters.
- Files: `web/src/pages/Events.tsx`, `web/src/components/PatternsChart.tsx`, API calls to `event:ingest` proxy and `getReplyPatterns`.
- Functions: `useEvents({ since, limit })`, `useReplyPatterns()`.
- Tests: `events.fetches_and_renders_rows`, `patterns.renders_counts`.

5) **Settings & Guardrails**
- Tasks: Settings page for Retry-After cap, assume-now toggle (with warning), and logging opt-in; surface env hints.
- Files: `web/src/pages/Settings.tsx`, `README.md`.
- Functions: `useSettingsStore()`, `updateSettings()`.
- Tests: `settings.updates_and_persists`, `settings.shows_warnings_for_assume_now`.

6) **Telemetry & UX polish**
- Tasks: Wire optional telemetry hooks for assume-now usage and send summaries (no PII); add loading/error states; basic layout/nav.
- Files: `web/src/hooks/useTelemetry.ts`, layout components.
- Functions: `logAssumeNowUsage(info)`, `logSendSummary(summary)`.
- Tests: `telemetry.hook_invoked_on_assume_now`, `ui.shows_loading_and_errors`.

## Notes
- Keep web API layer thin: reuse existing service/CLI adapters; no new business rules.
- No legacy fallback; prefer dry-run toggles for destructive actions.
- Ensure env handling keeps secrets out of the browser; use server proxy if needed.
