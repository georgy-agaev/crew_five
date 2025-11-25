# Session Plan – 2025-11-25 13:40:05

## Overview
Add a Send control page to run Smartlead send with dry-run/batch size and show a summary. Guard empty drafts and provide clear logging.

## Tasks
- Completed: Send page with dry-run/batch size form and summary panel (mock API).
- To Do: Guard when no drafts are available; show informative message.
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/src/pages/Send.tsx`, `web/src/components/SendSummaryCard.tsx`.
- `web/src/api/client.ts` – send endpoint wrapper.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `useSendSmartlead(opts)` – call send API, return summary.
- `SendSummaryCard` – display fetched/sent/failed/skipped.

## Tests
- `send.calls_api_with_dry_run` – form triggers send with dry-run flag.
- `send.shows_summary` – summary rendered after API returns.

## Status
- Send page implemented against mock API; need guard for empty drafts and doc updates.
