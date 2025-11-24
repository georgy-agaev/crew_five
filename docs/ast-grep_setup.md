# ast-grep Setup & Usage

Use ast-grep to enforce project-specific guardrails (CLI parity, idempotency, error hygiene) with AST-aware rules.

## Install
- Homebrew (macOS): `brew install ast-grep`
- Cargo: `cargo install ast-grep`
- Verify: `ast-grep --version`

## Config (starter)
Create `ast-grep.yml` at repo root:
```yaml
id: ai-sdr-gtm-rules
metadata:
  description: Project guardrails for Smartlead/CLI

rules:
  - id: smartlead-assume-now-logging
    message: "assumeNowOccurredAt should pair with logging/telemetry."
    severity: warning
    language: TypeScript
    pattern: "assumeNowOccurredAt: true"
```
*(Add more rules as needed; start with warnings and tighten over time.)*

## Run
- Lint: `ast-grep --config ast-grep.yml --lint .`
- Search ad-hoc: `ast-grep -p "assumeNowOccurredAt" --lang ts`
- Rewrite example: `ast-grep -p 'var $X = $Y' -r 'let $X = $Y' --lang js`

## Tips
- Keep rules small and focused; avoid blocking on noisy matches.
- Document allowlists/false positives near the rule.
- Prefer warnings first; promote to errors once stable.
