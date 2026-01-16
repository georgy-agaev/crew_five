# Workflow 2 – SIM & Replies (PRD Draft)

> Dedicated spec for the Simulation (SIM) workflow: light roast, full persona simulation, and AI-assisted replies.  
> **Implementation status (2025-12-01):** SIM is contract-defined only (Option 2). `sim` jobs and request/response types exist in code, but no SIM modes (W2.v0–v2) are executed yet; all SIM requests resolve to `not_implemented`.

---

## 1. Scope & Goals

**Workflow 2 (SIM & Replies)** covers all functionality related to:

1. Evaluating the **first outreach message** before mass sending (simulation).
2. Providing a structured, persona-based view of how a target recipient might react.
3. Generating **AI-assisted replies** to real inbound emails using the same ICP/persona context.

Key principles:
- SIM is a **hypothesis** about reactions, **not ground truth**.
- The user remains the final decision-maker.
- SIM should be **optional, explainable, and cost-aware**.

---

## 2. Modes & Versions

### W2.v0 – "Super Light" Skeptical Buyer Roast

**Goal:** Cheap and fast sanity check of the offer and first email draft, without enrichment.

- Inputs:
  - Draft email (intro only, or intro + bump).
  - Minimal ICP context (who is the target, what we offer, desired CTA).
- Behavior:
  - LLM assumes the role of a **skeptical buyer**.
  - It aggressively critiques the offer and message:
    - weak spots, vague claims, credibility gaps,
    - likely objections and confusion points,
    - spammy or manipulative-sounding phrases.
- Outputs:
  - List of **objections** and risk flags.
  - Specific suggestions for improving clarity, relevance, and specificity.
  - Optional improved rewrite or suggested edits for key fragments.

**Position in system:**
- Can be invoked directly from Workflow 1 (email coach) or W0 (before SIM).
- Requires no enrichment; cost is mainly LLM tokens.

---

### W2.v1 – Full Persona Simulation (5-Contact Sample)

**Goal:** Use enriched data and structured personas to simulate recipient reactions to the first outreach message before scaling.

This mode assumes a **sample of 5 contacts** taken from a finalized segment (W0.v4) but MUST degrade gracefully if some enrichment signals (e.g., LinkedIn) are missing.

#### 2.1 Inputs

- A finalized segment version (from Workflow 0).
- A sample of **5 employees** from that segment.
- For each employee (where available):
  - LinkedIn profile URL (optional but preferred).
  - Internal company/employee data (from Supabase).
- Draft email(s) to test:
  - at minimum: the first outreach email (intro),
  - optionally: bump or second email.
- ICP context:
  - `icp_profile`, `icp_hypothesis` linked to the segment.

#### 2.2 Phase 1 – Preparation & Validation

System behavior:
- Validate that up to 5 leads are selected; if fewer exist, use all.
- Check for presence of LinkedIn URLs and enrichment state.
- Build a SIM request payload per employee, containing:
  - base CRM data (role, seniority, company, segment info),
  - any existing enrichment (company_research, ai_research_data),
  - the email draft(s),
  - ICP profile & hypothesis metadata.

**Graceful degradation rule:**
- LinkedIn is **preferred but optional**. If no LinkedIn is available:
  - SIM uses only company data, role, and ICP context.
  - The result should explicitly flag: "limited persona due to missing LinkedIn data".

#### 2.3 Phase 2 – Persona Emulation (Enrichment & "Life World")

For each selected employee, the system:

1. **Data enrichment** (where allowed and configured):
   - Collects public data from:
     - LinkedIn (profile, headline, "About"),
     - company website and metadata (industry, size, region, product focus),
     - other configured sources (EXA, Parallel, Firecrawl).
   - Writes results into enrichment fields (e.g. `employees.ai_research_data`, `companies.company_research`).

2. **World modeling (LLM step)**
   - Extrapolates a plausible "life world" of the persona:
     - day-to-day responsibilities,
     - constraints/pressures from the company context,
     - likely communication habits and working style.

