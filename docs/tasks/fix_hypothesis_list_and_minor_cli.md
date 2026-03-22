# Задача: мелкие доработки CLI для Outreach

## Статус

Completed

Примечание: пункт про SMTP port в `imap_add_account` задокументирован как внешний для `imap-mcp`; изменения
в `crew_five` по этой части не требовались.

## 1. Добавить `--icp-profile-id` фильтр в `campaign:list`

Сейчас `campaign:list` фильтрует по `--status` и `--segment-id`. Outreach часто нужно найти кампании по ICP — приходится загружать все и фильтровать на стороне клиента.

Предложение: добавить `--icp-profile-id` фильтр (через join segments → icp_profile_id или через campaigns.metadata.icp_profile_id).

## 2. SMTP port в `imap_add_account`

Outreach добавляет email-аккаунты через imap-mcp `imap_add_account`. Инструмент не поддерживает SMTP-параметры — приходится вручную редактировать accounts.json.

Это вопрос к imap-mcp серверу, не к crew_five, но стоит задокументировать в operating model что SMTP-конфигурация требует ручной правки accounts.json.

## 3. `email:record-outbound` — проверить работоспособность

Outreach будет записывать факты отправки через `email:record-outbound`. Проверить что команда:
- Создаёт запись в `email_outbound`
- Обновляет `drafts.status` на `sent`
- Корректно обрабатывает `status: failed`
- Возвращает JSON с outbound_id

## 4. `event:ingest` — проверить работоспособность

Outreach будет ингестить ответы/баунсы через `event:ingest`. Проверить что команда:
- Создаёт запись в `email_events`
- Принимает event_type: reply, bounce, unsubscribe
- Корректно связывает с outbound_id

## Приоритет

Средний — п.3 и п.4 нужны для /send-campaign, но отправка заблокирована портами сервера.
