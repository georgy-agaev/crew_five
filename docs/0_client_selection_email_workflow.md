Here’s a detailed, implementation-oriented description of the workflow for **client selection and first email generation** for your GTM system.

Think of it as a spec for both **UI design** and **backend orchestration**.

---

## 0. High-Level Concept

Goal:  
Help the user go from **“I have a database of companies & contacts”** to **“I have a validated, personalized first email + bump email for a selected cohort and I’m ready to send a campaign”**.

Pipeline:

1. Select companies & contacts from Supabase.
2. Confirm which contacts + emails are usable.
3. Run a coach prompt to create a base email.
4. User reviews & edits → system learns from edits (A/B input).
5. Apply the “offer + angle” to the whole cohort with personalization.
6. User reviews the entire batch (regenerate / cancel / proceed).
7. Generate bump email, review, then either discard or schedule/send.

---

## 1. Step 1 – Client Selection from Supabase

### 1.1 User Interface

**Screen: “Audience Selection”**

Controls:

- **Filters for companies:**
  - `created_at` / `updated_at` (date picker or relative ranges: last 7 days, last 30 days, etc.).
  - `office_quantification` (e.g. number of offices / size buckets: “1–5”, “6–20”, “20+”, or raw numeric).
  - `segment` (dropdown/tags: e.g. SMB, Mid-Market, Enterprise, Industry tags).
  - `registration_date` (company registration date, again date range).
  - `last_outreach_date` (e.g. “never”, “> 90 days ago”, “last 30 days”).
- **Preset filter templates** (quick buttons: “Newly added companies”, “Dormant > 90 days”, etc.).
- **Table view of companies**:
  - Columns: name, segment, registration_date, office_quantification, last_outreach_date, #employees in DB, etc.
  - Multi-select checkboxes for manual inclusion/exclusion.
- **Action button**:
  - `Next: Load Contacts` – triggers query and moves to Step 2.

### 1.2 Backend / Implementation

- The client sends a **filter object** to backend:

  ```json
  {
    "created_at_from": "...",
    "created_at_to": "...",
    "updated_at_from": "...",
    "segment": ["SaaS", "Retail"],
    "office_quantification": { "min": 5, "max": 50 },
    "registration_date_from": "...",
    "last_outreach_before": "...",
    "limit": 500
  }
  ```

- Backend performs a **Supabase query** on the `companies` table with these conditions and returns a paginated list.
- Important: **Store the filter config** as part of a `selection_session` or `campaign_draft` record:
  - So user can later re-run/adjust this audience or clone it.

**Devil’s advocate:**  
If you let the user define too many filters with no guardrails, they’ll either select too few companies or break the UX with slow queries. You’ll probably need:
- A hard **limit** on result size (e.g. 1–5k companies per selection).
- Some **precomputed segments** or views to speed up queries.

---

## 2. Step 2 – Company & Contact Resolution

### 2.1 User Interface

**Screen: “Contacts Review”**

Once companies are selected:

- System automatically fetches all **employees linked to those companies**.
- Show a **Contacts table**:

  - Columns: contact name, title, department, `email_type` (work / generic / missing), LinkedIn URL (if any), company name.
  - Badge:  
    - `Work email verified`  
    - `Generic email`  
    - `No email – needs enrichment`
  - Toggle/filter:
    - Include only contacts with valid work email.
    - Include generic emails as fallback.
    - Show contacts grouped by company.

- User actions:
  - Select/deselect individual contacts.
  - Option to exclude a company completely from this campaign.
  - Button: `Next: Define Offer & Base Email`.

### 2.2 Backend / Implementation

- Supabase relations:
  - `companies` ←→ `employees`
  - `employees.email_type` ∈ {`work`, `generic`, `none`}.
- When this step is loaded:
  - Query `employees` where `company_id IN (selected_companies)` and `status = 'active'`.
  - Compute counts:
    - total contacts, # with work email, # generic only, # without email.
- Store in DB:
  - A `campaign_draft_contacts` table linking `selection_session_id` → `employee_id` + flags (`include_in_campaign`).

**Devil’s advocate:**  
If many contacts still don’t have proper emails, you’re going to waste time later. Long term, it’s more efficient to plug in enrichment at this stage (auto-run email discovery/validation before going to messaging).

---

## 3. Step 3 – Coach Prompt: Offer & Ideal Customer Clarification

### 3.1 User Interface

**Screen: “Coach: Define Your Offer & ICP”**