3. **Persona attribute generation**
   - Produces a **structured persona object** per employee with fields such as:
     - identity & psychology (self-image, attitude at work),
     - decision style (data-driven / intuition / consensus / hierarchy),
     - communication style (short & direct, detailed, formal vs informal),
     - motivators & KPIs (what success looks like),
     - key pain points,
     - inbox behavior (e.g. zero-inbox, batch reader, ignores cold outreach).

Outputs:
- A normalized persona JSON structure per employee.
- Optional markdown summary for UI display.

#### 2.4 Phase 3 – Inbox Simulation

For each persona + email draft combination, SIM runs an "inbox simulation" composed of multiple agent perspectives:

1. **Inbox attention filter**
   - Would this email catch their attention at all?
   - Likely actions: ignore, skim, read properly, archive, delete.

2. **First impression & emotional reaction**
   - High-level label (e.g. "curious", "skeptical", "annoyed", "neutral", "interested").
   - Short explanation referencing:
     - subject line,
     - opening line,
     - tone, length, jargon/buzzwords.

3. **Business evaluation (KPI fit)**
   - Is the message aligned with the persona's KPIs and priorities?
   - Categorization: **high / medium / low fit**.
   - Assessment of perceived risk vs. reward.

Outputs per employee:
- qualitative narrative of first impression,
- emotional reaction tag,
- business-fit classification,
- a rough probability band for reply (e.g. "very low", "low", "medium", "high"), clearly labeled as **simulated**.

#### 2.5 Phase 4 – Analysis & Recommendations

The SIM engine aggregates per-contact results into actionable insights.

1. **Pain point alignment**
   - Analysis of how well the email addresses identified pain points.
   - Gaps: missing problems, misaligned assumptions, or irrelevant themes.

2. **Objections & risk flags**
   - Likely objections the persona would raise.
   - Risk flags such as:
     - unrealistic promises,
     - unclear ROI,
     - no credible proof,
     - aggressive or spammy wording.

3. **Copy & sales improvements**
   - Concrete suggestions for improving:
     - hook and opener,
     - structure and flow,
     - value proposition articulation,
     - CTA (clarity, friction, perceived risk).

4. **Personalization & deliverability**
   - Ideas for deeper personalization using available enrichment (role, recent company events, etc.).
   - Deliverability heuristics:
     - spam-like phrases,
     - excessive links or tracking,
     - formatting that can lower trust,
     - "reply-blocking" phrases that discourage answer.

5. **Aggregated verdict**
   - For the 5-contact sample as a whole, SIM returns:
     - an aggregated "fit score" for this ICP/hypothesis,
     - a qualitative verdict (e.g. "promising", "risky", "likely ignored"),
     - recommendations on whether to:
       - ship as-is,
       - iterate and re-test,
       - abandon this angle for this ICP.

**Critical note:**
- This verdict MUST be explicitly labeled as **simulation/hypothesis**, not as prediction.
- The UI MUST emphasize that final go/no-go decisions rest with the user.

---

### W2.v2 – AI-Suggested Replies to Real Responses

**Goal:** Use ICP, persona, and SIM context to generate helpful draft replies to real inbound emails.

Inputs:
- Original outbound draft and its metadata:
  - `icp_profile`, `icp_hypothesis`, `pattern_id`, `email_type`.
- Inbound reply body.
- Persona/SIM data if available (optional but preferred).
- Deal/opportunity state (if integrated from CRM).

Behavior:
- Build a reply context that includes:
  - summary of the original offer and value proposition,
  - key concerns the prospect raised (parsed from the reply),
  - persona attributes and likely decision style.
- Generate 1–2 suggested responses that:
  - address objections directly,
  - move the conversation toward a clear next step,
  - match the expected tone and communication style.

