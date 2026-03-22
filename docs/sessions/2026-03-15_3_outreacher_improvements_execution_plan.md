# 2026-03-15 Session 3 - Outreacher Improvements Execution Plan

> Version: v0.1 (2026-03-15)

## Goal

Prepare a concrete execution plan for the next agreed `Outreacher`-driven improvements in `crew_five`.

Agreed decisions:

- use the existing `enrich:run` command rather than introducing a new enrichment command
- improve `enrich:run --dry-run` so it becomes a real preview for `Outreacher`
- fix snapshot company payload with a minimal required field set rather than a broad normalized schema
- add `campaign:list --icp-profile-id`
- update docs only after the runtime surface is finalized

## Scope

This plan covers four implementation tracks:

1. Snapshot company payload parity
2. Enrichment preview via `enrich:run --dry-run`
3. `campaign:list --icp-profile-id`
4. Documentation and runner updates

## Execution Order

### Phase 1 - Snapshot company payload parity

Reason:

- This is the lowest-risk runtime change.
- It improves prompt context immediately.
- It reduces drift between `Outreach` assumptions and `crew_five` snapshots.

### Phase 2 - Enrichment preview via `enrich:run --dry-run`

Reason:

- `Outreacher` wants operator preview before enrichment.
- Existing `enrich:run` should remain the execution entry point.
- This defines the contract that later docs must describe.

### Phase 3 - `campaign:list --icp-profile-id`

Reason:

- Small CLI convenience improvement.
- Dependent on no schema changes.
- Easy to add once the bigger workflow changes are stable.

### Phase 4 - Docs and examples refresh

Reason:

- Should describe the final chosen runtime behavior, not an intermediate state.

## Phase 1 - Snapshot Company Payload Parity

### Current state

`src/services/segmentSnapshot.ts` already persists whatever company object it receives.

The real gap is upstream in `src/filters/index.ts`:

- `buildContactQuery()` currently selects only:
  - `id`
  - `company_name`
  - `segment`
  - `company_research`

So `snapshot.company` is currently missing some fields `Outreacher` expects.

### Agreed target

Minimal required `snapshot.company` shape:

```json
{
  "id": "company-uuid",
  "company_name": "Acme",
  "company_description": "Description from source DB",
  "website": "acme.com",
  "employee_count": 120,
  "company_research": {}
}
```

Optional fields only if they already exist cleanly in the DB and are immediately useful:

- `region`
- `office_qualification`

### Implementation options

1. Minimal select expansion
- Extend `buildContactQuery()` to include the required company fields.
- No additional normalization helper.

2. Minimal select expansion plus small normalizer
- Extend the query.
- Add a helper that ensures the snapshot writes the agreed minimal keys with stable names.

3. Full schema normalization
- Define a dedicated typed snapshot shape and normalize aggressively.

### Recommended path

Option 2.

Why:

- Still minimal.
- Gives `Outreacher` a stable contract.
- Avoids silently depending on raw Supabase relation output shape.

### Files expected to change

- `src/filters/index.ts`
- `src/services/segmentSnapshot.ts`
- `tests/segmentSnapshot.test.ts`
- possibly `tests/segmentSnapshotWorkflow.test.ts`
- possibly `docs/Outreacher_operating_model.md` later in Phase 4

### Concrete implementation steps

1. Confirm canonical company columns in the current DB-facing code.
2. Expand `buildContactQuery()` to select:
   - `company_description`
   - `website`
   - `employee_count`
   - keep `company_research`
3. Add a small helper in snapshot creation:
   - preserve only the agreed fields
   - avoid introducing `business_description`
4. Verify `snapshot.company.company_description` is present in inserted rows.
5. Verify `snapshot.company.company_research` still survives unchanged.

### Acceptance criteria

- `snapshot.company.company_description` exists when source company row has it.
- `snapshot.company.company_research` still exists.
- No code path writes `business_description`.
- Existing snapshot tests stay green.

### Test plan

- extend unit test for `createSegmentSnapshot`
- add/adjust workflow test if query shape is asserted there

## Phase 2 - Enrichment Preview Via `enrich:run --dry-run`

### Current state

`enrich:run` already exists and supports:

- `--provider`
- `--run-now`
- `--dry-run`
- async job enqueueing
- live execution via `runSegmentEnrichmentOnce`

But current `--dry-run` is not a true operator preview. It does not clearly answer:

- how many companies are in scope
- how many already have `company_research`
- how many still need enrichment
- what the capped processing set will be under `--limit`
- what estimated cost might be

### Agreed target

Keep `enrich:run` as the single entry point.

Upgrade `--dry-run` so it returns a preview payload suitable for `Outreacher`.

Additional rules agreed during discussion:

- enrichment freshness is time-bound, not binary
- company or employee enrichment older than 3 months is eligible for refresh
- `Outreacher` must be able to request refresh regardless of age
- `Outreacher` must be able to choose the provider and, where supported by the current enrichment store,
  provider combinations
- `enrich:run --limit N` should be interpreted as a limit on companies, not on segment members
- employee counts remain informational / secondary in preview output
- freshness should be tracked with one shared timestamp per entity, not a separate timestamp per provider

### Preview payload target

Recommended shape:

```json
{
  "status": "preview",
  "mode": "async_run_now",
  "provider": "firecrawl",
  "segmentId": "seg-uuid",
  "segmentVersion": 3,
  "dryRun": true,
  "refreshPolicy": {
    "maxAgeDays": 90,
    "forceRefresh": false
  },
  "counts": {
    "companiesTotal": 42,
    "companiesFresh": 18,
    "companiesStale": 9,
    "companiesMissing": 15,
    "companiesEligibleForRefresh": 24,
    "contactsTotal": 55,
    "contactsFresh": 11,
    "contactsStale": 8,
    "contactsMissing": 36,
    "contactsEligibleForRefresh": 44,
    "plannedCompanyCount": 10,
    "plannedContactCount": 10
  },
  "estimate": {
    "costModel": "static|none",
    "estimatedCredits": null,
    "estimatedUsd": null
  }
}
```

If cost cannot be calculated safely, return explicit `null` values instead of fake estimates.

### Implementation options

1. Minimal preview only
- Return counts only.
- No cost estimate.

2. Counts plus optional estimate
- Return counts always.
- include `estimate` block with `null` defaults unless provider config supports estimates.

3. Full preview plus last-job summary / diffs
- Also compare against latest enrichment job for the segment.

### Recommended path

Option 2.

Why:

- Gives `Outreacher` a stable shape now.
- Leaves room for provider-specific estimates later without changing the contract again.

### Files expected to change

- `src/commands/enrich.ts`
- `src/services/enrichSegment.ts`
- possibly `src/services/segments.ts`
- `tests/cli.test.ts`
- maybe a new focused enrichment preview test file
- docs in Phase 4

### Concrete implementation steps

1. Add helper that loads finalized segment snapshot membership.
2. Count:
   - unique companies in scope
   - unique contacts in scope
   - company rows with fresh enrichment
   - company rows with stale enrichment
   - company rows with missing enrichment
   - employee rows with fresh enrichment
   - employee rows with stale enrichment
   - employee rows with missing enrichment
3. Respect `--limit` when computing planned counts.
   - interpret `limit` as planned company count
   - employee planned counts are derived/informational only
4. Add refresh-policy inputs:
   - default `maxAgeDays=90`
   - optional force-refresh mode that treats all rows as eligible regardless of age
5. Keep provider selection explicit:
   - continue supporting `--provider`
   - preserve compatibility with the existing provider/adapter routing
6. Use one freshness timestamp per entity for preview eligibility checks.
   - do not model provider-specific freshness windows in this phase
4. When `--dry-run` is set:
   - do not enqueue a job
   - do not write enrichment results
   - return preview payload
5. Keep existing non-dry-run behavior unchanged.

### Acceptance criteria

- `enrich:run --dry-run` performs no writes.
- Output clearly reports total/fresh/stale/missing/eligible counts.
- Rows older than 90 days are treated as refresh-eligible by default.
- `Outreacher` can explicitly force refresh regardless of age.
- `--limit` is operator-facing company limit, not segment-member limit.
- Existing `--run-now` and async enqueue paths remain intact.
- Unknown provider handling remains unchanged.

### Test plan

- add unit/CLI test for `--dry-run` preview payload
- keep existing enrich command tests green
- optionally add provider-agnostic preview test with partial research data

### Remaining discussion items

- For provider combinations, do we treat eligibility per primary provider, per requested provider, or as a union of providers?

## Phase 3 - `campaign:list --icp-profile-id`

### Current state

