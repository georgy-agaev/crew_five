# 2026-03-15 Session 2 - Outreacher Task Review And Options

> Version: v0.1 (2026-03-15)

## Goal

Review the current `docs/tasks/*` requests coming from `Outreacher`, compare them to the current
`crew_five` state, and preserve a concrete implementation plan for each task before discussion.

## Task Inventory

1. `docs/tasks/add_offering_domain_to_icp_profiles.md`
2. `docs/tasks/expose_enrichment_for_outreach.md`
3. `docs/tasks/fix_hypothesis_list_and_minor_cli.md`
4. `docs/tasks/fix_snapshot_company_description.md`
5. `docs/tasks/update_claude_md_and_contract.md`

## Current Status Snapshot

### Already completed

`add_offering_domain_to_icp_profiles.md`

- Repository migration exists and was applied live:
  - `supabase/migrations/20260315093000_add_icp_profile_offering_domain.sql`
- Shared Supabase verified:
  - `4` ICP rows
  - all `4` backfilled to `voicexpert.ru`
  - no `NULL` values remain
- CLI support is present:
  - `icp:create --offering-domain`
  - `icp:coach:profile --offering-domain`
  - `icp:list` now default-includes `offering_domain`
- Balanced provenance is implemented:
  - `drafts.metadata.offering_domain`
  - `drafts.metadata.offering_hash`
  - `drafts.metadata.offering_summary`
  - inherited into `email_outbound.metadata`

### Partially completed / needs follow-up

`fix_hypothesis_list_and_minor_cli.md`

- `icp:hypothesis:list` is already fixed and wrapped.
- `email:record-outbound` already has unit coverage and working behavior.
- `event:ingest` already has unit coverage and outbound-context enrichment.
- `campaign:list --icp-profile-id` is still missing.
- `imap_add_account` SMTP port issue is external to `crew_five`; documentation only.

`fix_snapshot_company_description.md`

- `snapshot.company.company_research` is already preserved in `createSegmentSnapshot`.
- But upstream contact fetch still selects only a narrow company shape in `src/filters/index.ts`:
  - `id`
  - `company_name`
  - `segment`
  - `company_research`
- `company_description`, `website`, `employee_count`, region-like fields are not yet selected there.

`expose_enrichment_for_outreach.md`

- `enrich:run` exists and supports:
  - provider selection
  - `--run-now`
  - `--dry-run`
  - JSON errors
- Contract/docs are only partially updated.
- Current response shape is `{ status, jobId, summary, mode }`, not the flatter shape proposed in the task.
- No dedicated enrichment preview contract exists yet.

`update_claude_md_and_contract.md`

- `offering_domain` + live migration status are already reflected in contract/changelog.
- Enrichment docs/runner/operating-model updates are still incomplete.

## Detailed Analysis And Options

### 1. `add_offering_domain_to_icp_profiles.md`

Status: Completed

Implementation notes:

- Keep as reference task only.
- No new work is required unless we later move from the balanced provenance model to a dedicated
  `offering_snapshots` table.

Options:

1. Leave as completed and archive mentally.
2. Mark the task doc explicitly as completed in a future pass.
3. Split future replay/audit upgrades into a separate task.

Recommendation:

- Option 3. Keep this task closed and create a new one later if full snapshot storage becomes necessary.

### 2. `expose_enrichment_for_outreach.md`

Status: Partially done

Observed current state:

- CLI exists in `src/commands/enrich.ts`
- async execution path is backed by `src/services/enrichSegment.ts`
- `runNow` returns nested summary:
  - `status`
  - `jobId`
  - `summary.processed`
  - `summary.skipped`
  - `summary.failed`
- no dedicated preview endpoint/command for already-enriched counts or cost estimation

Options:

1. Documentation-only alignment
- Keep runtime behavior as-is.
- Update contract/docs so `Outreacher` uses the current nested response shape.
- Cheapest path, but no enrichment preview UX improvement.

2. Practical CLI improvement
- Keep `enrich:run` behavior.
- Add an enrichment preview/read-only command or extend `--dry-run` to return:
  - total companies in snapshot
  - already enriched companies
  - missing enrichment count
  - optional estimated cost
- Update contract and runner examples.

3. Full enrichment orchestration surface
- Add preview
- add status polling / job-summary command
- define normalized output contract for `Outreacher`
- document `company_research -> company_confirmed_facts` mapping expectations

Recommendation:

- Option 2 now.

Why:

- It gives `Outreacher` the preflight it explicitly wants without redesigning the enrichment job model.
- It can be implemented without changing the existing async job semantics.

Suggested implementation path:

1. Verify end-to-end `enrich:run --run-now` against a safe provider / small segment.
2. Add either:
   - `enrich:preview --segment-id <id> --provider <provider>`
   - or enhance `enrich:run --dry-run` to return richer preview counts.
3. Update:
   - `docs/Outreach_crew_five_cli_contract.md`
   - `docs/Outreacher_operating_model.md`
   - `docs/Outreach_agent_runner_examples.md`
4. Decide whether `company_confirmed_facts` should be derived by `Outreach` directly from
   `company_research.providers.<provider>` or through a normalization helper later.

Discussion questions:

- Do we want preview as a separate command or as richer `--dry-run` output?
- Does `Outreacher` need company-level only preview, or company + employee enrichment counts?
- Is estimated cost static per provider or fetched dynamically?

