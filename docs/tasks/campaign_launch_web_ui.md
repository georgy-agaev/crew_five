# Campaign Launch: Web UI Task For Claude

**Status:** Done
**Created:** 2026-03-20
**Context:** canonical backend launch is now ready in `crew_five`:

- `POST /api/campaigns/launch-preview`
- `POST /api/campaigns/launch`

The UI should use these canonical surfaces instead of reconstructing launch logic client-side.

---

## Goal

Add a compact, operator-friendly launch flow to the existing Web surfaces so a user can:

- select or confirm campaign launch parameters
- preview the launch before mutation
- see launch warnings and counts
- perform the canonical launch mutation

Do **not** redesign the whole workspace as part of this task.

## Runtime clarification

Current factual runtime:

- `interactionMode` is not used by `Outreach`
- `dataQualityMode` is not used by `Outreach`
- `coach` is not a real operator/runtime path today

So these fields should not be treated as operator-facing controls in the current launch UI. Backend
legacy/default persistence may still exist, but the launch form should not ask the operator to make
choices that do nothing.

---

## Backend Contract To Use

### Preview

`POST /api/campaigns/launch-preview`

Request body:

```json
{
  "name": "Q2 Negotiation Rooms",
  "segmentId": "seg-uuid",
  "segmentVersion": 1,
  "snapshotMode": "reuse",
  "senderPlan": {
    "assignments": [
      {
        "mailboxAccountId": "mbox-1",
        "senderIdentity": "sales@voicexpert.ru",
        "provider": "imap_mcp"
      }
    ]
  }
}
```

Important response fields:

- `campaign`
- `segment.snapshotStatus`
- `summary.companyCount`
- `summary.contactCount`
- `summary.sendableContactCount`
- `summary.freshCompanyCount`
- `summary.staleCompanyCount`
- `summary.missingCompanyCount`
- `summary.senderAssignmentCount`
- `senderPlan.domains`
- `warnings[]`

Current warning codes:

- `snapshot_missing_refresh_required`
- `missing_sender_plan`
- `company_enrichment_incomplete`

### Launch mutation

`POST /api/campaigns/launch`

Request body matches preview, plus optional `createdBy`.

Important response fields:

- `campaign`
- `segment.snapshot`
- `senderPlan.assignments`
- `senderPlan.summary`

---

## UI Scope

Use the existing operator shell.

Recommended entry points:

1. `Builder V2`
2. `Campaigns`

Both can open the same launch flow.

Recommended shape:

- a modal or drawer
- one reusable launch form component
- one reusable launch preview block

Do not create a separate top-level page just for launch.

---

## Required Flow

### Step 1 - Input

Collect:

- `name`
- `segmentId`
- optional `segmentVersion`
- `snapshotMode`
- optional `senderPlan.assignments`

### Step 2 - Preview

Call `POST /api/campaigns/launch-preview`.

Show:

- campaign name
- snapshot status
- companies / contacts / sendable contacts
- enrichment summary
- sender domains
- warnings

### Step 3 - Launch

If operator confirms, call `POST /api/campaigns/launch`.

On success:

- show created campaign id/name
- show saved sender plan summary
- offer navigation into `Campaigns`

---

## Required UI States

### Input

- editable form
- disabled submit until minimum required fields exist

### Preview loading

- lightweight skeleton / loading card

### Preview success

- counters first
- warnings visible but secondary to totals
- sender plan visible

### Preview blocked-ish / warning state

- no hard blocker model yet
- warnings must still be clearly visible

### Launch pending

- disable confirm button
- show short progress text

### Launch success

- success confirmation
- campaign id
- next-step CTA into operator surface

### Launch error

- render backend error message directly

---

## UX Rules

1. Do not duplicate backend logic in the client.
2. Use `launch-preview` before `launch`.
3. Reuse existing workspace colors, typography, cards, pills, and spacing.
4. Do not introduce a separate visual language for this flow.
5. Do not build mailbox inventory management here.
6. Do not mix send-preflight into the same component.
7. Do not show `interactionMode` / `dataQualityMode` as editable operator controls.

---

## Suggested Component Shape

Reusable pieces:

- `CampaignLaunchDialog` or `CampaignLaunchDrawer`
- `CampaignLaunchForm`
- `CampaignLaunchPreviewCard`

Suggested responsibilities:

- form owns input state
- preview card renders canonical preview response
- parent owns preview/load/launch orchestration

---

## Nice-To-Have But Not Required

- prefill from selected segment in Builder V2
- prefill sender plan if already known
- deep-link to the created campaign

These should not block the first version.

---

## Acceptance Criteria

1. Operator can launch a campaign without manually stitching together raw backend calls.
2. UI uses `POST /api/campaigns/launch-preview` before launch.
3. UI uses `POST /api/campaigns/launch` for mutation.
4. No duplicate client-side launch semantics are introduced.
5. The flow fits into the existing workspace shell and theme.
