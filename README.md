# crew_five

`crew_five` is the canonical outbound execution system for the current working setup.

Today it is not a generic GTM platform and not a fully autonomous AI SDR. Its actual job is simpler:

- keep the canonical GTM spine in Supabase,
- own campaign execution state,
- send emails through the live mailbox transport,
- poll inboxes and ingest obvious reply events,
- expose operator workflows in Web UI + CLI,
- provide stable read/write contracts for `Outreach`.

Public landing page:

- https://georgy-agaev.github.io/crew_five/

## Current Focus

The active product focus is:

1. stable outbound execution,
2. canonical campaign context,
3. operator usability,
4. safe integration boundaries with `Outreach`.

The project is already past the foundation stage. The current priority is not “add more modules”, but
“make the real operator loop reliable and easier to use”.

## Current System Boundary

### `crew_five` owns

- campaigns, waves, attaches, next-wave creation, rotation previews,
- mailbox assignment, send preflight, send policy, business-day calendar,
- direct send execution via `imap-mcp`,
- auto-send scheduling,
- inbox polling / `Poll now`,
- obvious reply ingestion into canonical `email_events`,
- operator-facing Web UI and CLI around the canonical spine.

### `Outreach` owns

- company processing,
- generation / review runtime,
- ambiguous reply interpretation,
- follow-up drafting on top of canonical `crew_five` state.

### Live transport

Current live runtime path:

`crew_five -> imap-mcp -> mailbox providers`

Legacy Outreach send / poll bridges are compatibility fallbacks, not the primary path.

## Canonical Model

- `project` = business/workspace boundary
- `icp_profile` = targeting root
- `offer` = business proposition
- `icp_hypothesis` = targeting + messaging preset
- `segment` = audience subset
- `campaign` = frozen execution wave over that subset

Execution always flows through the same spine:

`segment -> segment_members -> campaign -> drafts -> email_outbound -> email_events`

## What Works Now

- import preview/apply,
- processed-company save path,
- campaign launch,
- manual attach to campaign,
- next-wave preview/create,
- rotation preview groundwork,
- mailbox assignment,
- send preflight,
- manual `Send now`,
- auto-send intro + bump,
- inbox polling,
- obvious reply ingestion,
- operator dashboard and campaign workspaces.

## What Is Next

Current active priorities:

1. richer canonical generation context for `Outreach`,
2. canonical setup flow `project -> offer -> hypothesis -> segment -> campaign`,
3. inbox filtering / pagination / linkage-noise cleanup,
4. refreshed E2E coverage for the real operator surfaces.

Detailed engineering roadmap:

- [roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md)

## Local Runbook

### Required environment

Minimum live-mode env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IMAP_MCP_SERVER_ROOT`
- `IMAP_MCP_HOME`

Common live runtime env:

- `IMAP_MCP_SERVER_COMMAND`
- `IMAP_MCP_SERVER_ENTRY`
- `AUTO_SEND_ENABLED`
- `AUTO_SEND_INTERVAL_MINUTES`
- `AUTO_SEND_BATCH_LIMIT`
- `INBOX_POLL_ENABLED`
- `INBOX_POLL_INTERVAL_MINUTES`
- `INBOX_POLL_LOOKBACK_HOURS`

### Start locally

Install dependencies:

```bash
pnpm install
```

Run the live adapter:

```bash
pnpm dev:web:live
```

Default daily local URLs:

- adapter: `http://localhost:8787/api`
- UI: `http://localhost:5173`

Validation-only ports:

- adapter: `http://localhost:8888/api`
- UI: `http://localhost:5174`

### Core checks

```bash
pnpm build
pnpm lint
pnpm test
pnpm run scan:ast-grep
pnpm run audit
```

## Main CLI Surface

Most important commands for current operations:

- `pnpm cli campaign:list --error-format json`
- `pnpm cli campaign:detail --campaign-id <id> --error-format json`
- `pnpm cli campaign:launch:preview --payload '<json>' --error-format json`
- `pnpm cli campaign:launch --payload '<json>' --error-format json`
- `pnpm cli campaign:attach-companies --campaign-id <id> --company-ids '["<companyId>"]' --error-format json`
- `pnpm cli campaign:next-wave:preview --campaign-id <id> --error-format json`
- `pnpm cli campaign:next-wave:create --payload '<json>' --error-format json`
- `pnpm cli campaign:send-preflight --campaign-id <id> --error-format json`
- `pnpm cli campaign:auto-send:get --campaign-id <id> --error-format json`
- `pnpm cli campaign:auto-send:put --campaign-id <id> --payload '<json>' --error-format json`
- `pnpm cli campaign:send-policy:get --campaign-id <id> --error-format json`
- `pnpm cli campaign:send-policy:put --campaign-id <id> --payload '<json>' --error-format json`
- `pnpm cli campaign:mailbox-assignment:get --campaign-id <id> --error-format json`
- `pnpm cli campaign:mailbox-assignment:put --campaign-id <id> --payload '<json>' --error-format json`
- `pnpm cli draft:load --campaign-id <id> --include-recipient-context --error-format json`
- `pnpm cli company:save-processed --payload '<json>' --error-format json`

## Where To Read Next

- Shared runtime contract with `Outreach`:
  [Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
- Current engineering roadmap:
  [roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md)
- HTTP endpoint catalog:
  [web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md)
- Database reference:
  [Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md)
- Public-facing architecture/setup docs:
  [public-docs/](/Users/georgyagaev/crew_five/public-docs)

## License

This repository is licensed under the Apache License 2.0.

- Canonical text: [LICENSE](/Users/georgyagaev/crew_five/LICENSE)
- Open-core code stays reusable under `Apache-2.0`
- Private/commercial extensions should remain outside this repository and integrate through the
  documented public interfaces
