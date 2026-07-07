# Mesh Media → "Agency OS" Build Plan

**A phased roadmap to turn m3m.ae into an advanced, AI-native ERP + team management + client management + client onboarding platform.**

Stack: **GitHub** (source/CI) · **Vercel** (Next.js hosting + cron) · **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions, pgvector) · **Gemini** (LLM, embeddings, vision) · **Resend** (email)

Use this document as the master plan. Each phase below is written so you can hand it to Claude Code as a self-contained brief.

> ## STATUS — as of 2026-07-06 (updated same-day, evening session 2)
> Much of this plan is now BUILT (migrations `phase2`–`phase19` written; see git log):
> - ✅ Phase 0–1: stabilized; RBAC (`phase5_rbac.sql`), roles owner/admin/manager/member/viewer/client, per-user permission overrides (`phase12`)
> - ✅ Phase 2: projects layer (`phase6_projects.sql`)
> - ✅ Phase 3: client portal (`phase7_portal.sql`), quotations with VAT/discount/decline-reason
> - ✅ Phase 4 (partial): time tracking (`phase8_time.sql`), approvals (`phase9_approvals.sql`)
> - ✅ Phase 7 (partial): full payroll module — multi-currency, payslips, recurring
> - ✅ Part B (partial): brand re-skin + mobile responsiveness (app-shell drawer, card views)
> - ✅ Celine integration: `/api/celine/*` action endpoints + portal-view event webhooks
> - ✅ Security fixes from [SECURITY_AUDIT.md](SECURITY_AUDIT.md) applied 2026-07-06 (phase17 migration + password rotation still manual — see its status table)
> - ✅ 2026-07-06 evening (session 1): click-to-confirm invite flow (`/auth/confirm`), admin password set/reset on Team page, real server-generated PDF downloads, WhatsApp on both doc pages
> - ✅ **2026-07-06 evening (session 2): Tier 1 + Tier 2 fully shipped, Tier 3 fully code-complete (all of #10–12)** — see "DONE" list below.
> - ✅ **2026-07-06 evening (session 3): critical permission-leak fix** (see detail below) + Tier 3 #11/#12 (recurring retainer invoices/dunning, cash-flow forecast).
> - ❌ NOT done: e-signature, RAG/pgvector for Aether, CRM/leads, onboarding workflows, knowledge base, Tier 4 flagship differentiators
>
> **⚠️ Three migrations are written but NOT yet run in Supabase** — paste these into the Supabase SQL editor when convenient (nothing is broken in the meantime, all degrade gracefully):
> - `supabase/phase18_portal_access.sql` — adds `clients.portal_enabled`; until run, the portal on/off toggle shows a clear "run this migration" error instead of saving.
> - `supabase/phase19_activity_log.sql` — creates the `activity_log` table; until run, `/settings/activity` shows a clear "run this migration" error instead of listing entries.
> - `supabase/phase21_recurring_invoices.sql` — adds `clients.auto_invoice_retainer`, `invoices.retainer_period`/`dunning_stage`/`last_reminder_sent_at`; until run, recurring invoices/dunning cron jobs will error (manual "Run Retainer Invoices" button will show the DB error).
>
> **⚠️ Online payments (Tier 3 #10) needs Stripe keys** — code is fully built (Checkout session creation, webhook handler, Pay Now button, idempotent paid-status update) but inert until you add to the environment: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` (the last one only after registering a webhook endpoint at `https://www.m3m.ae/api/webhooks/stripe` for the `checkout.session.completed` event in the Stripe dashboard).
>
> - ✅ **2026-07-06 evening (session 3): critical permission-leak fix, requested urgently by Huzaifa.** Managers/members were seeing finance data (invoices, revenue, dashboard KPIs, all client-support requests) and the Permissions Matrix editor had **zero effect** on built-in roles because `lib/apiAuth.ts` checked a hardcoded role array before ever consulting `role_permissions`. Fixed properly — see `lib/apiAuth.ts` (`requireFinanceRead/Write`, `requirePayrollRead/Write` are now fully permission-driven, owner/admin bypass only). Also fixed along the way:
>   - `GET /api/salaries` had **no auth check at all** — any authenticated (or unauthenticated) request returned every employee's salary. Now gated by `payroll.read`.
>   - `/payslip/[id]` "not loading" bug: `salary_payments` has two FKs to `profiles` (`profile_id`, `created_by`); the ambiguous embed was silently failing every request. Fixed with an explicit `!salary_payments_profile_id_fkey` hint.
>   - Dashboard (`app/(dashboard)/dashboard/page.tsx`) now computes effective permissions server-side and only queries/renders finance (revenue, expenses, invoices, charts) and clients data for users who actually have `finance.read`/`clients.read`. Non-finance staff see Open Tasks, Due Today, and a "My Salary" tile instead.
>   - `/api/requests` (client support tickets) now scopes non-admin staff to only the clients they're actually assigned to (via tasks or project membership) instead of every request in the system.
>   - Ran `phase20_restrict_manager_finance.sql` directly against production (with Huzaifa's explicit go-ahead) to revoke the `manager` role's default `finance.read`/`finance.write` grants — the owner can re-grant per-role via `/settings/permissions` or per-person via Team → Manage Access.
>   - Invoices: `InvoiceForm` now has an editable **Paid Date** field (shown when status = Paid).
>   - Salaries: replaced the one-click "Pay Now" (always dated today) with a **Payments modal** (`components/finance/SalaryPaymentsModal.tsx`) — record a payment with any date, and edit the date/amount of any past payment via a new `PUT /api/salary-payments/[id]`.
>   - All verified live via the "View as" impersonation feature (start a real session as the manager, confirm the dashboard/invoices/requests are properly scoped, then return to admin).

---

## NEXT UP — prioritized roadmap (agreed 2026-07-06)

### Tier 1 — quick wins (each ~1 session) — ✅ ALL DONE
1. ✅ **Attach the PDF to invoice/quotation emails** — `/api/invoices/[id]/send` and `/api/quotations/[id]/send` now attach the real PDF via Resend (reusing `lib/pdf/DocumentPdf.ts`), not just a link.
2. ✅ **Search + filter + pagination** on Clients, Invoices, Expenses, Tasks — new shared `components/ui/Pagination.tsx`, per-page search/filter state, `ClientsTable.tsx` extracted as a client component for Clients.
3. ✅ **Dashboard upgrade** — clickable KPI tiles (already were), added trend-delta arrow on Total Revenue, a fluid-width inline-SVG revenue-vs-expenses line chart and expense-by-category donut (`components/dashboard/RevenueChart.tsx`, `ExpenseDonut.tsx` — no chart library dependency added).
4. ✅ **Empty states + toasts + confirm-before-delete** — new `components/ui/Toast.tsx` (`ToastProvider`, mounted in root `app/layout.tsx`) and `components/ui/EmptyState.tsx`, wired into Clients/Invoices/Expenses/Tasks/Contracts/Quotations/Salaries, replacing all ad-hoc inline success/error banners and one stray `alert()`.
5. ✅ **Global ⌘K command palette** — `components/CommandPalette.tsx` + `/api/search` (clients/invoices/quotations/tasks/contracts via RLS-scoped query), triggered by `Cmd/Ctrl+K` or the search icon in the sidebar/mobile header.

### Tier 2 — admin control center — ✅ ALL DONE
6. ✅ **Permissions matrix editor** at `/settings/permissions` — `/api/role-permissions` (owner/admin only) + a role × permission grid UI, click-to-toggle with optimistic updates.
7. ✅ **Client portal access manager** — `PortalAccessCard.tsx` on the client detail page: on/off toggle (needs `phase18` migration — see warning above), invited-user list with last-login, resend invite, invite-first-user CTA. Portal itself now blocks paused clients (`app/portal/layout.tsx`).
8. ✅ **Audit log** — `lib/activityLog.ts` (`logActivity()`) wired into every mutation route (clients, invoices, quotations, expenses, tasks, contracts, salary pay/payroll run, role-permission changes, per-user permission overrides, portal invite/toggle). Browse UI at `/settings/activity` (needs `phase19` migration — see warning above).
9. ✅ **"View as" impersonation** — real session-swap (not a simulated view): `/api/admin/impersonate/start` mints and swaps to the target's real session via a server-side magic-link exchange (stashes the admin's original session in an httpOnly cookie), `/api/admin/impersonate/stop` restores it. `ImpersonationBanner.tsx` shown in both dashboard and portal layouts. Trigger buttons (`ViewAsButton.tsx`) on Team member cards and invited portal users. Cannot impersonate another owner/admin. Both start/stop are audit-logged.
   - **Found and fixed in passing**: `PUT`/`DELETE` on `/api/invoices/[id]` had **no auth check at all** — now gated with `requireRoles` like every other mutation route.
   - **Found and fixed in passing**: the global `middleware.ts` was redirecting *all* unauthenticated requests to `/login`, including the public invoice/quotation print pages and their API routes — meaning a client opening their emailed invoice link (or, critically, Stripe's webhook) would never have worked. Added explicit public-path exemptions for `/invoice/`, `/quotation/`, `/api/invoices`, `/api/quotations`, `/api/webhooks/` (each of those routes still self-enforces auth internally where it should).

### Tier 3 — money & retention (biggest business impact) — ✅ ALL DONE (code-complete)
10. ✅ **Online payments** — Stripe Checkout (AED). `lib/stripe.ts`, `/api/invoices/[id]/checkout` (creates session), `/api/webhooks/stripe` (verifies signature, idempotently marks invoice paid, audit-logs), a "Pay Now" button on the invoice print page with a post-payment confirmation poll. **Inert until Stripe keys are added** — see warning above.
11. ✅ **Recurring retainer invoices + smart dunning** — `supabase/phase21_recurring_invoices.sql` (adds `clients.auto_invoice_retainer`, `invoices.retainer_period`/`dunning_stage`/`last_reminder_sent_at`). `/api/cron/recurring-invoices` generates one invoice per opted-in client per month (idempotent via a unique `(client_id, retainer_period)` index), emails it via Resend. `/api/cron/dunning` escalates overdue invoices through 3 stages (polite day 0 → firm day 7 → final notice day 14), auto-stops once paid/cancelled (`dunning_stage` reset in the invoice PUT route and the Stripe webhook). Wired to `vercel.json` cron schedules (1st of month 6am, daily 8am) — protected by a `CRON_SECRET` bearer check (`lib/cron.ts`) that also lets a signed-in finance.write admin trigger either job manually (the "Run Retainer Invoices" button on `/finance/invoices`). **Needs `CRON_SECRET` set in Vercel env** (same value cron sends) for the scheduled runs to authenticate — manual "Run Retainer Invoices" works either way since it falls back to a normal session check.
12. ✅ **Cash-flow forecast** widget on `/finance` (`components/finance/CashFlowForecast.tsx`, `/api/finance/cashflow`) — recurring retainer income + outstanding − payroll − recurring expenses, projected across this month / next month / month after.

### Tier 4 — flagship differentiators (see audit §4)
13. Client Pulse churn radar · monthly branded Impact Report PDF per client · WhatsApp-native Aether · PR media-placement/EMV tracker. NOT STARTED.

---

## 0. Two things to fix today (already diagnosed)

1. **AI is down** — `/api/ai/chat` returns `500 {"error":"GEMINI_API_KEY not configured"}`. Add `GEMINI_API_KEY` to Vercel env (Production + Preview), redeploy. Confirm the assistant streams a reply.
2. **Tasks page is broken** — `/api/tasks` returns `400 "Could not embed because more than one relationship was found for 'tasks' and 'profiles'"`. The `tasks` table has 2+ FKs to `profiles` (e.g. `assigned_to`, `created_by`). Disambiguate the embed: `profiles!tasks_assigned_to_fkey(id,full_name)`. Add a visible error state so failed loads stop looking like "no data."
3. Minor: reconcile Dashboard "5 invoices" vs 46; Finance "1 quotation" vs 0; redirect `/login`→`/dashboard` after auth.

---

## 1. The vision

One system where **everything is linked and everything syncs**:

> A client is created → an onboarding workflow kicks off → a project with milestones is generated → tasks are assigned to team members → time is tracked → a quotation is approved by the client in their portal → it converts to an invoice → the invoice is paid online → revenue, expenses, and payroll roll up into live finance dashboards → and an AI assistant ("Meshi") sits on top of all of it, answering questions and *taking actions* for admins, team, and clients — each seeing only what their role allows.

Three portals, one codebase, one database, role-aware:

| Portal | Who | Sees |
|--------|-----|------|
| **Admin / Owner** | You + admins | Everything: full ERP, finance, team, AI ops, settings |
| **Team Member** | Staff/freelancers | Their assigned clients/projects/tasks, time tracking, their own payslips, files — no company-wide finance unless granted |
| **Client** | Your clients | Their projects, deliverables, invoices (pay), quotations (approve), contracts (sign), files, requests, onboarding |

All three live behind the **same login page** with role-based routing after auth (no separate apps).

---

## 2. Target architecture

### 2.1 Auth & multi-portal
- **Supabase Auth** for everyone. Admin/team via email+password (or Google). **Clients via magic link / OTP** (low friction, no password to manage).
- One login page → after sign-in, read the user's role and route: admin → `/`, team → `/`(scoped), client → `/portal`. Same shell, different navigation and data scope.
- A `profiles` row for every auth user with `role` and `org` context; a separate `client_contacts` mapping for client-portal users tied to a `client_id`.

### 2.2 Roles & permissions (RBAC + RLS)
- Roles: **owner, admin, manager, member, viewer, client**.
- Two layers:
  1. **Coarse role** on `profiles.role`.
  2. **Granular permissions** via a `permissions` / `role_permissions` table (e.g. `invoices.read`, `invoices.write`, `finance.view_all`, `clients.assigned_only`) so you can fine-tune without code changes.
- **Enforce in the database with Supabase Row Level Security (RLS)** — never trust the client. Every table gets policies: admins see all; members see rows for clients/projects they're assigned to; clients see only their own `client_id` rows. This is the single most important architectural decision — do it in Phase 1 before building more.

### 2.3 Data model (additions to what exists)
Existing: clients, tasks, invoices, quotations, expenses, contracts, files, profiles, settings.

Add:
- `projects` (client_id, status, dates, budget) — the missing middle layer that links clients ↔ tasks ↔ invoices ↔ files.
- `milestones`, `project_members`.
- `time_entries` (user, task/project, minutes, billable).
- `leads` + `pipeline_stages` (CRM before a client converts).
- `onboarding_templates` + `onboarding_runs` + `onboarding_steps`.
- `client_requests` (support/tickets from the client portal).
- `approvals` (generic approval workflow: quotations, expenses, time-off).
- `notifications` (in-app) + email log.
- `activity_log` (audit trail, who did what).
- `credentials_vault` (encrypted client logins/assets) — optional, secure.
- `documents` embeddings table with **pgvector** for AI search/RAG.
- `permissions`, `role_permissions`.

### 2.4 The "everything links" rule
Adopt one **polymorphic activity + relations** pattern so any entity can reference any other:
- A unified `entity_timeline` view (tasks, invoices, files, notes, emails, AI actions) keyed by `(entity_type, entity_id)` → every client/project page shows one chronological feed.
- Foreign keys everywhere: invoice → project → client; task → project → assignee; expense → client/project; contract → client/project.

### 2.5 AI architecture (Gemini)
- **`/api/ai/chat`** = the **Aether** assistant (rename from "Meshi" — Aether is the brand's named AI persona/mascot; see B8). Upgrade it from plain chat to **tool-calling agent**: give Gemini function definitions (`createTask`, `createInvoice`, `getOverdueInvoices`, `getClient`, `scheduleReminder`, …). The model decides which tool to call; your server executes it **with the caller's RLS/permissions**, so a client can't trigger an admin action.
- **RAG**: nightly (or on-write) job embeds clients, projects, tasks, invoices, notes, files (text) with **Gemini `text-embedding-004`** into `pgvector`. The assistant retrieves relevant rows before answering → grounded, company-specific responses.
- **Vision**: Gemini multimodal for receipt/invoice/PDF extraction.
- **Where it runs**: Next.js route handlers on Vercel for request/response; **Supabase Edge Functions + Vercel Cron** for background jobs (embeddings, digests, reminders).
- **Per-role AI**: admins get ops/finance agents; team get task/time agents; clients get a safe, scoped concierge ("when is my next deliverable?", "show my unpaid invoices").

### 2.6 Integrations
- **Resend**: all transactional + scheduled email (invoices, magic links, reminders, weekly digests) using React Email templates.
- **Payments** (Phase 7): Stripe, or a UAE gateway (Telr / Network International / Stripe-UAE) for online invoice payment; webhook → mark invoice paid → update finance.
- **Vercel Cron**: overdue-invoice sweep, due-task reminders, embedding refresh, weekly digest, contract-expiry alerts.
- **GitHub**: PR previews on Vercel; Supabase migrations via CLI in CI; environment-per-branch.

---

## 3. Module map

| Module | Status | Phase |
|--------|--------|-------|
| Clients | Exists | — |
| **Projects + milestones** | New (key glue) | 2 |
| Tasks (board, assignees, deps) | Fix + expand | 0/2 |
| **Time tracking & timesheets** | New | 4 |
| **CRM / leads pipeline** | New | 6 |
| **Client onboarding workflows** | New | 3 |
| Quotations / proposal builder | Expand | 3 |
| Contracts + **e-sign** | Expand | 7 |
| Invoices + **online pay + VAT** | Expand | 7 |
| Expenses (+ receipt AI) | Expand | 6 |
| **Payroll / salaries / payslips** | Expand | 7 |
| Files / deliverables (versioned) | Expand | 3 |
| **Client requests / ticketing** | New | 3 |
| **Approvals workflow** | New | 4 |
| **Notifications center** | New | 1/4 |
| **Reporting & role dashboards** | New | 5 |
| **Knowledge base / SOPs** | New | 8 |
| **Aether AI assistant (agent)** | Fix + expand | 5/6 |
| Audit log / activity feed | New | 8 |
| Settings / org config | Exists | — |

---

## 4. Phase-by-phase roadmap

> Each phase = a shippable increment. Don't start a later phase before the RLS/auth foundation (Phase 1) is solid.

### Phase 0 — Stabilize (days)
**Goal:** working baseline, nothing red.
- Set `GEMINI_API_KEY`; verify AI responds.
- Fix `/api/tasks` FK embed; add error states to all list pages.
- Reconcile dashboard/finance counts; fix post-login redirect.
- Add a global error boundary + toast on API failure.
**Done when:** every existing page loads real data or a clear empty/error state; AI returns a reply.

### Phase 1 — Auth, RBAC & the multi-portal shell (foundation)
**Goal:** the security and routing backbone for three portals.
- Roles + granular `permissions`/`role_permissions` tables.
- **RLS policies on every table** (admin-all, member-assigned, client-own). Write tests.
- One login page → role-based routing + scoped navigation. Client login via Resend magic link.
- Team invite flow (Resend email → accept → profile + role).
- Notifications table + basic in-app notification bell (Supabase Realtime).
**Done when:** a team member and a test client can each log in and see only their scoped view; RLS blocks cross-access in tests.

### Phase 2 — Projects layer + "everything links"
**Goal:** the connective tissue.
- `projects` + `milestones` + `project_members`; attach tasks, invoices, expenses, files to projects.
- Rebuild Tasks as a **board (kanban) + list**, with assignee, priority, status, due date, dependencies, comments.
- Unified **entity timeline** on client and project pages (one activity feed).
**Done when:** opening a client shows its projects; opening a project shows its tasks, files, invoices, and a live activity feed.

### Phase 3 — Client portal MVP + onboarding
**Goal:** clients self-serve; onboarding is systematized.
- Client portal: their projects/deliverables status, files (download), invoices (view + later pay), quotations (**approve/decline**), contracts (view), and a **requests** inbox (submit + track).
- **Onboarding workflows**: templates (steps, forms, doc requests, e-sign) → run per new client → progress tracked, auto-reminders via Resend.
- Quotation builder (line items, VAT, terms) → client approves in portal → one-click **convert to invoice**.
**Done when:** you can onboard a new client end-to-end and they can approve a quote and see their project in their portal.

### Phase 4 — Team portal & operations
**Goal:** the team's daily cockpit.
- Team home: my tasks, my clients/projects, today/this-week.
- **Time tracking** (start/stop timer + manual) → timesheets → billable rollup per project/client.
- **Workload view** for managers (who's over/under capacity).
- **Approvals**: time-off, expenses, quotations route to approvers.
- Team member sees **their own** payslips/salary only.
**Done when:** a member logs time against a task and a manager sees workload + approves a request.

### Phase 5 — AI core: "Aether" as a grounded agent
**Goal:** the assistant actually knows your data and can act. (Rename the assistant **Meshi → Aether** everywhere — UI strings, launcher, system prompt persona.)
- Embeddings pipeline (pgvector) over clients/projects/tasks/invoices/notes; refresh on write + nightly cron.
- Upgrade `/api/ai/chat` to **RAG + Gemini function-calling**; execute tools under the caller's permissions.
- **Semantic global search** ("find the Glo Pro Car Wash contract", "overdue invoices > 1k").
- Per-role assistant scope (admin/team/client).
**Done when:** "What's overdue and who do I chase?" returns a grounded answer with the real invoices, and "Create a task for ZAIN to redesign the Blinkr homepage due Friday" actually creates it.

### Phase 6 — AI everywhere (the differentiators)
**Goal:** AI woven into every module.
- **Receipt/invoice extraction** (Gemini vision): drop a PDF/photo → auto-fill expense/invoice, auto-categorize.
- **Auto-draft**: proposals, scopes of work, client emails, contract clauses, task breakdowns from a brief.
- **Client health scoring** + churn risk (activity, payment, sentiment).
- **Cash-flow forecast** + anomaly alerts on expenses/revenue (data already present).
- **Meeting notes → tasks**; **weekly auto-digest** emailed via Resend per role.
- Agency-specific: content/caption/brief generation, content calendar assistant.
**Done when:** expenses can be created by photo, and every Monday each role gets an AI-written digest.

### Phase 7 — Money, contracts & people (hard ERP)
**Goal:** close the financial + HR loop.
- **Online invoice payments** (Stripe/Telr/Network Intl) + webhook reconciliation; **UAE 5% VAT** support end-to-end (default is currently 0%).
- **Recurring invoices** for retainer clients (retainer field already exists).
- **E-signature** for contracts/quotations (build or integrate).
- **Payroll**: salaries → monthly payslips (PDF via Resend), link to expenses.
- HR-lite: leave/attendance, team docs.
**Done when:** a retainer client is auto-invoiced monthly, pays online, and the payment reconciles into finance with correct VAT.

### Phase 8 — Scale, insight & polish
**Goal:** enterprise-grade.
- Reporting suite: P&L by period, utilization, project profitability, AR aging — exportable (CSV/PDF).
- **Audit log** UI; full activity history.
- Knowledge base / SOPs (also fed to AI as a tool).
- Mobile-responsive / PWA; white-label client portal (your branding per client).
- Optional: Slack/WhatsApp notifications, calendar sync.

---

## 5. AI feature catalog (heavy use, by area)

- **Assistant/agent**: ask + act across all data, per-role scoped, tool-calling.
- **Finance**: receipt OCR, auto-categorization, cash-flow forecast, anomaly detection, AR-aging summaries, "draft this invoice."
- **Clients/CRM**: health/churn scoring, next-best-action, auto-research a new lead, draft outreach.
- **Projects/Tasks**: brief → task breakdown, smart prioritization, workload balancing, deadline risk prediction.
- **Comms**: draft client emails/updates, summarize threads, meeting-notes → action items.
- **Onboarding**: AI concierge guiding the client through steps, auto-filling forms from uploaded docs.
- **Content (agency)**: captions, ad copy, content calendars, brand-voice drafts.
- **Knowledge**: semantic search + "answer from our SOPs."
- **Automation**: weekly digests, overdue chasers (draft the chase email), contract-expiry summaries.

All on **Gemini** (chat/`gemini-2.x`, embeddings `text-embedding-004`, vision for documents).

---

## 6. Permissions matrix (starting point)

| Capability | Owner | Admin | Manager | Member | Viewer | Client |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| View all clients | ✅ | ✅ | ✅ | assigned | ✅ | own |
| Edit clients | ✅ | ✅ | ✅ | — | — | — |
| Projects/tasks | ✅ | ✅ | ✅ | assigned | view | own (view) |
| Time tracking | ✅ | ✅ | ✅ | own | — | — |
| Finance (all) | ✅ | ✅ | limited | — | — | — |
| Own invoices | ✅ | ✅ | ✅ | — | — | ✅ pay |
| Quotations approve | ✅ | ✅ | ✅ | — | — | ✅ |
| Payroll/salaries | ✅ | ✅ | — | own payslip | — | — |
| Team management | ✅ | ✅ | — | — | — | — |
| AI assistant | full | full | scoped | scoped | read | concierge |
| Settings | ✅ | ✅ | — | — | — | — |

(Drive these from `role_permissions` so they're editable in the UI, not hard-coded.)

---

## 7. Engineering conventions (for Claude Code)

- **RLS-first**: write the Supabase policy *with* every new table; add a policy test. Treat the API as untrusted.
- **Migrations** via Supabase CLI, committed to GitHub; never hand-edit prod.
- **Types**: generate TS types from the DB (`supabase gen types`) so the front end stays in sync.
- **AI safety**: the agent executes tools through the same authenticated Supabase client as the user → permissions are automatic. Never give the model a service-role key.
- **Secrets** in Vercel env (`GEMINI_API_KEY`, `RESEND_API_KEY`, Supabase keys, payment keys); preview vs production separated.
- **Email** via Resend with React Email templates; log every send.
- **Cron** on Vercel for sweeps/digests; idempotent jobs.
- **Observability**: structured errors + a visible error state on every async UI.
- **Responsive by default**: every screen is built mobile-first and must pass at 390 / 768 / 1280px — see B9. Treat it as a per-phase acceptance criterion, not a cleanup pass.

### How to drive this with Claude Code
Feed one phase at a time. Suggested opening prompt per phase:
> "We're building Agency OS (Next.js + Supabase + Gemini + Resend on Vercel). Implement **Phase N** from the build plan: [paste that phase]. Start by proposing the DB migration + RLS policies, then the API routes, then the UI. Show me the migration first for approval before writing app code."

Always have it (1) propose schema + RLS, (2) get your OK, (3) build API, (4) build UI, (5) add a test for the RLS policy.

---

## 8. Suggested sequence at a glance

`Phase 0 (stabilize)` → `1 (auth/RBAC/portals)` → `2 (projects glue)` → `3 (client portal + onboarding)` → `4 (team portal + time)` → `5 (AI core)` → `6 (AI everywhere)` → `7 (payments/contracts/payroll)` → `8 (scale/insight)`

Phases 1 and 2 are the foundation — invest there. Phases 5–6 are where this becomes *uniquely powerful*. Phase 7 is what makes it a real ERP.

---

# Part B — UI/UX & Design System (brand-aligned)

> Source of truth: **Mesh Media Brand Guidelines**. This part is written so it can be handed to Claude Code directly to re-skin and upgrade the UI.

## B0. The core problem: the app is off-brand

The brand is **warm, editorial, luxury** — deep maroon, cream "paper," warm dark neutrals, an elegant **Cormorant** serif paired with **Inter**. The live app is a generic **indigo/blue-violet SaaS template** (indigo primary `#4F46E5`-ish, cold grays, Inter only). **None of the brand comes through.** Re-skinning to the brand is the highest-impact, lowest-risk UI change — do it first as a global token swap, then refine components.

### Brand essence
- **Primary:** Maroon `#6E1318` · **Primary dark/hover:** `#4E0E12`
- **Accent:** Dusty rose `#D98A8E` (sparingly — highlights, focus, small accents)
- **Paper/cream surfaces:** `#FAF9F5` → `#F7F2E9` → `#F3EEE6` → `#ECE4D6`
- **Warm neutrals:** sand/taupe/umber/espresso scale (below)
- **Ink (text):** `#151312`; muted text `#6E655B`
- **Type:** Display/headlines = **Cormorant** (serif); UI/body = **Inter** (sans)
- **Logo:** italic serif "M" in cream on maroon

## B1. Design tokens (drop into `globals.css`)

```css
:root {
  /* Brand */
  --maroon:        #6E1318;  /* primary action */
  --maroon-dark:   #4E0E12;  /* hover/active */
  --rose:          #D98A8E;  /* accent (non-text / on-dark) */

  /* Paper / cream surfaces */
  --paper-0:       #FAF9F5;  /* app background */
  --paper-50:      #F7F2E9;
  --paper-100:     #F3EEE6;  /* cream card / panel */
  --paper-200:     #ECE4D6;  /* subtle fill */
  --sand-300:      #E0D6C4;  /* borders / dividers */
  --sand-400:      #C8BCA8;

  /* Warm neutral ink scale */
  --taupe-500:     #9C9384;
  --taupe-600:     #6E655B;  /* muted/secondary text */
  --umber-700:     #574E44;
  --umber-800:     #3A332C;
  --espresso-900:  #2A2420;
  --espresso-950:  #1C1815;
  --ink:           #151312;  /* primary text */
  --ink-black:     #0E0C0B;

  /* Semantic */
  --bg:            var(--paper-0);
  --surface:       #FFFFFF;
  --surface-cream: var(--paper-100);
  --border:        var(--sand-300);
  --text:          var(--ink);
  --text-muted:    var(--taupe-600);
  --primary:       var(--maroon);
  --primary-hover: var(--maroon-dark);
  --primary-fg:    var(--paper-100);
  --focus-ring:    var(--rose);

  /* Status — tuned to sit in a warm palette */
  --success:       #4F7A4A;  /* Active / Paid / Signed */
  --success-bg:    #E7EFE3;
  --warning:       #B8801F;  /* Pending / Sent / Paused */
  --warning-bg:    #F6ECD6;
  --danger:        #B23A2E;  /* Overdue / Churned / destructive */
  --danger-bg:     #F4E0DC;
  --info:          #4A5A6E;  /* Draft / neutral states */
  --info-bg:       #E6E9EE;

  --radius: 12px;            /* cards */
  --radius-sm: 8px;          /* inputs/buttons */
  --shadow-sm: 0 1px 2px rgba(21,19,18,.06);
  --shadow-md: 0 4px 16px rgba(21,19,18,.08);
}
```

### Tailwind extension (`tailwind.config`)
```js
theme: { extend: {
  colors: {
    maroon: { DEFAULT:'#6E1318', dark:'#4E0E12' },
    rose:   '#D98A8E',
    paper:  { 0:'#FAF9F5',50:'#F7F2E9',100:'#F3EEE6',200:'#ECE4D6' },
    sand:   { 300:'#E0D6C4',400:'#C8BCA8' },
    ink:    { DEFAULT:'#151312', muted:'#6E655B', black:'#0E0C0B' },
  },
  fontFamily: {
    display: ['var(--font-cormorant)','Georgia','serif'],
    sans:    ['var(--font-inter)','system-ui','sans-serif'],
  },
  borderRadius: { card:'12px', field:'8px' },
}}
```

## B2. Typography system

- **Load fonts via `next/font`:** Cormorant (`--font-cormorant`, weights 500/600) and Inter (`--font-inter`, 400/500/600). (Cormorant Garamond is the closest Google font to the brand mark.)
- **Use Cormorant for expressive text:** page titles, KPI/finance hero numbers, client/company names on detail headers, empty-state headings, login wordmark. Slightly tight leading, generous size.
- **Use Inter for everything functional:** tables, form labels/inputs, buttons, nav, badges, body copy. Use **tabular-nums** for all money/columns.
- **Scale:** Display 36–48 / H1 28 / H2 22 / H3 18 (Cormorant for Display–H2 on key screens; Inter-600 for in-table headers). Body 14–15, caption 12–13 in `--text-muted`.
- Rule of thumb: **one serif moment per screen** (the title or the hero number) — don't set tables in serif.

## B3. Component specs

- **Buttons:** Primary = maroon bg, cream text, hover `--maroon-dark`. Secondary = transparent/cream with `--sand-300` border, ink text. Destructive = `--danger`. Ghost for low-emphasis. Radius `--radius-sm`, height 36/40, focus ring = `--rose` 2px. Replace **all** indigo buttons.
- **Cards/panels:** white or `--paper-100`, `--border` 1px, `--radius`, `--shadow-sm`. KPI cards: small label (Inter caption, muted) + big Cormorant figure + optional trend delta (▲/▼ colored) + sparkline. Make KPI cards clickable → drill into the module.
- **Tables:** sticky header, `--paper-50` header row, hover `--paper-50`, dividers `--paper-200`, comfortable/compact density toggle. Money right-aligned, tabular-nums. Replace inline "View/Edit/Delete" text links with a **kebab (⋯) actions menu**; keep the row clickable to open. Always provide loading **skeletons**, an empty state, and an **error state**.
- **Status pills:** branded set — Active/Paid/Signed = success; Sent/Paused/Pending = warning; Overdue/Churned = danger; Draft/Lead = info/neutral. Pill = tinted bg + darker text, not full saturation.
- **Forms:** grouped sections with a Cormorant section heading; required `*`; inline validation + helper text; inputs with `--sand-300` border, `--rose` focus ring; a **sticky save bar** on long forms (e.g. New Client, Settings).
- **Detail headers:** avatar/monogram + Cormorant name + status pill + quick actions (Edit, New Invoice, New Task). Below: **tabs** (Overview · Tasks · Invoices · Files · Notes · **Activity**) instead of one long scroll.
- **Nav/sidebar:** cream/ink theme, maroon active indicator (left bar + tinted bg), the serif "M" mark up top, grouped sections (Workspace · Finance · Organization), collapsible, role-aware (hide what the role can't see).
- **Feedback:** consistent toasts (success/error), confirm dialogs for destructive actions, and a notifications bell (Realtime).
- **Motion:** 150–200ms ease, subtle; honor `prefers-reduced-motion`.

## B4. Screen-by-screen UX upgrades (from the audit)

- **Login:** rebrand to maroon/cream with the Cormorant wordmark; add **show/hide password**, **forgot password**, inline error messaging, and a **portal context** (admin/team password, **client magic-link**). Fix post-login redirect to `/dashboard`.
- **Dashboard:** KPI numbers in Cormorant + **trend deltas + sparklines**; make tiles clickable; add a **revenue-over-time** line chart and **expense-by-category** donut (data already exists); fix the "5 invoices" label/count; show a real "due today / overdue" call-out.
- **Clients:** add **search + sort + status filter** (tabs already exist), populate the empty **Retainer** column, normalize email casing for display, kebab actions, pagination.
- **Tasks:** after the API fix, ship a **kanban board + list toggle**, assignees with avatars, priority/status pills, due-date with overdue styling, quick-add.
- **Invoices/Expenses:** **search, sort, date-range filter, pagination**; full subject on hover (not "Imported from Zoho B…"); right-aligned money; bulk actions; export.
- **Finance hub:** keep the strong card layout but add mini-charts and make "Open →" obvious; reconcile the quotations count.
- **Settings:** group with Cormorant section headers, sticky save bar, mask IBAN/account number with reveal-on-click.
- **Empty states everywhere:** Cormorant heading + one-line helper + primary CTA (the Contracts/Quotations "Loading…" flash should become a skeleton).

## B5. Accessibility & quality bar (WCAG 2.1 AA)

- Maroon `#6E1318` on white and on cream `#F3EEE6` passes AA for text; **cream text on maroon** passes for buttons. **Rose `#D98A8E` is light** → use only for non-text accents, focus rings, or text on dark — never light-rose text on cream.
- Visible focus ring on every interactive element; full keyboard nav; min **44px** tap targets; label every input and icon-button; respect reduced motion; don't encode status by color alone (pair with text/icon).

## B6. Multi-portal theming

- Same tokens across all three portals. **Admin** = denser, data-first. **Team** = focused on tasks/time. **Client portal** = calmer, more cream/whitespace, larger type, fewer controls — the "luxury concierge" feel. Drive variations with a `data-portal` attribute layered over the same variables.
- Optional later: **white-label** the client portal per client by overriding `--primary`/`--rose` and logo.

## B7. How to ship it with Claude Code (suggested order)

1. **Tokens + fonts first:** add the CSS variables and Tailwind colors, load Cormorant + Inter via `next/font`, and do a **global find-and-replace of indigo/violet** classes → brand tokens. This alone transforms the app.
2. **Primitive components:** Button, Card, Badge/StatusPill, Input/Field, Table, Tabs, Modal, Toast, EmptyState, Skeleton — all consuming tokens. Replace ad-hoc styles.
3. **Re-skin screen by screen** using B4, starting with Login → Dashboard → Clients → Finance.
4. **Then** layer the functional UX (search/sort/filter, charts, kanban, tabs).

> Suggested Claude Code prompt: *"Re-theme this Next.js app to the Mesh Media brand using Part B of the build plan. Step 1: add the design tokens to globals.css, extend tailwind.config, load Cormorant + Inter via next/font, and replace all indigo/violet utility classes with the brand tokens. Show me the diff for globals.css, tailwind.config, and the root layout before touching components."*

## B8. Logo & the Aether mascot/AI persona

### Real logo — replace the placeholder "M"
The app currently uses a generic "M" monogram. **Replace it everywhere with the real Mesh Media waveform mark** (the brand asset files are provided alongside this plan):
- `mm_mark_maroon.png` — waveform mark in maroon `#6E1318`, for **light/cream** backgrounds (sidebar, login on cream).
- `mm_mark_cream.png` — waveform mark in cream `#F3EEE6`, for **maroon/dark** backgrounds (maroon header tiles, dark cards).
- `mm_logo_a.png` (white) / `mm_logo_b.png` (dark) — the full horizontal "MeshMedia" wordmark + mark, for login headers and emails.
- Recommended: ship the mark as an **SVG** favicon + app icon for crispness; export from these PNGs or re-trace.
- Usage: app sidebar/topbar = mark + Cormorant "Mesh Media"; login = full wordmark; client portal = mark + "Client portal" tag.

### Aether — the named AI assistant + brand mascot
Per the brand guidelines, the AI is **Aether** ("guardian of the brand-verse") — a laurel-crowned, circuit-suited figure with a crimson gaze (vision/insight) and a glowing orb. **Rename the assistant from "Meshi" to "Aether"** across UI strings, the launcher, and the system-prompt persona.
- **Avatar/launcher:** use `mm_aether_avatar.png` (circular crop) for the floating launcher and chat header. Use `mm_aether_main.png` / `mm_aether_orb.png` for empty states, the onboarding welcome, and marketing.
- **Persona/voice (for the system prompt):** insightful, composed, a little cinematic — "sees what a brand can become." Concise and helpful; never breaks character into "as an AI language model."
- **Per-portal Aether:** admin = ops/finance co-pilot that can act; team = task/time helper; client = friendly **concierge** ("when is my next deliverable?", "show my unpaid invoices"), scoped by RLS so it can never reveal or act beyond that client.

### Aether Cyan — a strictly scoped accent
Add **`--aether-cyan: #2BD6D6`** as a token, but **use it ONLY on Aether** — his avatar ring, the assistant panel chrome, the send icon, his energy/circuitry. It must **never** appear on general UI, type, buttons, or brand chrome; the rest of the system stays maroon / cream / warm-neutral. This is the one deliberate "energy" hue and it belongs to Aether alone. (Mockup shows the correct usage: the dark Aether card is the only place cyan appears.)

```css
:root { --aether-cyan: #2BD6D6; } /* Aether artwork & assistant chrome ONLY */
```

## B9. Responsive & multi-device (mobile, tablet, desktop)

**Cross-cutting requirement:** every screen must work on phone, tablet, and desktop. The current app is desktop-only (fixed sidebar, wide tables that overflow on small screens). Build **mobile-first** — design the small layout first, then enhance upward. This is an acceptance criterion for *every* phase, not a separate phase.

### Breakpoints (Tailwind defaults)
- `base` <640 (phone) · `sm` 640 · `md` 768 (tablet) · `lg` 1024 (small laptop) · `xl` 1280 · `2xl` 1536.
- Design at **360–390px** width first (typical phone); verify at 768 (tablet) and 1280 (desktop).

### Navigation
- **Desktop (≥lg):** persistent left sidebar (as today).
- **Tablet (md):** collapsible/icon-rail sidebar.
- **Phone (<md):** hide the sidebar; use a **top bar with a hamburger** that opens a slide-in drawer, **or** a bottom tab bar for the 4–5 primary destinations (Dashboard, Clients, Tasks, Finance, Aether). Bottom tabs feel native on phones — recommended for the team and client portals.
- The Aether launcher floats bottom-right but must **not** overlap the bottom tab bar — offset it, or dock Aether into the tab bar on phones.

### Tables → cards (the biggest fix)
Wide tables (Clients, Invoices, Expenses — 5–6 columns) overflow horribly on phones. Two acceptable patterns:
1. **Card list on phone:** below `md`, render each row as a stacked card (primary field bold, secondary fields as label/value pairs, status pill, a `⋯` actions menu). Switch to the real table at `md+`.
2. **Priority columns + horizontal scroll:** keep a 2-column essential view (e.g. Client + Amount/Status) with the rest behind a tap-to-expand, or allow horizontal scroll on a wrapper as a last resort.
Prefer pattern 1 for the main lists.

### Layout & components
- Multi-column grids collapse to 1 column on phone: KPI cards `grid-cols-2` on phone → `grid-cols-4` on desktop; detail pages stack the side panel above/below the main content.
- **Forms** go single-column on phone; sticky action bar pinned to the bottom of the viewport; use native inputs (`type="date"`, `type="tel"`, `inputmode="decimal"` for money) so phones show the right keyboard.
- **Modals/dialogs** become full-screen sheets (or bottom sheets) on phone, not tiny centered boxes.
- **Charts** must be fluid-width (`width:100%`, responsive container) — never fixed pixel widths.
- Detail header actions collapse into a `⋯` menu on phone.

### Touch & ergonomics
- **Minimum 44×44px** tap targets; spacing so adjacent actions aren't mis-tapped.
- Replace hover-only affordances (tooltips, row-hover actions) with tap-visible equivalents — **nothing critical behind hover** on touch devices.
- Respect safe areas: use `env(safe-area-inset-*)` padding for notched phones (especially a bottom tab bar / sticky save bar).
- Prevent iOS input zoom: form fields ≥16px font-size.
- Honor `prefers-reduced-motion`.

### Per-portal notes
- **Client portal** is the most likely to be opened on a phone — prioritize its mobile layout: big tap targets, Pay button thumb-reachable, Aether as a bottom-docked chat. Make it feel like a native app.
- **Team portal** on phone: focus on "my tasks today," quick time-tracking start/stop, and approvals — things people do on the go.
- **Admin** finance tables are fine to be tablet/desktop-first but must still be *usable* (card fallback) on phone.

### PWA / installable
- Ship the `site.webmanifest` (already generated) + icons so all three portals are **installable to the home screen** and run standalone. Add a service worker for offline shell + cached assets (Phase 8). `theme_color #6E1318`.

### Testing / acceptance
- Each PR: verify at **390px, 768px, 1280px**; no horizontal scroll on phone; all primary actions reachable one-handed.
- Run Lighthouse mobile (target ≥90 performance/accessibility) and test on a real iOS Safari + Android Chrome before sign-off.
- Add a viewport meta if missing: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

> Suggested Claude Code prompt: *"Make the app fully responsive per Part B9, mobile-first. Start with the app shell: convert the fixed sidebar into a desktop sidebar + mobile hamburger drawer (or bottom tab bar on the client/team portals), add the viewport meta, and make the Clients/Invoices/Expenses tables fall back to stacked cards below md. Show me the shell + one list page first."*
