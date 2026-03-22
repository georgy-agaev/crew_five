# Задача: исправить company_description в snapshot workflow

## Статус

Completed

## Контекст

При создании segment_members snapshot, crew_five (и Outreach) записывает данные компании в `snapshot.company`. Outreach использует поле `snapshot.company.business_description` для формирования `company_confirmed_facts` — контекста для LLM при генерации писем.

Проблема: в таблице `companies` нет колонки `business_description`. Есть `company_description` (ОКВЭД-описание из Контур.Компас) и `company_research` (JSON с результатами enrichment).

В Outreach `create_segment.py:66` уже исправлен — читает `company_description`. Но crew_five `segmentSnapshotWorkflow.ts` может иметь ту же проблему.

## Что нужно проверить и исправить

### 1. Проверить snapshot workflow

В `src/services/segmentSnapshotWorkflow.ts` — как формируется snapshot для segment_members:
- Какие поля компании включаются?
- Есть ли `business_description` vs `company_description`?
- Включается ли `company_research`?

### 2. Убедиться что snapshot содержит:

```json
{
  "company": {
    "company_name": "...",
    "company_description": "Описание из ОКВЭД",
    "website": "...",
    "employee_count": 123,
    "office_qualification": "Less",
    "region": "..."
  }
}
```

### 3. Опционально: включить company_research

`company_research` содержит результаты enrichment (JSON text). Если включить его в snapshot, Outreach сможет формировать более богатый `company_confirmed_facts` для LLM.

## Приоритет

Средний — Outreach-сторона уже исправлена, но crew_five snapshot должен быть консистентен.