- This is a conversational UI pane with:
  - Chat window (history of user↔assistant).
  - Structured blocks summarizing:

    - **Offer** (1–2 sentences).
    - **Target persona(s)** (role, industry, company profile).
    - **Key pains / jobs-to-be-done**
    - **Desired call-to-action**.
    - **Tone & style** (formal, casual, punchy, etc.).

- The coach prompt drives questions like:
  - “What exactly are you offering?”
  - “Who inside the target account should care?”
  - “What are the top 2–3 pains you solve?”
  - “What’s the minimal ‘yes’ you want from them in this email?”

- At the end:
  - Show **“Base Email Draft for One Contact”** – generated for a specific “anchor contact” (e.g. the first selected company + first contact).
  - Buttons:
    - `Accept as Base Email`
    - `Edit Manually`
    - `Regenerate with different angle` (e.g. shorter, more direct, etc.).

### 3.2 Backend / Implementation

- Prompt input includes:
  - User’s free-text answers.
  - High-level info about anchor company and contact (industry, size, role, etc.).
- You store:
  - `offer_summary`, `icp_summary`, `email_tone`, `cta` as fields on `campaign_draft`.
  - The generated base email as:
    - `email_version_id`, with metadata: LLM model, prompt template ID, timestamp.

**Devil’s advocate:**  
You can overcomplicate this step with too many questions. People won’t finish. You probably need:
- A **“Quick mode”** (minimal fields, fast email),
- and a **“Guided mode”** (full coach conversation).

---

## 4. Step 4 – User Review & Edit of Base Email + Learning from Edits

### 4.1 User Interface

Still on the same or next screen:

- Editable rich text box with:
  - Subject line.
  - Body (with variables like {{first_name}}, {{company_name}} highlighted or chip-styled).
- Side panel:
  - Summary of the offer & ICP.
  - Preview block: “This email will be adapted for X companies / Y contacts.”

User can:

- Edit subject/body directly.
- Use quick actions:
  - `Shorten`, `Make more formal`, `Add social proof`, `Simplify language`.
- Buttons:
  - `Save & Apply to Cohort`.
  - `Discard and go back to coach`.

### 4.2 Backend / Implementation

When user hits **Save**:

- Store two copies:
  1. **LLM Original** (`email_version_original`).
  2. **User-Edited** (`email_version_user`).

- For A/B learning and pattern analytics you should store:
  - The **diff** between original and edited email:
    - e.g. line-based or token-based diff; store as JSON patches or just raw before/after.
  - Metadata:
    - Which prompt template was used (`pattern_prompt_id`).
    - Who edited (user ID), time, campaign ID.

Later, when campaign results come in (opens, replies, positive replies, etc.), you can:

- Attribute performance to:
  - `pattern_prompt_id`.
  - The **type of edits** user usually makes (e.g. always removing fluff, shortening intros).

**Devil’s advocate:**  
This will only be useful if:
- You **actually track** performance later, and
- You build some mechanism to **feed these learnings back** into prompt templates. Otherwise, you’re just logging noise.

---

## 5. Step 5 – Apply Offer to Full Cohort (Bulk Personalization)

### 5.1 User Interface

**Screen: “Generated Emails for Selection”**

After user confirms the base email:

- System generates a **personalized version for each contact** in the selection.
- Display:
  - A paginated list of emails.
  - For each row:

    - Contact name, role, company.
    - Email subject.
    - Tag: “Generated”.
    - Status: `OK`, `Needs Attention` (e.g. missing first_name), `Skipped (no email)`.

- User can click a row to expand full email body in a side panel.
- A small counter bar at top:
  - `Total emails: 150`
  - `Ready: 138`
  - `Warnings: 8`
  - `Skipped: 4`

- Actions:
  - Bulk select/deselect contacts.
  - Filter by status (`Needs Attention`, `Skipped`, etc.).
  - Button: `Continue to Individual Review` or `Go to Sequence Step 2`.

### 5.2 Backend / Implementation

- For each contact:
  - Apply the base template with variables:
    - {{first_name}}, {{company_name}}, {{industry}}, {{role}}, maybe 1 custom insight if available.
  - Optionally use LLM for micro-personalization:
    - E.g. “Add one line based on their job title and segment.”
- Save each email as:
  - A `campaign_email` record with states: `draft_generated`, etc.
- Mark those with missing critical variables (`first_name`, `email`) as `warning` or `skipped`.

**Devil’s advocate:**  
Full LLM personalization for every single contact can get expensive and slow. You might want:
- Tiered personalization:
  - Top 20 accounts → deep personalization.
  - The rest → lighter merge-field personalization.

