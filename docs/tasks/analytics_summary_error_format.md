# Bug: analytics:summary не поддерживает --error-format json

## Статус

Completed

## CLI команда

```bash
pnpm --silent cli analytics:summary --group-by pattern --error-format json
```

## Ответ

```
error: unknown option '--error-format'
```

## Ожидание

Все CLI команды, используемые Outreach, должны поддерживать `--error-format json` для унифицированного парсинга (см. Outreach_crew_five_cli_contract.md).

Без `--error-format` команда работает:

```bash
pnpm --silent cli analytics:summary --group-by pattern
```

Ответ:
```json
{"groupBy": "pattern", "results": []}
```

## Приоритет

Низкий — workaround: вызывать без `--error-format`.
