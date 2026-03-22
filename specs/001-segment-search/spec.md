# Feature Specification: AI-Assisted Segment Builder & EXA Webset Integration

**Feature Branch**: `001-segment-search`
**Created**: 2025-12-15
**Updated**: 2025-12-16
**Status**: Draft
**Input**: User description: "web UIs for 'Database Search' and 'EXA Search' buttons situated on Segment tab, wiring up with existing endpoint, create new endpoint if missed"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Database-Driven Segment Builder with Manual Filters (Priority: P1)

Users can click the "Search Database" button to open an interactive segment builder where they can manually create filter criteria based on all available parameters from the `companies` and `employees` tables, preview how many matches exist, and save the resulting segment to the database.

**Why this priority**: This is the foundational capability enabling users to build precise segments using their existing data. Without this, users cannot leverage the filtering system to target specific company and employee attributes. It provides immediate value by giving users control over segment definition.

**Independent Test**: Can be fully tested by clicking "Search Database", manually defining filters using company and employee parameters (e.g., "companies.industry = 'SaaS' AND employees.role = 'CTO'"), seeing the preview count, and saving the segment. Delivers value by enabling data-driven segmentation.

**Acceptance Scenarios**:

1. **Given** a user is on the Segment tab, **When** they click the "Search Database" button, **Then** a segment builder interface opens showing available filter parameters from `companies` and `employees` tables.
2. **Given** the segment builder is open, **When** the user selects filter criteria (field, operator, value), **Then** the system displays a preview count of how many companies and employees match the current filter set.
3. **Given** the user has defined one or more filters, **When** they click "Create Segment", **Then** a new segment is created in the database with the filter definition and the user receives confirmation.
4. **Given** filter parameters are invalid or incomplete, **When** the user attempts to create a segment, **Then** validation errors are displayed with specific guidance on what needs to be corrected.

---

### User Story 2 - AI-Assisted Segment Builder with Filter Suggestions (Priority: P1)

Users can leverage AI chat integration within the segment builder to receive intelligent filter suggestions based on their ICP profile, hypothesis, or natural language description, with each AI-suggested filter showing preview counts so users can evaluate relevance before choosing up to 3 suggested filters to combine or apply.

**Why this priority**: AI assistance dramatically reduces the cognitive load of manual filter creation and enables users without deep data knowledge to build effective segments. This is critical for user adoption and reduces time-to-value from hours to minutes.

**Independent Test**: Can be fully tested by opening the segment builder, chatting with the AI ("suggest filters for enterprise SaaS companies in North America"), reviewing the AI's suggested filters (up to 3) with preview counts, selecting one or more suggestions, and creating a segment. Delivers value by democratizing segment creation.

**Acceptance Scenarios**:

1. **Given** the segment builder is open with AI chat enabled, **When** the user provides a natural language description of their target segment, **Then** the AI proposes up to 3 different filter configurations with preview counts for each.
2. **Given** the AI has proposed multiple filter options, **When** the user reviews the suggestions, **Then** each suggestion clearly shows the filter criteria and the count of matching companies and employees.
3. **Given** AI-proposed filters are displayed, **When** the user selects one or more suggestions (up to 3), **Then** the selected filters are applied to the segment builder and combined appropriately (AND/OR logic as specified).
4. **Given** the user has selected AI-proposed filters, **When** they click "Create Segment", **Then** the segment is created with the AI-suggested filter definition and attribution metadata is stored for analytics.

---

### User Story 3 - Integration with Existing Enrichment Workflow (Priority: P2)

After a segment is created and saved to the database (from either Database Search or EXA Webset), users can proceed to Step 4 (Enrichment) in the existing pipeline workflow, where the segment can be enriched using the already-available multi-provider enrichment functionality.

**Why this priority**: This ensures that segments created through the new Database Search and EXA Webset tools are fully compatible with the existing Step 4 enrichment workflow. While enrichment itself is not new functionality, proper integration is critical for a seamless user experience.

**Independent Test**: Can be tested by creating a segment via Database Search or EXA Webset, verifying it appears in the segment list, and confirming that the existing Step 4 enrichment workflow accepts and processes the newly created segment without errors. Delivers value by ensuring end-to-end workflow continuity.

**Acceptance Scenarios**:

1. **Given** a segment has been created via Database Search, **When** the user proceeds to Step 4 (Enrichment), **Then** the segment is available for enrichment using the existing enrichment interface.
2. **Given** a segment has been created via EXA Webset, **When** the user proceeds to Step 4 (Enrichment), **Then** the segment is available for enrichment with all standard enrichment providers.
3. **Given** a newly created segment is enriched, **When** enrichment completes, **Then** the segment data is updated correctly and reflects enriched information in subsequent workflow steps.
4. **Given** a segment is created with specific filter definitions, **When** enrichment runs, **Then** only segment members matching the filters are enriched (no unintended scope expansion).

---

### User Story 4 - EXA Webset Tool Integration for Web-Based Segment Discovery (Priority: P1)

