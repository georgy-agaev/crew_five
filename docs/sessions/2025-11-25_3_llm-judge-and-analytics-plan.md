# Session Plan – 2025-11-25 00:09:58

## Overview
Add an LLM judge scaffold to score drafts and log analytics for Pattern Breaker dashboards. Keep scope to scoring stub, storage, and tests; no UI yet.

## Tasks
- Completed: Add judge service with stubbed AI call and scoring schema.
- Completed: Persist scores/reasons to drafts/analytics table.
- Completed: Add CLI command to run judge on a campaign or draft set (dry-run supported).
- Completed: Update docs/changelog and session log.

## Files to Touch
- `src/services/judge.ts` – judge client/stub and scoring.
- `src/commands/judgeDrafts.ts`, `src/cli.ts` – CLI wiring with dry-run/limit.
- `tests/judge.test.ts`, `tests/cli.test.ts` – scoring/persistence flows.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `scoreDraft(aiJudge, draft)` – returns scores/reasons for a draft.
- `recordJudgement(client, draftId, score)` – persist scores into drafts/analytics.
- `judgeDraftsCommand(args)` – CLI entry to run judge with dry-run/limit.

## Tests
- `judge.scores_and_persists` – stores scores/reasons.
- `judge.rejects_missing_inputs` – errors on incomplete draft data.
- `cli.judge_drafts_dry_run` – CLI runs judge in dry-run/limit mode.

## Outcomes
- Judge stub added with scoring schema and CLI `judge:drafts` (dry-run/limit); tests added; changelog updated (0.1.28).

## Review Notes
- Stub is simple; consider validating inputs (non-empty subject/body) and surfacing a warning when skipped.
- Scoring schema is flat; if we expand, keep scores normalized (0–1) and documented.
- A small summary count in CLI output (judged/failed) is good; if we log, reuse the JSON summary pattern to stay DRY.
