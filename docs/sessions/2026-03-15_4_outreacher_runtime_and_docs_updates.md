# 2026-03-15 Session 4 - Outreacher Runtime And Docs Updates

> Version: v0.1 (2026-03-15)

## Context

After agreeing on the `Outreacher` integration direction in the planning documents:

- `2026-03-15_1_offering_domain_and_provenance.md`
- `2026-03-15_2_outreacher_tasks_review_and_options.md`
- `2026-03-15_3_outreacher_improvements_execution_plan.md`

the next step was to execute the remaining runtime and documentation tasks end-to-end and verify them.

## Completed

### 1. Snapshot company payload parity

Implemented the minimal `snapshot.company` contract needed by `Outreacher`.

Changes:

- `src/filters/index.ts`
  - expanded company selection in `buildContactQuery()` to include:
    - `company_description`
    - `website`
    - `employee_count`
    - `region`
    - `office_qualification`
    - `company_research`
- `src/services/segmentSnapshot.ts`
  - added a small normalizer so snapshot rows persist a stable minimal company shape
- tests updated:
  - `tests/segmentSnapshot.test.ts`
  - `tests/fetchContacts.test.ts`

Result:

- `snapshot.company` no longer depends on the old/non-existent `business_description`
- `company_research` remains available in the snapshot

### 2. Enrichment preview and refresh policy

Extended `enrich:run` so `Outreacher` can use it as both preview and execution entry point.

Changes:

- `src/services/enrichSegment.ts`
  - added `planSegmentEnrichment()`
  - added freshness classification using one shared timestamp per entity store (`lastUpdatedAt`)
  - freshness threshold defaults to `90` days
  - `--limit` is interpreted as a company-level limit
  - provider combinations are treated as a union
  - enqueue payload now carries selected providers and planned target ids
  - runtime execution can apply multiple providers sequentially and merge results into the shared enrichment store
- `src/commands/enrich.ts`
  - `--dry-run` now returns preview payload instead of a fake execution summary
  - added `--max-age-days`
  - added `--force-refresh`
  - provider combinations now work through comma-separated `--provider`
- `src/cli.ts`
  - surfaced the new CLI flags for `enrich:run`
- tests updated:
  - `tests/enrichment.test.ts`
  - `tests/cli.test.ts`

Result:

- `Outreacher` can preview enrichment without writes
- stale data is refresh-eligible by policy
- manual refresh is possible regardless of age
- provider combinations can be selected per run

### 3. Campaign list by ICP

Added `campaign:list --icp-profile-id`.

Changes:

- `src/services/campaigns.ts`
  - implemented a two-step lookup:
    - resolve segment ids by `segments.icp_profile_id`
    - filter campaigns by those `segment_id`s
- `src/commands/campaignList.ts`
  - added the new option to the command handler
- `src/cli.ts`
  - exposed `--icp-profile-id`
- tests updated:
  - `tests/campaignList.test.ts`
  - `tests/cli.test.ts`

Result:

- `Outreacher` can now find campaigns by ICP directly through the CLI instead of filtering client-side

### 4. Docs and runner refresh

Updated the public integration docs and example runners to match the final runtime behavior.

Changes:

- `docs/Outreach_crew_five_cli_contract.md`
  - added enrichment section
  - documented preview payload
  - documented provider combinations
  - documented `campaign:list --icp-profile-id`
  - documented minimal snapshot company contract
- `docs/Outreacher_operating_model.md`
  - added enrichment as an explicit step:
    - `ICP -> Hypothesis -> Segment -> Enrich -> Campaign -> Drafts -> Send -> Events`
  - added `imap_mcp` account/SMTP config note
- `docs/Outreach_agent_runner_examples.md`
  - added enrichment loop and preview examples
  - added `list_campaigns_by_icp()` / `enrich_segment()` to the recommended runner surface
- example runners updated:
  - `examples/outreach-crew-five-runner.ts`
  - `examples/outreach_crew_five_runner.py`
- `README.md`
  - updated CLI usage examples for enrichment and campaign filtering

### 5. Verification

Completed verification:

- `pnpm test`
- `pnpm build`
- `python -m py_compile examples/outreach_crew_five_runner.py`

Result:

- full repository test suite passed
- TypeScript build passed
- Python example runner syntax check passed

## To Do

- None for the agreed task set from this session cluster
- Future follow-up only if `Outreacher` wants:
  - provider-specific cost estimation
  - full `offering_snapshots` table
  - richer mailbox configuration automation inside `imap_mcp`
