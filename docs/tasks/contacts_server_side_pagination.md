# Task: Server-Side Pagination for Contacts / Directory

**Date:** 2026-04-02
**Status:** Planned
**Owner:** frontend + backend
**Priority:** Medium — needed when company count exceeds ~1000

## Problem

ContactsWorkspacePage loads all companies in one request with a hardcoded `limit`.
Current database has ~500 companies, limit is set to 1000. When the database grows to
5000–10000+ companies, this approach will:

- slow down page load (large JSON payload)
- consume excessive browser memory
- make client-side filtering sluggish
- potentially hit Supabase response size limits

The same problem applies to:
- `fetchDirectoryCompanies` (company list)
- `fetchDirectoryContacts` (contact list within companies)
- `CampaignAttachCompaniesDrawer` (loads up to 500 companies for attach picker)

## Target Behavior

### Backend
1. Add `offset` / `cursor` param to `GET /api/directory/companies` and `GET /api/directory/contacts`
2. Return `total` count in response for pagination UI
3. Server-side search (`q` param) already exists — keep it
4. Server-side enrichment filter already exists — keep it

### Frontend
1. Load first page (50–100 items) on mount
2. "Load more" button at bottom of list (append to existing items)
3. Reset to first page when filters/search change
4. Show "N of M companies" counter
5. Search should debounce (300ms) and hit server-side `q` param
6. Enrichment filter should trigger server-side re-fetch, not client-side filter

### Attach Drawer
Same pattern — load first 50, "Load more" or search to find specific companies.

## Architecture Notes

- Supabase `.range(from, to)` supports offset-based pagination natively
- `total` can come from a separate `count` query or Supabase `count: 'exact'` option
- Consider `useInfiniteQuery` pattern if adopting a data-fetching library later
- For now, plain `useState` + append pattern is sufficient (same as Inbox "Show more")

## Not In Scope

- Virtual scrolling (react-window / react-virtualized) — overkill for current scale
- Full-text search — `q` ILIKE is sufficient for now
- Cursor-based pagination — offset is simpler and fine for this use case

## Acceptance Criteria

- Page loads fast with 10,000+ companies in database
- Operator can scroll/load-more through full list
- Search and filter still work without loading everything
- No regression in current 500-company workflow
