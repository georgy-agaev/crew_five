# Bug: company:import и company:save-processed не сохраняют часть полей из БД

## Статус

Completed on 2026-03-18.

## Проблема

`buildCompanyPatch()` и employee upsert в `companyStore.ts` не включают ряд колонок, которые есть в таблицах `companies` (28 колонок) и `employees` (29 колонок). При import/save-processed эти данные теряются.

## Воспроизведение

```bash
# Import компании с финансовыми данными
pnpm --silent cli company:import --file /tmp/test.json --error-format json
```

Файл содержит:
```json
[{"company_name": "ООО \"ТД Кардаильский МЗ\"", "tin": "3623007578", "revenue": 4927497000, "balance": 1832068000, "net_profit_loss": 38017000, "sme_registry": false}]
```

После import в БД:
```
revenue: NULL
balance: NULL
net_profit_loss: NULL
sme_registry: NULL (или default false)
```

## Что нужно

### 1. Добавить поля в `CompanyImportInput` interface

```typescript
revenue?: number | null;
balance?: number | null;
net_profit_loss?: number | null;
sme_registry?: string | null;
```

### 2. Добавить в `buildCompanyPatch()`

```typescript
revenue: input.revenue ?? null,
balance: input.balance ?? null,
net_profit_loss: input.net_profit_loss ?? null,
sme_registry: input.sme_registry ?? null,
```

### 3. Добавить в `normalizeCompanyInput()`

```typescript
revenue: typeof input.revenue === 'number' ? input.revenue : null,
balance: typeof input.balance === 'number' ? input.balance : null,
net_profit_loss: typeof input.net_profit_loss === 'number' ? input.net_profit_loss : null,
sme_registry: input.sme_registry === undefined ? undefined : input.sme_registry ?? null,
```

### 4. Обновить контракт

В `Outreach_crew_five_cli_contract.md` — добавить поля в примеры payload.

## Полный список пропущенных полей

### Companies (buildCompanyPatch)

| Поле | Тип в БД | Источник | Зачем нужно |
|------|----------|----------|-------------|
| `revenue` | bigint | Контур.Компас xlsx | Сегментация, scoring |
| `balance` | bigint | Контур.Компас xlsx | Сегментация |
| `net_profit_loss` | bigint | Контур.Компас xlsx | Scoring |
| `sme_registry` | text | Контур.Компас xlsx | Фильтр МСП |

### Employees (employee upsert)

| Поле | Тип в БД | Источник | Зачем нужно |
|------|----------|----------|-------------|
| `source_urls` | text[] | Scrape/enrichment | Откуда найден сотрудник (URL сайта, LinkedIn) |
| `phone_numbers` | text[] | Сайт, xlsx | Контакт |
| `ai_research_data` | jsonb | Claude analysis | Дополнительный контекст для генерации |

### CompanyImportEmployeeInput — нужно добавить

```typescript
source_urls?: string[] | null;
phone_numbers?: string[] | null;
ai_research_data?: unknown;
```

### CompanyImportInput — нужно добавить

```typescript
revenue?: number | null;
balance?: number | null;
net_profit_loss?: number | null;
sme_registry?: string | null;
```

## Контекст

Данные Контур.Компас содержат финансовую информацию и реестр МСП. При scrape/enrichment находятся телефоны и URL-источники сотрудников. Все эти поля есть в таблицах БД, но `companyStore.ts` их не передаёт — данные теряются при каждом import и save-processed.

## Что сделано

- `companyStore.ts` now preserves `revenue`, `balance`, `net_profit_loss`, and `sme_registry`
- employee upsert now preserves `source_urls`, `phone_numbers`, and `ai_research_data`
- regression coverage added in `src/services/companyStore.test.ts`

## Приоритет

Высокий — потеря данных при каждом import/save-processed.
