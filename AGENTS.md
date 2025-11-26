# Repository Guidelines

## Project Structure & Module Organization
- `docs/AI_SDR_GTM_PRD.md` holds the authoritative product requirements; update it first when scope changes.
- `docs/appendix_ai_contract.md` defines the non-negotiable `generate_email_draft` contract; never modify the PRD without syncing this appendix.
- `docs/AI_SDR_Toolkit_Architecture.md`, `docs/GMT_system_plan.md`, `docs/Setup_Guide.md`, and `docs/Database_Description.md` provide architectural, roadmap, setup, and schema context respectively.
- `docs/Setup_smartlead_mcp.md` documents Smartlead MCP setup/integration options; keep tokens only in `.env`/secret stores.
- `docs/ast-grep_setup.md` documents ast-grep usage; run `ast-grep --config ast-grep.yml scan .` before commits to catch guardrail violations (CLI parity, idempotency, assume-now logging, retry caps, error hygiene).
- `docs/sessions/YYYY-MM-DD_<n>_<slug>.md` stores session tasks/outcomes (e.g., `docs/sessions/2025-11-21_1_initial-prd-and-structure.md`).
- `CHANGELOG.md` captures versioned changes; `README.md` is the entry point for repo orientation.
- Update `CHANGELOG.md` at the end of each session so the latest changes are recorded first.
- Prompt-pack drafts live at the root (`Cold_*.md`); keep Interactive Coach and Pipeline Express copies in sync.
- When current documentation is needed for external APIs/libraries, fetch it via Context7 (`resolve-library-id` + `get-library-docs`) instead of relying solely on model training data.
- When addressing problems or decisions, always propose at least three options (or combinations).
- Prompts are kept in `prompts/` (ignored except for `prompts/template.md`); store working drafts there, never commit secrets, and keep tracked templates sanitized.
- In session docs, explicitly mark tasks as “Completed” vs “To Do” so readers can see what’s done and what’s upcoming.

## Agent Roster (Copilot)
- @docs-agent  
  - Scope: Write/update `docs/`, `CHANGELOG.md`, `docs/sessions/*.md`; read `src/` for context; keep
    PRD and Appendix A synchronized.  
  - Commands: `pnpm build`, `pnpm test` (sanity before doc updates).  
  - Boundaries: Never edit `src/`, `supabase/migrations/`, or `prompts/`; ask before major rewrites.
- @cli-agent  
  - Scope: CLI behavior/guardrails in `src/cli.ts` and `src/commands/**`; enforce dry-run/retry/assume-now
    options per `ast-grep.yml`; keep CLI/Web parity.  
  - Commands: `pnpm build`, `pnpm test`, `pnpm cli ... --dry-run`, `ast-grep --config ast-grep.yml scan .`.  
  - Boundaries: No schema changes; coordinate with @ui-agent on parity shifts.
- @prompt-agent  
  - Scope: Prompt packs (`Cold_*.md`, `prompts/`), Coach vs Pipeline Express parity, Appendix A
    `generate_email_draft` contract, AI SDK usage.  
  - Commands: `pnpm cli draft:generate --campaign-id <id> --dry-run --fail-fast --limit 5`, `pnpm test`
    (prompt parity fixtures).  
  - Boundaries: Do not change DB or CLI flags without @cli-agent/@db-agent alignment.
- @db-agent  
  - Scope: Supabase schema/migrations in `supabase/migrations/` and `docs/Database_Description.md`; keep
    spine tables consistent.  
  - Commands: `supabase db diff --linked --f supabase/migrations/<name>.sql`, `supabase db lint`,
    `pnpm build`.  
  - Boundaries: Ask before destructive DDL; keep PRD/appendix references updated with @docs-agent.
- @test-agent  
  - Scope: Vitest suites in `tests/` (and `web/**/tests`); protect CLI/Web parity via fixtures/mocks.  
  - Commands: `pnpm test`, `pnpm test --runInBand`.  
  - Boundaries: Do not delete failing tests without approval; no schema or prompt edits.
- @ui-agent  
  - Scope: `web/` flows (segment selector, draft review, outreach control, logs); keep parity with CLI
    outputs/flags.  
  - Commands: `cd web && pnpm install`, `cd web && pnpm test`, `cd web && pnpm build`; may run
    `pnpm cli ... --format json` for parity checks.  
  - Boundaries: No Supabase schema or prompt changes.
- @ops-agent (optional)  
  - Scope: Observability/release hygiene for dev/stage; logging/telemetry/circuit breakers; cautious deploy
    steps.  
  - Commands: `pnpm build`, `pnpm test`, `supabase db reset` (only with approval), telemetry verification
    scripts.  
  - Boundaries: Dev/stage only; no production secrets; defer schema/prompt decisions to owners.

## Build, Test, and Development Commands
- Install deps: `pnpm install`
- Run unit tests (Vitest): `pnpm test`
- Execute the CLI: `pnpm cli <command>` (e.g., `pnpm cli segment:create --name ...`)
- Compile TypeScript: `pnpm build`
- For any Web UI changes, validate via Chrome DevTools MCP (use the `chrome-devtools` server) and attach logs/screenshots to the session file.

## Coding Style & Naming Conventions
- Follow Markdown best practices: wrap at ~100 chars, use `##` hierarchy, prefer bullet lists for requirements.
- Name session notes `YYYY-MM-DD_<increment>_<description>.md` inside `docs/sessions/`.
- For future code, default to TypeScript/SQL formatting enforced by Prettier and Supabase linting scripts once available; note the tool + config in README.
- Split files once they exceed ~300 LOC, and periodically merge APIs that share identical behaviour to avoid redundancy.
- Author `ast-grep` rules (https://ast-grep.github.io/) for recurring checks (e.g., CLI option validation, Supabase call patterns) and run them before shipping.

## Testing Guidelines
- Vitest is the testing framework; all new modules should ship with tests next to existing suites in `tests/`.
- Follow TDD (write failing test, implement, rerun). Keep `pnpm test` green before committing.
- Prefer unit tests with mocked Supabase clients and AI generators; integration tests can be added later as CLI matures.
- For backend + frontend features, add end-to-end coverage that exercises the full flow (data ingestion → Supabase → UI). Use Chrome DevTools MCP for UI automation and store artifacts in `docs/sessions/`.
- When tests become slow or flaky, schedule time to refactor them (and document findings) rather than ignoring failures.

## Commit & Pull Request Guidelines
- Use clear, imperative commit messages (e.g., “Add graceful mode gating”); group related doc edits into a single commit when possible.
- Every substantive change should update `CHANGELOG.md` with a new version heading or bullet.
- Pull requests must describe the scope, reference affected docs (PRD, appendix, changelog, session logs), and include any follow-up tasks.
- Keep CLI and Web UI requirements in parity; note deviations explicitly in PR descriptions until resolved.
- Include evidence of e2e runs (links to Chrome-devtools logs, screenshots) whenever a change spans backend + frontend.
- Regularly manage the GitHub repo (branch protections, backups) and note maintenance actions in session logs.

## Security & Configuration Tips
- Store secrets outside the repo (1Password CLI or env files referenced in `docs/Setup_Guide.md`).
- Document new API keys or provider requirements inside `README.md` and update the setup guide accordingly.
- Keep dependencies/tools current (brew, pnpm) and run `pnpm update` / `brew upgrade` routinely; log the upgrades.
- Manage Supabase migrations exclusively via the CLI (`supabase/migrations/`). Never apply schema changes manually without capturing SQL.
- Maintain backups/versioning: document any dump/restore steps in session logs and ensure GitHub issues/PRs track recovery drills.
