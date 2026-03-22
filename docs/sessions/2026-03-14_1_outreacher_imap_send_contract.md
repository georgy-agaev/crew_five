# 2026-03-14 Session 1 - Outreacher IMAP Send Contract

> Version: v0.1 (2026-03-14)

## Context

`Outreacher` is the AI orchestration layer. `crew_five` remains the execution/data layer over the shared
Supabase. Smartlead is no longer the target send transport. Instead, the preferred runtime path is:

`Outreacher -> imap_mcp -> crew_five/Supabase`

The existing data model already has the right spine:

- `drafts`
- `email_outbound`
- `email_events`

The missing pieces are:

- recipient resolution should prefer `employees.work_email` and fall back to `employees.generic_email`
- `Outreacher` needs a clean way to load drafts together with resolved recipient metadata
- successful/failed sends performed via `imap_mcp` must be written back into `email_outbound`
- reply/bounce/unsubscribe events should continue to flow through `event:ingest`

## Options Considered

### Option A - Outreacher orchestrates `imap_mcp`, `crew_five` records state

- `Outreacher` loads drafts from `crew_five`
- `Outreacher` sends via `imap_mcp`
- `Outreacher` records results back through `crew_five`

Pros:
- Minimal new infrastructure
- Keeps `Outreacher` as the mailbox-aware agent
- Keeps `crew_five` as the source of truth for state and analytics

Cons:
- Requires a new outbound-recording CLI surface in `crew_five`

### Option B - `crew_five` talks directly to SMTP/IMAP

- Replace Smartlead with direct SMTP/IMAP code inside `crew_five`

Pros:
- Full control from one codebase

Cons:
- Duplicates capabilities already available in `imap_mcp`
- Pushes mailbox orchestration into `crew_five`

### Option C - Add a separate local mail gateway service

- `Outreacher` talks to a mail service
- the service talks to SMTP/IMAP
- `crew_five` only receives normalized results

Pros:
- Good long-term boundary for rotation, warm-up, and rate limits

Cons:
- Extra service surface to build and maintain now

## Chosen Direction

Option A for this session.

Why:

- It matches the desired architecture: `Outreacher` as agent, `crew_five` as CLI/data tool
- It reuses the already available `imap_mcp` send + reply capabilities
- It preserves the canonical spine in Supabase without introducing a second send ledger

## Planned Implementation

### 1. Recipient resolution

Add a shared resolver in `crew_five`:

- first choice: `employees.work_email`
- fallback: `employees.generic_email`
- if both are empty: mark draft as not sendable

Resolver output should also include:

- `recipient_email`
- `recipient_email_source` = `work` | `generic` | `missing`
- `recipient_email_kind` = `corporate` | `personal` | `generic` | `missing`

### 2. Draft loading for Outreacher

Extend `draft:load` so `Outreacher` can ask for recipient context without direct DB joins.

Target output per row:

- draft fields
- contact/company fields needed for send orchestration
- resolved recipient metadata
- `sendable` boolean

Keep the default response backward-compatible unless recipient context is explicitly requested.

### 3. Outbound recording

Add a new CLI command so `Outreacher` can report the result of a send performed through `imap_mcp`.

Required payload should support:

- `draftId`
- `provider` (expected default: `imap_mcp`)
- `providerMessageId`
- `senderIdentity`
- `recipientEmail`
- `recipientEmailSource`
- `status` = `sent` | `failed`
- optional `metadata`
- optional `error`
- optional `sentAt`

Expected side effects:

- insert row into `email_outbound`
- update `drafts.status`
- merge/send metadata needed for later reply correlation

### 4. Reply/event ingestion

No new event schema is needed in this session.

`Outreacher` should continue to use:

- `event:ingest --payload <json>`

with `provider='imap_mcp'` and the `outbound_id`/`provider_message_id` it knows from send tracking.

## Completed

- Audited the current `crew_five` send/event surfaces:
  - `drafts`
  - `email_outbound`
  - `email_events`
  - existing `event:ingest`
- Audited the local `imap-mcp-server` and confirmed it supports:
  - SMTP send
  - IMAP read/search
  - reply/forward flows
- Chosen architecture for this session: `Outreacher -> imap_mcp -> crew_five`
- Added shared recipient resolution with `work_email -> generic_email`
- Extended `draft:load` with `--include-recipient-context` and resolved fields:
  - `recipient_email`
  - `recipient_email_source`
  - `recipient_email_kind`
  - `sendable`
- Added `email:record-outbound` so `Outreacher` can persist results of sends performed via `imap_mcp`
- Updated `docs/Outreach_crew_five_cli_contract.md` and `README.md` for the new send flow
- Added `docs/Outreacher_operating_model.md` with the full recommended process for send orchestration, inbox polling, follow-up scheduling, reply classification, and pattern analytics
- Added tests covering:
  - recipient resolution
  - recipient-aware draft loading
  - outbound recording
  - CLI wiring
- Verified with:
  - `pnpm test tests/recipientResolver.test.ts tests/draftStore.test.ts tests/emailOutboundRecorder.test.ts tests/cli.test.ts`
  - `pnpm build`

## To Do

- Decide whether to retrofit legacy `email:send` to use the same recipient resolver for direct SMTP mode
- Add mailbox-pool selection and rate-limit metadata to the `Outreacher` side of the contract
- Add reply-ingest examples for `imap_mcp -> event:ingest`
