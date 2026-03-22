# Task: Multi-Project Foundations Backend

**Date:** 2026-03-22
**Status:** Done
**Owner:** backend / Codex

## Goal

Add the minimal canonical project/workspace registry needed to run multiple projects in the same
shared GTM spine without flattening execution identity into `offer` alone.

## Product Rule

Execution identity still follows:

- ICP profile
- ICP hypothesis
- segment subset
- campaign wave

`project` is a shared business/workspace boundary on top of that spine, not a replacement for ICP.

## Completed

- Added canonical project registry service:
  [projects.ts](/Users/georgyagaev/crew_five/src/services/projects.ts)
- Added migration:
  [20260322012000_add_projects_and_project_links.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260322012000_add_projects_and_project_links.sql)
- Added canonical CLI:
  - `project:list`
  - `project:create`
  - `project:update`
- Added canonical web routes:
  - `GET /api/projects`
  - `POST /api/projects`
  - `PUT /api/projects/:projectId`
- Added `project_id` linkage on:
  - `icp_profiles`
  - `offers`
  - `campaigns`
- Extended ICP public surfaces with `projectId`
- Added project-aware consistency rules:
  - `ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH`
  - `CAMPAIGN_PROJECT_MISMATCH`
- Extended raw `campaign:create` with `--project-id`
- Extended offer surfaces with `projectId`

## Required Follow-Up

- Apply schema changes:
  - `supabase db push`
- Frontend can now build a minimal project picker / visibility layer on top of the new registry.
- Outreach can now choose/create a canonical `projectId` before offer / launch flows.
