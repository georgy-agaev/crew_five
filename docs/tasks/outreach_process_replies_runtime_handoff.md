# Handoff: process_replies_cli.py runtime configuration

## Статус

Работает. Poll now возвращает `"errors":[]`, scheduler может вызывать автоматически.

## Команда для запуска

```bash
/Users/georgyagaev/Projects/Outreach/.venv/bin/python \
  /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py \
  --lookback-hours 24
```

## ENV для crew_five adapter

```env
OUTREACH_PROCESS_REPLIES_CMD="/Users/georgyagaev/Projects/Outreach/.venv/bin/python /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py"

INBOX_POLL_ENABLED=true
INBOX_POLL_INTERVAL_MINUTES=10
INBOX_POLL_LOOKBACK_HOURS=24
```

## Критически важно: Claude работает через подписку

Скрипт внутри запускает `claude --print` (headless). Claude Code ДОЛЖЕН работать через подписку (Max/Pro), а не через API credits.

Скрипт гарантирует это:
- Явно убирает `ANTHROPIC_API_KEY` из env subprocess (`env.pop("ANTHROPIC_API_KEY", None)`)
- `ANTHROPIC_API_KEY` удалён из `.env` проекта Outreach
- Если в окружении crew_five adapter есть `ANTHROPIC_API_KEY` — скрипт его проигнорирует при вызове Claude

**Не добавлять `ANTHROPIC_API_KEY` в env crew_five adapter.** Это приведёт к использованию API credits вместо подписки, и Claude откажет с "Credit balance is too low".

## Исправленные проблемы

| Проблема | Причина | Fix |
|----------|---------|-----|
| `claude exit code 127` | `node` не в PATH при subprocess | Скрипт добавляет `/usr/local/bin`, `/opt/homebrew/bin` в PATH |
| `claude exit code 1` + "Credit balance too low" | `ANTHROPIC_API_KEY` в env → API path вместо подписки | Скрипт убирает ключ из env; ключ удалён из `.env` |
| `claude exit code 1` + "no stdin data received" | Claude ждёт stdin | `stdin=subprocess.DEVNULL` |
| JSON в markdown fences | Claude оборачивает ответ в `` ```json ``` `` | Regex для извлечения JSON из fences |
| Голое "claude exit code 1" без контекста | Парсер не возвращал stderr | Подробная диагностика в errors[] |

## Диагностика при ошибках

Если poll возвращает ошибки, в `errors[]` теперь есть:
- `stderr: <текст ошибки от Claude>`
- `stdout_tail: <хвост stdout>`
- `claude_bin: <путь к Claude binary>`

Это позволяет диагностировать без доступа к Outreach машине.

## Runtime contract

- Последняя непустая строка stdout = valid JSON
- Все логи → stderr
- Exit 0 = success
- Non-zero exit = failure
- JSON response shape:

```json
{
  "accepted": true,
  "processed": 12,
  "classified": 9,
  "ingested": 9,
  "skipped": 3,
  "errors": [],
  "details": [
    {"from": "email", "category": "bounce", "confidence": "high"}
  ]
}
```

## Зависимости

- Python venv: `/Users/georgyagaev/Projects/Outreach/.venv/`
- Claude Code CLI: `~/.claude/local/claude` (должен быть залогинен с активной подпиской)
- imap-mcp: должен быть подключён в Claude Code
- crew_five CLI: `~/crew_five/` (для `event:ingest`)

## Проверка работоспособности

```bash
# Ручной запуск
/Users/georgyagaev/Projects/Outreach/.venv/bin/python \
  /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py \
  --lookback-hours 1

# Через crew_five
curl -s -X POST http://localhost:8787/api/inbox/poll \
  -H 'Content-Type: application/json' \
  -d '{"lookbackHours":1}'

# Ожидание: "errors":[]
```
