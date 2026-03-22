# 2025-12-01 – Prompt Selection & Registry UI Plan

> Timestamp (UTC): 2025-12-01T13:30:38Z  
> Goal: expose prompt selection per coach step (ICP profile → hypothesis →
> drafts) in the Web UI, backed by `prompt_registry`, while keeping system
> scaffolding non-editable. No legacy paths.

## Overview
- Separate system prompts (fixed scaffolding) from user-selectable variants.
- Let users pick per-step prompt variants per campaign via a bundle; store bundle in campaign metadata.
- Provide a registry page to list/create prompt versions (metadata only) and an optional composed prompt preview.

## To Do
- Closed: prompt registry surface, campaign prompt selection, optional prompt preview, draft metadata wiring,
  and docs/tests landed; no remaining To Dos tracked in this session file.

## Completed
- Prompt registry page added to list/create prompt entries with step-tagged IDs, versions, rollout statuses, and optional variant text; system scaffold remains fixed in code (`web/src/pages/PromptRegistryPage.tsx`, test helper).
- API client exposes typed prompt registry fetch/create (`web/src/apiClient.ts`, tests updated).
- Web draft generation flows (Drafts/Campaigns/W0/ICP Discovery) now thread curated provider/model selections from settings; settings store/page expose per-task provider/model dropdowns with validation.
