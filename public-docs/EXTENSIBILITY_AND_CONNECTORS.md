# Extensibility and Connectors

> Version: v0.2 (2025-12-05)

The open-core toolkit is designed to be extended via connectors and adapters.
This lets the core remain open source while advanced integrations (e.g., CRM
connectors) can live in separate packages or services.

## Extension Points

- **Email delivery providers** – SMTP, Smartlead, and other tools that turn
  drafts into outbound emails.
- **Event sources** – systems that emit events (opens, clicks, replies) for
  `email_events`.
- **CRM/Enrichment connectors** – systems that provide additional company or
  contact data.

At the code level, these are expressed as interfaces or service contracts in
the open-core codebase (for example, `EmailProvider`, `EventIngestor`,
`CrmConnector`), and concrete implementations are wired in via adapters.

## Configuration Model

- Providers and connectors are selected via environment variables or config
  options (for example, `EMAIL_PROVIDER`, `CRM_CONNECTOR`).
- The CLI and Web adapter read these values and route work through the
  corresponding implementation.
- Safe defaults (mock/local implementations) are kept in the open-core repo so
  the project works out of the box.

## Open-Core vs. Commercial Connectors

The repository is structured so that:

- Open-core connectors and adapters live in this repo and are fully usable
  under the open-source license.
- Future commercial connectors (e.g., CRM integrations) can be implemented as:
  - Separate NPM packages that implement the same interfaces.
  - Hosted services accessed via HTTP adapters.
  - Private modules that are not part of this public repository.

This preserves API stability for open-core users while allowing a clear path to
add paid or proprietary functionality without changing the core.

## Research & Social Enrichment Connectors

- **Discovery vs. enrichment**  
  - Discovery of *new* companies and contacts is owned by search/Websets-style providers (for example, Exa) and flows through explicit staging and promotion steps before touching core tables.  
  - Enrichment providers (for example, AnySite, Firecrawl, Parallel) operate only on records that already exist in `companies` / `employees` (typically via `segment_members`), adding context rather than creating entities.

- **Integration pattern**  
  - Core app code talks to research/enrichment systems through **small HTTP clients** behind narrow interfaces (e.g., “fetch company insights”, “fetch persona insights”), not directly through dozens of MCP tools or vendor-specific APIs.  
  - Exa is used primarily for ICP discovery/search; AnySite is used as a targeted enrichment provider (LinkedIn/social/web parsing) after records are created; Firecrawl and Parallel are reserved for deeper web crawl and research scenarios.

- **CLI routing via providers**  
  - The enrichment CLI uses a provider registry to route calls: `pnpm cli enrich:run --segment-id <id> --provider mock|exa|parallel|firecrawl|anysite [--limit 10] [--run-now]`.  
  - When a provider is unknown or misconfigured (for example, missing API key), `enrich:run` fails fast and can emit structured JSON errors via `--error-format json`, with stable error codes (such as `ENRICHMENT_PROVIDER_UNKNOWN`) suitable for automation.

- **MCP usage**  
  - MCP servers for Exa/AnySite may be configured for external agents (Claude Desktop, code agents) but are treated as an optional façade on top of the same HTTP-based interfaces.  
  - The open-core CLI and Web adapter do **not** depend on the full MCP tool surface; they rely on the small, versioned HTTP interfaces described above to keep coupling and blast radius low.
