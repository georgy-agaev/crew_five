## Context

`Outreacher` reported that `analytics:summary` rejected `--error-format json` with Commander's
`unknown option '--error-format'`, while the shared CLI contract expects automation-facing commands to accept the
structured error mode.

## Completed

- Added `--error-format <format>` to `analytics:summary` in [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts).
- Routed `analytics:summary` through the shared `wrapCliAction()` helper so runtime failures emit JSON errors when
  `--error-format json` is used.
- Applied the same parity fix to `analytics:optimize` so the adjacent analytics entrypoint does not remain text-only.
- Added regression coverage:
  - [tests/analytics.test.ts](/Users/georgyagaev/crew_five/tests/analytics.test.ts) verifies
    `analytics:summary --error-format json` is accepted and still returns normal JSON output.
  - [tests/cli.test.ts](/Users/georgyagaev/crew_five/tests/cli.test.ts) verifies JSON error payloads for failing
    `analytics:summary` and `analytics:optimize`.
- Updated automation-facing docs:
  - [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
  - [README.md](/Users/georgyagaev/crew_five/README.md)
- Updated [CHANGELOG.md](/Users/georgyagaev/crew_five/CHANGELOG.md).

## Verification

- `pnpm test tests/analytics.test.ts tests/cli.test.ts`
- `pnpm build`

## To Do

- None for this task.
