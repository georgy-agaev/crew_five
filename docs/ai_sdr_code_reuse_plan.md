# Code Reuse Plan for AI SDR / GTM Assistant

This document summarizes which open‑source projects you can safely borrow code from, which you should only use as architectural inspiration, and where copying becomes a liability. It also includes direct source links.

---

## 1. Projects You Can Safely Borrow Code From

### 1.1 SalesGPT – “Sales Brain” for Stage‑Aware Logic

- **Repo:** https://github.com/filip-michalsky/SalesGPT
- **Typical License:** MIT (check the repo’s `LICENSE` file to confirm).

**What to reuse directly:**

- The core `SalesGPT` agent class and related modules that implement:
  - Sales **stage tracking** (intro / discovery / objection handling / closing, etc.).
  - Management of **customer profile**, **product knowledge**, and **conversation history**.
- Prompt templates and system prompts used for:
  - Objection handling.
  - Next‑step recommendations.
  - Stage‑aware behavior.

**How to plug it into your project:**

- Add `salesgpt` (or the relevant modules) as a dependency.
- Wrap it inside your own “Coach Agent” so that your system can call SalesGPT to:
  - Propose stage‑aware email drafts.
  - Generate lists of likely objections.
  - Suggest next steps in a sequence (e.g., follow‑up angle, qualification questions).
- Replace their tools with yours:
  - Your LLM provider (OpenAI / local model).
  - Your data sources (Supabase, ICP definitions).
  - Your execution layer (Smartlead, CRM APIs).

**Key idea:** treat SalesGPT as a **drop‑in “sales reasoning engine”** that you adapt to your own MCP + Supabase + Smartlead architecture.

---

### 1.2 AI Sales Assistant Chatbot – RAG + Backend Skeleton

- **Repo:** https://github.com/christancho/ai-sales-assistant-chatbot  
- **Typical License:** MIT (again, confirm in the repo).

**What to reuse directly:**

- **Backend structure** (commonly FastAPI):
  - API endpoints for chat, lead capture, and possibly webhooks.
- **RAG stack:**
  - Schema and code to store documents, chunks, and embeddings (Postgres + pgvector).
  - Scripts/utilities for:
    - Ingesting documents (battlecards, FAQs, case studies, call transcripts).
    - Creating embeddings and storing them in the DB.
    - Retrieving relevant chunks given a query.
- **Lead‑qualification logic**:
  - Patterns for extracting structured lead info and intent scores from unstructured text.

**How to adapt it to your stack:**

- Point the DB layer at **Supabase Postgres + pgvector** instead of a local Postgres instance.
- Strip out Mailgun / built‑in email sending; you already have/want **Smartlead** as the outreach engine.
- Use this module purely as your **GTM knowledge service** that powers:
  - Coach prompts (pull relevant product/case details before writing emails).
  - SIM (persona/world modelling with real GTM knowledge).
  - Internal GTM copilot (“what’s our best wedge for ICP X?”).

**Key idea:** this saves you from reinventing a full RAG pipeline; you just adapt it to Supabase and your embedding provider.

---

## 2. Projects to Use as Design Docs, Not Code Sources

### 2.1 Sales Outreach Automation with LangGraph

- **Repo:** https://github.com/kaymen99/sales-outreach-automation-langgraph

This is architecturally strong but currently has **no explicit open license** in the repo. Without an explicit MIT/Apache‑style license, you should treat it as **“all rights reserved”** by default.

**Use as a specification, not a codebase:**

- Mirror the overall flow in your own technology stack:
  - `Fetch leads → Enrich (LinkedIn / website / news) → Qualify → Generate report → Draft email → Update CRM`.
- Recreate the same logical nodes using:
  - CrewAI / Code Agents for orchestration.
  - MCP servers for Supabase, Smartlead, Exa, etc.
- Translate their prompts and graph structure into your own agents and tools instead of copying source files.

**What to copy conceptually:**

- Separation of concerns:
  - Distinct steps for CRM read, research, analysis, email drafting, CRM write‑back.
