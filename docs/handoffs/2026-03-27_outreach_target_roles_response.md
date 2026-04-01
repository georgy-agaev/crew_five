# Response: Outreach Handoff (Structured `target_roles` in `persona_criteria`)

**Date:** 2026-03-27  
**From:** `crew_five`  
**To:** Outreach  
**Scope:** Alignment on `persona_criteria.target_roles` shape and how it flows through `crew_five`.

## 1) `target_roles` Shape Review

The proposed shape works.

Recommended contract (minimal required fields):

```jsonc
{
  "role": "IT-директор",
  "priority": "P1",
  "search_patterns": ["директор.*ит", "it.director", "cto", "cio"],
  "angle": "Совместимость с ВКС-платформами, интеграция с российским ПО"
}
```

Notes:

- `search_patterns` should be treated as **regex-like strings**, not necessarily strict/portable regex.
- `budget_range` and `decision_cycle` are useful as optional informational fields for prompts.
- `excluded_roles` and `office_qualification_rules` are a good fit in ICP-level `persona_criteria` (see section 4).

## 2) `campaign:detail` Pass-Through Confirmation

Confirmed: `crew_five` `campaign:detail` (aka `campaign:detail` / `campaign:read-model`) already reads and returns
`icp_profiles.persona_criteria` as JSONB pass-through.

Implication: if Outreach writes `target_roles` into `persona_criteria`, it will appear in `campaign:detail` without
backend changes.

Implementation reference: [campaignDetailReadModel.ts](/Users/georgyagaev/crew_five/src/services/campaignDetailReadModel.ts)

## 3) `project:bootstrap` Validation (Planned)

`project:bootstrap` is not implemented yet in `crew_five` (see design in
[outreach_project_bootstrap_wizard_design.md](/Users/georgyagaev/crew_five/docs/tasks/outreach_project_bootstrap_wizard_design.md)).

When implemented, we will add a **readiness warning** (not a hard error):

- `persona_criteria.target_roles` exists and non-empty
- each role has `role`, `priority`, `search_patterns`

Optional best-effort validation:

- attempt to compile `search_patterns` as JS `RegExp`
- on failure: emit a warning, but do not block bootstrap

## 4) `office_qualification_rules` Placement

Recommendation: store `office_qualification_rules` inside ICP `persona_criteria`.

Reason:

- rules vary by ICP
- rules are consumed by multiple pipeline stages (collect/analyze/generation)
- keeping them in ICP avoids per-script drift

## Next Steps

- Outreach can safely start populating `persona_criteria.target_roles` for pilot ICPs now.
- `crew_five` will treat these fields as stable contract (pass-through in read models) and will wire validations into
  `project:bootstrap` once that command lands.

