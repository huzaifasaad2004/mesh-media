# Mesh Media → "Agency OS" Build Plan

**A phased roadmap to turn m3m.ae into an advanced, AI-native ERP + team management + client management + client onboarding platform.**

Stack: **GitHub** (source/CI) · **Vercel** (Next.js hosting + cron) · **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions, pgvector) · **Gemini** (LLM, embeddings, vision) · **Resend** (email)

## ✅ Phase 54 — Visual Workflow Automation Builder (released 2026-07-29)

`/settings/automations` upgrades the existing onboarding-template concept into a general,
manager-only WHEN / ONLY IF / DO THIS builder. It includes starter recipes, draft/active states,
ordered multi-action workflows, variable placeholders, manual test runs, duplicate-event
protection, and an auditable run history with per-action success/failure results.

Initial triggers: client created, lead won, quotation accepted, invoice paid (manual, split-payment,
or Stripe), task completed, project completed, and manual. Initial actions: create/assign a task,
notify selected staff roles by in-app notification + email, start an onboarding checklist, create a
client project, and update client status. Existing business mutations remain successful if the
automation migration is not live or an action fails; failures are recorded instead of rolling back
the source transaction.

Migration: `supabase/migrations/20260729151620_workflow_automation_builder.sql`.

Production migration applied and verified with all three tables under RLS and nine manager-only
policies. The application release includes no pre-activated rules; admins intentionally choose
which recipes to create and activate.

## 🟡 Phase 53 — Document Studio + automatic archive (prepared 2026-07-22)

Official `public/templates/MeshMedia_Letterhead.docx` is the master template. `/documents/studio`
creates letters, proposals, plans, scopes and reports with CRM recipient autofill, structured body
blocks, live A4 preview, statuses, duplicate/delete, and one-click DOCX/PDF exports. DOCX export
patches only `word/document.xml`; the source headers, footers, artwork, relationships and section
geometry remain intact. Server PDF export recreates the same letterhead using the supplied brand
assets and Helvetica, avoiding silent Avenir Next substitution on Vercel Linux.

Invoice/quotation downloads and sends now upsert their generated PDFs into a private
`document-archive` bucket. A launchd helper on the office Mac mirrors cloud archives every minute
to `MESH MEDIA DOCUMENTS/QUOTATION`, `MESH MEDIA DOCUMENTS/INVOICES`, and `MESH MEDIA
DOCUMENTS/DOCUMENT STUDIO` without deleting local files. Migration:
`supabase/migrations/20260722152124_document_studio_archive.sql`.

**Not live yet:** migration, launchd installation and production deployment require explicit
approval after local verification.

## ✅ Phase 51 — Mesh Chat presence & notifications (shipped 2026-07-22)

Private Realtime presence, per-channel typing
indicators, durable sent/delivered/read receipts, @mention autocomplete/highlighting, and opt-in
browser push notifications. Migration: `supabase/phase51_chat_presence_receipts_mentions_push.sql`.
`supabase/phase52_chat_function_grants.sql` explicitly removes anonymous execution from the two
chat authorization helpers after Supabase's security advisor caught role-specific grants that
survived the earlier `PUBLIC` revoke. Production and Preview have the required VAPID variables.

## ✅ Phase 50 — Mesh Chat (shipped 2026-07-22)

Native staff messaging at `/chat`: public/private channels, direct and group chats,
real-time messages, replies, reactions, read markers, image/PDF sharing, and recorded
voice notes. Supabase migration: `supabase/phase50_team_chat.sql`. The migration and
application code must be deployed together.

Use this document as the master plan. Each phase below is written so you can hand it to Claude Code as a self-contained brief.

---

## ✅ URGENT batch — ALL DONE (session 8, 2026-07-09/10)

Everything that was in the 🚨 URGENT section (§A–§D below, requested 2026-07-08/09) is now
**built, migrated, verified live, and pushed to production.** The detailed per-item briefs that
used to live here have been superseded by this summary — see git log commits `b2d96de`,
`7ff8818`, `a8f9792`, `89c9162` for the full original write-ups and diffs if needed.

**§A Platform workflows** — all 3 shipped:
1. ✅ **File module overhaul** (`phase32_files_module.sql`) — real upload to a new
   `project-files` bucket (≤8MB) or a "link a Drive file" option for larger assets; a
   `client_visible` flag (defaults by category, always overridable) controls what the client
   portal's Files card shows. Both the dropzone and Upload button, previously non-functional
   stubs, are now wired end-to-end with working download/delete.
2. ✅ **Content approval workflow** (`phase27_content_approvals.sql`) — new `content_items`
   table: creator submits → manager reviews (forward to client / send back with comment) →
   client approves/declines/comments in the portal. Employees never have a path to submit
   directly to a client — matches the member-scoping pass in §D.
3. ✅ **Email notification system** (`phase28_notification_preferences.sql`) — per-user,
   per-category (task assignment / approval request / content review / critical alert) email
   toggle, reachable from the notification bell's gear icon. Wired into 11 of the ~13 existing
   notification points (the 2 salary ones already send a dedicated payslip email, so weren't
   double-wired).

**§B Document/e-signature fixes** — 2 of 3 shipped, 1 deliberately deferred:
4. ✅ **Signature placement visibility** — a live preview overlay anchored to the bottom of the
   document (split Agency/Client) shows exactly where a signature will land, updating in real
   time as you draw or type.
5. ✅ **Client signing email** — replaced the bare unstyled email with the branded template
   used elsewhere; Resend failures are now logged server-side and surfaced as a toast instead
   of failing silently.
6. ⬜ **Full placeholder/field system** (drag-and-place signature/name/date fields on upload,
   merged final PDF) — NOT built. This is a real PDF-annotation project, scoped separately per
   the original brief's own recommendation. Worth its own session.

**§C Finance/salary bugs and gaps** — all 5 shipped:
- ✅ **"This month" report bug** — `resolvePeriod()` now caps all "current period" ranges
  (week/month/quarter/year) at today instead of leaving the end open-ended, so a future-dated
  row can never leak into revenue figures again.
- ✅ **PKR/AED salary blending** — Salaries page and Finance dashboard tile now show
  per-currency subtotals instead of a blended, misleading single number. (A third instance of
  the same bug was later found and fixed live on the Team page — see session log below.)
- ✅ **"Set Salary" dropdown leaking clients** — `GET /api/profiles` now excludes `role='client'`
  rows server-side; it's a staff-picker endpoint (tasks, salaries), never meant to include
  client-portal accounts.
