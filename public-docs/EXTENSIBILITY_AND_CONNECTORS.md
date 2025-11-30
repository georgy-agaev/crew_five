# Extensibility and Connectors

> Version: v0.1 (2025-11-30)

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

