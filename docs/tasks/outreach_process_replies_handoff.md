# Handoff: Outreach process-replies для crew_five Inbox polling

## Что реализовано

`scripts/process_replies_cli.py` — CLI-скрипт, вызываемый crew_five как локальная команда.

Архитектура:
```
crew_five /api/inbox/poll
  → spawn: python3 /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py
    → spawn: claude --print (Claude Code headless)
      → imap-mcp: connect, search, get_email, mark_as_read
      → Python: reply_classifier.py (rule-based classification)
      → crew_five CLI: event:ingest
    → stdout: JSON result
  → crew_five возвращает в UI
```

Ключевое решение: скрипт работает через Claude Code CLI (`claude --print`), который имеет доступ к imap-mcp. Нет прямого IMAP, нет дешифровки паролей, нет дублирования mailbox access logic.

## Env для crew_five

```bash
OUTREACH_PROCESS_REPLIES_CMD="python3 /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py"
```

Или через OUTREACH_API_BASE (если crew_five adapter ожидает URL, а не CMD):

В текущей реализации скрипт вызывается как subprocess, не как HTTP endpoint. crew_five adapter должен:
1. Получить `POST /api/inbox/poll` с body `{"mailboxAccountId": "...", "lookbackHours": 24}`
2. Spawn команду: `python3 .../process_replies_cli.py --mailbox-account-id <id> --lookback-hours <hours>`
3. Прочитать JSON из stdout
4. Вернуть результат в UI

## CLI interface

```bash
# Все outreach-ящики, последние 24 часа
python3 scripts/process_replies_cli.py

# Конкретный ящик
python3 scripts/process_replies_cli.py --mailbox-account-id 3d28f7bc-b6c3-4337-9e04-de64ef524693

# Другой lookback period
python3 scripts/process_replies_cli.py --lookback-hours 48

# Фильтр по кампании
python3 scripts/process_replies_cli.py --campaign-id 969230cb-792f-4b74-bef1-453e99dd506d
```

Все аргументы optional.

## Response format

```json
{
  "accepted": true,
  "processed": 12,
  "classified": 9,
  "ingested": 9,
  "skipped": 3,
  "errors": [],
  "details": [
    {"from": "ivanov@company.ru", "category": "interested", "confidence": "medium"},
    {"from": "MAILER-DAEMON@server.ru", "category": "bounce", "confidence": "high"}
  ]
}
```

## Классификация (reply_classifier.py)

Rule-based, 13 unit-тестов, 100% pass.

| Категория | Примеры | Confidence |
|-----------|---------|-----------|
| bounce | MAILER-DAEMON, Undelivered, 5.x.x | high |
| resignation | "больше не работаю", "уволился" | high |
| vacation | "в отпуске", "out of office", "автоответ" | high |
| decline | "не интересует", "не пишите", "удалите адрес" | high |
| interested | "пришлите каталог", "давайте созвонимся" | medium |
| needs_review | всё остальное | low |

Дополнительно извлекает:
- `return_date` — для vacation ("до 25 марта")
- `alt_contact` — альтернативный email ("обращайтесь к ivanov@...")

## Что скрипт делает внутри

1. Формирует prompt для Claude Code
2. Запускает `claude --print --dangerously-skip-permissions <prompt>`
3. Claude Code выполняет:
   - `imap_connect` для каждого outreach-ящика
   - `imap_search_emails` (unseen, since lookback)
   - `imap_get_email` для каждого непрочитанного
   - Классификация через `reply_classifier.py`
   - `event:ingest` для classified ответов
   - `imap_mark_as_read` для обработанных
4. Claude Code возвращает JSON
5. Скрипт парсит и выводит в stdout

## Зависимости

- Claude Code CLI (`claude`) должен быть в PATH
- imap-mcp должен быть подключён в Claude Code (`claude mcp list` показывает imap)
- Python venv с `reply_classifier.py` по пути `/Users/georgyagaev/Projects/Outreach/.venv/`
- crew_five CLI доступен по пути `~/crew_five/` (для event:ingest)

## Тесты

41 unit-тестов, 100% pass:
- `tests/test_process_replies_cli.py` — 8 тестов (correlate, build_result, build_prompt)
- `tests/test_reply_classifier.py` — 13 тестов (все категории + extraction)
- `tests/test_offering_provenance.py` — 9 тестов
- `tests/test_bump_formatter.py` — 10 тестов
- + 1 тест ReplyClassification dataclass

## Timeout

Claude Code headless timeout = 300 секунд (5 мин). Для 8 ящиков с несколькими письмами должно хватить. Для большого объёма — увеличить или запускать по одному ящику.

## Smoke test

```bash
cd /Users/georgyagaev/Projects/Outreach
source .venv/bin/activate
python3 scripts/process_replies_cli.py --lookback-hours 1
```

Ожидание: JSON в stdout с `accepted: true`.

## Что ещё НЕ реализовано

- Автоответ на decline (imap_reply_to_email с извинением) — в prompt скрипта пока нет
- Пересылка interested (imap_forward_email менеджеру) — в prompt скрипта пока нет
- Эти действия описаны в `/process-replies` SKILL.md и будут добавлены после smoke test

## Адаптация crew_five adapter

Если crew_five adapter сейчас ожидает HTTP endpoint (`OUTREACH_PROCESS_REPLIES_URL`), а не CMD:

Вариант A — добавить CMD mode:
```typescript
if (process.env.OUTREACH_PROCESS_REPLIES_CMD) {
  const result = execSync(cmd + args, { encoding: 'utf-8', timeout: 300000 });
  return JSON.parse(result);
}
```

Вариант B — обернуть скрипт в HTTP (позже, когда понадобится remote triggering).

Рекомендация: Вариант A для v1.