### 3. `fix_hypothesis_list_and_minor_cli.md`

Status: Mixed

Observed current state:

- `icp:hypothesis:list` issue is already closed.
- `campaign:list` currently only filters by `status` and `segmentId` in `src/services/campaigns.ts`.
- `email:record-outbound` has service + CLI tests and updates `drafts.status='sent'`.
- `event:ingest` accepts arbitrary `event_type`, dedupes, and enriches with outbound/draft/campaign/segment context.
- SMTP port / `imap_add_account` is not a `crew_five` responsibility.

Options for `campaign:list --icp-profile-id`:

1. Filter via `campaigns.metadata.icp_profile_id`
- Fast if metadata is always present.
- Weak contract because older rows may not have it.

2. Two-step lookup through `segments`
- Query segments by `icp_profile_id`
- filter campaigns by `segment_id in (...)`
- Clear and robust against older campaigns.

3. Join-based query in one shot
- Use Supabase relation select/join to segments.
- Compact, but more brittle in tests and relation naming.

Recommendation:

- Option 2 now.

Why:

- It is explicit, testable, and does not depend on historical campaign metadata hygiene.

Suggested implementation path:

1. Extend CLI:
   - `campaign:list --icp-profile-id <id>`
2. In service:
   - load segment ids with `icp_profile_id=<id>`
   - apply `.in('segment_id', ids)` to campaigns query
3. Add tests for:
   - filter hit
   - zero matching segments
   - coexistence with `--status`

Options for outbound/event verification:

1. Rely on existing unit tests only
2. Add a lightweight CLI smoke test with mocked client
3. Add a live smoke path against shared Supabase test rows

Recommendation:

- Option 2.

Why:

- It keeps verification closer to the CLI surface `Outreacher` actually uses, without needing live test data.

SMTP-port documentation options:

1. Note it only in `Outreacher` operating model
2. Add a dedicated `imap_mcp` integration appendix
3. Ignore in `crew_five`

Recommendation:

- Option 1.

### 4. `fix_snapshot_company_description.md`

Status: Partially done

Observed current state:

- `src/services/segmentSnapshot.ts` preserves whatever company object is already attached to the contact row.
- The real gap is earlier in `src/filters/index.ts`, where `buildContactQuery()` currently selects only:
  - `id`
  - `company_name`
  - `segment`
  - `company_research`
- So snapshot consistency is blocked by query shape, not by snapshot insertion logic.

Options:

1. Minimal snapshot parity fix
- Extend company selection to include:
  - `company_description`
  - `website`
  - `employee_count`
  - any existing region / office-size fields used by `Outreach`
- Keep `company_research` as-is.

2. Strong snapshot contract
- Define an explicit `CompanySnapshotShape`
- normalize field names centrally before insert
- update tests to enforce exact snapshot schema

3. Rich snapshot contract
- Option 2 plus controlled normalization of `company_research` into a prompt-ready sub-shape

Recommendation:

- Option 2 now.

Why:

- It fixes the immediate missing fields and creates a stable snapshot schema that `Outreacher` can depend on.

Suggested implementation path:

1. Confirm the canonical company columns in the DB:
   - `company_description`
   - `website`
   - `employee_count`
   - region / office qualification naming
2. Extend `buildContactQuery()` to select the needed fields.
3. Add a `normalizeCompanySnapshot()` helper in the snapshot path.
4. Update tests to assert the exact shape of `snapshot.company`.

Discussion questions:

- Which exact company fields are required by `Outreacher` today, versus merely nice to have?
- Should `company_research` go into every snapshot by default, or only when not too large?

### 5. `update_claude_md_and_contract.md`

Status: Partially done

Observed current state:

- Contract already includes:
  - offering-domain integration
  - live migration status
  - IMAP send loop
- Missing/partial items:
  - explicit enrichment section in the contract
  - enrichment as required step in operating model
  - `imap_mcp` config guidance
  - runner examples for enrichment

Options:

1. Docs-only cleanup pass
- Update the three docs and changelog with no runtime changes.

2. Bundle with enrichment task
- Implement/review enrichment preview + contract first
- then update docs once the runtime surface is stable

3. Defer until all runtime tasks are finished
- Lowest churn
- But docs stay behind reality longer

Recommendation:

- Option 2.

Why:

- The contract should describe the runtime we actually choose for enrichment, not a moving target.

Suggested implementation path:

1. Finish the enrichment decision first.
2. Then update:
   - `docs/Outreach_crew_five_cli_contract.md`
   - `docs/Outreacher_operating_model.md`
   - `docs/Outreach_agent_runner_examples.md`
   - `CHANGELOG.md`

## Recommended Execution Order

1. `fix_snapshot_company_description.md`
- unblocks better prompt context and snapshot consistency

2. `expose_enrichment_for_outreach.md`
- turns enrichment into an explicit, reviewable step in the `Outreacher` flow

3. `fix_hypothesis_list_and_minor_cli.md`
- mostly small surface improvements and CLI verification

4. `update_claude_md_and_contract.md`
- docs pass after runtime behavior is settled

`add_offering_domain_to_icp_profiles.md` is already done.

## Completed

- Audited all current `docs/tasks/*` files
- Mapped each task to the current implementation state in `crew_five`
- Proposed 3 options per open task
- Preserved recommended paths and execution order in this session document

## To Do

- Discuss and confirm the recommended order with the user
- Convert selected recommendations into implementation tasks one by one