Users can click the "EXA Web Search" button to access the EXA Webset tool, provide a text description of their target segment (manually typed or generated by AI), retrieve matching companies/employees from the web, preview the results, and optionally save them as a new segment in the database.

**Why this priority**: EXA Webset enables expansion beyond the existing database by discovering new prospects from the web. This is critical for outbound prospecting and market expansion use cases, providing immediate value by uncovering previously unknown opportunities.

**Independent Test**: Can be fully tested by clicking "EXA Web Search", entering or generating a segment description, viewing EXA results with company/employee details, and optionally saving as a new segment. Delivers value by enabling web-scale prospect discovery.

**Acceptance Scenarios**:

1. **Given** a user is on the Segment tab, **When** they click the "EXA Web Search" button, **Then** an EXA search interface opens allowing text input for segment description.
2. **Given** the EXA search interface is open, **When** the user provides a segment description (or requests AI to generate one), **Then** the description is sent to the EXA Webset tool and results are fetched.
3. **Given** EXA Webset results are returned, **When** the user reviews the results, **Then** a list of matching companies and employees is displayed with key details (name, domain, location, role, confidence score).
4. **Given** EXA results are displayed, **When** the user decides to save the results, **Then** a new segment is created in the database containing the EXA-discovered companies and employees, and the user receives confirmation.
5. **Given** the user does not want to save EXA results, **When** they close the interface, **Then** the results are discarded and no segment is created.

---

### Edge Cases

- What happens when the AI chat is unavailable or fails to generate filter suggestions?
- How does the system handle filters that result in zero matches (empty segment)?
- How does the UI handle very large EXA result sets (1000+ companies)?
- What happens when a user tries to create a segment with duplicate filter definitions?
- How does the system handle API rate limits from EXA Webset API?
- What happens when a user navigates away while a segment builder or EXA search is in progress?
- What happens when filter parameters reference table columns that don't exist?
- How does the system handle segments created from AI suggestions when the underlying data changes?
- What happens when EXA Webset returns companies that already exist in the database?
- How does the UI handle partial failures when saving large EXA result sets to the database?
- What happens when a segment name conflicts with an existing segment name?

## Requirements *(mandatory)*

### Functional Requirements

#### Database Segment Builder

- **FR-001**: System MUST provide a "Search Database" button on the Segment tab that opens an interactive segment builder interface.
- **FR-002**: Segment builder MUST display all available filter parameters from the `companies` and `employees` tables.
- **FR-003**: System MUST allow users to define filter criteria using field, operator, and value selections (operators: eq, in, not_in, gte, lte).
- **FR-004**: System MUST display a real-time preview count showing how many companies and employees match the current filter set.
- **FR-005**: System MUST validate filter definitions before segment creation and display specific error messages for invalid filters.
- **FR-006**: System MUST allow users to create a segment from manually defined filters and save it to the database.
- **FR-007**: System MUST generate a unique segment ID and timestamp upon segment creation.

#### AI-Assisted Filter Suggestions

- **FR-008**: Segment builder MUST integrate with AI chat to accept natural language segment descriptions from users.
- **FR-009**: AI chat MUST generate up to 3 different filter configuration suggestions based on user input.
- **FR-010**: Each AI-suggested filter configuration MUST display a preview count of matching companies and employees.
- **FR-011**: Users MUST be able to select one or more AI-suggested filters (maximum 3) to apply to their segment.
- **FR-012**: System MUST combine multiple selected filters using AND boolean logic. (OR logic support deferred to future release.)
- **FR-013**: System MUST store attribution metadata when segments are created from AI suggestions (for analytics and prompt improvement).

#### Integration with Existing Enrichment (Step 4)

- **FR-014**: Segments created via Database Search MUST be compatible with the existing Step 4 enrichment workflow.
- **FR-015**: Segments created via EXA Webset MUST be compatible with the existing Step 4 enrichment workflow.
- **FR-016**: Segment schema (filter_definition, member tables) MUST conform to the format expected by existing enrichment services.
- **FR-017**: System MUST ensure newly created segments appear in the segment selection list for enrichment operations.

#### EXA Webset Integration

- **FR-018**: System MUST provide an "EXA Web Search" button on the Segment tab that opens an EXA Webset search interface.
- **FR-019**: EXA search interface MUST allow users to enter a text description of their target segment.
- **FR-020**: EXA search interface MUST allow users to request AI-generated segment descriptions.
- **FR-021**: System MUST send the segment description to the EXA Webset tool and retrieve matching companies and employees.
- **FR-022**: System MUST display EXA results with company and employee details including name, domain, location, role, and confidence score.
- **FR-023**: Users MUST be able to preview EXA results before deciding whether to save them.
- **FR-024**: System MUST provide a "Save as Segment" action that creates a new segment in the database from EXA results.
- **FR-025**: System MUST allow users to close the EXA interface without saving, discarding the results.
- **FR-026**: System MUST store EXA results (companies and employees) in the appropriate database tables when a segment is saved.

#### General UI/UX

