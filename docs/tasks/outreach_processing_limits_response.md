# Outreach processing runtime limits

## 1. Recommended max per batch

**10 компаний** за один запуск `/process-batch`.

Причина: каждая компания = отдельный Claude Code субагент (Sonnet). Субагент делает scrape, analyze, enrich, save — это 3-5 минут на компанию. 10 компаний = 30-50 минут. Больше — контекст Claude Code сессии может переполниться, и пользователь теряет возможность следить за прогрессом.

## 2. Hard upper bound

**20 компаний.** Больше 20 — реальный риск timeout (Claude Code session ~60 мин), memory pressure, и FireCrawl rate limiting.

## 3. Sync vs async

**Асинхронно.** Обработка компании занимает 3-5 минут — это неприемлемо для синхронного HTTP запроса.

Рекомендуемая модель:
1. UI отправляет список company IDs для обработки
2. Backend принимает (`202 Accepted`), записывает task
3. Outreach `process_replies_cli.py` (или аналогичный `process_batch_cli.py`) запускается как subprocess
4. Прогресс: обновляет `processing_status` каждой компании (`pending → processing → completed/mismatch/no_website`)
5. UI поллит `campaign:detail` или отдельный endpoint для прогресса

## 4. Main bottleneck

В порядке критичности:

| # | Bottleneck | Лимит | Влияние |
|---|-----------|-------|---------|
| 1 | **Claude Code session** | ~60 мин, контекст ~200K tokens | Главный ограничитель batch size |
| 2 | **FireCrawl credits** | Hobby plan: 3K credits | 1 компания = 2-5 credits (map + scrape). 3K credits ≈ 600-1500 компаний |
| 3 | **FireCrawl rate limit** | ~10 req/min | Параллельный scrape невозможен, только последовательный |
| 4 | **Prospeo credits** | Ограничены | Email enrichment — 1 call per ЛПР |
| 5 | **Время** | 3-5 мин/компания | 100 компаний = 5-8 часов |

## Рекомендация для Import UI

**Chunk automatically.** Import UI не должен запускать обработку всех 1000+ компаний одним запросом.

Рекомендуемый flow:
1. Import (Apply) — записать все компании в DB с `processing_status: "pending"`. Это быстро.
2. Processing — отдельный шаг, chunk по 10:
   - UI показывает: "850 компаний ожидают обработки"
   - Кнопка "Обработать следующие 10" или автоматический scheduler
   - Каждый chunk = один subprocess вызов
   - Прогресс видно по `processing_status`

Не совмещать Import Apply с enrichment/processing в одном запросе — это разные операции с разной стоимостью и временем.

## Два типа обработки

Важно: не все компании нужно полностью обрабатывать.

**Лёгкий enrichment** (crew_five `enrich:run`):
- Только обогащение company_research через провайдеры (exa, firecrawl)
- Без scrape сайта, без поиска ЛПР
- Быстрее: 5-10 сек на компанию
- Batch size: 25-50 компаний за раз

**Полная обработка** (Outreach `process_company.py`):
- Scrape сайта + анализ + поиск ЛПР + email enrichment
- 3-5 мин на компанию
- Batch size: 10 компаний за раз

UI может предлагать оба варианта после import.