- Prompt patterns:
  - Research summaries.
  - Qualification reports.
  - Email drafts and follow‑up plans.
  - Question lists (SPIN‑style interviews, discovery questions).

**Key idea:** this repo is an excellent **blueprint**, but you should reimplement its ideas in your stack instead of copying code.

---

### 2.2 AI‑SDR (n8n Workflow)

- **Repo:** https://github.com/AntraTripathi74/AI-SDR

Again, there is no explicit license file; treat it as **reference material**, not a code source for your commercial product.

**How to use it sensibly:**

- Import the `sdr.json` workflow into a private n8n instance **for experimentation only**.
- Study the end‑to‑end pattern:
  - Google Search → LinkedIn scraping → Google Sheets → Gemini qualification → Gmail outreach.
- Use the learnings to design your own equivalent pipeline in:
  - Supabase (as DB).
  - Code Agents / MCP (as orchestrator).
  - Smartlead (as email engine).

**What not to do:**

- Don’t ship this JSON or derivative workflows as part of your product artifacts.
- Don’t rely on n8n as your “real” production orchestrator if your core architecture is Code Agents + MCP.

**Key idea:** treat it as a **test harness and example of a full SDR chain**, not a component you ship.

---

## 3. Generic Agent Frameworks and Blueprints

Frameworks like LangGraph, CrewAI, AutoGen, SuperAGI, and GoalChain often come with examples under permissive licenses (MIT / Apache 2.0). Always check the `LICENSE` file per repo.

For your project:

- You’re already using **CrewAI + MCP + Code Agents**.  
- Use other frameworks’ repos primarily to steal **ideas**:
  - How they implement resumable graphs.
  - How they model agent state and tools.
  - How they implement goal‑oriented workflows.

Avoid rewriting your stack around a new framework unless there’s a hard, quantified reason.

---

## 4. Concrete “Copy This, Not That” Plan

If you want to move faster *and* stay on the right side of licensing and maintainability:

### 4.1 Copy/Reuse Directly

1. **From SalesGPT**  
   - Import the library, and/or copy core classes with MIT license headers intact.  
   - Use it for:
     - Stage‑aware sales reasoning.
     - Objection handling.
     - Conversation state management.

2. **From AI Sales Assistant Chatbot**  
   - Copy the RAG and backend scaffolding (DB models, embedding logic, basic APIs), preserving the MIT license notice.  
   - Rewire it to:
     - Supabase instead of local Postgres.
     - Your embedding provider (OpenAI, local model, etc.).
     - Your outreach layer (Smartlead, not Mailgun).

### 4.2 Reimplement From Scratch, Using Their Designs

1. **Sales Outreach Automation (LangGraph)**  
   - Transcribe the flow and prompts into your own agent graph using CrewAI/Code Agents.  
   - Keep the *structure*; change the implementation.

2. **AI-SDR (n8n)**  
   - Use `sdr.json` and the workflow as a checklist of steps (search → enrich → qualify → outreach).  
   - Implement your own version with your tools and DB.

### 4.3 What to Watch Out For

Even with MIT‑licensed code:

- **Tech debt inheritance:** you take on their assumptions, structure, and bugs.
- **Design lock‑in:** don’t let foreign code dictate your ICP or channel model.
- **Security & PII:** sanitize inputs, log safely, and handle personal data properly (emails, LinkedIn URLs, call notes).
- **License drift:** always re‑check upstream `LICENSE` files before going to production; repos can change licenses over time.

---

## 5. Minimal Winning Set

If you restrict yourself to the smallest set of repos that really accelerate you:

1. **SalesGPT** – as a plug‑in sales reasoning engine.  
   - https://github.com/filip-michalsky/SalesGPT

2. **AI Sales Assistant Chatbot** – as your RAG + backend starting point.  
   - https://github.com/christancho/ai-sales-assistant-chatbot

3. **Your own PRD & coach prompts** – as the non‑negotiable source of truth.  

Everything else (Sales Outreach Automation, AI-SDR) lives in the “design inspiration” folder.

