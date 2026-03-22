# Bug: company:save-processed затирает существующие данные null-ами

## Статус

Completed on 2026-03-18.

## Проблема

`buildCompanyPatch()` использует `input.field ?? null` для всех полей. Если caller не передаёт поле (undefined), оно превращается в явный `null` в patch. Supabase `.update(patch)` записывает этот null, затирая существующие данные.

## Воспроизведение

1. WebUI crew_five импортирует компанию с `revenue: 317153000`
2. Outreach вызывает `company:save-processed` без поля revenue в payload
3. `buildCompanyPatch` → `revenue: undefined ?? null = null`
4. `.update({revenue: null})` → затирает 317153000 на null

## Реальный кейс

ООО "УК "Русмолко" (tin: 5836634785):
- После webUI import: revenue=317153000, balance=121583000, net_profit_loss=129000
- После Outreach save-processed: revenue=null, balance=null, net_profit_loss=null

## Решение

В `buildCompanyPatch()` не включать поле в patch если оно undefined. Вместо:
```typescript
revenue: input.revenue ?? null,
```

Использовать:
```typescript
...(input.revenue !== undefined && { revenue: input.revenue }),
```

Или фильтровать undefined из patch перед `.update()`.

Это касается ВСЕХ полей в buildCompanyPatch — не только финансовых.

## Что сделано

- `saveProcessedCompany()` / `upsertCompany()` больше не отправляют `undefined` поля в Supabase `update()`
- create-path сохраняет прежние defaults (`status = Active`, `processing_status = pending`)
- explicit `null` по-прежнему поддерживается как намеренное очищение поля
- такой же guard применён к employee update path внутри `saveProcessedCompany()`
- добавлен regression test: `src/services/companyStore.test.ts`

## Приоритет

Высокий — любой update через save-processed затирает данные, которые caller не передал.
