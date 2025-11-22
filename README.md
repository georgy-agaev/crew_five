# AI SDR GTM System Workspace

This repo tracks specs and planning artifacts for the AI SDR GTM System. It keeps product requirements, architecture notes, setup instructions, and change history in one place while engineering work spins up.

## Directory Guide
- `docs/AI_SDR_GTM_PRD.md` – canonical product requirements document (Version 0.1, 2025‑11‑21).
- `docs/appendix_ai_contract.md` – immutable `generate_email_draft` contract referenced by PRD.
- `docs/AI_SDR_Toolkit_Architecture.md` – CLI/architecture overview driving the implementation approach.
- `docs/GMT_system_plan.md` – staged rollout plan for outreach system.
- `docs/Setup_Guide.md` – local environment prerequisites (macOS focused).
- `docs/Database_Description.md` – current Supabase schema reference.
- `docs/sessions/YYYY-MM-DD_<n>_<slug>.md` – session backlog + outcomes (see `docs/sessions/2025-11-21_1_initial-prd-and-structure.md`).
- `Cold_*.md` – prompt-pack source files for Interactive Coach / Pipeline Express modes.
- `CHANGELOG.md` – log of project-level changes (keep updated with each PRD revision or major decision).
- `.env.example` – template for the Supabase environment variables needed by the CLI.

## Working Agreements
1. **Single Spine**: all GTM flows must traverse `segment → segment_members → campaign → drafts → email_outbound → email_events`.
2. **AI Contract**: every draft generation call uses the `generate_email_draft` interface (Appendix A); prompt updates stay behind this contract.
3. **SMTP First**: SMTP adapter is the default sending provider, Smartlead is optional.
4. **Mode Parity**: CLI and Web UI expose the same controls (Strict/Graceful, Interactive Coach/Pipeline Express).
5. **Changelog Discipline**: record notable decisions and doc updates in `CHANGELOG.md` with semantic version bumps.

## Python Virtual Environment
- Created `.venv/` using `python3.10 -m venv .venv`. Activate via `source .venv/bin/activate` before running any DSPy/GEPA scripts or Supabase helpers, then `deactivate` when finished.
- Keep Python dependencies isolated to this env; document new requirements in the README when tooling is added.

## Next Steps
- Translate PRD sections into Supabase migrations and CLI/Web tickets.
- Keep prompt-pack updates synchronized between Interactive Coach and Pipeline Express versions.
- Expand the changelog as new versions (0.2, 0.3, …) of the PRD/specs are published.
- Use the new CLI to manage the spine tables end to end:
  - Install deps: `pnpm install`
  - Run tests: `pnpm test`
  - Segment creation: `pnpm cli segment:create --name "Fintech" --locale en --filter '{"field":"employees.role","operator":"eq","value":"CTO"}'`
  - Segment snapshot: `pnpm cli segment:snapshot --segment-id <id> [--segment-version 2]`
  - Campaign creation: `pnpm cli campaign:create --name "Q1 Push" --segment-id <id> --segment-version 1 --snapshot-mode refresh`
  - Draft generation: `pnpm cli draft:generate --campaign-id <id>`
  Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are present (see `.env.example` once added).

### Segment Filter Definition
Segments store `filter_definition` as an array of clauses, e.g. `[{"field":"employees.role","operator":"eq","value":"CTO"}]`. Supported operators today are `eq` and `ilike`; snapshotting fails fast if an unsupported operator is encountered. Campaign creation enforces that a snapshot exists by using `--snapshot-mode reuse|refresh` (default `reuse`) and `--bump-segment-version` when an operator wants an entirely new version.
