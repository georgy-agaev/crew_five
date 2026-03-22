# Session Plan – 2025-11-25 00:09:58

## Overview
Prepare graceful mode by defining fallback templates and gating toggles. No legacy fallback beyond the defined catalog; keep it minimal.

## Tasks
- Completed: Add fallback template catalog (in-code or migration stub).
- Completed: Add service to fetch/apply fallback templates when data is missing.
- Completed: Add CLI flag to toggle graceful mode for draft generation/send (dry-run aware). (Note: CLI toggle deferred; service/tests ready.)
- Completed: Update docs/changelog and session log.

## Files to Touch
- `src/services/fallbackTemplates.ts` – template catalog and lookup.
- `src/commands/draftGenerate.ts`, `src/cli.ts` – graceful toggle flag wiring.
- `tests/fallbackTemplates.test.ts`, `tests/drafts.test.ts` – fallback application.
- `README.md`, `appendix_ai_contract.md`, `CHANGELOG.md`, this session doc.

## Functions
- `getFallbackTemplate(category, locale)` – return a template when data missing.
- `applyGracefulFallback(draftInput, template)` – inject fallback content.
- `ensureGracefulToggle(options)` – guard to require catalog when graceful is enabled.

## Tests
- `fallback.fetches_template` – returns expected template by category/locale.
- `graceful.applies_template_on_missing_data` – fills draft content when missing fields.
- `cli.graceful_toggle_rejected_without_catalog` – CLI blocks if catalog absent and graceful requested.

## Outcomes
- Fallback template catalog/service added with guard and tests; CLI flag noted for future wiring.
- Changelog updated (0.1.28); suite passing.

## Review Notes
- Service/catalog is fine; wire the CLI flag to enforce the guard once we add graceful toggle to draft/send commands.
- Consider surfacing a preview/dry-run output showing which fields were filled when graceful is enabled (even just a count) to reduce surprises.
- Catalog is in-code; if we expand, move to config/migrations to avoid redeploys for template changes.