`campaign:list` currently filters by:

- `status`
- `segmentId`

There is no ICP-based filter.

### Agreed target

Support:

```bash
pnpm cli campaign:list --icp-profile-id <icpProfileId> --error-format json
```

### Implementation options

1. Filter via `campaigns.metadata.icp_profile_id`
- fast but relies on metadata hygiene

2. Two-step filter through `segments`
- fetch segment ids where `segments.icp_profile_id = <id>`
- filter campaigns by those segment ids

3. Relation join filter
- one query, more compact, more brittle

### Recommended path

Option 2.

Why:

- Works against the canonical segment linkage.
- Does not rely on historical campaign metadata being complete.
- Easy to test.

### Files expected to change

- `src/cli.ts`
- `src/commands/campaignList.ts`
- `src/services/campaigns.ts`
- `tests/cli.test.ts`
- `tests/campaignList.test.ts`

### Concrete implementation steps

1. Extend CLI options with `--icp-profile-id`.
2. In service:
   - if filter is present, load matching segment ids
   - if none found, return `[]`
   - otherwise apply `.in('segment_id', ids)` to the campaigns query
3. Keep `status` + `segmentId` filters composable.

### Acceptance criteria

- campaigns linked to segments with the requested `icp_profile_id` are returned
- empty set is returned cleanly if no segments match
- existing filters continue to work

### Test plan

- add service/unit test for icp-profile filter
- add CLI wiring test

## Phase 4 - Docs And Examples Refresh

### Current state

Docs are ahead in some areas and behind in others.

Already documented:

- IMAP send loop
- offering-domain provenance
- `email:record-outbound`

Still incomplete for the new agreed runtime:

- enrichment as explicit pre-draft step
- `enrich:run --dry-run` preview contract
- minimal snapshot company expectations
- `imap_mcp` config footnote about manual SMTP config in `accounts.json`
- runner examples for enrichment

### Implementation options

1. Docs-only sync after runtime work
- recommended

2. Update docs incrementally during implementation
- acceptable but risks drift mid-session

3. Defer docs until all `Outreacher` runtime work is finished
- lowest immediate effort, highest short-term confusion

### Recommended path

Option 1.

### Files expected to change

- `docs/Outreach_crew_five_cli_contract.md`
- `docs/Outreacher_operating_model.md`
- `docs/Outreach_agent_runner_examples.md`
- `README.md`
- `CHANGELOG.md`

### Concrete implementation steps

1. Add enrichment section to the contract with final preview payload.
2. Update operating model workflow:
   - `ICP -> Hypothesis -> Segment -> Enrich -> Campaign -> Drafts`
3. Add note:
   - `imap_add_account` currently requires manual SMTP completion in `accounts.json`
4. Add runner examples:
   - `enrich_segment()`
   - preview call
   - live call

### Acceptance criteria

- docs match actual CLI/runtime behavior
- `Outreacher` can implement enrichment and campaign filtering directly from docs/examples

## Delivery Strategy

### Option A - One focused session per phase

Pros:

- Clean checkpoints
- easier review

Cons:

- more session overhead

### Option B - Runtime batch, then docs batch

Pros:

- fastest overall
- minimizes doc churn

Cons:

- bigger change set

### Option C - Interleave code and docs

Pros:

- docs stay current during implementation

Cons:

- more likely to document unstable behavior

### Recommended delivery strategy

Option B:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4

## Risks

### Snapshot risk

- Querying too many company fields may accidentally enlarge snapshot payloads more than needed.

Mitigation:

- keep the agreed minimal set only

### Enrichment-preview risk

- provider-specific cost estimation may be speculative

Mitigation:

- return explicit `null` estimate values unless a trustworthy estimate exists

### Campaign filter risk

- segment lookup could add an extra query

Mitigation:

- acceptable for CLI orchestration scale

### Docs risk

- docs can easily drift from implementation if updated too early

Mitigation:

- update only after runtime behavior is locked

## Recommended Next Implementation Step

Start with Phase 1:

- fix minimal snapshot company payload parity

Then continue to Phase 2:

- enrich preview via `enrich:run --dry-run`

## Completed

- Captured the agreed execution sequence
- Defined concrete target behavior for all remaining runtime tasks
- Listed implementation files, acceptance criteria, and test strategy per phase

## To Do

- Discuss this plan with the user
- Start implementation with Phase 1 once approved
