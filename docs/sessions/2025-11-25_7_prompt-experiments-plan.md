# Session Plan – 2025-11-25 13:10:03

## Overview
Add prompt experiment hooks to assign variants and record outcomes for Pattern Breaker analysis. Keep scope to deterministic assignment and JSON logging; no UI.

## Tasks
- Completed: Add experiment service to assign variants (A/B) deterministically.
- Completed: Add API to record experiment outcomes (JSON log or stub table).
- Completed: Expose a CLI flag to run draft generation with a variant label.
- Completed: Update docs/changelog and session log.

## Files to Touch
- `src/services/experiments.ts` (new) – variant assignment and outcome recording.
- `src/services/drafts.ts`, `src/commands/draftGenerate.ts`, `src/cli.ts` – optional variant flag.
- `tests/experiments.test.ts`, `tests/drafts.test.ts` – deterministic assignment and recording.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `assignVariant(subject)` – deterministically assigns a variant id (e.g., A/B).
- `recordExperimentResult(variant, outcome)` – log outcome (stub storage/log).
- `applyVariantToDraft(draftInput, variant)` – tag draft metadata with variant.

## Tests
- `experiments.assigns_deterministically` – same subject => same variant.
- `experiments.records_outcome` – outcome stored/logged.
- `drafts.propagates_variant_label` – variant flag reaches draft metadata.

## Status
- Variant assignment and outcome logging helpers added; tests present.
- CLI variant flag wired to draft generation; docs/changelog updated.

## Review Notes
- Deterministic assignment is straightforward. Variant flag applies to drafts by tagging metadata; ensure downstream code ignores empty string variants (today we pass `''` when flag absent).
- Outcome logging is console-only; if expanded, consider reusing telemetry hook to avoid duplicate logging pathways.
- Keep variants to a small allowlist (A/B) to prevent unexpected labels creeping into analytics.