---

## 6. Step 6 – Per-Email Refinement & Selection Control

### 6.1 User Interface

Same or next screen:

- User can:
  - Click into any email and:
    - Edit manually.
    - Hit `Regenerate` (LLM reworks the email just for this contact).
  - Bulk actions:
    - `Regenerate with different angle` for a subset (e.g. all CTOs).
    - `Remove from campaign` for specific contacts.

- High-level controls:

  - `Cancel this selection and discard all generated emails`
    - Hard reset for this campaign draft.
  - `Proceed to Bump Email (Step 2 of Sequence)`
    - Locks in the first email copy and the final set of recipients.

### 6.2 Backend / Implementation

States per `campaign_email`:

- `draft_generated` → initial AI output.
- `edited_by_user` → after manual changes.
- `regenerated` → AI re-generation, keep a version history.
- `marked_for_exclusion` → removed from this campaign.

If the user **annuls** the selection:

- Mark the entire `campaign_draft` as `cancelled`.
- Optionally keep a snapshot for analytics, but don’t use it for sending.

**Devil’s advocate:**  
This is where complexity explodes. If you allow infinite micro-edits + regenerations, most users will get stuck polishing instead of sending. You’ll probably want:
- A **visual warning**: “You’ve already edited 20 emails individually; consider sending instead.”
- Or a **guardrail**: maximum individual regenerations per batch before suggesting a fresh campaign.

---

## 7. Step 7 – Bump Email (Follow-Up) Generation & Send

### 7.1 User Interface

**Screen: “Bump Email Setup (Step 2 in Sequence)”**

- Once first email is locked in:
  - User selects delay rules (e.g. send bump after 3 days if no reply).
- Another coach prompt / configuration pane:
  - “What’s the tone of your bump?”
  - “Do you want to reference the previous email explicitly?”
  - “Do you want a shorter CTA / different angle?”

- System generates a **bump email** template:
  - Subject line (maybe a variation referencing previous thread).
  - Body referencing lack of response politely.

- Same pattern as with the first email:
  - User can:
    - Accept / edit bump template.
    - Regenerate if needed.
    - Apply to the same contact list.
  - Show preview of how bump email looks for a couple of sample contacts.

- Final actions:
  - `Discard this batch & start over` (annul sequence creation).
  - `Save sequence & schedule sending` (send both first email + bump based on defined rules).

### 7.2 Backend / Implementation

- Bump email is a **second step in a sequence**:

  - `sequence_id` (e.g. “Cold Outreach – November batch”)
  - `sequence_steps`:
    - Step 1: `email_type = initial`, template + send time / immediate.
    - Step 2: `email_type = bump`, send offset: e.g. `+3 days`, condition: `no_reply`.

- For each `campaign_email` in Step 1:
  - Create corresponding `campaign_email_step2` records for bump with:
    - Link to step 1 email.
    - Condition: “trigger if status in {sent, opened, not replied} by day X, no existing reply thread”.

- At send time:
  - Outbound engine checks conditions and sends only for those that qualify.

**Devil’s advocate:**  
If you don’t connect to real inboxes / reply tracking, the bump logic will be dumb – you’ll send follow-ups to people who already responded manually. You’ll need:
- Inbox integration or at least forwarding + tracking.
- Or accept that in MVP, “bump if no link click or no tracking event” is a crude proxy.

---

## 8. Summary: What the Interface & System Must Support

To implement this process, you **must** support at least:

1. **Audience selection UI + query builder** → filters for date, segment, office_quantification, registration_date, last_outreach.
2. **Contacts resolution & selection UI** → display employees, email types, inclusion flags.
3. **Coach prompt chat interface** → collect offer/ICP, build a structured representation.
4. **Base email editor** → editable template with merge fields, initial AI draft.
5. **Versioning & analytics**:
   - Store LLM original vs user edits.
   - Track diff for A/B test later.
6. **Batch personalization engine** → generates per-contact emails from base template + enrichment.
7. **Email review console** → list/detail views, regenerate per contact, exclude, cancel.
8. **Sequence support**:
   - Step 1: first email.
   - Step 2: bump email with timing & conditions.
9. **State machine in DB** for campaign_draft / campaign_email / sequence_step.
10. **Future-proofing for metrics**:
    - Fields to attach open/click/reply/positive reply metrics back to:
      - pattern_prompt_id
      - email_version
      - user_edit_profile

