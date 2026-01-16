# Session Notes — 2026-01-15 (Smartlead Send: Direct API Prepare)

> Timestamp: 2026-01-15T23:51:00Z

## Overview
We aligned “Smartlead send” with the reality that we use the **direct Smartlead API** (not a Smartlead MCP server).
Instead of attempting to send one-off emails via `sendEmail`, the system now **prepares** a Smartlead campaign by
pushing leads and syncing the first sequence step from Supabase drafts.

This is the minimum functionality needed to get to “first outreach emails” while keeping Supabase as the spine.

## Completed
- Refactored `smartlead:send` to work with the direct Smartlead API (no MCP server dependency).
- Re-defined `POST /api/smartlead/send` as a **prepare** endpoint:
  - Requires internal `campaignId` (Supabase `campaigns.id`) and remote `smartleadCampaignId`.
  - In `dryRun=true`, computes counts only (no remote calls).
  - In `dryRun=false`, pushes leads + syncs one sequence step to Smartlead and links the internal campaign via
    `campaigns.metadata.smartlead_campaign_id`.
- Updated Web UI API client + Pipeline Send preview to pass the required ids.
- Added unit tests covering:
  - `smartleadSendCommand` prepare behaviour (dry-run + live).
  - Web dispatch validation + payload forwarding for `POST /api/smartlead/send`.
- Updated documentation:
  - `docs/web_ui_endpoints.md` Smartlead endpoint contract.
  - `docs/Setup_smartlead_mcp.md` CLI usage for prepare/send.

## Notes / Behaviour
- “Send” is now **Smartlead campaign preparation**:
  - Leads are sourced from the internal campaign’s segment snapshot (`segment_members` → `employees`).
  - A single sequence step is synced from the first generated draft (`drafts.status='generated'`).
  - No direct email send is executed by the API; Smartlead sends when the campaign is active in Smartlead.

## To Do
- Decide and implement campaign lifecycle control:
  - Start/pause/stop Smartlead campaign from the app if the API supports it, or keep the UI as “prepare + start in
    Smartlead”.
- Make internal ↔ Smartlead campaign mapping first-class in the UI:
  - Persist mapping at campaign creation time and avoid manual id copy/paste.
- Lead identity tracking:
  - Store Smartlead `lead_id` mapping per employee (or per outbound) so event ingestion can backfill `email_outbound`
    and analytics more reliably.
- Confirm segment snapshot prerequisites:
  - Ensure the pipeline always finalizes/snapshots segments before preparing Smartlead (so `segment_members` is
    populated).

