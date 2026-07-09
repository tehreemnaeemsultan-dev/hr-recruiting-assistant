# HR Recruiting Assistant — Build Specification

**For:** Claude Code
**Owner:** single recruiter (internal tool, not multi-tenant)
**Status:** build brief. No application code is written in this document — Claude Code writes the code, phase by phase.

---

## 0. How to use this file in Claude Code

1. Save this file as `SPEC.md` in the root of a new empty project folder.
2. Open Claude Code in that folder.
3. Tell Claude Code: *"Read SPEC.md. Start with Phase 0 only. Stop when Phase 0's acceptance criteria are met and let me confirm before continuing."*
4. Build **one phase at a time**. Do not start a later phase until the current phase runs locally and its acceptance criteria pass.
5. Whenever a phase needs a secret (API key, client secret), **stop and ask the owner for it** — never invent or hardcode secrets, and never commit them.
6. After Phase 0, create a `CLAUDE.md` in the repo capturing the conventions in section 11 so they persist across sessions.

**Prerequisite:** Node.js must be installed (Claude Code and Next.js both require it).

**Golden rule:** this is a single-user internal tool. Do not over-engineer. No team roles, no org/workspace model, no billing, no complex RBAC. Simple and reliable beats clever.

---

## 1. What we are building

A private web app that helps one recruiter do five things:

1. **Rank CVs against a job** — paste a job description, add free-form criteria, upload PDF CVs, get a ranked shortlist with reasons.
2. **Manage candidates on a pipeline board** — a Kanban board; drag candidates between stages.
3. **Source candidates from LinkedIn** — search by role + filters, pull matching public profiles in for review.
4. **Email candidates** — send outreach and rejection emails from the recruiter's own Zoho mailbox.
5. **Schedule interviews** — create a Google Calendar event with a Google Meet link and invite the candidate.

Automation is driven by **stage changes**: moving a candidate to an interview stage triggers scheduling + email; moving to rejected triggers a rejection email.

---

## 2. Locked decisions (do not revisit)

- **Single user only.** One account (the owner). No sign-up flow for others, no team features.
- **Region:** roles and candidates are primarily Pakistan-based. Handle candidate data carefully (see section 10) but no multi-jurisdiction compliance engine is needed.
- **Ranking criteria are free-form text, entered per job.** The recruiter types criteria in plain language for each job (e.g. "5+ years B2B SaaS sales, fluent English, based in or near Islamabad"). Do **not** build a fixed weighted-field system.
- **Framework:** Next.js (App Router) + TypeScript, one unified full-stack app.
- **UI:** shadcn/ui + Tailwind CSS.
- **Backend/data:** Supabase — Postgres, Auth, Storage, Realtime, Row-Level Security.
- **Deploy target:** Vercel.
- **LinkedIn:** Apify, **cookieless actors only** (see section 8.1). Never use cookie/session-based actors. Never automate LinkedIn messaging.
- **Email:** Zoho Mail REST API over OAuth 2.0.
- **Scheduling:** Google Calendar API with Meet link generation, over OAuth 2.0.
- **CV scoring engine:** Anthropic API (Claude), returning strict JSON.

---

## 3. Tech stack and libraries

- Next.js (latest stable, App Router, server components by default) + TypeScript (strict mode).
- Tailwind CSS + shadcn/ui.
- Supabase: `@supabase/supabase-js` and `@supabase/ssr` for auth in Next.js.
- Anthropic: `@anthropic-ai/sdk`.
- PDF text extraction: a Node-friendly library (e.g. `pdf-parse` or `unpdf`); pick one and standardise.
- Drag-and-drop for the board: `@dnd-kit/core` (or shadcn-compatible equivalent).
- Optional background jobs (only if/when needed, Phase 5+): Inngest or Trigger.dev. Not required for the MVP.

