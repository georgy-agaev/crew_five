# ast-grep Setup & Usage

Use ast-grep to enforce project-specific guardrails (CLI parity, idempotency, error hygiene) with AST-aware rules. The live rule set lives in `ast-grep.yml`; keep this doc in sync when rules change.

## Install
- Homebrew (macOS): `brew install ast-grep`
- Cargo: `cargo install ast-grep`
- Verify: `ast-grep --version`

## Guardrails we enforce today
- **CLI safety**: Smartlead commands must expose `--dry-run`, retry caps, and assume-now flags
  (`smartlead-cli-dry-run`, `smartlead-events-pull-guardrails`).
- **Data integrity**: Inserts into Smartlead send/email events must carry idempotency keys and reply
  labels where required (`smartlead-send-idempotency`, `reply-label-required`).
- **Logging/telemetry**: `assumeNowOccurredAt` usage should wire logging hooks (`smartlead-assume-now-logging`).
- **Retry/error hygiene**: Avoid hardcoded Retry-After caps and enforce Smartlead error details (`smartlead-retry-cap-constant`, `smartlead-error-hygiene`).

## Run
- Repo task: `pnpm run scan:ast-grep` (uses `ast-grep.yml` via `pnpm dlx @ast-grep/cli`, so CI does not depend on a globally installed binary)
- Lint-style output: `ast-grep --config ast-grep.yml --lint .`
- Search ad-hoc: `ast-grep -p "assumeNowOccurredAt" --lang ts`
- Rewrite example: `ast-grep -p 'var $X = $Y' -r 'let $X = $Y' --lang js`

## Tips
- Keep rules small and focused; avoid blocking on noisy matches.
- Document allowlists/false positives near the rule.
- Prefer warnings first; promote to errors once stable.
