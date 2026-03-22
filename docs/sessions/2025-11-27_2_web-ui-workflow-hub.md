# Session Notes – 2025-11-27 Web UI Workflow Hub

## Overview
- Goal: Align the web UI with PRD v0.2 workflows (client selection → first email + bump, ICP discovery, SIM/offer roast) while keeping ops controls reachable and Smartlead readiness visible.
- Scope: Front-end only (React mock/live adapter). Reused existing API client for campaigns/drafts/send; added mock data for new workflow surfaces.

## Completed
- Built a **Workflow Hub** shell with tabs for client selection, ICP discovery/expansion, SIM, ops desk, and settings; added readiness badges for Supabase/Smartlead.
- Added **Workflow 0** page: audience filters, contact review with include/exclude, base email + bump setup, draft generation hook (dry-run/limit/modes), Smartlead preview, and guardrail checklist.
- Added **ICP discovery** page: ICP form → Exa query plan → pre-import review with approvals and metadata hand-off notes.
- Added **SIM/offer roast** page: mode toggle, value prop + email under test, seed persona selection, alignment scoring helper, and actionable notes.
- Updated styling (Space Grotesk, cards/tabs/pills/panels) for clearer hierarchy; ops desk now nests campaigns/drafts/send/events cards.
- Tests: Added helper coverage for workflow filters/stats, ICP query derivation, SIM scoring; `pnpm vitest run` green.
- Docs: README now documents the Web UI workflow hub; changelog bumped to 0.1.38.

## To Do
- Wire new UI surfaces to live Supabase data (companies/employees/segments) and Smartlead push once endpoints exist.
- Add SIM/ICP persistence (icp_profiles, sim_runs) when migrations and APIs land; surface run history in UI.
- Capture cost/volume estimates and AnySite/Exa run limits in the UI before triggering remote calls.
