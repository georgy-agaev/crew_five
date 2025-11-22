# Repository Guidelines

## Project Structure & Module Organization
- `docs/AI_SDR_GTM_PRD.md` holds the authoritative product requirements; update it first when scope changes.
- `docs/appendix_ai_contract.md` defines the non-negotiable `generate_email_draft` contract; never modify the PRD without syncing this appendix.
- `docs/AI_SDR_Toolkit_Architecture.md`, `docs/GMT_system_plan.md`, `docs/Setup_Guide.md`, and `docs/Database_Description.md` provide architectural, roadmap, setup, and schema context respectively.
- `docs/sessions/YYYY-MM-DD_<n>_<slug>.md` stores session tasks/outcomes (e.g., `docs/sessions/2025-11-21_1_initial-prd-and-structure.md`).
- `CHANGELOG.md` captures versioned changes; `README.md` is the entry point for repo orientation.
- Prompt-pack drafts live at the root (`Cold_*.md`); keep Interactive Coach and Pipeline Express copies in sync.
- When current documentation is needed for external APIs/libraries, fetch it via Context7 (`resolve-library-id` + `get-library-docs`) instead of relying solely on model training data.

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
