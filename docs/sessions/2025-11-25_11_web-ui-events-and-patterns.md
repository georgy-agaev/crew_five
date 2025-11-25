# Session Plan – 2025-11-25 13:40:05

## Overview
Add Events and Reply Patterns view: show recent events (with since/limit filters) and pattern counts. Keep it read-only with mock API.

## Tasks
- Completed: Events page with table and filters (mock data, since/limit inputs).
- Completed: Patterns component shows reply_label counts (mock).
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/src/pages/Events.tsx`, `web/src/components/PatternsChart.tsx`.
- `web/src/api/client.ts` – events/patterns endpoints.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `useEvents({ since, limit })` – fetch events list.
- `useReplyPatterns(opts)` – fetch pattern counts (topN optional).

## Tests
- `events.fetches_and_renders_rows` – events load and render with filters.
- `patterns.renders_counts` – pattern counts shown correctly.

## Status
- Events/Patterns mock page implemented; docs/changelog pending.
