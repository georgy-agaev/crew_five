# Tasks: AI-Assisted Segment Builder & EXA Webset Integration

**Input**: Design documents from `/specs/001-segment-search/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: Not explicitly requested - tests optional for now

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/` at repository root
- **Frontend**: `web/` at repository root
- **Tests**: `tests/` (backend), `web/src/` (frontend)

---

## Phase 0: Planning (Executor Assignment) ✅ COMPLETE

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [X] P001 Analyze all tasks and identify required agent types and capabilities
- [X] P002 Create missing agents using meta-agent-v3 (launch N calls in single message, 1 per agent), then ask user restart
- [X] P003 Assign executors to all tasks: MAIN (trivial only), existing agents (100% match), or specific agent names
- [X] P004 Resolve research tasks: simple (solve with tools now), complex (create prompts in research/)

**Analysis Results**:
- **Agents Needed**: fullstack-nextjs-specialist (exists), MAIN
- **New Agents Created**: None (all required agents exist)
- **Research Status**: All complete (research.md contains all decisions)

**Executor Assignments**:
- **MAIN**: T001 (npm install), T027-T030 (verification), T035, T038-T040 (verification/docs)
- **fullstack-nextjs-specialist**: T002-T026, T028, T031-T034, T036-T037 (all implementation)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 [EXECUTOR: MAIN] [SEQUENTIAL] Install use-debounce dependency in web/ for filter preview debouncing: `cd web && pnpm add use-debounce`
  → Artifacts: [package.json](web/package.json), [pnpm-lock.yaml](web/pnpm-lock.yaml)
- [X] T002 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Create types for filter UI in web/src/types/filters.ts
  → Artifacts: [filters.ts](web/src/types/filters.ts)
- [X] T003 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Create types for EXA Webset results in web/src/types/exaWebset.ts
  → Artifacts: [exaWebset.ts](web/src/types/exaWebset.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend services that MUST be complete before ANY user story UI can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-2] Implement filter preview count service in src/services/filterPreview.ts (queries companies/employees with filters, returns counts)
  → Artifacts: [filterPreview.ts](src/services/filterPreview.ts), [tests](tests/filterPreview.test.ts)
- [X] T005 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-2] Implement EXA Webset service wrapper in src/services/exaWebset.ts (uses existing src/integrations/exa.ts client)
  → Artifacts: [exaWebset.ts](src/services/exaWebset.ts), [types](src/types/exaWebset.ts), [tests](tests/exaWebset.test.ts), [docs](docs/exa-webset-usage.md)
- [X] T006 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-2] Extend AI coach to generate segment filters in src/services/icpCoach.ts (add generateSegmentFiltersViaCoach function with JSON mode)
  → Artifacts: [icpCoach.ts](src/services/icpCoach.ts), [tests](tests/segmentFilterCoach.test.ts), [docs](docs/SEGMENT_FILTER_COACH.md), [example](examples/segment-filter-coach-example.ts)
- [X] T007 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-3] Add POST /api/filters/preview endpoint to src/web/server.ts (calls filterPreview service)
  → Artifacts: [server.ts](src/web/server.ts), [tests](tests/web_filter_preview_endpoint.test.ts)
- [X] T008 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-3] Add POST /api/filters/ai-suggest endpoint to src/web/server.ts (calls extended AI coach)
  → Artifacts: [server.ts](src/web/server.ts), [tests](src/web/server.test.ts)
- [X] T009 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-3] Add POST /api/exa/webset/search endpoint to src/web/server.ts (calls exaWebset service)
  → Artifacts: [server.ts](src/web/server.ts), [tests](src/web/server.test.ts)
- [X] T010 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] Add segment creation endpoint validation to src/web/server.ts (verify POST /api/segments exists or create it)
  → Artifacts: [server.ts](src/web/server.ts), [tests](src/web/server.test.ts)

**Checkpoint**: Foundation ready - user story UI implementation can now begin in parallel ✅

---

