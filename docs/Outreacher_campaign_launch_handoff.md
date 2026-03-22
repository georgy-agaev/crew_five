# Outreacher Campaign Launch Handoff

> Version: v0.4 (2026-03-22)

## Goal

Align `/launch-campaign` in `Outreacher` with the shared `crew_five` campaign spine so campaign
creation, sender planning, and later generation/send flows do not drift apart.

## What Exists Today

The current `Outreacher` skill already has a sensible wizard order:

1. ICP
2. Hypothesis
3. Segment
4. Campaign
5. Next step

It correctly uses `crew_five` CLI for DB mutations and keeps the dialog/orchestration in
`Outreacher`.

## Current Gap

The skill currently asks the user for a sender during campaign creation, but the actual mutation
path only calls:

```bash
pnpm cli campaign:create ...
```

That means:

- the campaign row is created
- but the planned sender set is **not** persisted into `crew_five`
- the user may believe the sender is attached, while the shared spine does not know about it

This is especially risky now that `campaign:status --status sending` is guarded by
`MAILBOX_ASSIGNMENT_REQUIRED`.

## Recommended Boundary

### `Outreacher` owns

- the conversational wizard
- suggested campaign names
- recommended sender choice
- deciding whether to create a new campaign or reuse an existing one
- deciding what the next step should be after launch

### `crew_five` owns

- canonical campaign creation
- canonical campaign sender-plan persistence
- status transition validation
- the shared read models used later by Web UI, analytics, and outbound flows
- backend defaults / legacy persistence for execution flags that are not operator-facing today

## Recommended Model

### Short term

Keep `/launch-campaign` in `Outreacher`, but make it a thin orchestrator over canonical
`crew_five` surfaces:

1. `campaign:list --segment-id ...`
2. `campaign:create ...`
3. `campaign:mailbox-assignment:put ...`

### Canonical path now available

Both launch surfaces are now implemented in `crew_five`:

- `campaign:launch:preview`
- `campaign:launch`

So the practical recommendation is no longer `campaign:create` + manual mailbox persistence.
Instead:

1. `campaign:launch:preview`
2. `campaign:launch`

### Runtime clarification

Current factual runtime from `Outreach`:

- `interactionMode` is not used
- `dataQualityMode` is not used
- there is no `coach` runtime branch

So these fields should no longer be treated as operator-facing launch choices. `crew_five` may still
store backend defaults / legacy values, but `Outreacher` should not ask the operator about them or
pass them as explicit business intent.

## Recommended Wizard Flow

### Phase 1 - ICP

No change needed.

### Phase 2 - Hypothesis

No change needed.

### Phase 3 - Segment

No change needed.

### Phase 4 - Campaign

Split this phase logically into two substeps:

1. campaign selection or creation
2. sender-plan persistence

Recommended flow:

1. Check existing campaigns for the selected segment:

```bash
pnpm cli campaign:list --segment-id <segmentId> --error-format json
```

2. If the user chooses an existing campaign:
   - keep the campaign id
   - check whether a sender plan already exists

3. If the user creates a new campaign, preview first:

```bash
pnpm cli campaign:launch:preview \
  --payload '{"name":"<campaignName>","segmentId":"<segmentId>","segmentVersion":1,"snapshotMode":"reuse","senderPlan":{"assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}}' \
  --error-format json
```

4. If the preview looks acceptable, launch canonically:

```bash
pnpm cli campaign:launch \
  --payload '{"name":"<campaignName>","segmentId":"<segmentId>","segmentVersion":1,"snapshotMode":"reuse","createdBy":"claude-code","senderPlan":{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}}' \
  --error-format json
```

### Phase 5 - Next Step

No change in spirit, but the result summary should include mailbox assignment state:

- campaign id
- campaign name
- segment
- ICP
- hypothesis
- planned sender identities

## Recommended CLI Usage

### Preview a new campaign

```bash
pnpm cli campaign:launch:preview \
  --payload '{"name":"<campaignName>","segmentId":"<segmentId>","segmentVersion":1,"snapshotMode":"reuse","senderPlan":{"assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}}' \
  --error-format json
```

### Create a new campaign

```bash
pnpm cli campaign:launch \
  --payload '{"name":"<campaignName>","segmentId":"<segmentId>","segmentVersion":1,"snapshotMode":"reuse","createdBy":"claude-code","senderPlan":{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}}' \
  --error-format json
```

### Read the current sender plan

```bash
pnpm cli campaign:mailbox-assignment:get \
  --campaign-id <campaignId> \
  --error-format json
```

### Replace the sender plan

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}' \
  --error-format json
```

## Sender Semantics

The wizard should treat sender choice as a canonical sender-plan object, not as free-form text.

The important fields are:

- `mailboxAccountId`
- `senderIdentity`
- `provider`

Optional metadata may be added later, but these three are enough for the current contract.

## What `Outreacher` Should Not Do

- do not write sender bindings directly into Supabase tables
- do not keep campaign sender state only in local slash-command memory
- do not keep using raw `campaign:create` for the primary `/launch-campaign` path now that
  `campaign:launch` exists
- do not ask the operator to choose `interactionMode`
- do not ask the operator to choose `dataQualityMode`
- do not pass `interactionMode` / `dataQualityMode` in launch payload as if they were approved
  runtime intent

## Recommended User-Facing Language

Instead of asking only:

- "Имя кампании и sender?"

it is better to ask:

- "Имя кампании и sender set?"

or operationally:

- "Какой ящик или набор ящиков будет использовать эта кампания?"

This better matches the real persistence model.

## Minimum Change Required In The Current Skill

The minimum safe upgrade for `/launch-campaign` is:

1. keep the existing 5-phase wizard
2. before `campaign:create`, call `campaign:launch:preview`
3. replace `campaign:create` + `campaign:mailbox-assignment:put` with one `campaign:launch` call
4. show the saved sender plan in the final summary

That is enough to make the current slash workflow consistent with `crew_five`.

## Operator-Facing Rule

Until `Outreach` implements real runtime branching for these flags:

- treat `interactionMode` as backend-internal legacy default (`express`)
- treat `dataQualityMode` as backend-internal legacy default

Do not surface either one in `/launch-campaign` or `next-wave` operator choices.
