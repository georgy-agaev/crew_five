# Smartlead Integration (Optional)

Use Smartlead as a delivery tool without depending on a local MCP server. This guide focuses on
configuration and thin client wiring so we can stay on core AI SDR tasks.

## What This Covers
- Using the Smartlead HTTP API directly from this repo.
- Optional MCP usage in IDEs (Claude/Cursor/etc.) if you want extra tooling.
- Securing access tokens outside git.
- Integration options (ingest-first vs. full loop) with guardrails (`dryRun`, idempotency).

## Prerequisites
- Smartlead account with API access (see Smartlead docs).
- Node 18+ and `pnpm` installed locally.
- This repo checked out with `.env` gitignored (keep tokens out of git).

## Configure Environment Variables (direct API)
Add these to your local `.env` (never commit secrets):
- `SMARTLEAD_API_BASE` – base URL for the Smartlead API (for tests/dev you can use a stub or
  proxy; in production point to the real API host).
- `SMARTLEAD_API_KEY` – API key for the Smartlead API.
- `SMARTLEAD_WORKSPACE_ID` – optional, if your org requires scoping.

For backwards compatibility, the CLI and web adapter will also accept the legacy MCP-style envs:
- `SMARTLEAD_MCP_URL`
- `SMARTLEAD_MCP_TOKEN`
- `SMARTLEAD_MCP_WORKSPACE_ID`

When both are present, `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY` / `SMARTLEAD_WORKSPACE_ID` take
precedence in code. Also add the new keys to `.env.example` without real values.

The CLI fails fast when these envs are missing with a `SMARTLEAD_CONFIG_MISSING` error. Use
`--error-format json` on `smartlead:campaigns:list` (and other Smartlead commands that support it)
to capture structured `{ ok: false, error: { code, message } }` output in automation.

## Optional: MCP for IDEs
If you want to use Smartlead inside Claude, Cursor, or other MCP-aware tools, you can still run a
Smartlead MCP server or use `mcp-remote` pointing at a hosted Smartlead MCP endpoint. That setup is
IDE-specific and does not affect this repo’s direct API integration.

Keep any MCP client config (IDE settings) out of version control and always source the API key from
`.env` or a secret manager.

## Integration Options (choose one to start)
1) **Docs + wrapper only**: add a thin Smartlead client wrapper to call API methods; reuse
   existing orchestrators; no new CLI surface yet.
2) **Read/ingest first**: use campaign analytics plus webhooks to feed existing `event:ingest` and
   keep outbound on SMTP while we validate ingest paths.
3) **Full loop**: use Smartlead for campaigns + leads + sequences while still relying on Supabase
   as the spine for segments/drafts/results. Always support `--dry-run` when mutating remote state.

This repo now follows option 3 for the minimal loop we need: list campaigns, push leads, and sync
email sequences.

## Guardrails & Testing
- Always support `--dry-run` for Smartlead actions; print a single summary per run to avoid
  duplicate logs.
- Use deterministic idempotency keys in `email_outbound` when logging sends, even when Smartlead is
  the delivery provider.
- Tests use mocked Smartlead clients (no live API calls). Cover success, failure, and dry-run
  paths for each command.

## What to Update in Code (when we wire this)
- `src/integrations/smartleadMcp.ts` – thin Smartlead API client for campaigns, leads, sequences.
- `src/commands/smartleadCampaignsList.ts` – campaign list summaries for CLI/web.
- `src/commands/smartleadLeadsPush.ts` – map Supabase contacts to Smartlead leads and push.
- `src/commands/smartleadSequencesSync.ts` – sync primary email subject/body into campaign sequences.
- `src/cli.ts` – register `smartlead:*` commands and ensure they share error handling & telemetry.

## Security
- Keep MCP tokens in `.env`/secret manager (1Password CLI, etc.).
- Do not commit Smartlead configs or tokens.
- Rotate tokens periodically; document rotations in session logs.

## CLI Usage (ingest-first)
- List campaigns (read-only):  
  `pnpm cli smartlead:campaigns:list [--dry-run] [--format json|text]`
- Push leads into a Smartlead campaign:  
  `pnpm cli smartlead:leads:push --campaign-id <id> [--limit <n>] [--dry-run] [--error-format json]`
  - Reads contacts from Supabase (`employees`) and maps name/email/company fields into
    Smartlead `lead_list` entries.
  - In `--dry-run` mode, prints a summary without calling the Smartlead API.
- Sync primary email message into a Smartlead campaign sequence:  
  `pnpm cli smartlead:sequences:sync --campaign-id <id> [--step <n>] [--variant-label <label>] [--dry-run]`
  - Uses the first generated draft for the campaign as the source of subject/body by default.
  - In `--dry-run` mode, prints the would-be payload without mutating the campaign.
- Prepare a Smartlead campaign from an internal campaign (push leads + sync sequence):  
  `pnpm cli smartlead:send --campaign-id <internal_uuid> --smartlead-campaign-id <smartlead_id> [--batch-size <n>] [--step <n>] [--variant-label <label>] [--dry-run]`
  - Pulls contacts from the internal campaign’s segment snapshot (`segment_members`) and pushes them
    to Smartlead.
  - Syncs one sequence step from the first generated draft (subject/body).
  - This does not “force send” an email directly; Smartlead sends when the campaign is active in
    Smartlead.