## Phase 3: User Story 1 - Database-Driven Segment Builder with Manual Filters (Priority: P1) 🎯 MVP

**Goal**: Enable users to manually create filter criteria from companies/employees tables, preview match counts, and save segments

**Independent Test**: Click "Search Database" button → manually define filters (e.g., "companies.industry = 'SaaS'") → see preview count → save segment → verify segment created in database

### Implementation for User Story 1

- [X] T011 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-4] [US1] Create FilterRow component in web/src/components/FilterRow.tsx (field selector, operator dropdown, value input)
  → Artifacts: [FilterRow.tsx](web/src/components/FilterRow.tsx), [tests](web/src/components/FilterRow.test.tsx), [example](web/src/components/FilterRow.example.tsx)
- [X] T012 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-4] [US1] Create useFilterPreview hook in web/src/hooks/useFilterPreview.ts (debounced filter preview with use-debounce)
  → Artifacts: [useFilterPreview.ts](web/src/hooks/useFilterPreview.ts), [tests](web/src/hooks/useFilterPreview.test.ts), [example](web/src/hooks/useFilterPreview.example.tsx)
- [ ] T013 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-5] [US1] Create SegmentBuilder component in web/src/components/SegmentBuilder.tsx (modal with filter rows, preview count, save button)
- [ ] T014 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-5] [US1] Add filterPreviewAPI and createSegmentAPI functions to web/src/apiClient.ts
- [ ] T015 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US1] Add "Search Database" button to Segment tab in web/src/pages/PipelineWorkspaceWithSidebar.tsx (opens SegmentBuilder modal)
- [ ] T016 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US1] Integrate SegmentBuilder modal with state management in web/src/pages/PipelineWorkspaceWithSidebar.tsx (show/hide modal, pass callbacks)

**Checkpoint**: User Story 1 should be fully functional - users can manually create segments with filters

---

## Phase 4: User Story 2 - AI-Assisted Segment Builder with Filter Suggestions (Priority: P1)

**Goal**: Enable users to receive AI-generated filter suggestions (up to 3) with preview counts, select suggestions, and create segments

**Independent Test**: Open segment builder → chat with AI ("suggest filters for enterprise SaaS") → review 3 suggestions with counts → select one → create segment → verify segment saved

### Implementation for User Story 2

- [ ] T017 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6] [US2] Create AIFilterSuggestions component in web/src/components/AIFilterSuggestions.tsx (displays up to 3 AI suggestions with preview counts)
- [ ] T018 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6] [US2] Add aiSuggestFiltersAPI function to web/src/apiClient.ts
- [ ] T019 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US2] Extend SegmentBuilder component in web/src/components/SegmentBuilder.tsx (add AI chat input, suggestions display, selection logic)
- [ ] T020 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US2] Add AI suggestion attribution metadata storage to segment creation in src/web/server.ts POST /api/segments endpoint

**Checkpoint**: User Stories 1 AND 2 should both work independently - users can create segments manually OR with AI assistance

---

## Phase 5: User Story 4 - EXA Webset Tool Integration for Web-Based Segment Discovery (Priority: P1)

**Goal**: Enable users to search web for companies/employees via EXA Webset, preview results, and optionally save as segments

**Independent Test**: Click "EXA Web Search" button → enter segment description → view EXA results (companies/employees with details) → save as segment → verify segment created

### Implementation for User Story 4

- [ ] T021 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7] [US4] Create useExaSearch hook in web/src/hooks/useExaSearch.ts (manages EXA search state, loading, results)
- [ ] T022 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7] [US4] Add exaWebsetSearchAPI and saveExaSegmentAPI functions to web/src/apiClient.ts
- [ ] T023 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-8] [US4] Create ExaWebsetSearch component in web/src/components/ExaWebsetSearch.tsx (modal with description input, results list, save button)
- [ ] T024 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-8] [US4] Add "EXA Web Search" button to Segment tab in web/src/pages/PipelineWorkspaceWithSidebar.tsx (opens ExaWebsetSearch modal)
- [ ] T025 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US4] Integrate ExaWebsetSearch modal with state management in web/src/pages/PipelineWorkspaceWithSidebar.tsx (show/hide modal, refresh segment list after save)
- [ ] T026 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US4] Add EXA result persistence logic to src/web/server.ts (save companies/employees from EXA results to database tables)
  - Implement duplicate company detection/merge strategy (check by domain or name)
  - Add batch insert with transaction handling for 1000+ results
  - Implement error recovery and rollback for partial failures

