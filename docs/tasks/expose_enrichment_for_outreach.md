# Задача: интегрировать enrichment в workflow Outreach

## Статус

Completed

## Контекст

crew_five имеет полноценную enrichment инфраструктуру:
- 5 адаптеров (EXA, Parallel, FireCrawl, AnySite, Mock)
- Unified EnrichmentStoreV1 schema
- Multi-provider hybrid context
- CLI команда `enrich:run`

Outreach использует crew_five CLI для DB-операций. Enrichment — критический шаг перед генерацией писем: без enrichment `company_confirmed_facts` пустой, pattern_breaker невозможен, письма generic.

Текущий workflow: ICP → Hypothesis → Segment → Campaign → Drafts
Нужный workflow: ICP → Hypothesis → Segment → **Enrich** → Campaign → Drafts

## Что нужно сделать

### 1. Проверить что `enrich:run` работает end-to-end

```bash
pnpm --silent cli enrich:run \
  --segment-id <segmentId> \
  --provider firecrawl \
  --run-now \
  --limit 2 \
  --error-format json
```

Проверить:
- Команда выполняется без ошибок
- `companies.company_research` обновляется результатами enrichment
- JSON вывод содержит статус (processed, skipped, failed counts)

### 2. Добавить `enrich:run` в CLI contract

В `docs/Outreach_crew_five_cli_contract.md` добавить секцию:

```markdown
### Enrichment

- `pnpm cli enrich:run --segment-id <segmentId> --provider <provider> --run-now --limit <N> --error-format json`

Providers: exa, firecrawl, anysite, parallel, mock

Response:
{
  "status": "completed",
  "processed": 10,
  "skipped": 2,
  "failed": 0,
  "errors": []
}
```

### 3. Добавить `--dry-run` вывод для Outreach

Outreach будет показывать пользователю preview перед enrichment:
- Сколько компаний в сегменте
- Сколько уже enriched (есть company_research)
- Сколько нужно enrichment
- Estimated credits/cost

### 4. Обновить Outreacher operating model

В `docs/Outreacher_operating_model.md` добавить enrichment как обязательный шаг перед draft generation.

## Дополнительно (фаза 2)

### Prospeo email enrichment

Outreach имеет `scripts/enrich_email.py` с Prospeo API для email enrichment (name + domain → email). Рассмотреть:
- Создать Prospeo адаптер в crew_five
- Или: оставить email enrichment в Outreach как отдельный шаг

### company_research → company_confirmed_facts

Проверить что результаты enrichment из EnrichmentStoreV1 конвертируются в формат, который Outreach может использовать для `company_confirmed_facts` в промпте генерации.

## Приоритет

Высокий — без enrichment письма остаются generic, pattern_breaker невозможен.
