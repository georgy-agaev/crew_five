# Task: Campaign Wave Attach Web UI

## Status

Done.

## Goal

Give operators a canonical `Import -> Process -> Attach` flow in the Web UI so already-processed
companies can be added into an existing campaign wave without manual DB work.

## Backend Surface Ready

- `POST /api/campaigns/:campaignId/companies/attach`
- `GET /api/campaigns/:campaignId/companies`
- `GET /api/campaigns/:campaignId/audit`

## Required UI Shape

### Entry point

Use existing operator surfaces rather than creating a brand-new workspace:

- primary attach entry point in `Campaigns`
- optional secondary entry point later in import/process workspace

### Flow

1. operator selects a target campaign
2. operator selects one or more processed companies
3. UI calls `POST /api/campaigns/:campaignId/companies/attach`
4. UI shows attach summary:
   - attached companies
   - already present companies
   - invalid / blocked companies
   - inserted contacts
   - already present contacts
5. UI refreshes campaign companies / audit surfaces

## Required States

- idle
- loading
- success summary
- validation error (`companyIds` empty)
- server error

## Out Of Scope

- editing segment filters
- re-running company processing
- sendability scoring
- automatic draft generation after attach

## Verification

- attach a processed company into a `draft` campaign
- confirm the company appears in campaign companies list
- confirm campaign audit counts update
- confirm a later draft-generation flow includes the attached contacts