**Checkpoint**: User Stories 1, 2, AND 4 should all work independently - users can create segments via manual filters, AI suggestions, OR EXA web search

---

## Phase 6: User Story 3 - Integration with Existing Enrichment Workflow (Priority: P2)

**Goal**: Ensure segments created via Database Search and EXA Webset are compatible with existing Step 4 enrichment workflow

**Independent Test**: Create segment via Database Search → navigate to Step 4 (Enrichment) → verify segment appears in list → run enrichment → verify data updated correctly

### Implementation for User Story 3

- [ ] T027 [EXECUTOR: MAIN] [SEQUENTIAL] [US3] Verify segment schema compatibility with enrichment workflow in src/services/segments.ts (filter_definition format, member tables)
  - Verify filter_definition JSON format matches existing enrichment expectations
  - Verify segment_members table includes required columns
  - Verify enrichment service can query segments created via new tools
- [ ] T028 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US3] Add segment list refresh trigger after segment creation in web/src/pages/PipelineWorkspaceWithSidebar.tsx (ensure new segments visible for enrichment)
- [ ] T029 [EXECUTOR: MAIN] [SEQUENTIAL] [US3] Test end-to-end workflow: create segment (Database Search) → enrich → verify data updates
- [ ] T030 [EXECUTOR: MAIN] [SEQUENTIAL] [US3] Test end-to-end workflow: create segment (EXA Webset) → enrich → verify data updates

**Checkpoint**: All user stories should now be independently functional and integrated with existing enrichment workflow

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T031 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-9] Add loading indicators to all async operations in SegmentBuilder and ExaWebsetSearch components (handles edge case: user navigates away during operations)
- [ ] T032 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-9] Add error handling and user-friendly error messages for all API calls in web/src/apiClient.ts (handles edge cases: AI chat failures, EXA rate limits, non-existent columns, partial save failures, data changes after AI suggestions)
- [ ] T033 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-9] Add localization support for all new UI text using existing translation system in web/src/pages/PipelineWorkspaceWithSidebar.tsx
- [ ] T034 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-9] Add validation messages for invalid filters in SegmentBuilder component (handles edge cases: zero match filters, duplicate filter definitions, segment name conflicts, invalid column references)
- [ ] T035 [EXECUTOR: MAIN] [SEQUENTIAL] Verify button styling consistency for "Search Database" and "EXA Web Search" buttons with existing theme
- [ ] T036 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-10] Add keyboard navigation support for segment builder (tab through fields, enter to submit)
- [ ] T037 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-10] Add ARIA labels for accessibility in FilterRow, SegmentBuilder, and ExaWebsetSearch components
- [ ] T038 [EXECUTOR: MAIN] [SEQUENTIAL] Test all modals in Light and Dark themes (use existing isDark flag)
- [ ] T039 [EXECUTOR: MAIN] [SEQUENTIAL] Run type-check and build for both backend and frontend: `pnpm build && cd web && pnpm build`
- [ ] T040 [EXECUTOR: MAIN] [SEQUENTIAL] Update CHANGELOG.md with feature additions and version bump

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1, US2, US4 can proceed in parallel after Phase 2 (different components)
  - US3 depends on US1 and US4 completion (integration testing)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Extends US1 but independently testable
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after US1 and US4 complete - Integration testing only

### Within Each User Story