- ✅ **Split/partial salary payments** (`phase29_salary_partial_payments.sql`) — relaxed the
  one-payment-per-period DB constraint; the Payments modal now shows a running total/remaining
  balance and defaults the next amount to whatever's left.
- ⬜ Not explicitly revisited: the salary module's other minor gaps mentioned in the original
  brief (items 11–12 in the old numbering) were confirmed already working during triage — no
  action needed.

**§D Roles, permissions & task flow** — 4 of 5 shipped, 1 deliberately deferred:
7. ✅ **Member-role scoping** (`phase25_member_scoping.sql`) — `member` now only sees clients/
   projects/tasks/files/contracts/milestones they're actually assigned to (via `project_members`
   or an assigned task), via two new SQL helper functions `my_assigned_client_ids()` /
   `my_assigned_project_ids()`. Every table that previously had a single `FOR ALL` write policy
   (which — Postgres RLS gotcha — was silently also granting broad SELECT) got split into
   command-specific policies so the new read scoping actually takes effect.
8. ✅ **Task flow** (`phase26_task_delegation.sql`) — only managers+ create/assign/delete tasks;
   members get a status-only editor for tasks already assigned to them, enforced at both the API
   and RLS layers.
9. ✅ **Invoice side-door on project pages fixed** — `/api/projects/[id]` now checks
   `finance.read` before including invoice data in the response, not just relying on RLS.
10. ✅ **Task visibility restricted to assigned-only** — same migration as #7 (member's `tasks`
    SELECT policy now requires `assigned_to = auth.uid()`).
14. ✅ **Profile pictures** (`phase30_profile_pictures.sql`) — new self-service `/profile`
    (staff) and `/portal/profile` (client) pages, avatar upload to a new `avatars` bucket, wired
    into every place that previously always showed initials (sidebar, Team page, task assignee
    avatars, portal header).
15. ⬜ **Full granular per-feature access manager** — NOT built. The Permissions Matrix is still
    the flat 9-key list from Phase 1. This was flagged as the single largest item in the whole
    batch and the original brief itself suggested deciding whether to build it first (more
    architecturally correct) or generalize into it later (faster) — that decision is still open.
    See **Improvement Ideas** below for a concrete starting shape.

---

### Session log — live production issues fixed same-day (2026-07-09/10)

Reported live by Huzaifa after the batch above shipped, all fixed and verified same session:

- **Team page salary currency** — same root cause as the §C fix above, but on a third page
  (`app/(dashboard)/team/page.tsx`) that called `formatCurrency(salary.amount)` without the
  currency argument. Fixed.
- **`hello@m3m.ae` not receiving mail** — root-caused via direct DNS lookup (not a code bug):
  the domain had **zero MX records** at all, so nothing sent to any `@m3m.ae` address had
  anywhere to be delivered. Outbound sending was fine (a separate `send.m3m.ae` subdomain,
  correctly configured for Resend). Added the Google Workspace MX (`smtp.google.com`, priority
  1) + SPF TXT records in Cloudflare DNS; confirmed propagated on two independent resolvers.
- **"Top paying client" showing wrong data** — not a bug in the reporting code; one specific
  invoice (`MM-INV-2025-00076`) had a `paid_date` 93 days after its issue date, a clear outlier
  against the 0–3 day pattern found across all 43 other paid Zoho-imported invoices. Corrected
  the one bad row to match its issue date.
- **Invoice edit form showing "AED 0.00"** — found while investigating the above: any of the 46
  invoices imported from Zoho Books (no line-item breakdown, only a raw `total`) showed a
  misleading computed AED 0.00 in the edit form instead of the real stored total. Fixed to show
  the real total with an explanatory banner when no breakdown exists.
- **ADIB bank statement import** — ~171 personal + business card transactions imported into
  Expenses, deduped against existing records by exact (amount, date) match, categorized into
  the existing 6-value enum. Per Huzaifa's explicit choice, imported as-is including personal
  spending (not split into a separate personal ledger).

### New feature (not in the original brief): partial/split invoice payments

