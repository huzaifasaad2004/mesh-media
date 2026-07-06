# Mesh Media Agency OS (m3m.ae)

Agency ERP for Mesh Media (Huzaifa's marketing agency, Abu Dhabi): CRM, projects, tasks,
quotations/invoices (AED, UAE VAT), expenses, payroll, contracts, client portal, team portal,
and the "Aether" AI assistant.

**Live in production:** https://www.m3m.ae (always use `www.` — apex 308-redirects).
GitHub `huzaifasaad2004/mesh-media` auto-deploys to Vercel on push to `main`. **A push to main
is a production deploy — be sure before pushing.**

## Stack
- Next.js 14 App Router + TypeScript + Tailwind, Supabase (auth/Postgres/RLS/storage), Resend (email), Gemini (Aether AI — this repo's own free-tier key, separate from Celine's paid key)
- Dev: `npm run dev` (http://localhost:3000); env in `.env.local` (never commit; prod env lives in Vercel dashboard)
- Migrations: numbered `supabase/phaseN_*.sql`, applied by pasting into the Supabase SQL editor (no CLI pipeline). Continue the numbering; never edit an already-applied file.

## Security rules (non-negotiable)
- New API routes must use `lib/apiAuth.ts` (`requireUser` / `requireStaff` / `requireRoles` / `requireFinanceRead`): RLS cookie client (`auth.db`) for reads; `serviceRole()` **only after** the role gate. Never a bare service-role client — that was the audit's critical finding (see `docs/SECURITY_AUDIT.md`).
- Never put keys in code or scripts — a one-off script with a hardcoded service key already had to be purged once.
- `/api/celine/*` routes are bearer-token authed (Celine integration) and exempted from the session-cookie middleware — keep it that way; use `lib/celine/auth.ts`.

## Conventions
- Roles: `owner | admin | manager | member | viewer | client` — helpers in `lib/roles.ts`, effective permissions (role defaults + per-user overrides) in `lib/permissions.ts`. Gate UI *and* API with these, plus RLS in the DB.
- Brand: maroon `#6E1318` / cream paper surfaces / warm neutrals; Cormorant for display text, Inter for UI; tokens in `globals.css` + `tailwind.config.ts`. Aether Cyan `#2BD6D6` is used ONLY on Aether (avatar/panel) — never on general UI. Full spec: `docs/BUILD_PLAN.md` Part B.
- Mobile-first: every screen must work at 390 / 768 / 1280px; tables collapse to stacked cards below `md`.
- Money: AED, right-aligned, tabular-nums, round to 2dp.

## Docs
- `docs/SECURITY_AUDIT.md` — full audit with fixes, status table at top (verified 2026-07-06)
- `docs/BUILD_PLAN.md` — master roadmap + design system, with done/not-done status header
- `SETUP.md` — fresh-machine setup
- Brand assets: `~/Downloads/mesh-media-brand-assets/` (logos, favicons, Aether art + its README)
