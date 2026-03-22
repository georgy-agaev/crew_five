# Task: Multi-Project Foundations Web UI

**Date:** 2026-03-22
**Status:** Done
**Owner:** frontend / Claude

## Goal

Expose canonical project context in existing launch / campaign surfaces without creating a new
dashboard or replacing ICP-first execution semantics.

## Backend Ready

- `GET /api/projects`
- `POST /api/projects`
- `PUT /api/projects/:projectId`
- `GET /api/campaigns`
- `POST /api/campaigns`
- `POST /api/campaigns/launch-preview`
- `POST /api/campaigns/launch`

## Required UI Work

1. Add a compact project picker to launch flows.
2. Allow inline project creation in the same style as offer creation.
3. If UI exposes ICP create/edit, allow explicit project selection there too.
4. Pass `projectId` into raw create / launch flows when operator chooses a project.
5. Show linked project in normal campaign context.
6. Keep project visually separate from:
   - ICP
   - hypothesis
   - offer

## Important Rule

Do not present project as the execution root.

Execution remains:

- ICP
- hypothesis
- segment subset
- campaign wave

Project is a boundary / workspace context around that execution spine.

## Out Of Scope

- dedicated project management screen
- project analytics dashboard
- project-scoped auth / tenancy UI
