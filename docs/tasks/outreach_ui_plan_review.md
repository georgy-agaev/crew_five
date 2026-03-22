# Отзыв Outreach на Pipeline UI Improvement Plan

Источник: `docs/sessions/2026-03-16_9_pipeline_ui_improvement_plan.md`

---

## Общая оценка

План хороший, анализ проблем точный — все 6 пунктов из секции 1 мы подтверждаем на практике. Два режима Campaign Builder (setup vs operations) — правильное разделение. Приоритизация в целом согласована.

---

## Уточнения

### 1. Smartlead vs imap-mcp

План упоминает Smartlead в нескольких местах (sync events, push leads, sequences sync, event sync button). Smartlead поддерживается crew_five через API, но для текущего outreach workflow мы используем **imap-mcp** для работы с реальными почтовыми ящиками.

Transport flow:
```
Outreach → imap_send_email (MCP) → SMTP → получатель
Получатель → reply → IMAP ящик → Outreach imap_search_emails (MCP) → classify → event:ingest → crew_five
```

Для UI это означает:
- **Inbox** строится на `email_events` (уже в crew_five), источник данных одинаковый независимо от transport
- **Event sync** — не кнопка "Sync from Smartlead", а результат polling + classification в Outreach. Но кнопка "Refresh" / "Poll now" в UI имеет смысл — как триггер для Outreach запустить `/process-replies`
- **Mailbox Management** — показывать imap-mcp аккаунты (accountId, user, domain), не Smartlead campaigns

Smartlead может использоваться в будущем для масштабирования, но текущий primary transport — imap-mcp.

### 2. Inbox UI зависит от Outreach `/process-replies`

Inbox UI покажет данные из `email_events` — но записывает их туда Outreach через polling + classification + `event:ingest`. Без `/process-replies` в Outreach — Inbox UI будет пустым.

**Dependency chain:**
```
imap-mcp (читает ящик) → Outreach /process-replies (классифицирует) → event:ingest → crew_five DB → Inbox UI
```

Рекомендация: зафиксировать это как explicit dependency в плане. Inbox backend можно строить параллельно с Outreach `/process-replies`, но frontend будет пустым до тех пор, пока pipeline classification не заработает.

Возможный компромисс: Inbox UI может показывать raw email_outbound (что отправили) даже без replies — это уже полезно для оператора.

### 3. Campaign Builder ↔ Claude Code `/launch-campaign`

Оба делают setup кампании. Важно:
- Оба пишут через crew_five CLI → результат консистентен (shared DB)
- Campaign Builder (UI) — для визуальной работы, итерации, просмотра
- `/launch-campaign` (Claude Code) — для быстрого запуска через CLI/chat
- Не должны конфликтовать: если кампания создана через UI, Claude Code видит её через `campaign:list`

### 4. Чего не хватает в плане

**ICP Learnings UI (предлагаем P3):**
`icp_profiles.learnings` — JSON массив строк-правил, которые накапливаются при ревью писем. Сейчас 4 правила для ICP "Видеоконференции". Оператору нужно:
- Видеть текущие learnings для каждого ICP
- Добавлять/удалять/редактировать правила
- Видеть связь: rejection reason → learning rule (откуда правило появилось)

Пример текущих learnings:
1. "Не использовать слово «зал» — только «переговорная комната»"
2. "Совместимость — это про платформы ВКС, не про разных вендоров"
3. "Хорошие углы: протестированные решения, подбор под помещения, эхо"
4. "Тема = внутреннее письмо, не маркетинг"

**Offering management (предлагаем P3):**
`icp_profiles.offering_domain` связывает ICP с offering из Marketing2025. Хотя бы read-only view: какой ICP с каким offering связан.

### 5. Корректировка приоритетов

Предлагаем поднять **Pre-bump reply check** до **P0**:
- Отправить bump человеку, который уже ответил или отказался — репутационный риск
- Это не UX-improvement, а guardrail предотвращающий ошибку
- Реализация: `campaign:followup-candidates` (уже completed) проверяет eligibility, UI/Outreach должны блокировать отправку для ineligible контактов

---

## Согласованные приоритеты (наше видение)

| Приоритет | Что | Комментарий |
|-----------|-----|-------------|
| **P0** | Campaign status transitions в UI | Согласны |
| **P0** | Inbox rebuild (real reply data) | Согласны, dependency на Outreach /process-replies |
| **P0** | Pre-bump reply check | Повышаем с P1 — репутационный риск |
| **P1** | Pipeline state persistence | Согласны |
| **P1** | Batch draft approve/reject | Согласны |
| **P2** | Home/Dashboard | Согласны |
| **P2** | Pipeline redesign | Согласны |
| **P3** | ICP Learnings UI | Новое — накопление правил из ревью |
| **P3** | Contacts directory | Согласны |
| **P3** | Offering management | Новое — ICP → offering mapping |
| **P3** | XLSX import UI | Согласны |
| **P3** | Mailbox management (imap-mcp) | Согласны, адаптировать под imap-mcp |
| **P4** | Navigation restructure | Согласны |
