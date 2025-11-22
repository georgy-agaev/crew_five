# macOS Setup Guide for AI SDR Toolkit

## 1. Base Requirements
- **Xcode Command Line Tools**: `xcode-select --install`
- **Rosetta 2** (Apple Silicon optional): `softwareupdate --install-rosetta --agree-to-license`
- **Homebrew** (already installed, 4.6.19): keep updated via `brew update && brew upgrade`

### Apple Silicon Notes
- Ensure you're using the ARM64 Homebrew at `/opt/homebrew` (default on M1). Add `eval "$(/opt/homebrew/bin/brew shellenv)"` to your shell profile.
- When installing Intel-only binaries, prefix with `arch -x86_64` (rare; only if a dependency lacks ARM build).
- Some Python wheels may require `export LDFLAGS="-L/opt/homebrew/opt/openssl@3/lib"` and `CPPFLAGS="-I/opt/homebrew/opt/openssl@3/include"` before building; keep these in `.zshrc` if needed.

## 2. System Packages via Homebrew
```bash
brew install pkg-config cmake automake libtool openssl@3
brew install pyenv python@3.11 pipx
brew install jq watchman just redis fasttext libomp
# optional utilities
brew install mkcert nss direnv uv
```

## 3. Node.js Tooling
- Node `v22.16.0` & npm `11.4.2` already available.
- Enable Corepack for pnpm/yarn: `corepack enable`
- Install pnpm once network access is available:
  ```bash
  corepack prepare pnpm@latest --activate
  # or
  npm install -g pnpm
  ```
- Verify: `node -v`, `npm -v`, `pnpm -v`

## 4. Python & DSPy/GEPA Stack
> You already have **Python 3.13.5** (`python3.13 --version`). Keep it as your default if dependencies install cleanly; some AI libraries lag behind on the newest interpreters, so having Python 3.11 available via `pyenv` is a safe fallback.
> **Note:** Primary interpreter can remain Python 3.13.5. Install 3.11 via `pyenv` only if you hit compatibility issues.

1. **Optional fallback interpreter**
   ```bash
   pyenv install 3.11.9
   pyenv global 3.11.9  # optional
   ```
2. **Install pipx (isolated CLI manager)**
   ```bash
   python3.11 -m pip install --user pipx
   python3.11 -m pipx ensurepath
   pipx install dspy-ai
   pipx inject dspy-ai gepa
   ```
3. **Create a per-project virtual environment (`venv`)**
   - A virtual environment is a self-contained Python installation inside your project. Packages installed there won’t affect system Python.
   ```bash
   cd /Users/georgyagaev/crew_one
   python3.11 -m venv .venv            # creates .venv folder
   source .venv/bin/activate           # activate; shell prompt shows (.venv)
   python -m pip install --upgrade pip
   pip install -r requirements.txt     # once available
   ```
   - When finished, type `deactivate` to exit the venv.

## 5. Supabase & Database Tooling
```bash
brew install supabase/tap/supabase
supabase login
supabase init        # inside repo
```
- Use `supabase start` (Docker) for local stack; Docker Desktop 28.5.1 already installed.
- Optional: `brew install postgresql@16` for standalone Postgres.

## 6. Email Libraries
- Node dependencies (add once package.json ready): `npm install nodemailer imapflow`
- Python alternatives (if mail workers in Python): `pip install imapclient aioimaplib`

## 7. Environment Variables
1. Copy `.env.example` → `.env`
2. Populate:
   - LLM providers: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
   - Research/outreach: `EXA_API_KEY`, `SMARTLEAD_API_KEY`, `LEADMAGIC_API_KEY`
   - Email: `SEND_EMAIL_API_KEY`, `IMAP_HOST`, `IMAP_USERNAME`, `IMAP_APP_PASSWORD`
   - Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. **Optional: 1Password CLI for secret rotation**
   - Install: `brew install --cask 1password-cli`
   - Sign in once: `op account add --email you@example.com --signin-address my.1password.com`
   - Store secrets in a vault entry, then inject at runtime (no .env needed):
     ```bash
     op run --env-file=.env -- pnpm run dev         # reads values from 1Password items mapped in .env
     # or reference individual fields:
     export OPENAI_API_KEY="$(op read 'op://GTM/AI Keys/OpenAI/api_key')"
     ```
   - Rotate/revoke keys centrally in 1Password and rerun `op run …` to pick up new values.

## 8. Verification Checklist
- `node -v`, `npm -v`, `pnpm -v`
- `python3.11 --version`, `pipx --version`, `python -c "import dspy, gepa"`
- `supabase --version`, `docker ps`
- Once CLI exists: `pnpm install` (or `npm install`) and `npm run dev`

## 9. Optional Observability & Dev Tools
### OpenTelemetry CLI
```bash
npm install -g @bogdanteleaga/otel-cli
otel-cli exec --service-name=ai-sdr-cli -- pnpm run dev
```
- Configure OTLP endpoint via env vars (e.g., `OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io` plus headers).

### LangSmith CLI
```bash
pipx install langsmith
langsmith login   # follow browser auth to link account
langsmith into shell -- pnpm run dev  # injects LANGCHAIN_TRACING_V2 env vars
```
- Requires LangSmith account (free tier available). Stores traces in LangSmith’s hosted dashboard.

### Other Dev Helpers
- Global linters/formatters if desired: `npm install -g eslint prettier`

Keep this document updated as new services (e.g., CRM or additional prompt packs) introduce extra dependencies.
