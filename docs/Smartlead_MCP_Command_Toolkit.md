# Smartlead MCP Command Toolkit

Use Smartlead MCP as a delivery tool within our end-to-end loop (DB → campaigns → AI drafts → Smartlead → replies → analysis → prompt/enrichment updates). This guide lists key commands and cautions.

## Lead Management
- `smartlead:add_leads_to_campaign` – add new leads directly to a campaign (primary).
- `smartlead:push_leads_to_campaign` – copy/move leads from a list to a campaign.
- `smartlead:update_campaign_lead` – update existing lead information.
- `smartlead:get_lead_by_email` – look up a lead before pushing (avoid duplicates).

**Caution:** `add_leads_to_campaign` does not dedupe. Consider `get_lead_by_email` or `get_domain_block_list` before pushing to avoid mailbox reputation burn.

## Email Content (Sequences)
- `smartlead:create_campaign` – create a campaign with initial email subject/body.
- `smartlead:save_campaign_sequences` – add/update multi-step sequences (overwrites!).
- `smartlead:get_campaign_sequences` – retrieve current sequences to review/backup before overwriting.

**Caution:** `save_campaign_sequences` replaces sequences; pull them first as a backup before edits.

## Campaign Results & Analytics
- `smartlead:get_campaign_stats` – core metrics (opens, clicks, replies, bounces) by sequence.
- `smartlead:get_campaign_analytics` – comprehensive analytics overview.
- `smartlead:get_campaign_analytics_by_date` – performance in a specific date range.
- `smartlead:get_campaign_sequence_analytics` – which email in the sequence performs best.
- `smartlead:get_campaign_lead_statistics` – individual lead engagement metrics.
- `smartlead:export_campaign_leads` – download all leads with their statuses.

**Caution:** Analytics can lag; opens/clicks often trickle in for 48–72 hours. Treat early stats as provisional.

## Usage Notes
- Keep Smartlead actions aligned with our spine: DB leads → campaign creation → AI personalization → Smartlead send → reply analysis → prompt/enrichment updates.
- Deduplicate inputs before pushing leads; maintain block lists where applicable.
- Backup sequences before edits to avoid losing control variants.
- Use delayed analytics for decisions; avoid optimizing on fresh sends.
- When using `--assume-now-occurred-at`, log/monitor usage; it can reduce dedupe accuracy. Use pattern counts and reply labels to drive prompt/enrichment updates.
- Route `onAssumeNow` and reply pattern counts into your telemetry/log pipeline to inform prompt tuning and enrichment strategy adjustments.
