# Task: Claude Stage Closeout Handoff

**Date:** 2026-03-22
**Status:** In Progress
**Owner:** frontend / Claude

## Goal

Use this as the single finish-line brief for the current stage so frontend can move cleanly into E2E
 verification and stage-closeout commit.

## Backend Status

The current backend stage is effectively complete. The following are already implemented and should be
 treated as canonical:

- campaign send preflight
- campaign launch preview / launch
- campaign send policy
- campaign wave attach
- campaign detail composition visibility
- suppression / deliverability hardening
- minimal offer registry
- offer-aware analytics
- operational hypothesis
- next-wave preview / create
- controlled rotation preview
- multi-project foundations

## Confirmed Frontend Status

Already implemented in this session:

- send preflight card and blocker rendering
- campaign launch drawer
- explicit send-policy confirmation flow
- offer picker + inline create
- hypothesis picker
- campaign companies / employee context / drill-down
- next-wave drawer
- rotation preview UI
- composition visibility
- execution exposure rendering
- analytics groupings for offer / hypothesis / recipient type / sender identity

Do not reopen these unless E2E finds a real regression.

## Remaining Frontend Priority

### 1. Multi-Project Foundations Web UI

Primary open frontend task:

- [multi_project_foundations_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/multi_project_foundations_web_ui.md)

Required:

1. Add compact project picker to launch flows.
2. Allow inline project creation in the same style as offer creation.
3. If ICP create/edit is exposed in UI, allow explicit project selection there too.
4. Pass `projectId` into create / launch flows when chosen.
5. Show linked project in normal campaign context.
6. Keep project visually separate from:
   - ICP
   - hypothesis
   - offer

### 2. Stage E2E Verification

After the project UI pass, verify these live operator scenarios:

1. Launch a campaign with:
   - project
   - offer
   - optional hypothesis
   - explicit send policy
2. Open Campaigns and confirm context shows:
   - project
   - offer
   - hypothesis
   - send policy
   - sender plan / preflight
3. Open Builder V2 and confirm:
   - next-wave preview loads
   - rotation preview loads
4. Check analytics selectors:
   - offer
   - hypothesis
   - recipient type
   - sender identity

## Product Rules To Keep Explicit

- `project` is workspace / business boundary, not execution root
- `ICP` is targeting root
- `hypothesis` is execution preset under ICP
- `offer` is business proposition / execution context
- `segment` is subset of ICP / hypothesis audience
- `campaign` is a wave over that subset

Do not flatten these identities into one label in UI.

## Out Of Scope

- new dashboard
- full project management screen
- project-scoped auth / tenancy model
- rotation automation
- offer CRUD beyond compact operator needs
