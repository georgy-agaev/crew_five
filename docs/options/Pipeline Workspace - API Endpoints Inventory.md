2025-12-09  13:31

Status: 

Tags: #crew_five 

# Pipeline Workspace - API Endpoints Inventory

**Document Version:** 1.0  
**Date:** December 9, 2025  
**Status:** Planning & Implementation Guide

---

## 📋 Table of Contents

1. [Currently Referenced Endpoints](#1-currently-referenced-endpoints)
2. [Missing Endpoints - Critical](#2-missing-endpoints---critical)
3. [Missing Endpoints - High Priority](#3-missing-endpoints---high-priority)
4. [Missing Endpoints - Medium Priority](#4-missing-endpoints---medium-priority)
5. [API Design Patterns](#5-api-design-patterns)
6. [Implementation Priority Matrix](#6-implementation-priority-matrix)

---

## 1. Currently Referenced Endpoints

These endpoints are referenced in the UI code or documentation:

### 1.1 Prompt Registry APIs

| Method | Endpoint | Description | Status | UI Location |
|--------|----------|-------------|--------|-------------|
| `GET` | `/api/prompt-registry` | List all prompts (filter by step) | 🟡 Documented | Prompt Registry Page |
| `POST` | `/api/prompt-registry` | Create new prompt entry | 🟡 Documented | Prompt Registry Page |
| `GET` | `/api/prompt-registry/active` | Get active prompt for step | 🟡 Documented | Prompt Registry Page |
| `POST` | `/api/prompt-registry/active` | Set active prompt for step | 🟡 Documented | Prompt Registry Page |

**Legend:**
- 🟢 Implemented
- 🟡 Documented but not implemented
- 🔴 Not implemented, not documented

---

## 2. Missing Endpoints - Critical

### 2.1 Service Providers Management

**Purpose:** Configure and manage service connections (Supabase, OpenAI, Anthropic, Smartlead, etc.)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/services` | Get all service configurations | - | `{ services: Service[] }` |
| `GET` | `/api/services/:name` | Get specific service config | - | `{ service: Service }` |
| `POST` | `/api/services/:name/connect` | Connect/enable service | `{ apiKey?: string, config?: object }` | `{ status: 'connected', service: Service }` |
| `POST` | `/api/services/:name/disconnect` | Disconnect service | - | `{ status: 'disconnected' }` |
| `PATCH` | `/api/services/:name` | Update service config | `{ config: object }` | `{ service: Service }` |
| `POST` | `/api/services/:name/test` | Test service connection | - | `{ status: 'success' \| 'error', message?: string }` |

**Implementation notes (2025-12-09):**
- `GET /api/services` is implemented in the web adapter and used by `PipelineWorkspaceWithSidebar` to drive the Service Providers view. It inspects `.env` to surface Supabase, Smartlead, LLM providers (OpenAI/Anthropic/Gemini), and enrichment/search providers (Serper, Perplexity, Exa, Parallel, Firecrawl, Anysite, Prospeo, Leadmagic, TryKitt). The workspace hero header also summarizes connected providers by category (LLMs, enrichment, delivery) using this endpoint. Other methods remain planned.

**Service Object Structure:**
```typescript
interface Service {
  name: string;
  category: 'database' | 'llm' | 'delivery' | 'enrichment';
  status: 'connected' | 'disconnected' | 'warning';
  hasApiKey: boolean;
  config?: {
    apiKey?: string;
    baseUrl?: string;
    // ... service-specific config
  };
  lastChecked?: string;
  errorMessage?: string;
}
```

**UI Impact:** Settings Modal → Service Providers table

---

### 2.2 Task Configuration Management

**Purpose:** Configure which LLM provider, model, and prompt to use for each task

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/task-config` | Get all task configurations | - | `{ tasks: TaskConfig[] }` |
| `GET` | `/api/task-config/:taskId` | Get specific task config | - | `{ config: TaskConfig }` |
| `POST` | `/api/task-config/:taskId` | Update task configuration | `{ provider: string, model: string, promptId: string }` | `{ config: TaskConfig }` |
| `GET` | `/api/task-config/validate` | Validate task configs | - | `{ valid: boolean, errors?: ValidationError[] }` |

**TaskConfig Object Structure:**
```typescript
interface TaskConfig {
  taskId: 'icpDiscovery' | 'hypothesisGen' | 'emailDraft' | 'linkedinMsg';
  provider: 'OpenAI' | 'Anthropic' | 'Gemini';
  model: string; // 'GPT-4', 'Claude 3', etc.
  promptId: string; // Reference to prompt-registry
  enabled: boolean;
  updatedAt: string;
}
```

**UI Impact:** Prompt Registry Page → Task Configuration section

---

### 2.3 Pipeline Steps - ICP Discovery

**Purpose:** Create and manage ICP (Ideal Customer Profile) definitions

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/icps` | List all ICPs | `?limit=10&offset=0` | `{ icps: ICP[], total: number }` |
| `POST` | `/api/icps` | Create new ICP | `{ name: string, description?: string, criteria: object }` | `{ icp: ICP }` |
| `GET` | `/api/icps/:id` | Get ICP details | - | `{ icp: ICP }` |
| `PATCH` | `/api/icps/:id` | Update ICP | `{ name?: string, criteria?: object }` | `{ icp: ICP }` |
| `DELETE` | `/api/icps/:id` | Delete ICP | - | `{ success: boolean }` |
| `POST` | `/api/icps/ai-chat` | AI-assisted ICP creation | `{ message: string, context?: object }` | `{ response: string, suggestedICP?: ICP }` |

**ICP Object Structure:**
```typescript
interface ICP {
  id: string;
  name: string;
  description?: string;
  criteria: {
    industry?: string[];
    companySize?: { min?: number, max?: number };
    location?: string[];
    revenue?: { min?: number, max?: number };
    technologies?: string[];
    // ... more criteria
  };
  companiesCount: number;
  lastUpdated: string;
  createdAt: string;
}
```

**UI Impact:** Pipeline → ICP Discovery step

---

### 2.4 Pipeline Steps - Hypothesis Generation

**Purpose:** Create targeting hypotheses based on ICP

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/hypotheses` | List all hypotheses | `?icpId=xxx` | `{ hypotheses: Hypothesis[], total: number }` |
| `POST` | `/api/hypotheses` | Create hypothesis | `{ icpId: string, text: string, confidence?: number }` | `{ hypothesis: Hypothesis }` |
| `GET` | `/api/hypotheses/suggested` | Get AI-suggested hypotheses | `?icpId=xxx` | `{ suggestions: Hypothesis[] }` |
| `PATCH` | `/api/hypotheses/:id` | Update hypothesis | `{ text?: string, confidence?: number }` | `{ hypothesis: Hypothesis }` |
| `DELETE` | `/api/hypotheses/:id` | Delete hypothesis | - | `{ success: boolean }` |

**Hypothesis Object Structure:**
```typescript
interface Hypothesis {
  id: string;
  icpId: string;
  text: string;
  confidence: number; // 0-100
  createdAt: string;
  updatedAt: string;
}
```

**UI Impact:** Pipeline → Hypothesis Generation step

---

## 3. Missing Endpoints - High Priority

### 3.1 Pipeline Steps - Segment Selection

**Purpose:** Select or generate segments based on ICP and hypothesis

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/segments` | List matching segments | `?icpId=xxx&hypothesisId=yyy` | `{ segments: Segment[] }` |
| `POST` | `/api/segments/generate` | Generate new segment | `{ icpId: string, hypothesisId: string, filters: object }` | `{ segment: Segment, jobId?: string }` |
| `GET` | `/api/segments/:id` | Get segment details | - | `{ segment: Segment }` |
| `GET` | `/api/segments/:id/companies` | Get companies in segment | `?limit=50&offset=0` | `{ companies: Company[], total: number }` |

**Segment Object Structure:**
```typescript
interface Segment {
  id: string;
  name: string;
  icpId: string;
  hypothesisId?: string;
  companiesCount: number;
  filters: object;
  createdAt: string;
}
```

**UI Impact:** Pipeline → Segment Selection step

---

### 3.2 Pipeline Steps - Enrichment

**Purpose:** Enrich company and lead data using external services

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/api/enrichment/companies` | Enrich companies | `{ segmentId: string, fields: string[] }` | `{ jobId: string, status: 'queued' }` |
| `POST` | `/api/enrichment/leads` | Enrich leads | `{ companyIds: string[], fields: string[] }` | `{ jobId: string, status: 'queued' }` |
| `GET` | `/api/enrichment/jobs/:jobId` | Get enrichment job status | - | `{ job: EnrichmentJob }` |
| `GET` | `/api/enrichment/services` | List available enrichment services | - | `{ services: EnrichmentService[] }` |

**EnrichmentJob Object Structure:**
```typescript
interface EnrichmentJob {
  id: string;
  type: 'companies' | 'leads';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  total: number;
  processed: number;
  failed: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}
```

**UI Impact:** Pipeline → Enrichment step

---

### 3.3 Pipeline Steps - Email Draft

**Purpose:** Generate personalized email drafts using AI

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/api/drafts/generate` | Generate email drafts | `{ segmentId: string, templateId?: string }` | `{ jobId: string }` |
| `GET` | `/api/drafts` | List generated drafts | `?segmentId=xxx&limit=50` | `{ drafts: Draft[] }` |
| `GET` | `/api/drafts/:id` | Get draft details | - | `{ draft: Draft }` |
| `PATCH` | `/api/drafts/:id` | Update draft | `{ subject?: string, body?: string }` | `{ draft: Draft }` |
| `POST` | `/api/drafts/:id/approve` | Approve draft | - | `{ success: boolean }` |
| `DELETE` | `/api/drafts/:id` | Delete draft | - | `{ success: boolean }` |

**Draft Object Structure:**
```typescript
interface Draft {
  id: string;
  companyId: string;
  leadId: string;
  subject: string;
  body: string;
  status: 'generated' | 'reviewed' | 'approved' | 'rejected';
  generatedAt: string;
  approvedAt?: string;
}
```

**UI Impact:** Pipeline → Email Draft step

**Implementation notes (2025-12-09):**
- `POST /api/drafts/generate` and `GET /api/drafts` are implemented via the web adapter. The `PipelineWorkspaceWithSidebar` Draft step calls `POST /api/drafts/generate` in dry-run mode, passing the selected campaign, ICP profile, and hypothesis plus provider/model from the task settings store, and shows a summary instead of listing individual drafts.

---

### 3.4 Pipeline Steps - Send/Delivery

**Purpose:** Configure and execute email delivery

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/api/campaigns` | Create email campaign | `{ name: string, draftIds: string[], deliveryService: string }` | `{ campaign: Campaign }` |
| `GET` | `/api/campaigns` | List campaigns | `?status=active` | `{ campaigns: Campaign[] }` |
| `GET` | `/api/campaigns/:id` | Get campaign details | - | `{ campaign: Campaign }` |
| `POST` | `/api/campaigns/:id/start` | Start campaign | - | `{ success: boolean, jobId: string }` |
| `POST` | `/api/campaigns/:id/pause` | Pause campaign | - | `{ success: boolean }` |
| `POST` | `/api/campaigns/:id/stop` | Stop campaign | - | `{ success: boolean }` |

**Campaign Object Structure:**
```typescript
interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed';
  totalDrafts: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  deliveryService: 'smartlead' | 'sendmail';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

**UI Impact:** Pipeline → Send step

**Implementation notes (2025-12-09):**
- `GET /api/campaigns` is implemented and used by both Workflow 0 and `PipelineWorkspaceWithSidebar` to populate campaign selectors. The Send step in the workspace uses `GET /api/smartlead/campaigns` plus `POST /api/smartlead/send` as a preview-only path (dry-run) to Smartlead; no live send is triggered from the UI yet. Full campaign lifecycle endpoints (`/api/campaigns/:id/start|pause|stop`) remain planned.

---

### 3.5 Inbox Management

**Purpose:** Manage incoming emails and replies

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/inbox/messages` | List inbox messages | `?status=unread&limit=50` | `{ messages: Message[], total: number }` |
| `GET` | `/api/inbox/messages/:id` | Get message details | - | `{ message: Message, thread: Message[] }` |
| `PATCH` | `/api/inbox/messages/:id` | Mark as read/unread | `{ read: boolean }` | `{ success: boolean }` |
| `POST` | `/api/inbox/messages/:id/reply` | Send reply | `{ body: string, attachments?: Attachment[] }` | `{ message: Message }` |
| `POST` | `/api/inbox/messages/:id/categorize` | Categorize message | `{ category: string }` | `{ success: boolean }` |

**Message Object Structure:**
```typescript
interface Message {
  id: string;
  threadId: string;
  from: { email: string, name?: string };
  to: { email: string, name?: string }[];
  subject: string;
  body: string;
  htmlBody?: string;
  read: boolean;
  category?: 'interested' | 'not_interested' | 'ooo' | 'bounce' | 'spam';
  receivedAt: string;
  campaignId?: string;
  leadId?: string;
}
```

**UI Impact:** Inbox page

---

### 3.6 Analytics & Reporting

**Purpose:** View campaign performance and metrics

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/analytics/overview` | Get overall metrics | `?dateFrom=xxx&dateTo=yyy` | `{ metrics: OverviewMetrics }` |
| `GET` | `/api/analytics/campaigns/:id` | Get campaign analytics | - | `{ analytics: CampaignAnalytics }` |
| `GET` | `/api/analytics/pipeline` | Get pipeline conversion metrics | - | `{ funnel: PipelineFunnel[] }` |
| `GET` | `/api/analytics/export` | Export analytics data | `?format=csv&metric=all` | CSV/JSON file |

**OverviewMetrics Object Structure:**
```typescript
interface OverviewMetrics {
  icpsCreated: number;
  hypothesesGenerated: number;
  segmentsGenerated: number;
  companiesEnriched: number;
  emailsSent: number;
  emailsDelivered: number;
  openRate: number; // percentage
  clickRate: number; // percentage
  replyRate: number; // percentage
  dateRange: { from: string, to: string };
}
```

**UI Impact:** Analytics page

**Implementation notes (2025-12-09):**
- The current implementation uses `/api/analytics/summary` and `/api/analytics/optimize` (see web adapter docs) as the backing APIs for the Analytics tab in `PipelineWorkspaceWithSidebar`. The tab keeps the Option B layout (Overview/Campaigns/Performance pills) but:
  - Switches the `groupBy` parameter between `icp`, `segment`, and `pattern` based on the active pill.
  - Aggregates summary rows into totals (delivered/opened/replied/positive) and shows a compact list of top groups using the same grouping keys as `EventsPage`.
  - Surfaces a short “Prompt suggestions” list derived from `/api/analytics/optimize` suggestions.

---

## 4. Missing Endpoints - Medium Priority

### 4.1 User Management & Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/logout` | User logout |
| `POST` | `/api/auth/refresh` | Refresh auth token |
| `GET` | `/api/users/me` | Get current user |
| `PATCH` | `/api/users/me` | Update user profile |
| `GET` | `/api/users/me/preferences` | Get user preferences |
| `PATCH` | `/api/users/me/preferences` | Update preferences (language, etc.) |

**UI Impact:** Settings Modal, Language Selector

---

### 4.2 Prompt Registry - Extended Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prompt-registry/:id` | Get specific prompt |
| `PATCH` | `/api/prompt-registry/:id` | Update prompt |
| `DELETE` | `/api/prompt-registry/:id` | Delete prompt |
| `POST` | `/api/prompt-registry/:id/version` | Create new version |
| `GET` | `/api/prompt-registry/:id/versions` | List all versions |
| `POST` | `/api/prompt-registry/:id/test` | Test prompt with sample data |
| `POST` | `/api/prompt-registry/import` | Import prompts from file |
| `GET` | `/api/prompt-registry/export` | Export prompts |

**UI Impact:** Prompt Registry Page (CRUD operations)

---

### 4.3 Templates & Saved Configurations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/templates/icps` | Get ICP templates |
| `GET` | `/api/templates/hypotheses` | Get hypothesis templates |
| `GET` | `/api/templates/emails` | Get email templates |
| `POST` | `/api/templates/save` | Save current config as template |

**UI Impact:** Various pipeline steps (templates dropdown)

---

### 4.4 Webhooks & Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/webhooks` | List configured webhooks |
| `POST` | `/api/webhooks` | Create webhook |
| `DELETE` | `/api/webhooks/:id` | Delete webhook |
| `POST` | `/api/webhooks/:id/test` | Test webhook |

**UI Impact:** Settings → Integrations section (future)

---

### 4.5 File Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload/csv` | Upload CSV for import |
| `POST` | `/api/upload/logos` | Upload company logos |
| `GET` | `/api/files/:id` | Get file metadata |
| `DELETE` | `/api/files/:id` | Delete file |

**UI Impact:** ICP/Segment creation, enrichment

---

## 5. API Design Patterns

### 5.1 Standard Response Format
```typescript
// Success Response
{
  success: true,
  data: T,
  meta?: {
    pagination?: {
      total: number,
      limit: number,
      offset: number,
      hasNext: boolean
    },
    timestamp: string
  }
}

// Error Response
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: object
  }
}
```

### 5.2 Pagination Pattern
```
GET /api/resource?limit=50&offset=0
GET /api/resource?limit=50&cursor=xxx  // Alternative: cursor-based
```

### 5.3 Filtering Pattern
```
GET /api/resource?filter[status]=active&filter[category]=llm
```

### 5.4 Sorting Pattern
```
GET /api/resource?sort=createdAt:desc
```

### 5.5 Field Selection Pattern
```
GET /api/resource?fields=id,name,status
```

---

## 6. Implementation Priority Matrix

### Phase 1: Foundation (Week 1-2)
**Goal:** Enable basic service configuration and prompt management

- ✅ Service Providers APIs (2.1)
- ✅ Task Configuration APIs (2.2)
- ✅ Prompt Registry - Basic CRUD (1.1 + 4.2)
- ✅ User Preferences (4.1 - minimal)

**Deliverable:** Settings work end-to-end, Task Configuration functional

---

### Phase 2: Core Pipeline (Week 3-4)
**Goal:** Enable ICP → Hypothesis → Segment flow

- ✅ ICP Discovery APIs (2.3)
- ✅ Hypothesis Generation APIs (2.4)
- ✅ Segment Selection APIs (3.1)

**Deliverable:** Users can create ICPs, generate hypotheses, select segments

---

### Phase 3: Data Enrichment (Week 5-6)
**Goal:** Enable data enrichment pipeline

- ✅ Enrichment APIs (3.2)
- ✅ File Upload for CSV imports (4.5)

**Deliverable:** Users can enrich company and lead data

---

### Phase 4: Content Generation (Week 7-8)
**Goal:** Enable email draft generation

- ✅ Email Draft APIs (3.3)
- ✅ Email Templates (4.3)

**Deliverable:** AI-generated personalized emails ready for review

---

### Phase 5: Delivery & Inbox (Week 9-10)
**Goal:** Enable campaign execution and inbox management

- ✅ Campaign/Send APIs (3.4)
- ✅ Inbox Management APIs (3.5)

**Deliverable:** End-to-end: ICP → Send → Inbox replies

---

### Phase 6: Analytics & Optimization (Week 11-12)
**Goal:** Enable performance tracking and optimization

- ✅ Analytics APIs (3.6)
- ✅ Webhooks (4.4)

**Deliverable:** Full analytics dashboard, automated workflows

---

## 7. Summary Statistics

### Current State
- **Endpoints Documented:** 4 (Prompt Registry)
- **Endpoints Implemented:** 0
- **UI Features Blocked:** ~15 major features

### Required Endpoints
- **Critical Priority:** 24 endpoints
- **High Priority:** 32 endpoints
- **Medium Priority:** 20 endpoints
- **Total:** ~76 endpoints

### Estimated Implementation
- **Backend Work:** 8-12 weeks (1 senior + 1 mid-level backend engineer)
- **Testing & Integration:** 2-4 weeks
- **Documentation:** 1-2 weeks
- **Total Project:** 11-18 weeks

---

## 8. Quick Reference by UI Feature

### Settings Modal
```
GET    /api/services
POST   /api/services/:name/connect
POST   /api/services/:name/test
GET    /api/task-config
POST   /api/task-config/:taskId
```

### Prompt Registry Page
```
GET    /api/prompt-registry
POST   /api/prompt-registry
GET    /api/prompt-registry/active
POST   /api/prompt-registry/active
PATCH  /api/prompt-registry/:id
DELETE /api/prompt-registry/:id
```

### Pipeline - ICP Step
```
GET    /api/icps
POST   /api/icps
POST   /api/icps/ai-chat
PATCH  /api/icps/:id
DELETE /api/icps/:id
```

### Pipeline - Hypothesis Step
```
GET    /api/hypotheses
POST   /api/hypotheses
GET    /api/hypotheses/suggested
PATCH  /api/hypotheses/:id
```

### Pipeline - Segment Step
```
GET    /api/segments
POST   /api/segments/generate
GET    /api/segments/:id/companies
```

### Pipeline - Enrichment Step
```
POST   /api/enrichment/companies
POST   /api/enrichment/leads
GET    /api/enrichment/jobs/:jobId
```

### Pipeline - Draft Step
```
POST   /api/drafts/generate
GET    /api/drafts
PATCH  /api/drafts/:id
POST   /api/drafts/:id/approve
```

### Pipeline - Send Step
```
POST   /api/campaigns
GET    /api/campaigns
POST   /api/campaigns/:id/start
POST   /api/campaigns/:id/pause
```

### Inbox Page
```
GET    /api/inbox/messages
GET    /api/inbox/messages/:id
POST   /api/inbox/messages/:id/reply
PATCH  /api/inbox/messages/:id
```

### Analytics Page
```
GET    /api/analytics/overview
GET    /api/analytics/campaigns/:id
GET    /api/analytics/pipeline
GET    /api/analytics/export
```

---

**End of Document**

_This inventory should be updated as implementation progresses and requirements evolve._




References