- Components and hooks marked [P] can be built in parallel (different files)
- API client functions can be added in parallel
- Modal integration happens after component creation
- Components before modal integration
- API endpoints before UI components that call them

### Parallel Opportunities

**Phase 1 (Setup)**: All 3 tasks can run in parallel
```bash
# Launch together:
Task T001: Install use-debounce
Task T002: Create web/src/types/filters.ts
Task T003: Create web/src/types/exaWebset.ts
```

**Phase 2 (Foundational)**: Tasks T004-T006 and T007-T009 in parallel groups
```bash
# Parallel Group 1 (services):
Task T004: filterPreview.ts
Task T005: exaWebset.ts
Task T006: icpCoach.ts extension

# Then Parallel Group 2 (endpoints):
Task T007: POST /api/filters/preview
Task T008: POST /api/filters/ai-suggest
Task T009: POST /api/exa/webset/search
```

**User Story 1**: T011-T012 in parallel, then T013-T014 in parallel
```bash
# Parallel Group 1:
Task T011: FilterRow.tsx
Task T012: useFilterPreview.ts

# Parallel Group 2:
Task T013: SegmentBuilder.tsx
Task T014: apiClient.ts additions
```

**User Story 2**: T017-T018 in parallel
```bash
# Parallel Group:
Task T017: AIFilterSuggestions.tsx
Task T018: apiClient.ts additions
```

**User Story 4**: T021-T022 in parallel, then T023-T024 in parallel
```bash
# Parallel Group 1:
Task T021: useExaSearch.ts
Task T022: apiClient.ts additions

# Parallel Group 2:
Task T023: ExaWebsetSearch.tsx
Task T024: Button addition to PipelineWorkspaceWithSidebar.tsx
```

**Polish Phase**: T031-T034, T036-T038 all in parallel (different files or sections)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup → Dependencies installed
2. Complete Phase 2: Foundational → Backend services and API endpoints ready
3. Complete Phase 3: User Story 1 → Manual segment builder functional
4. **STOP and VALIDATE**: Test manual segment creation end-to-end
5. Deploy/demo if ready (basic segment builder with manual filters)

### Incremental Delivery

1. Setup + Foundational → API layer ready
2. Add User Story 1 → Test manually created segments → Deploy/Demo (MVP!)
3. Add User Story 2 → Test AI-assisted segments → Deploy/Demo
4. Add User Story 4 → Test EXA web search → Deploy/Demo
5. Add User Story 3 → Verify enrichment integration → Deploy/Demo
6. Add Polish → Professional UX refinements → Deploy/Demo

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (critical path)
2. Once Foundational is done:
   - Developer A: User Story 1 (manual segment builder)
   - Developer B: User Story 2 (AI suggestions) - light dependency on US1 component
   - Developer C: User Story 4 (EXA search)
3. Developer D: User Story 3 (integration testing after US1 + US4)
4. All: Polish phase (cross-cutting concerns)

---

## Library Decisions Summary

Based on research.md findings:

| Component | Decision | Library/Approach |
|-----------|----------|------------------|
| Debounce | ✅ use-debounce | 2.4KB, React-native, TypeScript support |
| Filter UI | ✅ Custom components | ~100-150 lines, full control, existing patterns |
| EXA Integration | ✅ Reuse existing | src/integrations/exa.ts already implements Webset API |
| Modal Pattern | ✅ Existing pattern | Follow PipelineWorkspaceWithSidebar.tsx modal structure |
| Filter Validation | ✅ Reuse existing | src/filters/index.ts validation system |
| AI Coach | ✅ Extend existing | src/services/coach.ts, src/services/icpCoach.ts |

**Key Insight**: Maximum reuse of existing infrastructure minimizes new code and maintains consistency.

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Backend services (Phase 2) must complete before any UI work
- Commit after each task using `/push patch`
- Stop at any checkpoint to validate story independently
- US1 is MVP - can ship after Phase 3 complete
- US2 and US4 add significant value but are independent
- US3 is integration validation only (no new features)