- **FR-027**: System MUST display loading indicators during all asynchronous operations (filter preview, segment creation, EXA search).
- **FR-028**: System MUST display user-friendly error messages for all failure scenarios with actionable guidance.
- **FR-029**: System MUST prevent duplicate segment creation requests while an operation is in progress.
- **FR-030**: System MUST maintain existing button styling and hover effects for "Search Database" and "EXA Web Search" buttons.
- **FR-031**: System MUST support localization for all new UI text using the existing translation system.

### Key Entities

- **Segment**: Represents a filtered subset of companies/contacts with attributes like name, filter_definition, version, member_count, created_at. Can be created from database filters or EXA results. Must be compatible with existing enrichment workflow schema.
- **Filter Definition**: JSON structure defining filter criteria with field, operator, and value. Stored in segment.filter_definition column. Uses existing filter validation system format.
- **Company**: Database table with attributes like id, name, industry, size, location, domain. Referenced in filter creation. Source of filter parameters for segment builder.
- **Employee**: Database table with attributes like id, company_id, name, role, email, title. Referenced in filter creation. Source of filter parameters for segment builder.
- **AI Filter Suggestion**: Temporary object containing AI-generated filter configuration, preview count, and rationale. Not persisted unless user creates segment.
- **Filter Preview Result**: Temporary object showing count of matching companies and employees for current filter criteria. Used for real-time feedback in segment builder.
- **EXA Webset Result**: Companies and employees discovered via EXA Webset API with attributes like name, domain, location, role, confidence_score, source_url. Persisted to database tables when user saves segment.
- **ICP Profile**: Ideal Customer Profile that may be used to guide AI filter suggestions or EXA search descriptions (optional context, not required).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the segment builder interface in under 1 second from button click.
- **SC-002**: Filter preview counts are displayed within 2 seconds of filter modification for segments with fewer than 10,000 potential matches.
- **SC-003**: Users can create a segment from manual filters or AI suggestions with no more than 5 clicks.
- **SC-004**: AI filter suggestions are generated and displayed within 5 seconds of user description submission.
- **SC-005**: EXA Webset results are retrieved and displayed within 10 seconds of search submission.
- **SC-006**: 85% of users successfully create a segment using AI suggestions on their first attempt.
- **SC-007**: The segment builder provides clear, real-time feedback on filter validity and match counts without page refreshes or navigation.
- **SC-008**: Segments created via Database Search and EXA Webset are immediately available for selection in the existing Step 4 enrichment workflow.
- **SC-009**: Saving EXA Webset results to database completes within 5 seconds for result sets under 100 companies.

## Assumptions

1. **Table Schema Stability**: The `companies` and `employees` table schemas are stable and documented, with known column names, types, and constraints.
2. **Filter Validation**: The existing filter validation system from `src/filters/index.ts` can be reused or extended to validate user-defined and AI-generated filters.
3. **AI Chat Integration**: The existing AI chat mechanism or coach system can be adapted to generate filter suggestions with preview counts.
4. **Existing Enrichment Compatibility**: The existing Step 4 enrichment workflow (already implemented in the UI) accepts segments with standard schema and does not require modifications to integrate with newly created segments.
5. **EXA Webset API**: The EXA Webset tool has a stable API distinct from the existing ICP discovery endpoint, or the existing discovery endpoint can be parameterized to support Webset queries.
6. **Preview Count Performance**: Database queries for filter preview counts are performant enough to return results within 2 seconds for typical filter complexity.
7. **Localization Support**: The existing translation system supports dynamic key addition for new UI text without code redeployment.
8. **Segment Ownership**: Segments are owned by users or projects, with appropriate access control enforced at the API level.
9. **EXA Rate Limits**: The EXA Webset API has reasonable rate limits that allow typical discovery workflows (10-50 searches per day).
10. **Database Write Performance**: Saving EXA result sets (100-1000 companies) to the database can complete within 5-10 seconds without blocking the UI.

## Dependencies

1. **Existing Filter System**: `src/filters/index.ts` for filter validation and segment member resolution.
2. **Existing Segment Services**: `src/services/segments.ts` for segment CRUD operations.
3. **Existing AI Chat/Coach**: `src/services/coach.ts`, `src/services/aiClient.ts` for AI-assisted filter generation.
4. **Existing Enrichment Workflow**: Step 4 enrichment interface and backend services (already implemented) for post-creation segment enrichment.
5. **Database Schema**: `companies` and `employees` tables with known columns for filter parameter discovery and data storage.
6. **EXA Webset API**: EXA Webset API endpoint, authentication, and response schema for web-based company discovery.
7. **Web UI Components**: Existing button, input, modal, and loading components from `web/src/pages/PipelineWorkspaceWithSidebar.tsx`.
8. **API Client Functions**: `web/src/apiClient.ts` for HTTP requests to backend endpoints.
9. **Translation System**: `web/src/pages/PipelineWorkspaceWithSidebar.tsx` localization structure for new UI text.
10. **Segment List Refresh**: Mechanism for refreshing segment lists in the UI after new segment creation to ensure visibility in enrichment step.
