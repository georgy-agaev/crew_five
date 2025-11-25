# Session Plan – 2025-11-25 13:40:05

## Overview
Add a Settings page to surface retry caps, assume-now toggle (with warnings), logging opt-in, and env hints. No sensitive data in browser.

## Tasks
- Completed: Settings page with retry cap, assume-now toggle, telemetry opt-in (client-only).
- Completed: Warnings for assume-now and PII guidance.
- Completed: Persist settings in local storage (or memory fallback).
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/src/pages/Settings.tsx`, `web/src/hooks/useSettingsStore.ts`.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `useSettingsStore()` – load/save settings locally.
- `updateSettings(values)` – apply and validate inputs (cap bounds).

## Tests
- `settings.updates_and_persists` – values saved/restored locally.
- `settings.shows_warnings_for_assume_now` – warnings visible when toggled.

## Status
- Settings page and storage implemented with tests; docs/changelog pending.
