# Session Plan – 2025-11-25 13:40:05

## Overview
Add optional telemetry hooks for UI actions (send, enrich, judge) and polish UX with loading/error states and basic layout/navigation.

## Tasks
- Completed: Telemetry hook to emit JSON summaries (opt-in) for key actions.
- Completed: Basic layout/nav added via App navigation.
- To Do: Add loading spinners/error toasts (pending).
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/src/hooks/useTelemetry.ts`, `web/src/components/Layout.tsx`, `web/src/components/Toast.tsx`.
- `web/src/pages/*` – wire loading/error states.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `useTelemetry(enabled)` – emit events when enabled; no PII.
- `Layout` – navigation/shell.
- `Toast` – display errors/success messages.

## Tests
- `telemetry.hook_invoked_on_actions` – events emitted when enabled.
- `ui.shows_loading_and_errors` – loading/error states render as expected.

## Status
- Telemetry hook added with tests; basic nav present. Loading/error polish pending; docs/changelog pending.