Requested live mid-session. New `invoice_payments` table + `invoices.amount_paid` running total
+ a new `partially_paid` status (`phase31_invoice_partial_payments.sql`). Record a payment with
any date/amount via a wallet-icon action on each invoice row; the invoice auto-transitions
between `partially_paid` and `paid` based on the cumulative total. Every "outstanding balance"
calculation across the app (Invoices list, Finance dashboard, cash-flow forecast, client detail
page, client statement, portal, Aether's finance tools, dunning reminders) now nets out
`amount_paid` instead of assuming the full invoice total is owed. Stripe's "Pay Now" charges the
remaining balance, not the original full amount.

---

## ✅ Session 10 (2026-07-15) — member-role vulnerability sweep

Huzaifa reported live: a `member` account could see client contact emails, view full
invoice/financial detail on client pages, create/edit clients and contracts, submit content
straight past manager review, and see/delete every company e-signature document regardless of
who uploaded or signed it. Fixed end-to-end (DB RLS + API + UI, not just hiding buttons):

1. **Clients/contracts writes were wrongly open to `member`** — `OPS_WRITE` (owner/admin/
   manager/member) was used for client and contract create/update/delete, both in the API routes
   (`app/api/clients/route.ts`, `app/api/clients/[id]/route.ts`, `app/api/contracts/*`) and the
   underlying RLS policies from phase25. Narrowed both to `MANAGERS` (owner/admin/manager) —
   `supabase/phase40_member_restrictions.sql`.
2. **Client contact emails and finance detail hidden from `member`** — `/clients/[id]` and the
   `/clients` list no longer fetch or render `client.email`/`contacts.email`, the Account
   Statement (invoices) card, monthly retainer, Portal Access, or Onboarding sections unless the
   viewer is manager+; the Edit button and clients-list Retainer/Email columns/actions are
   likewise manager+ only. The invoices query itself is skipped entirely for a member rather
   than just hidden client-side.
3. **Content approval now has an explicit "send to manager" step** — the submit form was
   missing exactly what Huzaifa asked for: a manager picker. Added `assigned_manager_id` to
   `content_items`, a required "Send to manager" dropdown in the submit modal (populated from
   real owner/admin/manager profiles), server-side validation that the chosen person really is a
   manager, and the assigned manager's name now shows in the list ("sent to Abid"). The
   underlying DB design already guaranteed nothing reaches the client without manager sign-off
   (`status` always starts `pending_manager`) — this was a UI gap, not a security hole.
4. **Documents module: member could see/delete/edit every company e-signature document** —
   `documents.write` had been defaulted to `member` by mistake (leftover from the old flat
   OPS_WRITE grouping) and `signable_documents`/`document_signatures`/`document_fields`/
   `document_recipients` all read via a blanket `is_staff()` policy. Removed `member`'s
   `documents.write` default and added a `my_assigned_document_ids()` scoping function (own
   uploads + assigned client/project + documents they're personally a named signer on, matched
   by email) — a member now only sees documents relevant to them; upload/edit-fields/delete
   buttons are hidden client-side too. Managers+ keep full visibility, matching every other
   module's scoping pattern from phase25.

**Needs `supabase/phase40_member_restrictions.sql` run in the Supabase SQL editor** — degrades
safely until then (existing RLS just stays as it was, no breakage, but the fixes above won't
take effect).

## ✅ Session 10 continued — PR media-placement / EMV tracker

The last never-started flagship differentiator from Tier 4. New `/media` page (nav: "Media
Coverage") — logs press placements per client (outlet name/type, placement type, sentiment,
publish date, a link to the coverage, estimated reach) and computes **Earned Media Value**:
`EMV = AVE (Ad Value Equivalent, what the space would cost as paid media) × a configurable
multiplier` (industry norm 2–10× since earned coverage reads as more credible than an ad; default
3×). Stat cards up top total EMV/AVE/reach and placement count for whatever's currently filtered
(client / outlet type / sentiment). `supabase/phase41_media_placements.sql` adds the
`media_placements` table plus new `media.read`/`media.write` permissions (owner/admin/manager
full access by default; **member also gets both by default**, scoped like content approvals — a
member can only log/see/edit coverage for clients they're actually assigned to, and can only
delete placements they logged themselves). A compact "Media Coverage" card was added to the
client detail page (recent 5 + EMV each, links to the full filtered list). New
`lib/apiAuth.ts` helpers `requireMediaRead`/`requireMediaWrite`; `MODULE_LABELS` on
`/settings/permissions` extended so `leads.*`/`media.*`/`contractors.*` get proper section
headers instead of the raw key. No Aether tool yet (`search_media_coverage` would be a
reasonable fast-follow, same pattern as the CRM lead tools).

**Needs `supabase/phase41_media_placements.sql` run in the Supabase SQL editor** to go live.
Verified with a clean `tsc --noEmit` and full production `next build`; not yet exercised in a
live browser session (this repo sits behind Supabase auth with no throwaway credentials
available in-session — worth a manual click-through after the migration runs).

## ✅ Session 10 continued — Knowledge base / SOPs

The last remaining unstarted module on the entire original roadmap (§3 Module map, Phase 8). New
`/knowledge` page (nav: "Knowledge Base") — staff write SOPs/how-tos with lightweight formatting
(`# `/`## ` headings, `- ` bullets, blank-line paragraphs — rendered as real React elements, never
`dangerouslySetInnerHTML`, so there's no HTML-injection surface even though authors write more
than plain prose), organized by a free-text `category`, with draft/published status. Search +
category filter client-side; reading an article opens a dedicated view with Edit/Delete for its
author or any manager+.

`supabase/phase42_knowledge_base.sql` adds `kb_articles` plus `kb.read`/`kb.write` permissions.
Unlike every other module tightened this session, **`kb.read` defaults to every staff role
including member and viewer** — reading company SOPs isn't a client-scoped or financially
sensitive action the way clients/invoices/documents are, so there was no reason to restrict it;
`kb.write` (create/edit/publish/delete) stays manager+ only, same review-gate pattern as
everything else. RLS lets an author see their own drafts before publishing; everyone else only
ever sees `published` articles.

The most valuable part of the integration: `refresh-embeddings` (the nightly cron already
powering Aether's RAG) now also embeds every **published** KB article, and the `embeddings` table's
`entity_type` CHECK constraint was extended to allow `'kb_article'`. Aether's existing
`search_knowledge` tool is entity-type-agnostic — it already returns whatever it finds regardless
of type — so SOPs are now answerable through Aether ("what's our SOP for onboarding a new
client?") with **zero new tool code**, just data flowing through the pipeline that already
existed. Its description was updated to mention SOPs so the model knows to reach for it.

**Needs `supabase/phase42_knowledge_base.sql` run in the Supabase SQL editor** to go live; the
nightly embeddings cron will then pick up any published article automatically on its next run (or
trigger `/api/cron/refresh-embeddings` manually to pick it up immediately). Verified with a clean
`tsc --noEmit` and full production `next build`.

## ✅ Session 10 continued — Dunning dry-run + Files access log/versioning

Two smaller improvement-idea items closed out:

- **Dunning dry-run** — `/api/cron/dunning` gained a `?dryRun=1` mode that computes exactly which
  invoices would get a reminder and at what stage, without sending any email or mutating
  `dunning_stage`/`last_reminder_sent_at`/`status`. Used it to verify the logic directly against
  production data (replicated the same read-only query outside the route itself, since no local
  session/cron-secret was available to call the live endpoint from here): only 2 invoices are
  currently overdue (both Mawad Online), and both already sit at `dunning_stage: 3` with a real
  `last_reminder_sent_at` from 2026-07-08 — meaning the scheduled Vercel cron has already been
  running this in production all along, and correctly stopped escalating past the final stage.
  Not a bug; the "never verified live" note in the old improvement-ideas list was simply stale.
  Worth a manual follow-up with Mawad Online given how long they've sat at final-notice.
- **Files module access log / versioning** (improvement idea #4) — `supabase/phase43_file_versions.sql`
  adds `root_file_id` (null on the original upload, points at the root on every later version) and
  `version` to `files`. New `/api/files/[id]/versions`: `GET` returns the full version history
  (uploader + timestamp + download link — this doubles as the access log), `POST` uploads a
  replacement that inherits the original's client/project/category/client_visible (a version
  can't quietly change what a file *is*, only its content) and requires you be replacing the
  *current* latest version, not an older one. `GET /api/files` now collapses each chain down to
  its latest version for the main list (older versions still exist as immutable rows, just
  reached through the history modal, not cluttering the list). Files page gained a "v3"-style
  badge (click to open history), a History button, and a Replace button per file.

**Needs `supabase/phase43_file_versions.sql` run in the Supabase SQL editor** to go live. Verified
with a clean `tsc --noEmit` and full production `next build`.

## ✅ Session 10 continued — Fixed the real 8MB upload-limit bug

The "worth confirming with a real upload" improvement idea turned into a genuine bug fix. Tested
directly against **production** by POSTing raw base64-JSON payloads of increasing size straight
at `/api/files` with curl (no auth needed — the point was to see whether Vercel's platform gateway
rejects the body before our code even runs): a 7MB file (9.8MB JSON payload, well under the
documented "8MB" limit) came back `413 FUNCTION_PAYLOAD_TOO_LARGE` — a raw platform-level
rejection, not our friendly error. Binary-searched the actual cutoff: **~3.2MB raw file survives,
~3.3MB does not** (base64's ~33% overhead pushes it past Vercel's real ~4.5MB serverless function
body-size ceiling). The code's own `MAX_UPLOAD_BYTES = 8MB` check was never reachable for anything
that would actually trip it — anyone uploading a file over ~3.3MB got a confusing raw error
instead of ever hitting our validation.

Fixed everywhere a base64 file/image gets POSTed as JSON, not just the Files module — same
platform ceiling applies to every one of them: new shared `lib/uploadLimits.ts`
(`MAX_DIRECT_UPLOAD_BYTES = 3MB`, safely under the real wall) now backs `/api/files`,
`/api/files/[id]/versions`, `/api/documents` (e-signature uploads — previously had **no size check
at all**), `/api/contractors/[id]/files` (also had none), `/api/expenses/receipt`,
`/api/ai/extract-expense`, and `/api/celine/expense-capture` (Celine's photo-receipt capture —
also had none). Client-side pre-checks were added on the Files and Documents upload forms so a
too-large file is rejected instantly with a clear message instead of a failed network call; UI
copy ("under 8MB") corrected to the real, verified 3MB across the Files module.

No migration needed — this is a pure code/config fix, live as soon as it's deployed. Re-verified
the new boundary directly against production after the fix: 2.8MB raw passes, 3.4MB is rejected by
Vercel exactly as expected.

## ✅ Session 10 continued — "Ask Aether about this client" + dark mode

Two of the brainstormed improvement ideas from the innovation list, picked by Huzaifa.

**Ask Aether about this client.** Aether's floating chat was a single component holding its own
state — nothing else in the app could open it pre-loaded with context. Lifted that state into a
new `components/AiChatContext.tsx` (`AiChatProvider`/`useAiChat()`), wrapping the dashboard layout.
Any component can now call `ask(prompt, { name: clientName })` to open Aether, tag the
conversation with a client, and send a prompt immediately. New `AskAetherButton` on the client
detail page header does exactly that — "Tell me everything you know about {client}…" — reusing
the `find_client`/`search_knowledge` tools that already existed, **zero new Aether tools needed**.
The client tag shows as a small "Talking about: X" chip in the chat header (with an ✕ to clear)
and is sent as `clientContext` on every message in that conversation; `/api/ai/chat`'s system
prompt now includes a note like *"the user opened you from X's page — assume that's who 'this
client' means, but still call a real tool rather than answering from this hint alone"* so follow-
ups ("what's their outstanding balance") resolve without repeating the name. All of Aether's
existing RLS/permission scoping is untouched — this only biases which client a vague follow-up
resolves to, not what data any tool is allowed to return.

**Dark mode.** The app is built entirely with literal Tailwind utility classes (`bg-white`,
`text-gray-500`, `bg-paper-100`, …) rather than the CSS variables already defined in
`globals.css`, so adding a `dark:` variant to every element across ~100 files wasn't realistic in
one session. Instead: a `data-theme="dark"` attribute on `<html>` (toggled via new
`components/ThemeToggle.tsx`, next to sign-out in the sidebar footer; persisted to
`localStorage['mm-theme']`, defaulting to `prefers-color-scheme` on first visit; applied by an
inline script in `app/layout.tsx` before first paint so there's no flash) plus a large, centralized
override block in `globals.css` that redefines every literal color utility class actually used in
the app (enumerated by grepping the codebase — `bg-white`, the full `gray`/`paper`/`sand`/`taupe`/
`umber`/`brand` scales, status tints like `bg-green-100`/`text-red-600`, and their `hover:`
variants) scoped under `[data-theme="dark"]`. This reskins every existing page with **zero
component-file changes** — the trick works because those overrides are plain (unlayered) CSS,
which the cascade always ranks above anything in Tailwind's `@layer utilities`/`@layer components`,
regardless of source order. A separate pass was needed for classes compiled via `@apply` into named
component classes (`.btn-secondary`, `.input`, `.table-row`, `.sidebar-link`, etc.) since those
never carry a literal `.bg-white` class in the DOM for the utility overrides to catch — each got
its own explicit dark-mode rule. Brand identity is preserved: maroon filled buttons/active nav
stay maroon in both themes (a dark fill reads fine on a dark shell), Aether's cyan chrome is
unaffected (it was already dark by design).

Verified with a clean `tsc --noEmit`, full production `next build`, and a real rendered screenshot
of both themes on the login page (dev server, no auth needed) — full dashboard pages weren't
click-tested live since no test account credentials were available in this session; worth a manual
pass through the main modules (Clients, Finance, CRM, Tasks) after this deploys to catch anything
the grep-based enumeration missed.

**✅ Confirmed run in Supabase, in order:** `phase18_portal_access.sql` through `phase32_files_module.sql`
(all pre-existing/prior-session), plus this session's `phase33_esignature_fields.sql`,
`phase34_esignature_recipients.sql`, `phase35_granular_permissions.sql`, `phase36_embeddings.sql`,
`phase37_contractors.sql`, `phase38_contractor_login.sql`. **⚠️ `phase39_crm_leads.sql` (session 10)
is written but NOT yet run** — run it next; after that, the next migration should be numbered `phase40`.

**⚠️ Online payments (Stripe) still needs keys** — code is fully built (Checkout session
creation, webhook handler, Pay Now button charging the remaining balance, idempotent paid-status
update) but inert until `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_WEBHOOK_SECRET` are added to the environment (the last one only after registering a
webhook endpoint at `https://www.m3m.ae/api/webhooks/stripe` for `checkout.session.completed`
in the Stripe dashboard).

**✅ Done:** PR media-placement/EMV tracker, knowledge base/SOPs (both session 10, 2026-07-15).
Every module on the original roadmap (§3 Module map) is now at least an MVP — see
**Improvement ideas** below for smaller polish items.

## ✅ Session 10 continued — Team notifications, KB/Media lockdown, sidebar unread dots

Huzaifa asked for comprehensive team notifications (task assignment, content approval decisions,
feedback), for Knowledge Base and Media Coverage to be hidden from `member` entirely, and for a
visual "you haven't opened this yet" indicator in the sidebar. A meetings module with Google Meet
integration was also requested — that's large enough to be its own section below.

**KB/Media restricted to manager+** (`supabase/phase44_restrict_kb_media.sql`) — reversing the
default-on grants from phase41/42. `member` loses `kb.read`/`media.read`/`media.write` outright.
`kb_articles`' read policy already gated its published-articles branch on `has_permission(...,
'kb.read')`, so revoking the grant was enough there; `media_placements`' read policy explicitly
allowed `member` for their assigned clients regardless of permission grants, so that branch was
removed from the policy itself, not just the permission row. Both `/media` and `/knowledge`
disappear from the sidebar for `member` automatically (`navVisible` was already permission-gated).

**Task comments/feedback** (`supabase/phase45_task_feedback.sql`) — new `task_comments` table,
visibility mirroring the `tasks` table itself (phase25: managers+ see all, a member only sees
comments on tasks assigned to them); anyone who can see a task can leave feedback on it. New
`components/tasks/TaskComments.tsx` renders inline in the task edit/status modal
(`app/(dashboard)/tasks/page.tsx`) once a task already exists. `POST /api/tasks/[id]/comments`
notifies whoever else is party to the task (assignee + creator, excluding the commenter) under a
new dedicated `task_feedback` notification category — deliberately not lumped into
`task_assignment`, since feedback is frequent enough to want its own on/off toggle in
`/notification-preferences`. A `meeting` category was added in the same migration too, anticipating
the meetings module below. Also added: `PUT /api/tasks/[id]` now notifies the task's creator (not
just the assignee) once a task is marked `done` — closing the loop that previously only fired
notifications one direction (creator → assignee on assignment, never assignee → creator on
completion).

**Sidebar unread red-dot** — the existing `NotificationBell` owned its own local state; lifted it
into a new `components/NotificationsContext.tsx` (`NotificationsProvider`/`useNotifications()`,
wrapping the dashboard layout alongside `AiChatProvider`) so `Sidebar` can read the same live
unread set. Each nav item now shows a small red dot if any *unread* notification's `href` matches
that module (prefix match, e.g. an unread notification linking to `/tasks` lights up the Tasks nav
item). Changed the read/unread model along the way: previously opening the bell dropdown at all
silently marked *everything* read; now only clicking a specific notification (or the new explicit
"Mark all read" link) marks things read — otherwise the sidebar dot would clear the instant
someone glanced at the bell without actually opening the relevant page, defeating the point of a
per-module indicator.

**Needs `supabase/phase44_restrict_kb_media.sql` and `supabase/phase45_task_feedback.sql`** run in
the Supabase SQL editor (in that order — 45 doesn't depend on 44, but keep migration numbering
sequential). Verified with a clean `tsc --noEmit` and full production `next build`; not yet
click-tested live (no test account credentials in this session).

## ✅ Session 10 continued — Meetings module with Google Meet integration

New `/meetings` page (`supabase/phase46_meetings.sql`): manager+ schedules a meeting with any mix
of staff, contractors, and ad-hoc client contacts (name+email, same pattern as documents/content
recipients), optionally tagged to a specific client. Real Google Meet links are auto-generated via
`lib/google/calendar.ts`, creating a Calendar event with `conferenceData.createRequest` — the only
way to mint a real Meet link server-side (there's no standalone "create a Meet link" API).

**Auth design changed mid-build**: the first pass used a service account with Workspace
domain-wide delegation. Huzaifa pointed out Celine (`~/celine`) already has a working Google
Calendar+Gmail OAuth integration (a real user-consent OAuth2 client, `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET`, type **Web application** — confirmed by reading Celine's own `SETUP.md`),
and asked to reuse it instead of standing up a whole separate service account + Workspace Admin
console authorization. Since it's a Web application client (not Desktop), it supports multiple
registered redirect URIs — so Mesh Media reuses the *exact same* `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET`, just with its own additional redirect URI
(`/api/google/oauth/callback`) added to that one existing Cloud Console client, and its own
independent OAuth token (own `google_oauth_tokens` row, own `TOKEN_ENCRYPTION_KEY` — deliberately
not shared with Celine's, so a leaked key in one app can't unlock the other's tokens). New
`lib/google/oauth.ts` mirrors Celine's own `core/src/integrations/google/auth.ts` almost exactly
(AES-256-GCM token encryption via `lib/crypto.ts`, same `access_type:'offline', prompt:'consent'`
pattern to force a refresh token) but drives the consent flow through the deployed web app itself
— **Settings → Integrations** has a "Connect Google Calendar" button (owner/admin only,
`/api/google/oauth/*`) rather than Celine's local-machine CLI script, since Mesh Media runs on
Vercel with no interactive terminal to run a loopback-redirect script from. Exact steps (just
adding one redirect URI + 3 env vars) are in `SETUP.md` Step 7.

The manual-link fallback still exists: if Google isn't connected yet
(`isGoogleCalendarConnected()` returns false — now an async DB check, not just an env-var
presence check), scheduling still works — the organizer pastes a Meet link themselves and
everything else (emails, reminders, in-app notifications) behaves identically.

Every attendee gets a branded Resend email (`lib/meetingEmail.ts`) on invite, reschedule, and
cancellation, plus in-app notifications (new `meeting` category, added in the same migration as
`task_feedback`) for anyone with an account.

**Reminders (24h and 15min before) are exact-time, not a daily digest** — the first design used a
polling cron, but m3m.ae is on Vercel's **Hobby plan**, which only allows daily-or-coarser cron
schedules, so a `*/10 * * * *` polling schedule would likely have failed deployment and a daily
digest was the fallback. Reworked once it came up that **Resend itself supports scheduled
sending** (`scheduledAt` on `emails.send`, plus `emails.cancel(id)`) — no cron needed at all.
`scheduleAttendeeReminders()` (`lib/meetingEmail.ts`) fires both reminder emails straight from
Resend's own queue at meeting-creation time, exact to the minute, completely sidestepping the
Vercel plan's cron-frequency limit. `supabase/phase47_meeting_reminder_scheduling.sql` adds
`reminder_24h_email_id`/`reminder_15m_email_id` to `meeting_attendees` to store the Resend email
ids Resend hands back — needed so a reschedule or cancellation can call `emails.cancel()` on the
stale reminder before scheduling a fresh one (otherwise a rescheduled meeting would still fire a
reminder for its old time). The earlier polling cron (`/api/cron/meeting-reminders`) and its
`vercel.json` entry were removed entirely — this is strictly better, not a workaround.

Attendees can accept/decline their invite in-app (`POST /api/meetings/[id]/respond`, RLS lets a
user update only their own `meeting_attendees` row).

RLS: managers+ see every meeting; anyone else (member, contractor, client-portal user) only sees
meetings they're actually invited to, or ones tagged to their own client. `meetings.write` stays
manager+ only, consistent with every other write-permission tightened this session.

**Needs `supabase/phase46_meetings.sql`, `supabase/phase47_meeting_reminder_scheduling.sql`, then
`supabase/phase48_google_oauth.sql` run in the Supabase SQL editor** (in that order), plus
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`TOKEN_ENCRYPTION_KEY` (optional — see above) and a
one-time "Connect Google Calendar" click in Settings to enable real auto-generated Meet links.
Verified with a clean `tsc --noEmit` and full
production `next build`; the Google Calendar code path and Resend's scheduled-send behavior
couldn't be exercised live since no Google Cloud credentials exist yet for this project and
scheduled sends only become observable after the fact.

**Live bug found and fixed same session: `supabase/phase49_fix_meeting_rls_recursion.sql`.**
Huzaifa connected Google Calendar, scheduled a real meeting (it created successfully — real
Google Meet link, real Calendar event, invite emails all sent via Resend), but the Meetings page
showed "No upcoming meetings" anyway with no visible error. Root-caused via Safari's Web
Inspector Network tab: `GET /api/meetings` was returning `{"error": "infinite recursion detected
in policy for relation \"meeting_attendees\""}`, which the frontend's `Array.isArray(m) ? m : []`
fallback silently swallowed into an empty list — a real UX gap (a failed fetch should surface
something, not look identical to "genuinely no meetings"). The actual bug: `meetings`' read
policy queried `meeting_attendees` directly, and `meeting_attendees`' read policy queried
`meetings` directly — each triggered the other's RLS check, which triggered the first again,
until Postgres's recursion guard gave up. Every other cross-table read policy in this schema
(`my_client_ids()`, `my_assigned_client_ids()`, etc.) already avoids exactly this by wrapping the
lookup in a `SECURITY DEFINER` function, which runs with the function owner's privileges and so
doesn't re-trigger RLS on the table it queries — phase46 just hadn't applied that pattern to the
two new tables. Fixed by adding `my_meeting_ids()`/`my_organized_meeting_ids()`/
`my_client_meeting_ids()` SECURITY DEFINER helpers and rewriting both policies to use them. Pure
SQL fix, no application code changed.

**Two more live bugs found and fixed, unrelated to each other:**

1. **Team members couldn't log in — "Email not confirmed."** Root cause: `POST /api/team/[id]/password`
   (action `set` — an admin directly assigning a password, bypassing the invite-email-click flow
   entirely) called `admin.auth.admin.updateUserById(id, { password })` without also passing
   `email_confirm: true`. Supabase Auth blocks sign-in on an unconfirmed email regardless of how
   correct the password is, and an account created via `generateLink({type:'invite'})` that never
   had its link clicked stays unconfirmed forever otherwise. The contractor equivalent
   (`/api/contractors/[id]/set-password`) already did this correctly since it calls `createUser`
   fresh with `email_confirm: true` — only the team-password route had the gap. Fixed the route,
   and directly confirmed the two already-affected accounts (Nabil's real account plus one test
   account) via the admin API so they could sign in immediately without needing a new password.
2. **Meeting times in emails were ~4 hours off from what the app showed.** The Meetings UI renders
   times client-side, correctly reflecting the browser's local timezone (Dubai, for a team member
   physically there). The email HTML, however, is generated server-side (Vercel functions default
   to UTC), and `lib/meetingEmail.ts`'s date formatting had no explicit `timeZone` — so it silently
   rendered in UTC while the app showed Dubai time, a fixed 4-hour gap. Fixed by pinning every
   server-side meeting-related date format (the email template and the "New meeting scheduled"
   in-app notification body) to `timeZone: 'Asia/Dubai'` explicitly, matching the agency's actual
   timezone (UTC+4, no DST) regardless of where the serverless function happens to execute.

---

## ✅ Session 9 (2026-07-13) — e-signature fields, granular permissions, RAG Aether, Contractors

1. ✅ **E-signature: drag-and-place fields + merged signed PDF** (`phase33_esignature_fields.sql`) —
   replaced the old single whole-document signature-per-party with real placed fields (signature/
   name/date) at exact page coordinates. Staff place fields in a new drag-and-place editor
   (`/documents/[id]/edit-fields`, `pdfjs-dist` renders real PDF pages to canvas — worker
   self-hosted at `public/pdf.worker.min.js` for CSP). Signers fill fields directly on the
   rendered page. Once every field is filled, `pdf-lib` (`lib/pdf/mergeDocument.ts`) stamps the
   values onto the *original* PDF bytes and produces a real flattened, merged file — the first
   actual PDF-manipulation library in this repo. Old documents with no placed fields keep using
   the legacy iframe/whole-doc sign flow untouched (zero regression).
2. ✅ **E-signature: arbitrary named recipients + token links + completion certificate**
   (`phase34_esignature_recipients.sql`) — a document is no longer tied to one CRM client for
   signing. Upload now takes a list of named recipients (any mix of client/employee/other), each
   emailed a personal `?token=` signing link — **no account required**, same pattern reused later
   for Contractors. Once every recipient signs, auto-generates a Certificate of Completion PDF
   (`lib/pdf/CertificatePdf.tsx` — signer identities, IPs, timestamps, SHA-256 hash of the final
   file) and emails the signed PDF + certificate to every signer and the uploader.
3. ✅ **Granular per-action permissions** (`phase35_granular_permissions.sql`) — the biggest
   remaining lever flagged in the old §D #15 write-up. Converted 6 previously hardcoded
   `MANAGERS`/`OPS_WRITE` role-array checks into real togglable permission keys:
   `tasks.manage`, `projects.write`, `projects.delete`, `invoices.send`, `documents.write`,
   `content.approve` — editable per-role (`/settings/permissions`) and per-person (Team → Manage
   Access), both now grouped by module. Every seeded default exactly mirrors the prior hardcoded
   behavior, so this was a no-op until a toggle is actually changed. (Note: `clients.read/write`,
   `tasks.write`, `finance.*`, `payroll.*`, `team.manage`, `settings.manage` from the original
   Phase 1 9-key matrix are untouched; full RLS-level `view_all` vs `view_assigned` toggles were
   *not* built — still a future step if wanted.)
4. ✅ **RAG-grounded Aether + a real security fix** (`phase36_embeddings.sql`) — nightly cron
   (`/api/cron/refresh-embeddings`, 2am) embeds clients/projects/tasks/client_notes via Gemini
   `text-embedding-004` into pgvector; new `search_knowledge` tool lets Aether answer open-ended
   questions ("what have we discussed with X"). **Found and fixed in passing**: every Aether tool
   read previously ran through a service-role client with **no RLS at all** — a `member` could ask
   Aether about clients/tasks outside their normally-assigned scope. Reads now run through the
   caller's real RLS-scoped session (writes still go through service-role, but only after the
   same manual role check every other write route already does); the `match_embeddings` RPC uses
   `SECURITY INVOKER` specifically so RLS isn't silently bypassed there either.
5. ✅ **Contractors module** (`phase37_contractors.sql`, `phase38_contractor_login.sql`) — new,
   requested mid-session: project-based freelancers paid one-off amounts, separate from salaried
   payroll. Add a contractor with just name + optional email/phone/bank details → they're emailed
   a personal token link (no account) where they see every payment (grouped by currency, AED/PKR
   like salaries), download a branded PDF receipt per payment, and upload their own project files.
   Recording a payment auto-emails a receipt. **Then extended with optional login**: a contractor
   can set a password from their token page to get a normal email+password login afterward (new
   `contractor` role in `profiles`, mirrors how `client` works) landing on a new `/contractor-portal`
   — the token link keeps working either way, login is additive, not a replacement.

---

## ✅ Session 10 (2026-07-13) — CRM / leads pipeline (old roadmap item #16)

Built code-complete this session; **needs `phase39_crm_leads.sql` run in Supabase** before it
works (the /crm page degrades gracefully with a "run phase39" empty state until then).

- **Schema** (`phase39_crm_leads.sql`): `pipeline_stages` (5 seeded ordered kanban columns:
  New → Contacted → Qualified → Proposal Sent → Negotiation), `leads` (company/contact/source/
  stage/estimated value/next follow-up/assignee/open-won-lost status), `lead_activities`
  (timeline of notes/calls/meetings/emails/WhatsApp + auto-logged stage & status changes).
  New `leads.read` / `leads.write` permission keys seeded to owner/admin/manager, RLS on all
  three tables via the standard `has_permission()` policies.
- **API**: `/api/leads` (+ `[id]`, `[id]/activities`, `[id]/convert`), `/api/pipeline-stages` —
  all gated through new `requireLeadsRead`/`requireLeadsWrite` in `lib/apiAuth.ts`, mutations
  audit-logged. **Convert** creates a real `clients` row (status `onboarding`, so the existing
  onboarding-workflow module picks it up naturally), marks the lead won, links it, and is
  idempotent.
- **UI** (`/crm`): kanban pipeline (drag between stages, per-column count + AED value, overdue
  follow-up highlighting) + list view with search/status filter/pagination, lead editor modal
  with the full activity timeline and Won→Convert / Lost (with reason) / Reopen actions.
  Sidebar entry gated by the new permissions; leads included in ⌘K global search (RLS-scoped).
- Verified with a clean `tsc --noEmit` and a full production `next build`; not yet exercised
  live (blocked on the migration).
- **Aether lead concierge** (improvement idea #8, built same session): three new Gemini tools
  in `lib/aiTools.ts` — `search_leads`, `create_lead`, `log_lead_activity` — so "add a lead:
  spoke to Fatima at Nova Realty at the expo, quote her 8k/mo social" or "log that I called
  Nova Realty, they want a proposal by Friday" works in the Aether chat, no CRM UI needed.
  Reads go through the caller's RLS-scoped client like every other tool; writes are
  role-gated (owner/admin/manager) through service-role, matching `create_client`'s pattern.
  System prompt updated to distinguish leads (prospects, not yet clients) from
  find_client/create_client. Same phase39 migration dependency as the CRM module above.

---

## 💡 Improvement ideas (not requested yet — surfaced during this session)

Things noticed while working through the urgent batch that are worth a future look, roughly
ordered by how much value they'd unlock relative to effort:

1. **The granular access manager (§D #15) is genuinely the biggest lever left.** Nearly every
   permissions fix this session (member scoping, task flow, invoice side-door) was a specific
   instance of "the flat 9-key matrix can't express this." A concrete starting shape: keep
   `role_permissions`/`user_permissions` as-is but expand the *key space* from 9 flat strings to
   `module.action` pairs (e.g. `tasks.view_all` vs `tasks.view_assigned`, `invoices.view` vs
   `invoices.send`) — the RLS helper functions built this session (`my_assigned_client_ids()`
   etc.) are already halfway to being permission-driven rather than role-hardcoded, so this is
   more a UI + seed-data project than a schema rewrite.
2. **A real "My Manager" / delegation chain.** Item #8 (task flow) intentionally left "manager"
   as a flat role rather than modeling actual reporting lines — right now any manager can
   review/forward any member's content or tasks. If the team grows past a size where that's fine,
   a `manager_id` column on `profiles` would let content approvals and task assignment route to
   someone's *actual* manager instead of "any manager."
3. **The Zoho-import data quality issue is probably not fully resolved.** This session found and
   fixed one bad `paid_date` by pattern-matching against 43 other invoices — but that was a
   targeted fix for the specific complaint raised, not an audit of all 48 imported invoices for
   other possible drift (wrong `issue_date`, wrong `total`, etc.). Worth a dedicated reconciliation
   pass against the original Zoho export before those numbers get relied on for anything like
   annual reporting or tax filing.
4. ✅ **Files module access log / versioning** — shipped session 10 (2026-07-15), see below.
5. **Dunning reminders for `partially_paid` invoices are new and unverified against a real cron
   run.** The logic was extended this session (§13 above) to include partially-paid-and-overdue
   invoices, and reasoned through carefully, but — unlike everything else this session — wasn't
   verified against an actual live cron trigger (would have required emailing a real client
   mid-test). Worth a dry run before relying on it.
6. **`hello@m3m.ae` DNS fix should be spot-checked again in a week.** MX/SPF propagation was
   confirmed on two resolvers same-day, but worth literally sending Huzaifa's own address a test
   email once to close the loop for real, not just via DNS lookups.
7. ✅ **The file-upload size ceiling was tested and turned out to be wrong** — see session 10
   below. The documented 8MB was never actually reachable; fixed to a verified 3MB across every
   base64-upload route in the app.

### Added session 10 (2026-07-13) — CRM-adjacent and AI ideas

8. ✅ **Aether lead concierge** — shipped same session, see the CRM session log entry above.
9. **AI lead enrichment on create.** When a lead has a website/Instagram, a one-shot Gemini call
   can pre-fill industry, a company one-liner, and a suggested pitch angle into the notes —
   free-tier Gemini, no new vendor.
10. **Website contact form → lead webhook.** A tokened `POST /api/leads/inbound` endpoint so the
    m3m.ae contact form (and any landing page) drops straight into stage "New" with source
    `website`, plus an email notification. Kills the copy-paste step where leads currently die.
11. **Follow-up nudges via the existing dunning/cron pattern.** A daily cron that emails (or
    notifies in-app) each lead's assignee when `next_follow_up` is today/overdue — the
    `lib/cron.ts` + notification-preferences plumbing already exists, this is a thin new job.
12. **Pipeline analytics on the dashboard.** Win rate, average days-in-stage, pipeline value by
    stage, and conversion by source — all derivable from `lead_activities` stage_change rows
    once a few weeks of data accumulate. A "Pipeline" KPI tile + funnel chart on /dashboard.
13. **Quotation → lead linkage.** Let a quotation be created from a lead (pre-client) and
    auto-convert the lead when the quote is accepted — closes the loop between CRM and the
    existing quote/e-sign flow, and makes "Proposal Sent" a real stage rather than a label.
14. **WhatsApp click-to-log.** No paid API needed: a `wa.me` deep link on each lead's phone plus
    a one-tap "log WhatsApp touch" button (the activity type already exists) keeps the timeline
    honest without Twilio costs.

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
13a. ✅ **Client Pulse churn radar** — `lib/churnRisk.ts` (transparent, rule-based 0–100 score: overdue invoices, retainer-but-no-recent-invoices, task-activity gap, note/contact gap, paused status), `/api/clients/churn-risk` (bulk, gated by `finance.read`). "Health" badge column on the Clients list (`ClientsTable.tsx`, hides itself if the endpoint 403s), full breakdown card ("Client Pulse" — score bar + bullet reasons) on the client detail page.
13b. 🟡 **Monthly branded Impact Report PDF** — ✅ shipped 2026-07-07 (session 6). `supabase/phase23_impact_reports.sql` (new `client_reports` table + public `client-reports` storage bucket, run in Supabase). `lib/impactReport.ts` computes per-client monthly stats (tasks completed, hours logged, revenue keyed off `paid_date` matching the existing convention, deliverables from `milestones`, active project count). `lib/pdf/ImpactReportPdf.tsx` renders the branded PDF (same `@react-pdf/renderer` approach and brand tokens as invoices/quotations). `/api/cron/impact-reports` mirrors the `recurring-invoices` cron pattern exactly (idempotent via unique `(client_id, period)`, `requireCronOrFinanceWrite` auth, emails the PDF via Resend), wired to `vercel.json` (1st of month, 07:00 UTC — one hour after retainer invoices). Manual "Generate Impact Reports" button on `/clients`. Reports show up in the client portal (`/portal`, new "Monthly Reports" card) and on the admin client detail page (`/clients/[id]`, new "Impact Reports" card). **Verified live in production**: ran the full generator for real — all 26 active clients got a `2026-06` report generated, uploaded, and emailed (Resend configured); confirmed idempotent on re-run (0 generated, 26 skipped); confirmed the PDF is valid and publicly reachable. Note: `milestones` has no "done at" timestamp, only `created_at`, so the Deliverables section lists all currently-done milestones rather than ones strictly completed within that calendar month — a known accuracy limitation, not a bug. WhatsApp-native Aether was scoped and planned but **declined by Huzaifa (2026-07-08) — avoiding Twilio/messaging costs for now**. The PR media-placement/EMV tracker is still NOT STARTED.
14. ✅ **E-signature** — `supabase/phase22_esignature.sql` (new `signable_documents` + `document_signatures` tables, `signable-documents` public storage bucket, `quotations.signature_name`/`signature_data` columns). Staff upload any PDF at `/documents` (emails the client a review-and-sign link via Resend); the shared viewer/signer at `/documents/[id]` (works for both staff and client, outside either dashboard/portal layout) embeds the PDF and lets each party sign independently — draw-on-canvas or type-your-name (`components/esign/SignaturePad.tsx`) — auto-flips to "signed" once both sides have. Client portal home shows a "Documents awaiting your signature" section. Quotations: accepting one in the portal now requires signing (`PortalQuoteActions.tsx`), and the signature renders on the printed quotation once accepted. **Needs `phase22_esignature.sql` run in Supabase** — degrades gracefully (clear "table not found" errors) until then.
15. ⬜ RAG/pgvector-grounded Aether (embeddings pipeline + Gemini function-calling agent). NOT STARTED.
16. ✅ CRM / leads pipeline — shipped session 10 (2026-07-13), see session log above. Needs `phase39_crm_leads.sql` run.
17. ✅ **Client onboarding workflows** — shipped 2026-07-08 (session 6). `supabase/phase24_onboarding.sql` replaces the dead, never-populated flat `onboarding_steps` table with a real templates → runs → steps model: `onboarding_templates`/`onboarding_template_steps` (reusable checklists, managed at `/settings/onboarding-templates`, MANAGERS-gated), `onboarding_runs`/`onboarding_run_steps` (one active run per client at a time via a partial unique index, steps snapshotted from the template at start time so later template edits don't retroactively change in-progress runs). New `components/clients/OnboardingRun.tsx` on the client detail page: "Start Onboarding" with a template picker when there's no active run, a live checklist with click-to-toggle steps once one's running, "Mark Onboarding Complete" once every step is done, and "Start Another" to re-onboard later. **Verified live in production**: created a real template, started a run on a real client, ticked all steps (confirmed `completed_at`/`completed_by` stamp correctly), marked it complete, started a second run, and confirmed the one-active-run-per-client constraint rejects a duplicate. Two test runs were cleaned up afterward (cancelled) at Huzaifa's request; the template itself was kept since it's a reasonable real starting point.
18. ⬜ Knowledge base / SOPs. NOT STARTED.

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
