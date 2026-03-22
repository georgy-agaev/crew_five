# Prompt Reference Usage – Production Mechanics

> Last updated: 2025-12-09

## How prompts are referenced
- Draft generation flows (`src/services/drafts.ts`, `src/services/coach.ts`) pass `coach_prompt_id`, `pattern_mode`, and `variant` into the AI client. `draft_pattern` is derived from these and stored in `drafts.metadata`.
- ICP coach flows (`src/services/coach.ts`, `src/services/icpCoach.ts`) accept an optional `promptId` for `icp_profile` and `icp_hypothesis` steps, which is recorded in the coach job payload and selected via the prompt registry active prompt per step.
- `prompt_registry` (migration `20251201102000_add_prompt_registry.sql`, helper `src/services/promptRegistry.ts`) is the source of truth for prompt IDs/versions/rollout status.
- Analytics uses `analytics_events_flat` to group performance by `draft_pattern` and `coach_prompt_id`.

## Updating prompts safely
1) Register a new prompt version in `prompt_registry` (add CLI or call service directly). Keep IDs stable when you want contiguous analytics; create a new `coach_prompt_id` for major changes.
2) Wire the new ID into generation:
   - For drafts, add CLI flags (recommended) to `draft:generate` for `--coach-prompt-id` and `--pattern-mode/variant`, or set defaults in config.
   - For ICP coach flows, set the active prompt per step (`icp_profile`, `icp_hypothesis`, `draft`) via the prompt registry; Web UI uses these active prompts when calling `/api/coach/icp` and `/api/coach/hypothesis`.
   - Ensure the AI client selects the right template based on these IDs.
3) Deploy prompt text updates in `prompts/` (sanitized) or `Cold_*.md`; align IDs with registry entries.
4) Measure via `analytics:summary` / `analytics:optimize`, which already group by `coach_prompt_id`/`draft_pattern`.

## When to bump IDs vs reuse
- Minor edits: keep the same `coach_prompt_id`, bump internal version in `prompt_registry` for traceability.
- Major prompt changes or new patterns: create a new `coach_prompt_id` (e.g., `intro_v3`), route traffic via `variant` or a feature flag, and compare metrics.

## Suggested next steps
- Add CLI flags `--coach-prompt-id` and `--pattern-mode/variant` to `draft:generate` for explicit selection.
- Optionally add `prompt:list` / `prompt:use` backed by `prompt_registry` to rotate prompts without code changes.
- Keep `draft_pattern` and `coach_prompt_id` intact to preserve analytics continuity; only change IDs when you want a clean time series break.
