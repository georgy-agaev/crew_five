# Implementation Plan: AI-Assisted Segment Builder & EXA Webset Integration

**Branch**: `001-segment-search` | **Date**: 2025-12-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-segment-search/spec.md`

## Summary

Build two segment creation tools for the existing GTM pipeline: (1) Database Search - an interactive segment builder with manual filter creation and AI-assisted suggestions using existing `companies`/`employees` data, featuring real-time preview counts; (2) EXA Web Search - integration with EXA Webset API for web-based company discovery. Both tools create segments compatible with the existing Step 4 enrichment workflow.

**Primary Requirement**: Enable users to create data-driven segments through manual filter building or AI assistance (Database Search) and discover new prospects via EXA Webset (EXA Web Search), with seamless integration into existing enrichment pipeline.

**Technical Approach**: Extend existing React web UI (`PipelineWorkspaceWithSidebar.tsx`) with new modal/panel interfaces for segment builder and EXA search. Backend adds API endpoints for filter preview counts, AI filter generation, and EXA Webset integration. Leverage existing filter validation system, segment services, AI coach, and Supabase database.

## Technical Context

**Language/Version**: TypeScript 5.6+ (backend), TypeScript 5.9+ (web)
**Primary Dependencies**:
- Backend: Node.js, Express (existing web server in `src/web/server.ts`), Supabase client, existing AI client
- Frontend: React 19, Vite 7, existing UI component library
**Storage**: Supabase PostgreSQL (existing `companies`, `employees`, `segments` tables)
**Testing**: Vitest (both backend and frontend)
**Target Platform**: Web application (browser + Node.js server)
**Project Type**: Web (separate backend/frontend structure)
**Performance Goals**:
- Filter preview counts < 2 seconds (10k potential matches)
- AI filter suggestions < 5 seconds
- EXA Webset results < 10 seconds
- Segment creation < 1 second
**Constraints**:
- Must maintain compatibility with existing filter schema (JSON array format)
- Must not modify existing Step 4 enrichment workflow
- Must preserve existing button styles and localization system
**Scale/Scope**:
- Support filter creation across all `companies` and `employees` table columns
- Handle result sets up to 1000 companies from EXA Webset
- Support concurrent users (typical web app load)
- Support 5 languages via existing translation system

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Context-First Development
- [X] Reviewed existing code: `src/web/server.ts`, `src/services/segments.ts`, `src/filters/index.ts`, `src/services/coach.ts`, `web/src/pages/PipelineWorkspaceWithSidebar.tsx`, `web/src/apiClient.ts`
- [X] Identified integration points: existing filter validation, segment CRUD, AI coach system, enrichment workflow (Step 4)
- [X] Reviewed dependencies: Supabase client, existing HTTP server, React UI patterns

### ✅ II. Single Source of Truth
- [X] Will use existing filter definition format from `src/filters/index.ts`
- [X] Will use existing segment schema from `src/services/segments.ts`
- [X] Will define new types in shared locations (API contracts in `/contracts`, frontend types in web/src)

### ⚠️ III. Library-First Development
- [ ] NEEDS RESEARCH: UI component library for segment builder form (filter builder with field/operator/value selection)
- [ ] NEEDS RESEARCH: EXA Webset SDK/client library
- [ ] NEEDS RESEARCH: Real-time preview/debouncing library for filter counts
- [ ] Will evaluate in Phase 0

### ✅ IV. Code Reuse & DRY
- [X] Reusing existing filter validation system (`src/filters/index.ts`)
- [X] Reusing existing segment services (`src/services/segments.ts`)
- [X] Reusing existing AI coach (`src/services/coach.ts`, `src/services/aiClient.ts`)
- [X] Reusing existing translation system (localization in `PipelineWorkspaceWithSidebar.tsx`)

### ✅ V. Strict Type Safety
- [X] TypeScript strict mode already enforced (project tsconfig)
- [X] Will define explicit types for all new API endpoints
- [X] Will use Zod or existing validation for request/response schemas

### ✅ VI. Atomic Task Execution
- [X] Will structure tasks atomically (one feature per task)
- [X] Will commit after each task with validation
- [X] Will use single-task agent delegation

### ✅ VII. Quality Gates
- [X] Type-check required (existing `pnpm build` for backend, `pnpm build` for frontend)
- [X] Tests required (Vitest for both)
- [X] No hardcoded credentials (existing .env pattern)
- [X] Will add AST-grep rules if needed

### ✅ VIII. Progressive Specification
- [X] Spec completed (`spec.md`)
- [X] Plan in progress (this file)
- [ ] Tasks (Phase 2, via `/speckit.tasks`)
- [ ] Implementation (Phase 3, via `/speckit.implement`)

### IX. Error Handling
- [X] Will use existing error handling patterns from `src/web/server.ts`
- [X] Will create typed errors for new operations
- [X] Will provide localized, actionable user messages

### X. Observability
- [X] Will use existing structured logging (if present) or add minimal logging for new endpoints
- [X] Will track AI attribution metadata for analytics

### XI. Accessibility (RECOMMENDED)
- [X] Will ensure keyboard navigation for segment builder
- [X] Will add ARIA labels for form controls
- [X] Will verify color contrast (existing theme system)
- [X] Will test with Light/Dark themes (existing implementation)

### Security Requirements
- [X] No new credentials (reusing existing Supabase, EXA API keys via env)
- [X] Input validation via existing filter validation system
- [X] RLS already enforced by Supabase for segments table

### Technology Standards
- [X] Aligns with existing TypeScript/React/Node.js/Supabase stack
- [X] Follows existing file organization (src/ for backend, web/ for frontend)

**Constitution Check Result**: ✅ PASSED (pending Phase 0 library research)

## Project Structure

### Documentation (this feature)

```text
specs/001-segment-search/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (PENDING)
├── data-model.md        # Phase 1 output (PENDING)
├── quickstart.md        # Phase 1 output (PENDING)
├── contracts/           # Phase 1 output (PENDING)
│   ├── filter-preview.json
│   ├── ai-filter-suggest.json
│   └── exa-search.json
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (frontend + backend)

