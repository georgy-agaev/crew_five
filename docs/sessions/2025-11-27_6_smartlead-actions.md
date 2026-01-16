# Session Notes – 2025-11-27 Smartlead Actions (campaigns, leads, sequences)

## Overview
- Goal: Exercise Smartlead direct API flows (list/create campaigns, add leads, sync sequences) and record the exact payloads/results for reuse.
- Scope covered: Smartlead campaign listing, campaign creation, lead push into a draft campaign, and a two-step sequence sync.

## Actions Performed
- **List campaigns**: Confirmed available campaigns via `smartlead:campaigns:list` (direct API). Notable IDs:
  - `2718813` – `test camp` (DRAFTED)
  - `2718812` – `test` (DRAFTED)
  - `2235282` – `VX_RU` (ACTIVE)
  - `2235316` – `VX_CC_RU` (COMPLETED)
  - `2129206` – `D3D-s_US` (STOPPED)
  - `1639348` – `Meulum Personal PTZ` (PAUSED)
  - `1639336` – `Meulum General PTZ` (PAUSED)

- **Create campaigns**:
  - Endpoint: `POST https://server.smartlead.ai/api/v1/campaigns/create?api_key=...`
  - Body (JSON): `{ "name": "<campaign name>", "client_id": "<workspaceId|null>" }`
  - Result: “test camp” and “test” created (status DRAFTED).

- **Add lead to campaign** (`test camp`, id `2718813`):
  - Endpoint: `POST /api/v1/campaigns/{campaignId}/leads?api_key=...`
  - Payload:
    ```json
    {
      "lead_list": [
        {
          "first_name": "Светлана",
          "last_name": "Кисельчук",
          "email": "svetlana.kiselchuk@ucmsgroup.ru",
          "company_name": "UCMS Group",
          "website": "ucmsgroup.ru",
          "custom_fields": {
            "title": "Генеральный директор",
            "patronymic": "Брониславовна"
          }
        }
      ],
      "settings": {
        "return_lead_ids": true,
        "ignore_duplicate_leads_in_other_campaign": true
      }
    }
    ```
  - Result: API returned `{}` (Smartlead returns empty JSON on success); lead appears in “test camp”.

- **Sync sequence** (`test camp`, id `2718813`):
  - Endpoint: `POST /api/v1/campaigns/{campaignId}/sequences?api_key=...`
  - Payload:
    ```json
    {
      "sequences": [
        {
          "seq_number": 1,
          "delay_in_days": 0,
          "subject": "test subj",
          "email_body": "Hi! First email",
          "variant_label": "A"
        },
        {
          "seq_number": 2,
          "delay_in_days": 3,
          "subject": "test subj",
          "email_body": "Second email, bye",
          "variant_label": "A"
        }
      ]
    }
    ```
  - Result: `{ "ok": true, "data": "success" }`; two-step sequence now attached to “test camp”.

## Notes / How to Reuse
- Campaign creation: name + optional `client_id`; Smartlead responds with 400 if the endpoint/format is wrong.
- Lead push: use `lead_list` and `settings.return_lead_ids=true` to fetch lead IDs; Smartlead may return empty JSON even on success.
- Sequence sync: keep `seq_number` ordered, include `variant_label`, and reuse subject if needed across steps.
- Adapter/UI now supports:
  - Listing Smartlead campaigns with statuses.
  - Creating Smartlead campaigns via `/api/smartlead/campaigns`.
  - Pushing leads/sequences can be done via CLI or direct script using the Smartlead client.

## Follow-ups
- Add explicit logging of lead IDs on `addLeadsToCampaign` responses.
- Optionally expose sequence sync + lead push controls in the UI with dry-run preview. 
