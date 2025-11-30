# Getting Started

> Version: v0.1 (2025-11-30)

This guide describes how to install, configure, and run the open-core AI SDR GTM
Toolkit from the public repository.

## Install

- Install Node.js 20+.
- Install pnpm: `npm install -g pnpm`.
- Install dependencies:
  - `pnpm install`

## Configure

- Copy your environment template and configure Supabase:
  - `cp .env.example .env`
  - Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Optional providers (SMTP, Smartlead API, etc.) are configured via additional
  env vars; see comments in `.env.example` and provider-specific docs when they
  are published.

## Run CLI

Common commands:

- Validate filters (no DB writes):
  - `pnpm cli filters:validate --filter '[{"field":"employees.role","operator":"eq","value":"CTO"}]'`
- Create a segment:
  - `pnpm cli segment:create --name "Fintech" --locale en --filter '{...}'`
- Snapshot a segment:
  - `pnpm cli segment:snapshot --segment-id <id> --max-contacts 5000`
- Create a campaign:
  - `pnpm cli campaign:create --name "Q1 Push" --segment-id <id> --snapshot-mode refresh`
- Generate drafts:
  - `pnpm cli draft:generate --campaign-id <id> --limit 100 --dry-run`

Use `pnpm cli --help` to list all commands and options.

## Run Web UI

- From the repo root:
  - `cd web`
  - `pnpm install`
  - `pnpm dev`
- The web UI talks to the same adapter/server used by the CLI. Ensure your
  `.env` is configured and any required adapter env vars are set.

## Tests and Guardrails

- Unit tests:
  - `pnpm test`
- TypeScript build:
  - `pnpm build`
- AST guardrails:
  - `pnpm run scan:ast-grep`
- Security and dependency checks (when configured):
  - `pnpm lint`
  - `pnpm run scan:secrets`
  - `pnpm run audit`

