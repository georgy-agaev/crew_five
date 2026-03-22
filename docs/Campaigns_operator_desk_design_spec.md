# Campaigns Operator Desk Design Spec

> Version: v0.2 (2026-03-16)

## Purpose

This document defines the target information architecture and interaction model for the `Campaigns`
workspace in the Web UI.

The goal is to replace the current vertically stacked operator surface with a focused multi-column
operator desk that supports:

- campaign selection
- company review inside the campaign snapshot
- employee review inside the selected company
- message review for the selected employee

This spec is intended as a handoff/design brief for UI redesign work.

## Primary Design Goal

`Campaigns` should behave as a dense operator desk, not as a long report page.

The main unit of work is:

`Campaign -> Company -> Employee -> Message`

The user should be able to move through this chain quickly without losing context.

## Target Layout

Use a four-column layout with fixed proportions:

```
┌──────────┬───────────┬──────────┬──────────────────┐
│ Campaigns│ Companies │ Employees│     Messages     │
│  240px   │   280px   │  260px   │      1fr         │
│          │           │          │                  │
│          │           │          │                  │
└──────────┴───────────┴──────────┴──────────────────┘
```

1. `Campaigns` — 240px fixed
2. `Companies` — 280px fixed
3. `Employees` — 260px fixed
4. `Messages` — remaining space (1fr)

### Grid CSS

```css
.operator-desk {
  display: grid;
  grid-template-columns: 240px 280px 260px 1fr;
  height: calc(100vh - 64px);
  overflow: hidden;
}

.operator-desk__column {
  overflow-y: auto;
  border-right: 1px solid var(--border);
  padding: 12px;
}

.operator-desk__column:last-child {
  border-right: none;
}
```

### Why These Proportions

- Column 1 (240px): campaign names are short, status pill fits inline. More space is wasted.
- Column 2 (280px): company name + website + enrichment badge need moderate width.
- Column 3 (260px): employee name + role + sendability indicator. Comparable to Column 2.
- Column 4 (1fr): message subject + body preview need maximum available space.

At 1440px screen width, Column 4 gets ~660px. At 1280px it gets ~500px. Both are comfortable
for message review.

### Shell Integration

This layout lives inside the existing Workspace shell and visual system, alongside:

- `Pipeline`
- `Campaigns`
- `Inbox`
- `Analytics`
- `Prompts`

Do not create a second top-level app shell.

## Column 1: Campaigns

### Purpose

Show the list of campaigns and the fixed campaign context for the selected campaign.

### Content

- campaign list
- selected campaign status
- linked `ICP`
- linked `Offer`
- linked `Hypothesis`
- linked `Segment`
- snapshot version

### Expected Behavior

- Selecting a campaign refreshes the other three columns.
- Campaign context stays visible while navigating companies/employees/messages.

### Recommended UI Shape

Split-panel layout within the column:

```
┌─────────────────┐
│ 🔍 Search       │  ← input + status filter + sort
├─────────────────┤
│ Campaign A      │
│ Campaign B  ●   │  ← scrollable list, selected = accent bg
│ Campaign C      │
│ ...             │  ← flex: 1 1 auto, overflow-y: auto
├─────────────────┤
│ Status: review  │  ← sticky context block (flex: 0 0 auto)
│ ICP: Enterprise │
│ Segment: v3     │
│ Hypothesis: ... │
│ Offer: ...      │
└─────────────────┘
```

The lower context block must use `flex-shrink: 0` so it remains visible regardless of list
scroll position. This is critical: campaign context must always be on screen.

## Column 2: Companies

### Purpose

Show companies that belong to the selected campaign snapshot.

### Content

Each row should be compact but informative:

- company name
- website
- region
- employee/contact count in campaign
- enrichment state (`fresh / stale / missing`)

### Expected Behavior

- Hover previews the next column (employees) with 150ms debounce.
- Click pins selection.
- Search/filter/sort controls belong in this column header.

### Recommended Controls

- search
- research-state filter
- sort by:
  - name
  - contact count
  - updated

## Column 3: Employees

### Purpose

Show campaign-relevant employees for the selected company.

### Content

Each employee row should show:

- full name
- role/title
- recipient email resolution summary
- sendability state
- optional quick message coverage indicator (`intro / bump`)

### Expected Behavior

- Hover previews `Messages` with 150ms debounce.
- Click pins the selected employee.
- The column is always contextual to the selected company.

### Important UX Rule

The employee list should not be a global contact table. It must remain scoped to the currently
selected company.

### Required API

This column requires a new endpoint that does not exist yet:

```
GET /api/campaigns/:campaignId/companies/:companyId/employees
```

Response shape:

