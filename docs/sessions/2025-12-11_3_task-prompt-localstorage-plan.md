# 2025-12-11 Session – Task ↔ Prompt Mapping Persistence (localStorage)

> Timestamp: 2025-12-11T12:10:00

## Short Overview

We will persist the Task Configuration mapping between workflow tasks (ICP Discovery, Hypothesis Generation, Email Draft, LinkedIn Message) and prompt IDs using the browser's `localStorage`. This makes the Prompts tab truly useful: once you select prompts for each task, those selections survive page reloads and are still threaded to the backend coach and draft flows.

## Goals (this mini-session)

- Extend the existing Web settings store (`useSettingsStore`) to include a `taskPrompts` object persisted in `localStorage`.
- Initialize the Pipeline workspace Task Configuration from stored `taskPrompts` so selections re-appear after reload.
- Whenever a user changes a task's prompt, update both React state and the persisted settings.
- Keep all existing provider/model settings behaviour intact and avoid any Supabase schema changes.

## Files to Change

- `web/src/hooks/useSettingsStore.ts`  
  - Add a `taskPrompts` field to the `Settings` type and `defaultSettings`.  
  - Ensure `loadSettings` and `saveSettings` correctly round-trip `taskPrompts` alongside providers.

- `web/src/hooks/useSettingsStore.test.ts`  
  - Add coverage to confirm `taskPrompts` is persisted and loaded via `saveSettings`/`loadSettings`.

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`  
  - Initialize `taskPrompts` React state from `loadSettings().taskPrompts`.  
  - When a Task Configuration dropdown changes, update `taskPrompts` and call `saveSettings` with the new mapping.

- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`  
  - Optionally add a small helper-level test to confirm `setTaskPrompt` can be used to persist and rehydrate mappings.

- `CHANGELOG.md`  
  - Note that Task Configuration prompt selections now persist per browser via localStorage.

## Functions (with roles)

- `Settings` (updated, `useSettingsStore.ts`)  
  Gains `taskPrompts?: { icpDiscovery?: string; hypothesisGen?: string; emailDraft?: string; linkedinMsg?: string }` so we can persist task ↔ prompt mappings without breaking existing callers.

- `loadSettings()` (updated)  
  Continues to merge parsed JSON with `defaultSettings`, now also providing a `taskPrompts` object (default `{}`) for any consumer that wants per-task prompt IDs.

- `saveSettings(settings)` (unchanged behaviour, new data)  
  Now writes `settings.taskPrompts` along with providers to `localStorage`, keeping `memoryStore` in sync.

- `PipelineWorkspaceWithSidebar` (updated)  
  Initializes `taskPrompts` React state from `loadSettings().taskPrompts ?? {}` and, on Task Configuration prompt change, updates state via `setTaskPrompt` and persists the new mapping via `saveSettings`.

## Tests (names and behaviours)

- `persists_taskPrompts_mapping_in_settings` (`web/src/hooks/useSettingsStore.test.ts`)  
  Saving a `taskPrompts` object via `saveSettings` and reloading via `loadSettings` yields the same mapping.

- (Existing) `setTaskPrompt` tests (`web/src/pages/PipelineWorkspaceWithSidebar.test.ts`)  
  Verify that the helper returns an updated mapping for the requested task, leaving other keys untouched; used to keep persistence logic simple and predictable.
