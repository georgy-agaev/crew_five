# ICP Discovery & Prospect Expansion Flow (Exa + AnySite)

## 1. Purpose of This Flow

Add an **“intelligent similar-customer discovery layer”** on top of the existing outreach system:

1. A coach-prompt talks with the user and extracts descriptions of existing / ideal customers (ICP) and buying personas.
2. It converts these into **structured ICP profiles** and **search hypotheses**.
3. These hypotheses are used to query **Exa Websets** to discover similar companies and potential buyers at scale.
4. Integration with **Exa MCP Server** allows all of this to be done directly from the AI environment (Claude / Code Agents / CodeX CLI etc.).
5. For the discovered contacts, the system enriches data with e-mails and LinkedIn profiles.
6. The enriched leads are written into the existing Supabase database and passed into the **already implemented personalized sequence engine** (email + LinkedIn).
7. For LinkedIn content and additional research, the system can use **AnySite.io API or AnySite MCP**.

---

## 2. Main Actors

- **User (AE / SDR / Founder)** – describes existing customers or target ICP.
- **Coach Prompt** – runs a dialog, clarifies and structures ICPs and hypotheses.
- **ICP Discovery & Prospect Expansion Agent** – converts ICPs into search queries and orchestrates calls to external tools.
- **Exa MCP Server** – performs high-compute Websets searches across the web.
- **AnySite API / MCP** – extracts data from LinkedIn and other web sources for enrichment and content insights.
- **Existing Outreach System** – Supabase DB, campaign and sequence logic, email / LinkedIn orchestration.

---

## 3. High-Level User Scenario

1. User starts an **“ICP Definition Session”** inside the system.
2. Coach-prompt runs a structured conversation and extracts:
   - Current customers (best deals, ideal accounts),
   - Ideal target accounts (by industry, size, geography, etc.),
   - Buyer personas and triggers.
3. The system converts the input into **structured ICP profiles** and **search hypotheses**.
4. User can review and edit these ICPs and hypotheses.
5. Coach-prompt offers:
   > “Do you want me to search for similar companies and buyers based on these ICPs?”
6. On confirmation, the ICP Discovery Agent generates Websets queries and calls **Exa MCP**.
7. The system receives clusters of candidate companies and contacts, scores them by relevance, and shows a **preview UI** where user can filter / approve which data to import.
8. After approval, the data is enriched (emails, LinkedIn, social / content signals), stored in Supabase, segmented into campaigns, and fed into the existing **personalized sequence generator**.

---

## 4. Detailed Flow Breakdown

### 4.1. Coach Prompt: Extracting ICPs and Hypotheses

**Goal:** Turn vague verbal descriptions into structured, machine-usable ICPs and hypotheses.

Typical raw description:
> “We sell to AV integrators who build meeting rooms for mid-size and large enterprises.”

The coach-prompt must push the user to a **structured ICP format**:

- **Company-level ICP (Account-level)**
  - Industry / segment
  - Size (revenue range, employee count)
  - Geography
  - Business model (SaaS, reseller, integrator, VAR, etc.)
  - Tech stack / collaboration stack (e.g. MS Teams Rooms, Zoom, Webex)

- **Buyer Personas (Contact-level)**
  - Titles / role types (e.g. Head of AV, IT Director, Collaboration Lead)
  - Function (IT, AV, procurement, facilities)
  - Key pains and responsibilities

- **Hypotheses**
  - Examples:
    - “AV integrators who actively implement Microsoft Teams Rooms.”
    - “Companies that recently opened new offices and built meeting rooms.”

**Output:** a normalized JSON-like structure for each ICP and persona, including a list of search hypotheses linked to that ICP.

---

### 4.2. Converting ICPs into Exa Websets Queries

Each ICP and hypothesis is transformed into 2–3 Websets-style query types:

1. **Company-level queries**
   - Example:
     > “B2B AV integrators specializing in meeting room solutions and Microsoft Teams Rooms, Europe, case studies, customer stories.”

2. **Persona-level queries**
   - Example:
     > “Head of AV, AV Director, Collaboration Lead at AV integrators and IT service companies.”

3. **Trigger-based queries**
   - Example:
     > “IT infrastructure upgrades, office relocation, meeting room modernization projects, RFPs for video conferencing.”

The agent automatically adds:
- Filters by language,
- Region / country,
- Content type (case studies, company pages, press releases, job posts, etc.),
- Time window (for recency, if needed).

The user does **not** see this technical structure; they only see the ICP and an estimate of how many accounts may be found.

---

### 4.3. Integration with Exa via MCP