```ts
interface CampaignEmployee {
  contact_id: string;
  full_name: string;
  position: string | null;
  recipient_email: string | null;
  recipient_email_source: 'work' | 'generic' | null;
  sendable: boolean;
  draft_coverage: { intro: boolean; bump: boolean };
}
```

This is the first implementation blocker. Without this endpoint, Column 3 cannot be populated.

## Column 4: Messages

### Purpose

Show messages for the selected employee.

### Content

Messages column should support two independent switches:

1. Message state: `draft | approved | rejected | sent`
2. Message sequence: `Email 1 | Email 2`

These sequence labels map to:

- `Email 1` → `intro`
- `Email 2` → `bump`

When rejecting a message, the operator should be able to persist a structured reason in
`drafts.metadata` via the existing draft review endpoint. Preferred fields:

- `review_reason_code`
- `review_reason_codes`
- `review_reason_text`
- `reviewed_at`
- `reviewed_by`

Recommended reason taxonomy:

- `too_generic`
- `marketing_tone`
- `bad_subject`
- `wrong_narrative`
- `gender_mismatch`
- `explicit_title`
- `unnatural_russian`
- `fabricated_context`
- `weak_personalization`
- `bad_cta`
- `wrong_persona`
- `tone_mismatch`
- `factual_issue`
- `duplicate`
- `other`

### Recommended Control Type: Segmented Controls

Use segmented controls (not tabs, not pills) for both switches:

```
┌──────────────────────────────────────┐
│ [Draft] [Approved] [Rejected] [Sent] │  ← status segmented control
├──────────────────────────────────────┤
│ [Email 1]  [Email 2]                 │  ← sequence segmented control
├──────────────────────────────────────┤
│ Subject: Re: Partnership             │
│                                      │
│ Hi Alex,                             │
│                                      │
│ I noticed your team recently...      │
│                                      │
│ [Approve]  [Reject]                  │  ← action buttons
├──────────────────────────────────────┤
│ Pattern: enterprise_intro_v2         │  ← provenance metadata
│ Recipient: alex@acme.com (work)      │
│ Sendability: ✓ ready                 │
└──────────────────────────────────────┘
```

### Why Segmented Controls

- Tabs have navigation semantics — these switches are filters, not pages.
- Pills are too loose visually for a primary control.
- Segmented controls are compact, communicate mutual exclusivity clearly,
  and fit naturally in a dense operator surface.

### Segmented Control CSS

```css
.segmented-control {
  display: inline-flex;
  background: #e2e8f0;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.segmented-control__item {
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  border: none;
  color: #475569;
}

.segmented-control__item--active {
  background: #fff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

### Message States

Initial design should prioritize:

- `generated`
- `approved`
- `rejected`
- `sent`

In the UI label layer, `generated` may be shown as `draft` if that is clearer for operators, but
the underlying data contract should stay compatible with existing status values.

## Interaction Model

### Selection Pattern: Hover Preview + Click Pin

Use a two-tier selection model:

```tsx
const [hoveredId, setHoveredId] = useState<string | null>(null);
const [pinnedId, setPinnedId] = useState<string | null>(null);

