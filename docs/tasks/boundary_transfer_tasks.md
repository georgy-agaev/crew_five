# Задачи по переносу функций в crew_five (из boundary review)

Источник: `docs/sessions/2026-03-16_10_outreach_workflow_boundary_review.md`

Принцип: Outreacher = агент/оркестрация, crew_five = spine/mutations/read models, imap_mcp = transport.

## Текущий статус

### Completed

- `company:import`
- `company:save-processed`
- `employee:repair-names`
- `campaign:audit`
- `campaign:followup-candidates`
- `campaign:detail`
- analytics extensions:
  - `analytics:summary --group-by rejection_reason`
  - `analytics:summary --group-by offering`
  - `analytics:funnel`

### Follow-up Completed

- `employee:repair-names --confidence high|low|all`
- `company:save-processed` high-confidence name normalization + low-confidence warnings

### To Do

- [add_employee_name_repair_audit_trail.md](/Users/georgyagaev/crew_five/docs/tasks/add_employee_name_repair_audit_trail.md)

---

## 1. Import surface для компаний

**Принцип:** crew_five принимает нормализованный JSON, не XLSX. XLSX-парсинг Контур.Компас остаётся в Outreach.

```bash
pnpm cli company:import --file companies.json --dry-run --error-format json
pnpm cli company:import --file companies.json --error-format json
```

**Что делает:**
- Принимает JSON (массив компаний в нормализованном формате)
- Canonical validation: ИНН дедупликация, name validation, office_qualification
- Preview: дубликаты, новые, counts
- Import: batch upsert в companies + employees
- Возвращает: created/updated/skipped counts

**Приоритет:** Высокий

---

## 2. Save contract для обработанных компаний

**Принцип:** Один канонический mutation-contract для company + employees[], не два отдельных CLI. Иначе инварианты разъедутся.

```bash
pnpm cli company:save-processed --payload '<json>' --error-format json
```

**Payload:**
```json
{
  "company": {
    "tin": "7707083893",
    "company_name": "ООО Пример",
    "company_description": "Описание бизнеса",
    "company_research": { "...enrichment data..." },
    "website": "example.ru",
    "office_qualification": "More"
  },
  "employees": [
    {
      "full_name": "Иванов Иван Иванович",
      "position": "Директор",
      "work_email": "ivanov@example.ru",
      "generic_email": "info@example.ru"
    }
  ]
}
```

**Что делает:**
- Upsert company по ИНН
- Upsert employees по company_id + full_name
- Валидация: name parsing, email format, дедупликация
- Атомарная операция: company + employees вместе
- Возвращает: company_id, employee_ids, warnings

**Outreach остаётся:** scrape (FireCrawl), analyze (Claude субагент), enrich email (Prospeo). Формирует JSON → передаёт в crew_five.

**Приоритет:** Высокий

---

## 3. Name parsing repair

**Проблема:** У части сотрудников с двухсловными именами (без отчества) `first_name` и `last_name` перепутаны. Пример: "Инна Федина" → first_name="Федина", last_name="Инна".

**Нужно:**
1. Утилита определения имени/фамилии для русских имён (по базе/словарю)
2. Migration-скрипт: найти и исправить все записи с перепутанными first_name/last_name
3. Валидация при сохранении (company:save-processed) — не допускать ошибку

```bash
pnpm cli employee:repair-names --dry-run --confidence high|low|all --error-format json
pnpm cli employee:repair-names --confidence high|low|all --error-format json
```

**Приоритет:** Высокий (влияет на greeting_name в письмах)

---

## 4. Campaign read models

**Принцип:** Не перегружать одну команду. Разделить:

**campaign:audit** — coverage, anomalies, health check:
```bash
pnpm cli campaign:audit --campaign-id <uuid> --error-format json
```
Возвращает: coverage %, anomalies (drafts без email, отправленные без записи), status distribution.

**campaign:detail** — полный read model campaign → companies → employees:
```bash
pnpm cli campaign:detail --campaign-id <uuid> --error-format json
```
Возвращает: campaign + segment + icp + companies[] (с employees[], draft counts, send/reply status).

**Используется:** UI, CLI, Outreacher — все видят одну картину.

**Приоритет:** Средний

---

## 5. Follow-up eligibility (campaign:followup-candidates)

**Принцип:** crew_five вычисляет кандидатов, Outreacher принимает финальное решение об отправке.

```bash
pnpm cli campaign:followup-candidates --campaign-id <uuid> --error-format json
```

**Возвращает:**
```json
[
  {
    "contact_id": "...",
    "company_id": "...",
    "intro_sent": true,
    "intro_sent_at": "2026-03-15T10:00:00Z",
    "intro_sender_identity": "pborodin@voicexpertout.ru",
    "reply_received": false,
    "bounce": false,
    "unsubscribed": false,
    "bump_draft_exists": true,
    "bump_sent": false,
    "eligible": true,
    "days_since_intro": 5,
    "auto_reply": null
  }
]
```

**Outreacher использует для:**
- Принятие решения отправлять ли bump
- Определение с какого ящика (intro_sender_identity)
- Проверка elapsed time (days_since_intro >= 3-5)

**Приоритет:** Высокий (нужен для `/send-campaign --type bump`)

---

## 6. Аналитика

**Уже есть:** `analytics:summary --group-by pattern|icp|segment`

**Нужно добавить:**

```bash
# По rejection reasons
pnpm cli analytics:summary --group-by rejection_reason --error-format json

# Campaign funnel
pnpm cli analytics:funnel --campaign-id <uuid> --error-format json

# По offering
pnpm cli analytics:summary --group-by offering --error-format json
```

**Funnel возвращает:**
```json
{
  "campaign_id": "...",
  "funnel": {
    "drafts_generated": 14,
    "drafts_approved": 14,
    "drafts_rejected": 0,
    "intro_sent": 7,
    "intro_replied": 2,
    "intro_bounced": 0,
    "intro_unsubscribed": 1,
    "bump_generated": 7,
    "bump_approved": 7,
    "bump_sent": 4,
    "bump_replied": 1
  },
  "rejection_reasons": {
    "marketing_tone": 3,
    "bad_subject": 2,
    "too_generic": 1
  }
}
```

**Приоритет:** Средний

---

## Важно: review path

Rejection metadata ОБЯЗАТЕЛЬНО идёт через существующий review path в crew_five (`draft:update-status --metadata`), а не через параллельный формат. Поля:
- `review_reason_code` (string)
- `review_reason_codes` (string[] — если несколько причин)
- `review_reason_text` (string — свободный текст)
- `review_surface` (string — "claude-code" | "campaigns-ui" | "operator-desk")

Taxonomy reason codes: `src/config/draftReviewReasons.ts`

---

## Порядок реализации

| # | Задача | Зависимости | Приоритет |
|---|--------|-------------|-----------|
| 3 | Name parsing repair | — | Высокий |
| 1 | Company import surface | — | Высокий |
| 2 | Company save-processed | #1 (shared validation) | Высокий |
| 5 | Follow-up candidates | — | Высокий |
| 4 | Campaign read models | — | Средний |
| 6 | Аналитика extensions | #4 | Средний |
