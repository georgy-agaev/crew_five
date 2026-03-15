# Задача: обновить документацию crew_five для Outreach интеграции

## Статус

Completed

## Контекст

Outreach перешёл на использование crew_five CLI для всех DB-операций. Документация crew_five должна отражать текущее состояние интеграции.

## Что нужно обновить

### 1. `docs/Outreach_crew_five_cli_contract.md`

Добавить:
- `offering_domain` поле в icp_profiles (после миграции)
- Enrichment команды (`enrich:run`)
- Обновить Live Migration Status (learnings, phase_outputs, offering_domain — все применены)

### 2. `docs/Outreacher_operating_model.md`

Добавить:
- Enrichment как обязательный шаг перед draft generation
- Описание workflow: ICP → Hypothesis → Segment → **Enrich** → Campaign → Drafts
- imap-mcp конфигурация: volume mount, accounts.json, SMTP настройка

### 3. `docs/Outreach_agent_runner_examples.md`

Добавить:
- `enrich_segment()` метод в Python runner
- Пример вызова enrichment

### 4. CHANGELOG.md

Зафиксировать все изменения:
- Новые миграции (offering_domain)
- Новые/обновлённые CLI команды
- Обновление контракта

## Приоритет

Низкий — документация, но важна для консистентности между проектами.
