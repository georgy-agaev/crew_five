# Bug: company:import apply падал на OGRN dedup из-за mutable query builder

## Статус

Completed on 2026-03-17.

## Точный payload

Файл `/tmp/ogrn_conflict_test.json`:
```json
[
  {"company_name": "ООО \"Ясон Агро\"", "tin": "2635800395", "registration_number": "1102651000891", "website": "yasonkompany.ru", "employee_count": 42},
  {"company_name": "ООО \"Нпк Химия\"", "tin": "7727404070", "registration_number": "1197746012199", "website": "npk-x.ru", "employee_count": 29}
]
```

## Конфликтующие строки в БД

```json
{"id": "3ac553a8-6b4a-4a29-afc6-134e8620f033", "tin": "6325079752", "registration_number": "1102651000891", "company_name": "ООО \"Ясон Агро\""}
{"id": "caa75213-ff1a-403f-bd5f-c825ed97c753", "tin": "7705573505", "registration_number": "1197746012199", "company_name": "ООО \"Нпк Химия\""}
```

Суть: одна и та же компания, но с разным ИНН (перерегистрация). ОГРН (registration_number) совпадает.

## Dry-run результат

```bash
pnpm --silent cli company:import --file /tmp/ogrn_conflict_test.json --dry-run --error-format json
```
```json
{"items": [
  {"company_name": "ООО \"Ясон Агро\"", "tin": "2635800395", "action": "create", "match_field": null, "warnings": []},
  {"company_name": "ООО \"Нпк Химия\"", "tin": "7727404070", "action": "create", "match_field": null, "warnings": []}
]}
```

Lookup по `registration_number` не срабатывает — обе показаны как `create`.

## Apply результат

```bash
pnpm --silent cli company:import --file /tmp/ogrn_conflict_test.json --error-format json
```
```json
{"ok":false,"error":{"code":"23505","message":"duplicate key value violates unique constraint \"companies_registration_number_key\""}}
```

## Root Cause

- В `findExistingCompany()` переиспользовался один и тот же Supabase query builder.
- При fallback с `tin` на `registration_number` второй lookup мог унаследовать первый `eq('tin', ...)`.
- В live Supabase это превращало fallback в фактический `tin AND registration_number`, поэтому dry-run
  ошибочно показывал `create`, а apply доходил до `23505 companies_registration_number_key`.

## Fix

- `findExistingCompany()` теперь делает новый `client.from('companies')` для каждого lookup branch.
- Добавлен regression test, который моделирует mutable builder и подтверждает, что fallback по
  `registration_number` больше не наследует `tin` filter.

## Result

Dry-run now resolves the rows as:
```json
{"action": "update", "match_field": "registration_number", "warnings": ["TIN mismatch: file=2635800395, db=6325079752"]}
```

Apply now updates instead of crashing on `companies_registration_number_key`.

## Приоритет

Высокий — блокирует batch import.