**Anthropic model guidance (confirm current names before coding at https://docs.claude.com/en/api/overview):**
- Default for CV scoring: **Claude Sonnet 5** (`claude-sonnet-5`) — good balance of quality and cost.
- High-volume / cheaper option: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`).
- Hardest reasoning if ever needed: **Claude Opus 4.8** (`claude-opus-4-8`).
- Get structured JSON out reliably via **tool use**: define a single tool whose `input_schema` is the scoring schema (section 9), and set `tool_choice` to force that tool. Do not rely on free-text JSON parsing.
- API reference: https://docs.claude.com/en/api/overview · docs map: https://docs.claude.com/en/docs_site_map.md

---

## 4. Environment variables

Create `.env.local` for local dev and mirror everything in Vercel project settings. Never commit `.env*`. Introduce each variable in the phase that first needs it.

| Variable | Phase | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 0 | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 0 | Supabase anon (client) key |
| `SUPABASE_SERVICE_ROLE_KEY` | 0 | server-only Supabase key (never exposed to client) |
| `APP_URL` | 0 | base URL, used for OAuth redirects and webhooks |
| `ANTHROPIC_API_KEY` | 1 | Claude API key for scoring |
| `ZOHO_CLIENT_ID` | 3 | Zoho OAuth app client id |
| `ZOHO_CLIENT_SECRET` | 3 | Zoho OAuth app client secret |
| `ZOHO_REDIRECT_URI` | 3 | Zoho OAuth callback URL |
| `GOOGLE_CLIENT_ID` | 4 | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | 4 | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | 4 | Google OAuth callback URL |
| `APIFY_TOKEN` | 5 | Apify API token |
| `APIFY_WEBHOOK_SECRET` | 5 | shared secret to verify Apify webhook calls |
| `TOKEN_ENCRYPTION_KEY` | 3 | key used to encrypt stored OAuth refresh tokens at rest |

Provider OAuth refresh tokens (Zoho, Google) are stored in the database **encrypted** using `TOKEN_ENCRYPTION_KEY`, not in plaintext.

---

## 5. Data model

Postgres via Supabase. All tables owned by the single user; enable Row-Level Security and restrict every table to the authenticated owner. Use `uuid` primary keys and `timestamptz` for time columns.

- **jobs** — `id`, `title`, `jd_text` (the pasted job description), `criteria_text` (free-form), `status` (`open` | `closed`), `created_at`, `updated_at`.
- **candidates** — `id`, `full_name`, `email` (nullable), `phone` (nullable), `source` (`upload` | `linkedin`), `linkedin_url` (nullable), `resume_path` (Supabase Storage path, nullable), `parsed` (jsonb: extracted fields), `raw_text` (extracted CV or profile text), `created_at`.
- **applications** — links a candidate to a job. `id`, `job_id` (fk), `candidate_id` (fk), `stage` (see enum), `score` (int 0–100, nullable until scored), `score_breakdown` (jsonb), `score_summary` (text), `notes` (text), `created_at`, `updated_at`. Unique on (`job_id`, `candidate_id`).
- **events** — the audit + timing log. `id`, `application_id` (fk), `type` (e.g. `stage_changed`, `email_sent`, `interview_scheduled`, `candidate_added`), `from_stage` (nullable), `to_stage` (nullable), `payload` (jsonb), `created_at`. **Write a row here on every stage change and every automated action from Phase 2 onward** — this powers the analytics in Phase 6 with no retrofitting.
- **emails** — `id`, `application_id` (fk), `to_address`, `subject`, `body`, `provider` (`zoho`), `status` (`sent` | `failed`), `provider_message_id` (nullable), `created_at`.
- **interviews** — `id`, `application_id` (fk), `google_event_id`, `meet_url`, `scheduled_start` (timestamptz), `scheduled_end` (timestamptz), `status` (`scheduled` | `cancelled`), `created_at`.
- **integration_tokens** — `id`, `provider` (`zoho` | `google`), `access_token_enc`, `refresh_token_enc`, `scope`, `expires_at`, `account_id` (e.g. Zoho account id), `updated_at`. One row per connected provider.

**Stage enum (Postgres enum or check constraint):** `new`, `screening`, `interview_1`, `interview_2`, `hired`, `rejected`.

---

## 6. App structure

**Pages (App Router):**
- `/login` — Supabase auth (email magic link or email+password). Single owner.
- `/` — dashboard: list of jobs, quick stats.
- `/jobs/new` — create a job (title, JD text, free-form criteria).
- `/jobs/[id]` — job detail: JD + criteria, CV upload area, ranked candidate list, link to board.
- `/jobs/[id]/board` — Kanban board for this job (columns = stages).
- `/candidates/[id]` — candidate detail: parsed info, resume/profile, score breakdown, email history, interview info, notes.
- `/settings/integrations` — connect/disconnect Zoho and Google; enter/store Apify token.

**Server:**
- Server actions for all CRUD (jobs, candidates, applications, notes, stage moves).
- API routes for things that must be endpoints:
  - `POST /api/apify/webhook` — receives Apify run-finished callbacks (Phase 5).
  - `GET /api/oauth/zoho/callback` and `GET /api/oauth/google/callback` — OAuth redirects (Phases 3–4).
- Keep all third-party API calls and secrets **server-side only**.

---

## 7. Build phases (with acceptance criteria)

### Phase 0 — Foundation
**Build:** Next.js + TypeScript + Tailwind + shadcn initialised; Supabase project connected; the full schema from section 5 created via migration; RLS enabled and locked to the owner; Supabase auth working; the app skeleton deployed to Vercel.
**Acceptance:** owner can log in; empty dashboard renders locally and on the deployed Vercel URL; all tables exist with RLS on; no secrets in the repo.
**Out of scope:** any feature logic.

### Phase 1 — JD + CV ranking (this is the MVP)
**Build:** create-a-job form (title, JD, free-form criteria); CV upload (PDF, multiple, stored in Supabase Storage); server-side PDF text extraction into `candidates.raw_text`/`parsed`; scoring each candidate against the job via the Anthropic API using the section-9 contract; store `score`, `score_breakdown`, `score_summary` on `applications`; ranked list view (highest score first) with per-criterion breakdown and short reasoning; ability to re-run scoring.
**Acceptance:** owner pastes a JD + criteria, uploads several PDFs, and sees a ranked list with scores and reasons within a reasonable time; scores are stored and survive reload; malformed/empty PDFs are handled gracefully (flagged, not crashing).
**Out of scope:** the board, email, scheduling, LinkedIn.

### Phase 2 — Pipeline board
**Build:** Kanban board at `/jobs/[id]/board` with columns for each stage; drag-and-drop between stages; each card shows name + score + source; candidate detail page; notes; **write an `events` row on every stage change**; use Supabase Realtime so the board reflects changes live.
**Acceptance:** owner can drag a candidate across all stages; the move persists and logs an `events` row with from/to stage and timestamp; the board updates without a manual refresh.
**Out of scope:** any action triggered by a move (that's Phases 3–4).

### Phase 3 — Email from Zoho
**Build:** `/settings/integrations` Zoho connect flow (OAuth 2.0, section 8.2); store encrypted tokens in `integration_tokens`; a compose/send action that sends from the owner's Zoho mailbox and logs to `emails`; simple reusable templates (outreach, rejection) with placeholders (candidate name, job title); wire the **rejected** stage to offer/send a rejection email.
**Acceptance:** owner connects Zoho once; can send a templated email to a candidate; the email arrives; a row is written to `emails` with status; moving a candidate to rejected prompts/sends the rejection email and logs an `events` row.
**Out of scope:** inbound reply tracking (later).

### Phase 4 — Interview scheduling (Google Calendar + Meet)
**Build:** Google connect flow (OAuth 2.0, section 8.3); when a candidate is moved to an interview stage, create a Google Calendar event **with a Meet link** and invite the candidate by email; store the event id + Meet URL in `interviews`; show the interview on the candidate detail page; log an `events` row.
**Acceptance:** owner connects Google once; moving a candidate to `interview_1` creates a real calendar event with a Meet link, invites the candidate, and records it in `interviews`; the Meet link is visible in the app.
**Out of scope:** rescheduling UI, availability logic (keep it: owner picks a time in a simple dialog).

### Phase 5 — LinkedIn sourcing (Apify, cookieless)
**Build:** a sourcing screen where the owner enters a role and filters (title, city/area, optional company); construct the search input for a **cookieless** Apify actor (section 8.1); trigger the run via the Apify API; receive results via `POST /api/apify/webhook` (verify with `APIFY_WEBHOOK_SECRET`); import each result as a `candidate` with `source = linkedin`, flagged **"needs review"**; the owner reviews and confirms before candidates enter a job's pipeline; then they can be scored like uploaded CVs.
**Acceptance:** owner runs a search, results arrive via webhook and appear as reviewable candidates; nothing is added to a pipeline without owner confirmation; only cookieless actors are used; no LinkedIn login/cookie is ever requested or stored.
**Out of scope:** any LinkedIn messaging/automation (explicitly forbidden — section 8.1).

### Phase 6 — Tracking and analytics ("track file")
**Build:** a simple analytics view computed from `events`: how many candidates are in each stage, average time-in-stage, and basic funnel counts per job. Optionally allow exporting a job's activity as CSV.
**Acceptance:** owner sees per-stage counts and average time a candidate spends in each stage, derived entirely from `events`.

---

## 8. Integration playbooks

### 8.1 LinkedIn via Apify — safety rules first
- **Cookieless actors ONLY.** Cookieless actors read only public profile data through their own proxies and require no LinkedIn login or session cookie, so they don't put any account at risk. Never use a cookie/session-based actor, and never ask the owner for a LinkedIn cookie.
- **Never automate LinkedIn messaging, connection requests, or InMail.** That cleanly violates LinkedIn's user agreement. All outreach goes through email (Zoho), never LinkedIn.
- **Two-step pattern:** (1) a profile-**search** actor takes a search URL with filters (title, geo, company) and returns a list of matching profiles; (2) a profile-**scraper** actor enriches each into structured fields. Choose specific cheap cookieless actors from the Apify Store at build time and record which ones in `CLAUDE.md`.
- **Async handling:** start the actor run via the Apify API, then let Apify call `POST /api/apify/webhook` when the run finishes — do **not** block a request waiting for a scrape (Vercel functions time out). Verify the webhook with `APIFY_WEBHOOK_SECRET`, then ingest the dataset.
- **Free tier reality:** the Apify free plan gives ~$5 of prepaid credit per cycle with no card — fine for development and small runs, not for volume. Add a per-run result cap so a single search can't burn the budget.
- **Treat every imported field as personal data.** Store only what's needed for recruiting, and support deleting a candidate and their data.

### 8.2 Zoho Mail
- OAuth 2.0. Register an app in the Zoho API Console for client id/secret; run the authorization-code flow; store the refresh token (encrypted).
- Note: Zoho Mail API access generally requires a paid Zoho Mail plan — confirm the owner's plan supports API sending.
- Send endpoint: `POST https://mail.zoho.com/api/accounts/{accountId}/messages` with header `Authorization: Zoho-oauthtoken {access_token}` and a JSON body containing `fromAddress`, `toAddress`, `subject`, `content`. Fetch `{accountId}` once via Zoho's accounts API and store it in `integration_tokens.account_id`.
- Refresh the access token using the stored refresh token when it expires.

### 8.3 Google Calendar + Meet
- OAuth 2.0 with the owner's Google account; request calendar scope; store the refresh token (encrypted).
- Create events via `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`.
- To auto-generate a Meet link, include in the event body: `conferenceData.createRequest` with `conferenceSolutionKey.type = "hangoutsMeet"` and a unique `requestId`. Read the returned Meet URL from the created event and store it in `interviews.meet_url`.
- `sendUpdates=all` emails the invite to the candidate; add the candidate under `attendees`.
- Use time zone `Asia/Karachi` for event times.

---

## 9. AI ranking contract

**Inputs to each scoring call:** the job's `jd_text`, the job's free-form `criteria_text`, and one candidate's extracted `raw_text`.

**Behaviour:** the model reads the criteria as the priority signal, scores the candidate's fit against the JD + criteria, and returns strict JSON via a forced tool call (no prose). If the CV text is very long, truncate sensibly or summarise before scoring, but keep the sections most relevant to the criteria.

**Output schema (the tool's `input_schema`):**
```json
{
  "overall_score": 0,
  "recommendation": "strong | possible | weak",
  "criteria_breakdown": [
    { "criterion": "string (echoed from the free-form criteria)", "met": true, "evidence": "short quote or paraphrase from the CV", "weight_note": "why this mattered" }
  ],
  "strengths": ["string"],
  "gaps": ["string"],
  "summary": "2-3 sentence justification"
}
```

**Rules:**
- `overall_score` is an integer 0–100; persist it to `applications.score`, the full object to `score_breakdown`, and `summary` to `score_summary`.
- If a criterion can't be assessed from the CV, mark `met: false` with evidence "not stated" rather than guessing.
- Ranking on the list view = sort by `overall_score` descending, ties broken by `recommendation`.
- Keep scoring reasonably consistent (low temperature).

---

## 10. Non-functional requirements and guardrails

- **Security:** RLS on every table, scoped to the owner. Service-role key and all provider secrets are server-side only. OAuth refresh tokens are encrypted at rest. Never log secrets or full tokens.
- **Candidate data:** store the minimum needed. Provide a way to delete a candidate and all their linked rows (applications, events, emails, interviews, storage files).
- **LinkedIn guardrails (restated):** cookieless only; no messaging automation; per-run result caps; imported profiles require owner review before entering a pipeline.
- **Reliability:** every third-party call wrapped in try/catch with a stored failure state (e.g. `emails.status = failed`) and a visible error in the UI — never a silent failure or an unhandled crash. Show loading states for scoring and scraping.
- **Cost control:** cap CVs scored per action and profiles fetched per search; show the owner what a run will do before it runs.
- **Simplicity:** no feature outside these phases without the owner asking. Prefer boring, well-supported patterns.

---

## 11. Coding conventions (put these in CLAUDE.md after Phase 0)

- TypeScript strict; App Router; server components by default, client components only where interactivity requires it.
- Data access and secrets live in server code (server actions / route handlers). The browser only ever sees the Supabase anon key.
- UI built from shadcn/ui components + Tailwind; keep it clean, neutral, and professional (an internal HR tool, not a marketing site).
- One migration per schema change; keep migrations in the repo.
- Small, reviewable commits — **commit at the end of each phase** with the phase name.
- Record chosen specifics as you go: which PDF library, which exact Apify actors, and the confirmed Anthropic model name.
- `.env*` is git-ignored; secrets are provided by the owner and set in Vercel.

---

## 12. Definition of done

The tool is complete when the owner can, end to end: create a job with free-form criteria → add candidates by uploading CVs and by importing reviewed LinkedIn profiles → see them ranked with reasons → move them across the board → have interviews auto-scheduled with Meet links and emails auto-sent from Zoho on the right stage moves → and view per-stage counts and time-in-stage. Each phase is signed off by the owner before the next begins.
