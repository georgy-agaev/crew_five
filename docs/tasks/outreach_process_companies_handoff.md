# Handoff: process_companies_cli.py — post-import company processing

## Скрипт

```
/Users/georgyagaev/Projects/Outreach/scripts/process_companies_cli.py
```

## ENV для crew_five

```env
OUTREACH_PROCESS_COMPANY_CMD="/Users/georgyagaev/Projects/Outreach/.venv/bin/python /Users/georgyagaev/Projects/Outreach/scripts/process_companies_cli.py"
```

## CLI interface

```bash
# Full processing (scrape + analyze + enrich + save) — 3-5 min/company
python3 scripts/process_companies_cli.py \
  --company-ids uuid1,uuid2,uuid3 \
  --mode full

# Light enrichment — placeholder (segment-scoped enrich:run)
python3 scripts/process_companies_cli.py \
  --company-ids uuid1,uuid2,uuid3 \
  --mode light
```

## Limits

- Recommended batch: **10 компаний**
- Hard max: **20 компаний** (скрипт отклонит с exit 1)
- Timeout per company: **600 сек** (10 мин)
- Full mode: **3-5 мин/компания**

## Response format

```json
{
  "accepted": true,
  "total": 3,
  "completed": 2,
  "failed": 1,
  "skipped": 0,
  "results": [
    {"companyId": "uuid-1", "status": "completed", "company_name": "ООО Пример"},
    {"companyId": "uuid-2", "status": "completed", "company_name": "АО Другая"},
    {"companyId": "uuid-3", "status": "error", "error": "no website"}
  ],
  "errors": ["uuid-3: no website"]
}
```

## Statuses per company

| Status | Meaning |
|--------|---------|
| `completed` | Scrape + analyze + save-processed done |
| `error` | Failed (reason in `error` field) |
| `skipped` | No website, or light mode (not yet supported per-company) |

## What the script does (full mode)

1. Loads company data from Supabase by ID
2. Generates subagent prompt via `process_company.py`
3. Runs Claude Code headless (`claude --print`) with the prompt
4. Claude subagent: scrape → analyze → find ЛПР → assign emails
5. Saves result via `pnpm cli company:save-processed`
6. Returns per-company status

## Runtime contract

Same as `process_replies_cli.py`:
- Last non-empty line of stdout = valid JSON
- Logs → stderr
- Exit 0 = success
- Exit 1 = batch validation failure (e.g. >20 companies)
- Claude uses subscription (ANTHROPIC_API_KEY removed from env)
- stdin = /dev/null

## Light mode — current limitation

`mode=light` currently returns `status: "skipped"` for all companies. Light enrichment is segment-scoped (`enrich:run --segment-id`), not company-level.

To enable company-level light enrichment, options:
1. crew_five adds `enrich:run --company-id` (not just segment-scoped)
2. Or Outreach creates a temporary segment per batch and runs `enrich:run`

Recommendation: for v1, use `mode=full` for post-import processing. Light enrichment stays segment-scoped via existing `/enrich-segment`.

## Recommended crew_five integration

```
POST /api/company-import/process
{
  "companyIds": ["uuid-1", "uuid-2"],
  "mode": "full",
  "source": "xlsx-import"
}
```

Backend:
1. Validate companyIds exist
2. Clamp batch: recommend 10, reject >20
3. Create async job
4. Spawn: `OUTREACH_PROCESS_COMPANY_CMD --company-ids uuid1,uuid2 --mode full`
5. Parse stdout JSON
6. Update job status from results

## Dependencies

- Python venv: `/Users/georgyagaev/Projects/Outreach/.venv/`
- Claude Code CLI: `~/.claude/local/claude` (subscription, not API key)
- imap-mcp: required for scrape (FireCrawl) via Claude
- crew_five CLI: `~/crew_five/` (for `company:save-processed`)
- `process_company.py`: prompt generator
- `supabase_client.py`: `get_company_by_id()` for loading company data