const activeId = pinnedId ?? hoveredId;
```

### Hover Timing

Use **150ms debounce** on hover preview.

- Immediate hover (0ms) is too unstable — fast mouse movement across a list triggers
  unnecessary data loads and visual flickering.
- 300ms+ feels like lag and breaks the sense of direct manipulation.
- 150ms is the sweet spot: fast enough to feel responsive, slow enough to ignore pass-through.

### Visual Distinction: Hover vs Pinned

| State   | Left border              | Background                |
|---------|--------------------------|---------------------------|
| Default | none                     | transparent               |
| Hover   | `2px solid var(--orange)` | transparent               |
| Pinned  | `3px solid var(--orange)` | `var(--orangeLight)`      |

This gives the operator clear feedback: "I'm hovering" vs "I've committed this selection".

### Pin Behavior

- Clicking a row pins it. Clicking another row in the same column moves the pin.
- Clicking the already-pinned row does not unpin (always-pinned model).
- Hover preview still works on non-pinned items, but pinned selection takes priority
  (`activeId = pinnedId ?? hoveredId`).

## What This Layout Should Replace

The current vertically stacked composition:

- campaign detail
- audit
- companies table
- draft review
- outbound ledger
- events ledger

is useful as a debug/admin surface, but not as the primary operator workspace.

The new four-column desk should become the main `Campaigns` working surface.

## Secondary Surfaces: Audit, Outbound, Events

### Decision: Slide-Over Drawer

The operator still needs access to:

- audit coverage
- outbounds
- events

These should render in a **slide-over drawer** from the right side of the viewport.

```
┌──────┬───────┬───────┬────────────┬──────────────┐
│  C1  │  C2   │  C3   │    C4      │   Drawer     │
│      │       │       │  Messages  │   Audit      │
│      │       │       │     [🔍]   │   trail...   │
│      │       │       │            │              │
└──────┴───────┴───────┴────────────┴──────────────┘
```

### Drawer Specs

- Width: `380px`
- Trigger: link or icon in the Messages column (e.g. "View trace" under action buttons)
- Content: trace chain for the selected message (`draft → outbound → event`)
- Close: click outside or explicit close button
- Animation: slide from right, 200ms ease-out

### Why Not Other Options

| Option           | Problem                                              |
|------------------|------------------------------------------------------|
| Modal            | Blocks context. Operator loses the four-column view. |
| Lower inspector  | Steals vertical space from all four columns.         |
| Inline expansion | Breaks column layout, pushes content down.           |
| Drawer           | Overlays without disrupting. Preserves context.      |

### Reuse

The existing `campaignTrace.ts` logic (find linked draft/outbound/event) can render directly
inside the drawer without refactoring.

## Data Mapping

### Campaigns column

Maps to:

- `campaigns`
- linked `segment`
- linked `icp_profile`
- linked `icp_hypothesis`
- `offering_domain`

### Companies column

Maps to:

- campaign-scoped `segment_members`
- company read model already used in campaign companies API

### Employees column

Maps to:

- snapshot contacts for selected company
- resolved recipient context (`work_email -> generic_email`)
- **requires new API endpoint** (see Column 3 section)

### Messages column

Maps to:

- campaign drafts for selected employee
- filtered by:
  - sequence (`intro` / `bump`)
  - state (`generated/approved/rejected/sent`)

## Edge Cases And Resolution Rules

### Missing Campaign Context

Not every campaign will have a complete modern linkage set.

If any of these are missing:

- `ICP`
- `Offer`
- `Hypothesis`
- `Segment`

the Campaigns context block should still render and show:

- known linked values normally
- missing values as `n/a`

Do not hide the entire context block because one field is absent.

### Employee Draft Coverage Semantics

`draft_coverage` in the Employees column means:

- `intro = true` if at least one `intro` draft exists for that employee in the selected campaign
- `bump = true` if at least one `bump` draft exists for that employee in the selected campaign

Coverage is existence-based, not quality-based.

It should not depend on:

- status
- sendability
- whether the draft is the currently selected one

Optional future enhancement:

- add a compact highest-status indicator next to each sequence

### Message Selection Resolution

If multiple drafts exist for the same employee, same sequence, and same visible state filter,
the Messages column must choose a deterministic default row.

Default resolution order:

1. newest `updated_at`
2. if `updated_at` is equal or missing, newest `created_at`
3. if still tied, prefer higher lifecycle priority:
   - `sent`
   - `approved`
   - `generated`
   - `rejected`

This rule is important because duplicate drafts already exist in live data.

### Sequence Switch Resolution

When the operator switches:

- `Email 1` -> show `intro`
- `Email 2` -> show `bump`

If no matching draft exists for the selected employee and sequence:

- show an explicit empty state in the Messages column
- do not silently fall back to another sequence

### State Switch Resolution

The state switch controls which draft subset is currently visible in the Messages column.

Recommended UI labels:

- `Draft`
- `Approved`
- `Rejected`
- `Sent`

Underlying mapping:

- `Draft` -> `generated`
- `Approved` -> `approved`
- `Rejected` -> `rejected`
- `Sent` -> `sent`

If no draft matches the selected employee + selected sequence + selected state:

- render an empty message state
- keep the selected employee pinned

## Empty And Degraded States

### No Campaign Selected

- Columns 2, 3, and 4 show placeholder empty states
- Column 1 remains fully interactive

### No Company Selected

- Employees column shows `Select a company`
- Messages column shows `Select an employee`

### No Employees For Company

- Employees column shows `No campaign employees for this company`
- Messages column remains empty/inactive

### No Messages For Employee

- Messages column shows:
  - selected employee header
  - active sequence/state controls
  - explicit empty state: `No message for this employee in the selected state`

### Missing Recipient Context

If the selected employee or selected draft has no resolved recipient:

- do not suppress the message view
- show the message normally
- render a visible warning state for sendability / missing recipient

## Data Loading And Caching Strategy

### Campaigns

- load normally at page entry
- retain current client-side search/filter/sort behavior

### Companies

- fetch on campaign selection
- keep the full company list client-side for local filtering/sorting

### Employees

- fetch on hover preview with `150ms` debounce
- cache by `companyId`
- clicking a company should reuse cached data when available

Recommended cache key:

`campaignId + companyId`

### Messages

- should prefer using already loaded campaign drafts when possible
- derive employee-scoped message subsets client-side from the campaign draft set

Only introduce a dedicated message endpoint if client-side derivation becomes too slow or too large.

### Hover Request Guardrails

To prevent noisy UX and excess fetch churn:

- debounce hover preview (`150ms`)
- cancel or ignore stale in-flight requests
- do not re-fetch if the hovered company already has warm cached employees

## Drawer Resolution Rules

The drawer shows the trace chain for the currently selected message context.

### Default Trace Rendering

For the current selected draft:

- show linked outbound if one exists
- show linked event if one exists

If multiple linked rows exist:

- show the newest outbound by `sent_at` / fallback `created_at`
- show the newest event by `occurred_at`

### Missing Trace Links

Possible states:

- draft with no outbound yet
- outbound with no event yet
- failed outbound with no downstream event

These should render as explicit missing steps, not as hidden sections.

## Existing Capabilities To Preserve

The redesign should preserve current useful operator capabilities:

- campaign filtering and sorting
- company filtering and sorting
- draft review actions
- trace drill-down between:
  - draft
  - outbound
  - event

These can move into a better layout, but should not be lost.

## Constraints

- Must use the existing Workspace shell.
- Must use the existing shared visual system:
  - `web/src/theme.ts`
  - `web/src/index.css`
- Must not introduce a second navigation layer.
- Must not rely on ad hoc colors or fonts.
- Should prefer incremental refactor over full rewrite if possible.
- Minimum supported viewport width: 1280px for four-column layout.

## Responsive Breakpoints

### 1280px+ (Desktop)

Full four-column operator desk as specified above.

### 1024px–1279px (Narrow Desktop)

Two-panel layout with internal tabs:

- Left panel: `Campaigns` / `Companies` (tab switch)
- Right panel: `Employees` / `Messages` (tab switch)

### < 1024px (Tablet / Mobile)

Single-column layout with breadcrumb navigation:

```
Campaigns > Acme Corp > John Smith > Email 1
```

Each breadcrumb segment navigates back to that level. Only one column visible at a time.

## Implementation Order

| Step | Task                                         | Dependencies           | Parallelizable |
|------|----------------------------------------------|------------------------|----------------|
| 1    | CSS: `.operator-desk` grid + column styles   | None                   | Yes            |
| 2    | API: `/campaigns/:id/companies/:cid/employees` | Backend route        | Yes            |
| 3    | Column 1: Campaign list + sticky context     | Existing `fetchCampaigns` | Yes         |
| 4    | Column 2: Companies with hover/pin           | Existing `fetchCampaignCompanies` | After 1 |
| 5    | Column 3: Employees with hover/pin           | Step 2 endpoint        | After 2, 4     |
| 6    | Column 4: Messages with segmented controls   | `fetchDrafts` + employee filter | After 5 |
| 7    | Drawer: audit/outbound/events trace          | Existing `campaignTrace.ts` | After 6   |
| 8    | Responsive breakpoints                       | After desktop complete  | After 7        |

Steps 1, 2, 3 can run in parallel.

## Design Decisions Log

Decisions made during UI design review (2026-03-16):

| Question                               | Decision                  | Rationale                                              |
|----------------------------------------|---------------------------|--------------------------------------------------------|
| Column proportions                     | 240 / 280 / 260 / 1fr    | Messages need max space; first 3 columns are navigation |
| Hover delay                            | 150ms debounce            | 0ms too unstable, 300ms+ feels laggy                   |
| Status/sequence switcher type          | Segmented controls        | Compact, filter semantics (not navigation), clear mutual exclusivity |
| Audit/outbound/events surface          | Slide-over drawer (380px) | Preserves four-column context, non-blocking            |
| Responsive fallback < 1280px           | Two-panel + tabs          | Maintains paired context (campaign+company, employee+message) |
| Responsive fallback < 1024px           | Single column + breadcrumb | Only viable option for narrow viewports               |
| Pin behavior on re-click              | Stay pinned               | Prevents accidental deselection during review          |

## Summary

The intended target is:

`Campaigns | Companies | Employees | Messages`

with:

- stable campaign context (sticky lower block in Column 1)
- company-scoped employee navigation (hover preview + click pin)
- employee-scoped message review (segmented controls for status + sequence)
- slide-over drawer for audit/outbound/event trace
- 150ms hover debounce across all preview interactions
- responsive fallback at 1280px and 1024px breakpoints

This is the desired direction for the next major `Campaigns` UI redesign.
