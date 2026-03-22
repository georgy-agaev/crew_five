# Outreacher Handoff: Offer Follow-up

`crew_five` offer registry is now fully wired through launch, campaign detail, and analytics.

## What Changed

- launch now persists canonical `campaign.offer_id`
- `campaign:detail` returns optional `offer`
- `analytics:summary --group-by offer` is available
- legacy `groupBy=offering` still exists separately for draft metadata analytics

## Recommended Outreacher Follow-up

### 1. Use offer-aware analytics

Use:

```bash
pnpm cli analytics:summary --group-by offer --error-format json
```

Interpretation:

- `offer` = canonical campaign-linked offer registry entity
- use this for operator/business reporting when you want campaign-level truth

### 2. Keep legacy `offering` only where needed

Use:

```bash
pnpm cli analytics:summary --group-by offering --error-format json
```

only when you explicitly need draft metadata / offering-domain lineage.

### 3. Surface offer in campaign summaries

Where `/launch-campaign`, `/send-campaign`, or review summaries mention campaign context:

- include selected offer title
- include project name when available

### 4. Clean up raw campaign creation paths

Audit any remaining low-level `campaign:create` uses.

If a raw create path still exists, pass:

```bash
--offer-id <offerId>
```

Do not keep offer identity only in slash-command memory once a campaign is created.

## Boundary

- `crew_five` owns canonical offer persistence and analytics grouping by `offer`
- `Outreach` owns choosing which offer to use and surfacing it in agent/operator flows