We integrate **Exa MCP Server** into the existing AI orchestrator:

- Define `mcp-server-exa` in the config (e.g. `config.toml`) with:
  - Command or remote URL for Exa MCP server,
  - API tokens in environment variables.
- Expose a minimal set of tools to the agents, e.g.:
  - `exa_websets_search` – main high-compute Websets search.
  - Optionally: `exa_research` / `exa_answer` – to summarize key findings for each ICP.

The **ICP Discovery Agent**:
1. Takes structured ICP + hypotheses.
2. Builds a batch of Websets queries.
3. Calls `exa_websets_search` via MCP.
4. Receives result sets containing:
   - URLs,
   - Text snippets / context,
   - Sometimes structured hints (company name, domain, keywords, etc.).

---

### 4.4. Matching and Writing to the Existing Database

Pipeline for handling Exa results:

1. **Parsing Exa Results**
   - Extract:
     - Company name,
     - Domain,
     - Industry / vertical (if detectable),
     - Geography (if mentioned),
     - Size indicators (employee count, revenue, phrases like “global”, “mid-market”),
     - Any person names / titles found on the page.

2. **Deduplication & Matching**
   - Match companies by:
     - Domain (primary key),
     - Fuzzy match on company name.
   - If company exists: update fields, add new contacts.
   - If company does not exist: create a new record.

3. **Source & Context Flags**
   - Store metadata, e.g.:
     - `source = "exa_websets"`,
     - `icp_id`,
     - `hypothesis_id`,
     - `confidence_score` (e.g. 0.0–1.0 with step 0.1),
     - `raw_exa_snippet` or URL for traceability.

4. **Pre-import Review UI**
   - Before final commit to the DB, present to the user:
     - List of candidate companies,
     - Basic fields (name, domain, country, size, tags),
     - Optional filters (country, size, industry, confidence threshold).
   - The user can:
     - Select all / deselect noisy entries,
     - Confirm import.

---

### 4.5. Contact Enrichment: E-mail + LinkedIn

For each company and candidate person:

1. We may already have some contacts from Exa or from the existing DB.
2. Enrichment agent runs two parallel tracks:

   - **Email enrichment & validation** (existing providers – the same as in the current system).

   - **LinkedIn & social enrichment via AnySite**:
     - For a given `person_name + company_name` (or domain), call AnySite API / MCP to:
       - Find LinkedIn profiles,
       - Extract headline, position, location,
       - Optionally pull recent posts / activity for personalization.

3. Synchronized writes to Supabase:
   - Update contact records with:
     - `email`, `email_status` / `email_verified`,
     - `linkedin_profile_url`,
     - `linkedin_headline`,
     - `has_recent_posts` flag,
     - `social_source = "anysite"`.

---

### 4.6. Hand-off to Sequences and Campaigns

At this point, for each ICP/hypothesis we have:

- A list of accounts with:
  - Clear ICP tag,
  - Source (Exa),
  - Basic firmographics.
- A list of contacts with:
  - Emails (validated where possible),
  - LinkedIn profiles,
  - Partial social / content context.

This plugs into the existing campaign layer:

1. System can automatically create a **new campaign** for each ICP or hypothesis, or attach leads to an existing campaign.
2. Coach-prompts that you already use for **email / LinkedIn sequence generation** take as input:
   - ICP description,
   - Hypothesis (why they are a good fit),
   - Exa snippets (company context, case studies, news),
   - AnySite snippets (social posts / topics of interest).
3. The result is a set of:
   - Email sequences (multistep),
   - LinkedIn messages (connection request + follow-ups),
   - Optionally content topics for the sales rep / founder’s personal LinkedIn.

---

### 4.7. LinkedIn Content Generation via AnySite

Separate but connected flow:

1. User chooses an ICP segment to “warm up” via content.
2. Content Agent uses AnySite to:
   - Look at what ICP leaders and prospects are posting (topics, vocabulary, angles).
   - Identify recurring themes, pains, and viewpoints.
3. Coach-prompt proposes:
   - A list of content themes (e.g. “meeting room reliability”, “hybrid work fatigue”, “AV/IT alignment”).
   - Draft LinkedIn posts adapted to the user’s tone and position.
4. Publication remains manual for now (no heavy automation on LinkedIn posting to avoid compliance issues). The system just:
   - Generates drafts,
   - Keeps track of which ICP and hypothesis each post supports.

---

## 5. Integration Points with Current Architecture

### 5.1. Database (Supabase)

Extend the existing schema with at least:

- **Companies**
  - `source` (enum: `manual`, `import`, `exa_websets`, `partner`, etc.),
  - `icp_id` (nullable, FK to ICP table),
  - `hypothesis_id` (nullable),
  - `confidence_score` (float),
  - optional `exa_metadata` (JSON).

- **Contacts**
  - `source` (same enum),
  - `icp_id` / `hypothesis_id` (nullable),
  - `email_status` (`valid`, `invalid`, `catch_all`, etc.),
  - `linkedin_profile_url`,
  - `linkedin_headline`,
  - `has_social_insights` (bool),
  - optional `social_metadata` (JSON from AnySite).

- **ICP / Hypotheses**
  - Dedicated tables storing structured ICP and persona definitions.

### 5.2. MCP Layer

- Already have: **Supabase MCP**.
- Add:
  - `exa-mcp-server` (for Websets & research),
  - `anysite-mcp` (for LinkedIn / social / web scraping) when credentials are available.

Each agent only sees the tools it actually needs (principle of least power) to reduce complexity and errors.

### 5.3. Agent Orchestrator

Introduce a distinct agent:

- **“ICP Discovery & Prospect Expansion Agent”**
  - Responsibilities:
    - Run the ICP Definition Session together with the coach-prompt.
    - Maintain structured ICP / persona / hypothesis objects.
    - Build and execute Exa Websets queries via MCP.
    - Coordinate enrichment via AnySite and email providers.
    - Write normalized data into Supabase.

This agent then hands off to:
- **Sequence Generation Agents**,
- **Outreach Orchestrator** (which already exist in your system).

---

## 6. Devil’s Advocate: Risks, Trade-offs, and Complexity

This flow is powerful, but there are real risks and trade-offs.

### 6.1. Garbage In → Garbage Out (Weak ICP Definitions)

If the user gives fuzzy or contradictory ICP input, Exa will surface fuzzy results.

Mitigation:
- Very strict ICP questioning by the coach-prompt.
- Use predefined ICP templates with concrete examples.
- Add built-in validation:
  - e.g. “You defined ICP as ‘mid-market’, but the revenue range is 10–20M only. Confirm or adjust?”

### 6.2. Noise and Irrelevance from Websets

Websets can produce a lot of noisy pages and borderline-relevant companies.

Mitigation:
- Strong post-filtering by:
  - domain patterns,
  - language,
  - geography,
  - presence of certain keywords.
- Maintain blocklists for obviously irrelevant domains.
- Use a simple relevance scoring model and hide low-score entries by default.
- Require human approval of the batch before DB import.

### 6.3. LinkedIn and Compliance

AnySite solves part of the “screen scraping” problem, but you still must:
- Respect rate limits and daily volume caps.
- Avoid building a spam machine on top of LinkedIn.
- Keep the automation focused on **research and drafting**, not fully automated LinkedIn posting or mass invites (at least in MVP).

### 6.4. Stack Complexity (MCP + Multiple APIs + DB)

Risk: over-engineering the architecture too early.

Mitigation for MVP:
- Start with a **very small tool surface**:
  - One Exa MCP tool (`exa_websets_search`).
  - One AnySite tool (`anysite_linkedin_search`) or even just raw HTTP calls.
  - One dedicated ICP Discovery Agent.
- Allow **CSV export/import** as a backup path if Supabase integration or enrichment fails.

### 6.5. Cost of External Calls

Websets and enrichment APIs cost money.

Mitigation:
- Always estimate volume before running full search:
  - “This may discover ~3,500 companies. Limit to 300 for this run?”
- Cap the number of companies per ICP in settings.
- Track cost per campaign and per booking to later evaluate ROI.

---

## 7. MVP vs. Later Phases (Optional Outline)

**MVP (Phase 1)**
- Coach-prompt for ICP and persona extraction.
- Basic ICP table and links to companies / contacts.
- Integration with Exa MCP for simple Websets queries.
- One-step pre-import review and write to Supabase.
- Email enrichment + minimal LinkedIn URL enrichment.
- Hand-off to existing email sequence engine.

**Phase 2**
- Full AnySite integration with:
  - LinkedIn headline / posts ingestion,
  - Thematic clustering for content.
- More advanced ranking and de-duplication logic.
- Better UI for batch review and segmentation.

**Phase 3**
- Feedback loop from campaign performance:
  - Learn which ICPs and hypotheses actually work.
  - Prioritize successful hypotheses in future searches.
- More advanced analytics on cost per acquired meeting per ICP.
- Optional: semi-automated LinkedIn content calendar linked to ICPs.