# Backend (Node.js + Express)
src/
├── web/
│   └── server.ts        # Existing HTTP server - ADD new endpoints
├── services/
│   ├── segments.ts      # Existing segment CRUD - reuse
│   ├── coach.ts         # Existing AI coach - reuse/extend
│   ├── aiClient.ts      # Existing AI client - reuse
│   ├── filterPreview.ts # NEW: filter preview count service
│   └── exaWebset.ts     # NEW: EXA Webset integration service
├── filters/
│   └── index.ts         # Existing filter validation - reuse
└── integrations/
    └── exa.ts           # Existing Exa client - check if compatible with Webset API

tests/
├── filterPreview.test.ts      # NEW
├── exaWebset.test.ts          # NEW
├── web_filter_endpoints.test.ts # NEW
└── web_exa_endpoints.test.ts   # NEW

# Frontend (React + Vite)
web/
├── src/
│   ├── pages/
│   │   └── PipelineWorkspaceWithSidebar.tsx  # Existing - EXTEND with new modals/panels
│   ├── components/
│   │   ├── SegmentBuilder.tsx               # NEW: segment builder UI
│   │   ├── FilterRow.tsx                     # NEW: individual filter row
│   │   ├── AIFilterSuggestions.tsx           # NEW: AI suggestion display
│   │   └── ExaWebsetSearch.tsx               # NEW: EXA search interface
│   ├── hooks/
│   │   ├── useFilterPreview.ts               # NEW: real-time preview hook
│   │   └── useExaSearch.ts                   # NEW: EXA search hook
│   ├── apiClient.ts                          # Existing - ADD new functions
│   └── types/
│       ├── filters.ts                        # NEW: filter UI types
│       └── exaWebset.ts                      # NEW: EXA result types
└── src/
    ├── SegmentBuilder.test.tsx              # NEW
    ├── FilterRow.test.tsx                   # NEW
    └── ExaWebsetSearch.test.tsx             # NEW
```

**Structure Decision**: Extend existing web application structure. Backend adds 2 new service files and 4 new endpoints to existing `server.ts`. Frontend adds 4 new components, 2 new hooks, and extends existing `PipelineWorkspaceWithSidebar.tsx` with modal/panel interfaces. This aligns with existing separation of concerns and reuses maximum existing infrastructure.

## Complexity Tracking

> **No violations requiring justification.**

All constitution principles are followed. Existing infrastructure supports the feature without requiring new projects, patterns, or architectural changes.

---

## Phase 0: Research & Library Evaluation

**Status**: IN PROGRESS

### Research Tasks

1. **UI Component Library for Filter Builder**
   - Need: Form component for building filter rules (field selector, operator dropdown, value input)
   - Evaluation criteria: TypeScript support, React 19 compatibility, bundle size, accessibility

2. **EXA Webset API Investigation**
   - Confirm API endpoint differences between Discovery and Webset
   - Check if existing `src/integrations/exa.ts` supports Webset queries
   - Document request/response schema

3. **Debounce/Throttle Utility**
   - For real-time filter preview counts
   - Evaluation criteria: Small footprint, TypeScript support

4. **Database Schema Discovery**
   - Query `companies` and `employees` tables for available columns
   - Document field types for UI filter building

5. **AI Coach Extension Requirements**
   - Can existing coach generate structured filter JSON?
   - What prompt modifications needed for filter suggestions?

6. **UI Modal/Panel Pattern**
   - Review existing modal patterns in `PipelineWorkspaceWithSidebar.tsx`
   - Identify reusable components

**Research Output**: Will generate `research.md` with findings and decisions.

---

## Phase 1: Design & Contracts

**Status**: NOT STARTED (awaits Phase 0 completion)

Will generate:
- `data-model.md`: Filter schema, EXA result schema, segment compatibility
- `contracts/filter-preview.json`: POST /api/filters/preview endpoint spec
- `contracts/ai-filter-suggest.json`: POST /api/filters/ai-suggest endpoint spec
- `contracts/exa-webset-search.json`: POST /api/exa/webset/search endpoint spec
- `quickstart.md`: Local setup, testing instructions
- Agent context update

---

## Phase 2: Task Breakdown

**Status**: NOT STARTED (via `/speckit.tasks` after Phase 1)

---

**Next Action**: Execute Phase 0 research tasks.
