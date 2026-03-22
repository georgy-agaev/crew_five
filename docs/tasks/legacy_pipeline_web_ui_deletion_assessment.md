# Task: Legacy Pipeline Web UI Deletion Assessment

**Date:** 2026-03-22
**Status:** Completed
**Owner:** backend / product

## Question

Can the old bulky Pipeline Web UI now be removed from the codebase?

Short answer:

- not safely in full
- yes for selected campaign-era responsibilities
- removal should be phased, not one-shot

## What Counts As Legacy Pipeline

Primary legacy surface:

- [PipelineWorkspaceWithSidebar.tsx](/Users/georgyagaev/crew_five/web/src/pages/PipelineWorkspaceWithSidebar.tsx)

Supporting legacy modules:

- [legacyWorkspace/](/Users/georgyagaev/crew_five/web/src/pages/legacyWorkspace)
- [WorkflowZeroPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/WorkflowZeroPage.tsx)

Current entrypoints still wired in [App.tsx](/Users/georgyagaev/crew_five/web/src/App.tsx):

- `?view=pipeline`
- `?view=campaigns`
- `?view=icp-discovery`

## What Is Already Replaced

The following operator responsibilities are now covered by newer surfaces and no longer need the
legacy pipeline as their primary UI:

1. Campaign operator desk
   - replaced by [CampaignOperatorDesk.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOperatorDesk.tsx)
2. Campaign launch
   - replaced by launch drawer in Builder V2 / Campaigns
3. Send preflight / send policy / auto-send visibility
   - replaced by dedicated cards in Builder V2 / Campaigns
4. Next-wave flow
   - replaced by `CampaignNextWaveDrawer`
5. Rotation preview
   - replaced by `CampaignRotationPreviewDrawer`
6. Campaign review / campaign context
   - largely replaced by `BuilderWorkspacePage` + `CampaignOperatorDesk`
7. Inbox
   - new Inbox V2 exists
8. Import / enrichment / contacts / mailboxes
   - new workspace surfaces exist

## What Still Appears To Be Legacy-Only Or Legacy-Critical

These are the main reasons the full legacy pipeline should not yet be deleted:

1. Prompt registry surface
   - legacy pipeline still contains prompt-registry navigation and page wiring
2. ICP / hypothesis / segment orchestration glue
   - old pipeline still acts as a single step-router across:
     - ICP selection/quick create
     - hypothesis selection/quick create
     - segment selection / builder handoff
3. Legacy draft-generation control path
   - `LegacyPipelineStepRouter` still wires `onGenerateDrafts`
   - old draft-generation UI concepts still exist in:
     - `LegacyDraftStep`
     - `WorkflowZeroPage`
4. Some discovery / search entry flows
   - old pipeline still wires:
     - database search openers
     - EXA search openers
     - AI chat modal
5. Analytics / prompt / inbox legacy shell compatibility
   - new surfaces exist, but the legacy workspace still provides one bundled shell around them

## Current Decision

### Do not remove the whole legacy pipeline today

That would be premature because parity is not yet proven for:

- prompt registry usage
- ICP/hypothesis/segment step orchestration
- draft-generation operator flow
- legacy discovery/search glue

### Safe partial conclusion

The old pipeline is no longer the canonical UI for campaign-wave operations.

So the stage-closeout position should be:

- keep legacy pipeline code for remaining upstream/discovery/draft-generation responsibilities
- treat campaign-wave execution as migrated to new surfaces
- avoid adding new campaign features to the legacy pipeline

## Practical Options

### Option 1. Keep everything for now

Safest, but leaves more dead-weight in the repo and risks duplicated behavior.

### Option 2. Freeze legacy pipeline and remove only campaign-era reliance

Recommended.

Meaning:

- keep legacy route available
- stop treating it as canonical for campaign launch / next-wave / rotation / operator review
- do not add new campaign features there
- plan targeted deletion after parity audit of prompt/discovery/draft-generation flows

### Option 3. Full removal now

Not recommended.

Too likely to delete still-live upstream workflow glue that has not been explicitly replaced.

## Recommended Next Step Before Deletion

Run one explicit parity audit for the following legacy-only capabilities:

1. prompt registry management
2. ICP quick-create / hypothesis quick-create operator path
3. segment builder / discovery opener path
4. draft-generation controls

If these four are either:

- replaced elsewhere, or
- intentionally dropped,

then the legacy pipeline can move to phased deletion.

## Final Recommendation

Today:

- do **not** remove the whole legacy pipeline
- do treat it as legacy/frozen
- do plan a targeted deletion pass after an explicit parity checklist for prompt/discovery/draft-generation glue
