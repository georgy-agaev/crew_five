# Задача: добавить offering_domain в icp_profiles

## Статус

Completed

## Контекст

Outreach генерирует email-черновики для кампаний. Для генерации нужен offering — описание продукта/компании (JSON-файл из Marketing2025). Сейчас offering захардкожен в `draft_helpers.py` — всегда берётся первый из `["voicexpert.ru", "skomplekt.com"]`. Нет связи ICP → offering.

Offering файлы находятся в `~/Projects/Marketing2025/knowledge/offerings/{domain}.json` и читаются Outreach при генерации писем.

## Принятое решение

Используем сбалансированный вариант provenance:

- в `icp_profiles` хранится `offering_domain`
- в `drafts.metadata` хранятся:
  - `offering_domain`
  - `offering_hash`
  - `offering_summary`
- в `email_outbound.metadata` хранятся те же поля через наследование `drafts.metadata`

Границы ответственности:

- `crew_five` хранит `icp_profiles.offering_domain` и переносит provenance в `drafts` / `email_outbound`
- `Outreach` читает offering JSON из Marketing2025, считает `offering_hash`, собирает `offering_summary` и передаёт их в `crew_five`

## Что нужно сделать

### 1. Миграция

Создать миграцию:

```sql
ALTER TABLE icp_profiles ADD COLUMN offering_domain text;
```

Файл: `supabase/migrations/YYYYMMDDHHMMSS_add_icp_offering_domain.sql`

### 2. Применить миграцию

Применить к текущей Supabase (та же БД что используется в Outreach).

### 3. Заполнить существующие записи

Все 4 текущих ICP профиля работают с voicexpert.ru:

```sql
UPDATE icp_profiles SET offering_domain = 'voicexpert.ru' WHERE offering_domain IS NULL;
```

### 4. Обновить CLI команды (если нужно)

- `icp:create` — добавить опцию `--offering-domain`
- `icp:list` — включить `offering_domain` в вывод
- `icp:coach:profile` — если есть шаг выбора продукта, записывать offering_domain

### 5. Обновить CLI contract

В `docs/Outreach_crew_five_cli_contract.md` — добавить `offering_domain` в описание `icp_profiles`.

### 6. Обновить draft/outbound provenance contract

- `draft:save` должен принимать `metadata.offering_domain`, `metadata.offering_hash`, `metadata.offering_summary`
- `draft:generate` должен сохранять `offering_domain` из `icp_profiles` и, если доступны, `offering_hash`/`offering_summary`
- `email:record-outbound` должен сохранять эти поля в `email_outbound.metadata` через копирование `draft.metadata`

## Ожидаемый результат

- Колонка `offering_domain` (text, nullable) в `icp_profiles`
- 4 существующих ICP имеют `offering_domain = 'voicexpert.ru'`
- `icp:list` возвращает `offering_domain` в JSON
- Outreach сможет читать `icp.offering_domain` вместо хардкода
- История draft/send будет хранить `offering_domain + offering_hash + offering_summary`

## Приоритет

Высокий — блокирует корректность генерации писем для разных продуктов.
