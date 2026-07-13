@AGENTS.md

# CLAUDE.md — HR Recruiting Assistant

Conventions and project facts for anyone (human or Claude) working in this repo.
The authoritative build brief is `SPEC.md`. Build **one phase at a time** and get
the owner's sign-off before starting the next phase. `AGENTS.md` (imported above)
holds the Next.js 16 rules — read the bundled docs in `node_modules/next/dist/docs/`
before writing framework code.

## Golden rule

Single-user internal tool. Do **not** over-engineer: no team roles, no
org/workspace model, no billing, no complex RBAC. Simple and reliable beats
clever. Do not build anything outside the current phase without the owner asking.

## Stack (chosen specifics)

- **Next.js 16** (App Router, Server Components by default) + **TypeScript strict**.
- **React 19**.
- **Tailwind CSS v4** + **shadcn/ui** (`base-nova` style, **Base UI** primitives,
  `neutral` base color, lucide icons). Add components with
  `npx shadcn@latest add <name>`.
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres, Auth,
  Storage, Realtime, RLS.
- **Deploy:** Vercel.
- **CV scoring (Phase 1):** **Google Gemini** via `@google/genai`. Model
  **`gemini-2.5-flash`** (override with `GEMINI_MODEL`, e.g. `gemini-2.5-pro`).
  Structured JSON via `config.responseSchema` + `responseMimeType:"application/json"`,
  `temperature: 0` for consistency. Contract lives in `lib/scoring.ts` (SPEC §9).
  **Owner-approved deviation from SPEC §2**, which locked the scoring engine to
  Anthropic — the owner switched to Gemini on 2026-07-09. `GEMINI_API_KEY` is the
  only scoring secret.
- **PDF text extraction:** **`unpdf`** (serverless-friendly, no native deps) —
  `lib/pdf.ts`.
- **Email (Phase 3): Zoho Mail (SMTP).** Sends candidate email from the HR
  mailbox via `smtp.zoho.com` using nodemailer (`lib/zoho.ts`, `sendZohoMail`).
  Auth is a **Zoho app-specific password** (not OAuth) held in env
  (`ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`; host/port/from-name overridable) —
  simplest for a single-user tool; no token store needed. Emails log to `emails`
  with `provider = 'zoho'`. History: SPEC §2 locked email to Zoho → owner
  switched to Gmail 2026-07-10 → **owner reverted email to Zoho 2026-07-13** (HR
  sends from Zoho); Google now covers scheduling only.
- **Inbound email / candidate replies (Phase 6): Zoho IMAP.** Reads the inbox
  via `imap.zoho.com` (imapflow + mailparser, `lib/zoho-imap.ts`), reusing the
  same app password as sending (enable IMAP in Zoho: Settings → Mail Accounts →
  IMAP Access). Sync is **on-demand** (server action `syncInboundEmails` in
  `app/emails/actions.ts`) — auto-runs when the Emails "Received" tab opens
  (rate-limited via `email_sync_state.last_synced_at`) plus a manual Refresh;
  no cron (Vercel Hobby only allows daily cron). Replies are matched to an
  application by RFC `In-Reply-To`/`References` → a sent `message_id`, falling
  back to sender address → candidate's most recent application; unmatched inbox
  mail is skipped. Inbound rows land in `emails` with `direction='inbound'`,
  `status='received'`, deduped by unique `message_id`. Emails tab shows
  **Sent / Received** sections.
- **Calendar (Phase 4): Google**, OAuth app (`lib/google.ts`). Used for
  interview scheduling (Calendar + Meet) only — **not** email. OAuth flow:
  `/api/oauth/google/start` + `/api/oauth/google/callback`. Scopes requested up
  front: `openid`, `userinfo.email`, `calendar.events`. (The `sendGmail` helper
  remains in `lib/google.ts` but is no longer wired to any send path.)
- **OAuth tokens** stored in `integration_tokens` (one row per provider),
  **encrypted at rest** with AES-256-GCM (`lib/crypto.ts`, `TOKEN_ENCRYPTION_KEY`).
  Never logged.
- **Interview scheduling (Phase 4):** Google Calendar + Meet via the same Google
  connection (`createCalendarEvent` in `lib/google.ts`;
  `conferenceData.createRequest` for the Meet link, `sendUpdates=all` to invite the
  candidate, time zone **Asia/Karachi**). Moving a candidate to an interview stage
  on the board opens a time/duration dialog; results are stored in `interviews` and
  shown on the candidate detail page, with an `interview_scheduled` event.
