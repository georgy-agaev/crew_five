# Session Plan – 2025-11-27 Workflow 0 Live Wiring (Planned)

## Overview
- Goal: Connect the Workflow 0 UI (audience selection → drafts → Smartlead preview) to live Supabase data and the Smartlead API client, while keeping guardrails (limits, dry-run by default) and avoiding legacy MCP fallbacks.
- Scope: Web adapter + web UI + API client; no schema changes. Limit to read-only company/contact fetches, draft generation trigger, and Smartlead preview send.

## Plan
- **Adapter endpoints**: Expose companies/contacts with filters and Smartlead send preview via existing adapter (`src/web/server.ts`).
- **API client**: Add functions to fetch companies/contacts and trigger Smartlead preview from UI (`web/src/apiClient.ts`).
- **UI workflow wiring**: Replace mock data in `WorkflowZeroPage` with live fetch + selection payloads, enforcing caps/guards on cohort size and missing emails.
- **Smartlead hook**: Call Smartlead preview/send through existing client in live mode with dry-run default, surface readiness and errors.
- **Validation/guards**: Cap results (e.g., 5k) in adapter and UI; handle missing email exclusions; keep dry-run on by default.
- **Tests**: Add adapter tests for new routes; UI tests for data plumbing and guardrails; API client tests for new functions.
- **Docs**: Brief note in README/Setup about new endpoints and live wiring for Workflow 0.

## Target Files
- `src/web/server.ts` – add GET `/api/companies`, `/api/contacts`, POST `/api/smartlead/send` reusing smartlead client with dry-run default; apply limits/filters.
- `src/web/server.test.ts` – cover new routes and guardrails.
- `web/src/apiClient.ts` – add `fetchCompanies`, `fetchContacts`, `triggerSmartleadPreview`.
- `web/src/pages/WorkflowZeroPage.tsx` – replace mock data with live fetch, selection state, and Smartlead preview call; enforce caps and missing-email handling.
- `web/src/pages/WorkflowZeroPage.test.tsx` – update for live data plumbing/guards.
- `README.md` – note new adapter endpoints / UI wiring (short).

## Completed
- Added `/api/companies` and `/api/contacts` (with caps) plus Smartlead send dry-run default in the web adapter; mock/live deps cover new routes and tests verify filters/caps.
- API client now fetches companies/contacts and triggers Smartlead preview with dry-run on by default; tests cover query strings and payloads.
- Workflow 0 UI now pulls live companies/contacts, auto-includes contacts with email, enforces cohort cap (5k), and uses Smartlead preview; helper tests updated.
- README updated to note live Workflow 0 wiring; full test suite (`pnpm vitest run`) green.
- Error surface: API client now propagates server error messages (not just status) to help debug Smartlead send/adapter issues in the UI.
- Smartlead preview now short-circuits dry-run to avoid backend fetch failures (returns summary using provided leadIds); companies/contacts mapping aligned to `company_name`, `office_qualification`, `work_email`/`generic_email`.
- Added safety wrapper around Smartlead send route so adapter returns a JSON error (not a crash) if downstream send throws.

## Functions (to add/extend)
- `listCompaniesFiltered(opts)` (server): query Supabase companies with basic filters + cap.
- `listContactsByCompanyIds(ids)` (server): fetch employees with email/status and company links, cap results.
- `sendSmartleadPreview(payload)` (server): invoke Smartlead client dry-run to summarize fetched leads.
- `fetchCompanies(params)` (web apiClient): GET `/companies` with filters.
- `fetchContacts(params)` (web apiClient): GET `/contacts` by company IDs.
- `triggerSmartleadPreview(payload)` (web apiClient): POST `/smartlead/send` dry-run path for UI.

## Tests
- `web server routes – lists companies with filters and cap` – applies query + limit.
- `web server routes – lists contacts by company ids` – returns contacts scoped to IDs.
- `web server routes – smartlead send defaults to dry-run` – dry-run true when omitted.
- `apiClient – fetchCompanies/contacts build URLs` – correct querystrings.
- `WorkflowZeroPage – loads companies/contacts and enforces caps` – disables actions when over limit/missing email.
- `WorkflowZeroPage – triggers draft generate and smartlead preview` – calls APIs with selection and dry-run.
