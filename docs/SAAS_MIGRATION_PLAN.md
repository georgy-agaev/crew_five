# SaaS Migration Plan

> Version: v0.1 (2025-11-30)

This document outlines the architectural changes required to transition the AI SDR GTM System from a single-user, local-first utility into a multi-tenant, production-ready SaaS application.

## 1. Executive Summary

The current architecture is designed for a single user running the system locally with "God mode" database privileges. To support multiple organizations securely, we must implement:
1.  **Multi-Tenancy:** Data isolation at the database level.
2.  **Authentication:** Secure user identity verification.
3.  **Authorization:** Role-based access control (RBAC) and Row Level Security (RLS).
4.  **Hardened API:** A robust web server framework with security middleware.

## 2. Database Strategy (Multi-Tenancy)

The most critical change is ensuring data isolation. We will use a "shared database, separate schemas via RLS" approach, which is native to Supabase.

### Schema Changes
Every table in the "Data Spine" (see `ARCHITECTURE_OVERVIEW.md`) must be associated with an organization.

1.  **New Tables:**
    *   `organizations` (id, name, created_at)
    *   `profiles` (id references auth.users, organization_id references organizations, role)

2.  **Modifications:**
    *   Add `organization_id` (UUID, Not Null) to all primary tables:
        *   `segments`
        *   `segment_members`
        *   `campaigns`
        *   `drafts`
        *   `email_outbound`
        *   `email_events`
        *   `companies` (if shared, requires strategy decision; if private, add org_id)
        *   `employees` (contacts)

### Row Level Security (RLS)
Disable the Service Role Key for standard API operations.

*   **Enable RLS** on all tables.
*   **Policy Example:**
    ```sql
    create policy "Org Isolation" on public.campaigns
    using (organization_id in (
      select organization_id from public.profiles
      where id = auth.uid()
    ));
    ```

## 3. Authentication & Authorization

### Backend
*   **Remove** reliance on `SUPABASE_SERVICE_ROLE_KEY` for API requests.
*   **Implement** Supabase Auth Middleware.
*   The backend should receive the user's JWT from the request header and create a scoped Supabase client:
    ```typescript
    // Pseudo-code
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.authorization } }
    });
    // This client now respects RLS policies for the logged-in user.
    ```

### Frontend
*   Integrate `@supabase/auth-helpers-react` (or standard `supabase-js` auth).
*   Add `AuthProvider` to wrap the React application.
*   Create a Login/Signup page.
*   Update `apiClient.ts` to inject the `access_token` into the `Authorization` header of every request.

## 4. Backend Architecture

The current ad-hoc `node:http` server in `src/web/server.ts` is insufficient for a public-facing API.

### Framework Adoption
Migrate to **Fastify** or **Express**. Fastify is recommended for performance and TypeScript support.

### Middleware Pipeline
1.  **CORS:** Restrict to trusted domains.
2.  **Rate Limiting:** Protect against abuse (e.g., `@fastify/rate-limit`).
3.  **Auth Guard:** Verify JWT before processing business logic.
4.  **Validation:** Use Zod to validate request bodies (replacing manual checks).

### Service Refactoring
Update `src/services/*` to accept a `SupabaseClient` instance as a dependency per request, rather than using a global singleton. This ensures database operations use the context of the specific requesting user.

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create `organizations` and `profiles` tables.
- [ ] Add `organization_id` to all existing tables (backfill with a default ID for local dev).
- [ ] Enable RLS and write policies for all tables.
- [ ] Implement Supabase Auth in the Frontend.

### Phase 2: Backend Hardening (Weeks 3-4)
- [ ] Replace `src/web/server.ts` with a Fastify server.
- [ ] Implement JWT verification middleware.
- [ ] Refactor `AdapterDeps` to support per-request context (passing the user-scoped Supabase client).
- [ ] Update `apiClient.ts` to handle auth tokens.

### Phase 3: Infrastructure (Week 5)
- [ ] Dockerize the new web server (separate from the CLI tools).
- [ ] Set up a CI/CD pipeline to deploy to a platform like Render or Railway.
- [ ] Configure production Supabase project.

## 6. CLI Considerations
The CLI can remain for admin tasks or advanced power users. However, for it to work with the SaaS model, it must:
1.  Implement a `login` command (e.g., device flow).
2.  Store the user's access token locally.
3.  Send this token with API requests (if talking to the SaaS API) or continue to use the Service Role Key *only* for local-only, single-tenant instances.
