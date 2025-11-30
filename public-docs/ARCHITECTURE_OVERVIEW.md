# Architecture Overview

> Version: v0.1 (2025-11-30)

The AI SDR GTM Toolkit is built around a single GTM spine, shared between the
CLI and Web UI. The public repository exposes the open-core engine; private
product docs and roadmaps are maintained separately.

## Core Concepts

- **Segments** – saved target definitions based on company/contact data.
- **Segment members** – entities selected by a snapshot of a segment at a
  point in time.
- **Campaigns** – outbound programs tied to segments and draft patterns.
- **Drafts** – AI-generated email drafts tied to a campaign and segment member.
- **Email outbound** – records of send attempts (provider-agnostic).
- **Email events** – opens/clicks/replies used for pattern analysis.

## Data Spine

All features are designed to follow a single spine:

- `segment → segment_members → campaign → drafts → email_outbound → email_events`

This keeps the CLI, Web UI, and integrations aligned and makes it easier to
reason about metrics and quality over time.

## Modules and Packages

- `src/cli.ts` – CLI entrypoint and command wiring.
- `src/commands/*` – individual CLI commands (segment, campaign, drafts,
  Smartlead, etc.).
- `src/services/*` – core application services (draft generation, email events,
  tracing, telemetry).
- `src/integrations/*` – integration clients and adapters (e.g., Smartlead MCP
  or direct API).
- `src/web/*` – HTTP adapter for the Web UI, exposing the same operations as
  the CLI.
- `web/src/*` – React-based Workflow Hub UI.
- `supabase/migrations/*` – database schema migrations for the GTM spine.
- `tests/*` and `web/src/**/*.test.tsx` – Vitest suites for CLI and Web flows.

## Open-Core Boundary

The public repository contains:

- Core data models and services.
- CLI and Web UI flows for segmenting, drafting, and sending via supported
  providers.
- Integration points for email delivery and event ingestion.

Future paid or proprietary features can plug in via:

- Additional providers or connectors implementing existing interfaces.
- Hosted services that implement the same adapter contracts as the local CLI.
- Optional packages that extend the open-core without changing its APIs.

See `public-docs/EXTENSIBILITY_AND_CONNECTORS.md` for details on the extension
model.