- **LinkedIn sourcing (Phase 5):** Apify, **cookieless actors only** (SPEC §8.1).
  Default actor **`harvestapi~linkedin-profile-search`** (no login/cookies; returns
  full public profiles with a `maxItems` cap) — override with `APIFY_LINKEDIN_ACTOR`.
  `lib/apify.ts` starts a run + normalizes profiles; `lib/sourcing.ts` ingests the
  dataset into `sourced_profiles` (staging, needs-review). Results arrive via
  `POST /api/apify/webhook` (verified with `APIFY_WEBHOOK_SECRET`) in production, or
  by **polling** from `/source` locally (no public URL needed). Nothing enters a
  role's pipeline until the owner clicks **Add to role** (creates a candidate +
  application, then scores). **Never** cookie/session actors; **never** LinkedIn
  messaging. Env: `APIFY_TOKEN`, `APIFY_WEBHOOK_SECRET`, `APIFY_LINKEDIN_ACTOR`.

## shadcn base-nova = Base UI (not Radix)

The `base-nova` style uses **Base UI** primitives, whose API differs from Radix:
- Compose/polymorphism uses the **`render`** prop, not `asChild`. e.g. a button
  that is a link: `<Button render={<Link href="…" />}>Label</Button>`.
- `Accordion` uses **`multiple={false}`** (not Radix's `type="single" collapsible`).
- `Badge`/`Button` accept variants: default, secondary, destructive, outline, ghost, link.

## CV upload + Storage (Phase 1)

- Private Storage bucket **`resumes`** (PDF only, 15 MB), created by
  `scripts/setup-storage.mjs` (service role). No Storage RLS policies — all access
  is server-side.
- Uploads go **browser → Storage directly** via `createSignedUploadUrl`
  (server, service role) + `uploadToSignedUrl` (client). This avoids Vercel's
  ~4.5 MB serverless request-body limit. The server then downloads each file with
  the service role, extracts text, creates candidate + application rows, and scores.
- Caps: 20 CVs per upload batch; scoring runs at concurrency 4 (`app/jobs/actions.ts`).
- Deleting a candidate/job also removes their Storage files (SPEC §10).

## Runtime / environment notes

- **Node 22 LTS is required** (Next 16 and Tailwind v4 need Node ≥ 20). The system
  Node was 18; a user-local Node 22 is installed at
  `~/.local/node-v22.23.1-linux-x64` and symlinked into `~/.local/bin`
  (`node`/`npm`/`npx`), which is first on PATH. Vercel should use Node 22.x.
- **Next.js 16 renamed Middleware to Proxy.** The root file is `proxy.ts` (not
  `middleware.ts`); it exports a `proxy` function + `config.matcher`. Session
  refresh + route protection live in `lib/supabase/proxy.ts`.
- `cookies()` / `headers()` from `next/headers` are **async** — always `await`.

## Coding conventions (SPEC §11)

- Server components by default; add `"use client"` only where interactivity needs it.
- **All data access and secrets stay server-side** (server actions / route
  handlers). The browser only ever sees the Supabase anon key.
- UI from shadcn/ui + Tailwind; keep it clean, neutral, professional.
- **One migration per schema change**, kept in `supabase/migrations/`.
- Small, reviewable commits — **commit at the end of each phase** with the phase name.
- `.env*` is git-ignored. Secrets come from the owner and are set in Vercel; never
  invent, hardcode, log, or commit secrets.
- Wrap every third-party call in try/catch with a stored failure state and a
  visible UI error — never a silent failure or unhandled crash.

## Auth & security model

- **Auth method: email + password** (Supabase Auth). The single owner account is
  created with `scripts/create-owner.mjs`. Public sign-ups must be **disabled** in
  the Supabase dashboard.
- Supabase clients: `lib/supabase/server.ts` (server), `lib/supabase/client.ts`
  (browser). Admin/service-role work is done in one-off scripts only, never shipped
  to the client.
- **RLS is on for every table.** Policies grant all access to the `authenticated`
  role only; `anon` gets nothing; `service_role` bypasses RLS server-side. Because
  there is one account and sign-ups are off, "authenticated" == "the owner". The
  data model intentionally has **no `owner_id` columns** (single-user; avoids an
  unnecessary tenancy model).

## Project layout

- `app/` — routes (App Router). `app/login` (auth), `app/auth` (callback +
  sign-out action), `app/page.tsx` (dashboard).
- `components/` — shared components; `components/ui/` is shadcn output.
- `lib/supabase/` — Supabase client/server/proxy helpers.
- `supabase/migrations/` — SQL migrations.
- `scripts/` — one-off admin scripts (run with `node --env-file=.env.local ...`).
- `proxy.ts` — Next.js Proxy (session refresh + route protection).

## Environment variables

See `.env.local.example`. Introduce each variable in the phase that first needs
it. Phase 0 needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (and `SUPABASE_DB_URL` for local tooling).

## Commands

- `npm run dev` — local dev server.
- `npm run build` — production build (run before deploying / at end of a phase).
- `npm run lint` — ESLint.
- Apply schema: run `supabase/migrations/*.sql` against the project (Supabase SQL
  editor, or `psql "$SUPABASE_DB_URL" -f <file>`).
- Create owner: `node --env-file=.env.local scripts/create-owner.mjs <email> <pw>`.
