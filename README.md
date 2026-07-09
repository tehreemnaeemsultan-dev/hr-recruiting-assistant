# HR Recruiting Assistant

Private, single-user recruiting tool: rank CVs against a job, manage candidates on
a pipeline board, source from LinkedIn, email from Zoho, and schedule interviews
with Google Meet. Built per `SPEC.md`, one phase at a time.

**Status:** Phase 0 (foundation) — Next.js + Supabase + auth + schema + deploy.

## Tech

Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · Supabase
(Postgres/Auth/Storage/RLS) · Vercel. See `CLAUDE.md` for conventions.

## Prerequisites

- **Node.js 22 LTS** (Next 16 / Tailwind v4 require Node ≥ 20).
- A Supabase project.
- A Vercel account (for deployment).

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and fill in the Supabase values:
   ```bash
   cp .env.local.example .env.local
   ```
   From the Supabase dashboard (Project Settings):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — API settings.
   - `SUPABASE_SERVICE_ROLE_KEY` — API settings (server-only, keep secret).
   - `SUPABASE_DB_URL` — Database → Connection string (URI). Used only to apply
     migrations locally.
   - `APP_URL` — `http://localhost:3000` for local dev.
3. Apply the database schema (creates all tables + RLS):
   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260709120000_init.sql
   ```
   (Or paste the file into the Supabase SQL Editor and run it.)
4. Create the single owner account and disable public sign-ups in Supabase
   (Authentication → Sign In / Providers):
   ```bash
   node --env-file=.env.local scripts/create-owner.mjs you@example.com 'a-strong-password'
   ```
5. Run the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you should be redirected to `/login`, then reach the
   dashboard after signing in.

## Deployment (Vercel)

- Import the repo in Vercel; framework preset is auto-detected (Next.js).
- Set Node.js version to **22.x** in Project Settings.
- Add the same environment variables as `.env.local` (set `APP_URL` to the Vercel
  URL). Do **not** add `SUPABASE_DB_URL` (local tooling only).
- Deploy. The build command is `next build`.

## Scripts

- `npm run dev` / `npm run build` / `npm run start` / `npm run lint`
