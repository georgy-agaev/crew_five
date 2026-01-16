# 2025-12-06 – Enrichment CLI Error Parity & Provider UX

> Timestamp (UTC): 2025-12-06T00:00:00Z  
> Goal: bring `enrich:run` error handling and provider selection UX into parity with other CLI commands (JSON/text errors, stable codes), and document how to use `--provider` alongside Exa and future enrichment connectors.

## Overview
The enrichment flows now support Exa discovery + enrichment and a multisource provider registry (`mock`, `exa`, `parallel`, `firecrawl`, `anysite`), but the CLI surface for `enrich:run` still lacks structured error handling (`--error-format`) and clear guidance for provider selection. This session tightens the CLI ergonomics and docs without changing job semantics or wiring new live providers.

## Scope (files to touch)
- **CLI**
  - `src/cli.ts` – wrap `enrich:run` in `wrapCliAction`, add `--error-format text|json`, and ensure unknown provider / misconfiguration errors surface via structured `{ ok:false, error:{ code,message,details } }` payloads when `--error-format json` is set.
  - `src/commands/enrich.ts` – leave async/legacy semantics intact; ensure provider selection and error codes remain stable (`EXA_ENRICHMENT_LEGACY_UNSUPPORTED`, `ENRICHMENT_PROVIDER_UNKNOWN`).
- **Tests**
  - `tests/cli.test.ts` – add coverage for `enrich:run` wiring with `--provider` and JSON error output when a bad provider is requested.
- **Docs**
  - `public-docs/EXTENSIBILITY_AND_CONNECTORS.md` – mention the `enrich:run --provider` flag and how it maps to the enrichment provider registry.
  - `CHANGELOG.md` – record enrichment CLI error parity and docs update.

## Functions / Behaviour (1–3 sentences)
- `enrich:run` (CLI wiring in `src/cli.ts`)  
  Adds `--error-format text|json` and uses `wrapCliAction` so enrichment errors (unknown provider, legacy Exa sync, env misconfig) are reported consistently with other commands, including JSON-mode `{ ok:false, error:{ code,message } }` payloads.

## Tests (name → behaviour in 5–10 words)
- `enrich_run_emits_json_error_for_unknown_provider`  
  `enrich:run --provider unknown --error-format json` prints structured JSON error and does not throw.

## Completed vs To Do
- **Completed (this session)**  
  - Added CLI wiring for `enrich:run` to support `--error-format text|json` and wrapped the handler in `wrapCliAction`, so enrichment errors are surfaced consistently with other commands instead of as unhandled exceptions.  
  - Updated `enrichCommand` to pre-validate the selected adapter/provider via the enrichment registry, ensuring unknown providers (and misconfigured ones like missing API keys) fail fast at CLI time.  
  - Added a CLI test `enrich_run_emits_json_error_for_unknown_provider` to assert JSON error payloads with code `ENRICHMENT_PROVIDER_UNKNOWN`, and adjusted enrichment tests to set `EXA_API_KEY` for Exa-specific flows.  
  - Documented `enrich:run --provider` routing and JSON error handling in `public-docs/EXTENSIBILITY_AND_CONNECTORS.md`, and recorded these changes under `[0.1.64]` in `CHANGELOG.md`.  
- **To Do (this session)**  
  - None – enrichment CLI error parity and provider UX improvements for this slice are complete.  