Outputs:
- Draft reply text(s).
- Optional rationale: why this approach, what it optimizes for.
- Metadata: `suggested_by_agent`, timestamps, and flags for later analytics.

UX:
- User sees a list of replies per campaign/segment.
- Clicking an item opens:
  - the original email,
  - the lead's reply,
  - suggested answer(s),
  - any relevant SIM/persona summary.
- User can accept, edit, or discard suggestions.
- All edits are logged as `user_edited` signals for analytics.

---

## 3. Architecture, Cost & Latency

### 3.1 High-Level Architecture

- SIM is exposed as an internal service or agent workflow that:
  - receives a structured SIM request (mode, inputs, context IDs),
  - orchestrates enrichment and LLM calls,
  - returns structured SIM results + human-readable summaries.
- Workflow 0 and 1 **call** SIM; they do not reimplement SIM logic.

### 3.2 Cost & Latency Considerations

Full SIM (W2.v1) is **expensive** compared to a simple prompt call:
- Up to 5× enrichment lookups (LinkedIn, EXA/Parallel/Firecrawl).
- Multi-step LLM pipeline (persona → inbox simulation → analysis).

Non-functional requirements:
- SIM requests MAY be queued and processed asynchronously.
- The UI SHOULD:
  - indicate when SIM is running and when new results arrive,
  - allow the user to move on and come back later.

### 3.3 Batching & Asynchronous Execution

- SIM for 5 contacts SHOULD be executed as a single **batched job**, not 5 completely separate runs.
- System MUST support a simple job lifecycle:
  - `created → running → completed / failed`.
- Partial results (e.g., 3 of 5 personas done) MAY be surfaced incrementally, but this is optional.

### 3.4 Caching Strategy

To reduce cost and latency, the system SHOULD cache:
- **Company-level enrichment**:
  - company research, website summaries, industry descriptors.
- **Persona-level enrichment**:
  - LinkedIn-derived features and stable persona traits.
- **Inbox behavior profile**:
  - once inferred, can be reused across multiple email tests for the same person.

Rules:
- Cached data MUST have a TTL and/or manual invalidation option.
- SIM runs SHOULD reuse cached data whenever possible and avoid repeated scraping.

---

## 4. Limitations, Risks & Decision Rights

### 4.1 SIM is a Model, Not Reality

We explicitly acknowledge:
- SIM reflects an LLM-based approximation of human reactions.
- It is sensitive to prompt design, training biases, and imperfect enrichment.

Therefore:
- SIM outputs MUST always be presented as **hypotheses**, not promises.
- Product copy, tooltips, and documentation MUST avoid language that implies guaranteed performance.

### 4.2 User as Final Decision-Maker

- The user decides whether to:
  - send, iterate, or discard an email based on SIM feedback plus real-world goals.
- Workflow AN (analytics) provides **actual** performance metrics (open/reply rates, positive responses) that can:
  - confirm or falsify SIM expectations,
  - guide iterative improvements.

### 4.3 Overfitting to the Model

Risk:
- If the team optimizes purely for "what the SIM likes", messaging may drift away from what real buyers respond to.

Mitigations:
- Combine SIM with **real-world metrics** from AN.v1.
- Periodically compare:
  - simulated predictions vs. actual outcomes,
  - adjust SIM prompts and weighting when strong divergence is observed.
- Keep a simple, model-agnostic baseline (e.g. historical ICP learnings) as a reference.

---

## 5. Integration with Analytics (AN)

- SIM events (runs, modes, results) MUST be logged and linked to:
  - segments,
  - ICP profiles & hypotheses,
  - patterns,
  - campaigns and drafts.
- Analytics layer (AN.v1/v2) SHOULD:
  - correlate SIM outputs (fit scores, verdicts) with real-world performance,
  - highlight where SIM is predictive vs. misleading,
  - provide feedback to improve SIM prompts and logic over time.

This ensures SIM remains a **useful decision support tool**, not a black box or oracle.
