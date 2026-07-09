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
- Later phases: Anthropic SDK (Phase 1), Zoho Mail (Phase 3), Google Calendar
  (Phase 4), Apify cookieless actors (Phase 5). PDF library, exact Apify actors,
  and confirmed Anthropic model name to be recorded here as they are chosen.

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
