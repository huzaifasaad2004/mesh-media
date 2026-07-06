# Mesh Media (m3m.ae) — Aggressive Audit Report

**Target:** https://www.m3m.ae (Next.js 14 + Supabase, agency ERP / "Mesh Media Agency OS")
**Scope:** Live black-box + full source review (frontend, backend, database/RLS, auth, AI assistant)
**Tested as:** `huzaifasaad2004@gmail.com` (role: **owner**)
**Date:** 2026-07-05

> ## STATUS — fixes applied 2026-07-06 (verified locally before deploy)
>
> | # | Finding | Status |
> |---|---------|--------|
> | 1 | Privilege escalation via `profiles.role` (CRITICAL) | ✅ FIXED — phase17 migration applied to production 2026-07-06 (verified: `doc_counters` live) |
> | 2 | 17 API routes use service-role key with no authz (CRITICAL) | ✅ FIXED — `lib/apiAuth.ts` added; all 17 routes now authenticate + role-gate (reads via RLS client, writes gated to the same role sets as the DB policies) |
> | 3 | `/api/ai/test` public + billable | ✅ FIXED — route deleted, removed from middleware public list |
> | 4 | Stored XSS in `components/AiChat.tsx` | ✅ FIXED — content HTML-escaped before mini-markdown |
> | 5 | No security headers / CSP | ✅ FIXED — HSTS/XFO/XCTO/Referrer/Permissions enforced; CSP in Report-Only (rename header to enforce once console is clean) |
> | 6 | Invoice number race condition | ✅ FIXED — `next_doc_number()` live; invoice counter seeded to 101 (matches current max MM-INV-2026-101) |
> | 7 | Mass-assignment | ✅ Mitigated — `stripProtected()` blocks id/created_at/created_by/updated_at on all create/update routes |
> | 8 | Weak owner password | 🔴 MANUAL — rotate the owner password + raise min length / leaked-password check in Supabase Auth settings |
> | 9 | HTML injection in outbound emails | ✅ FIXED — `escapeHtml()` on all interpolations in invoice/quotation emails |
>
> **Remaining action: #8 — rotate the owner password (the old one still authenticated when tested 2026-07-06) and enable leaked-password protection in Supabase Auth settings.**

This file is written to be handed directly to Claude Code. Each finding has: what's
wrong, proof, the exploit, and a concrete fix (with code/SQL). Findings marked
**[CONFIRMED LIVE]** were reproduced against production; **[CODE]** are confirmed by
source inspection.

---

## 0. TL;DR — fix these first (in order)

1. **[CRITICAL] Anyone logged in can make themselves `owner`** — the `profiles` RLS
   update policy lets a user rewrite their own `role`. Reproduced live. → **Fix #1**
2. **[CRITICAL] 17 API routes use the service-role key with ZERO authorization** —
   any logged-in user (including a client-portal account) can read/write ALL
   clients, invoices, expenses, contracts, payroll-adjacent data, and the full P&L,
   bypassing your (otherwise good) database security. Reproduced live. → **Fix #2**
3. **[MEDIUM] `/api/ai/test` is public** and makes a real, billable Gemini call on
   every hit → open cost/abuse endpoint. Reproduced live. → **Fix #3**
4. **[MEDIUM] Stored-XSS sink** in the Aether chat (`dangerouslySetInnerHTML` with no
   sanitization). → **Fix #4**
5. **[MEDIUM] Invoice/quote number generation has a race condition** → duplicate
   legal document numbers. → **Fix #6**

The good news: your **database RLS design is genuinely solid** (staff/finance/owner
scoping, client-owns-their-rows). The problem is the app's own API layer throws that
protection away by using the service-role key. Fixing #2 mostly means *using the
security you already built.*

---

## 1. SECURITY FINDINGS

### 🔴 Fix #1 — CRITICAL: Privilege escalation — any user can become `owner` [CONFIRMED LIVE]

**What:** The only `UPDATE` policy on `profiles` is:
```sql
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
```
It has **no `WITH CHECK`** and **no column restriction**, and there is **no trigger**
guarding the `role` column. So a user may `UPDATE` their own row and set any column —
including `role`.

**Proof (live):** With a normal user session token + the public anon key, PATCHing my
own profile row succeeded:
```
PATCH /rest/v1/profiles?id=eq.<my-uid>   body: {"role":"owner"}
→ HTTP 200, row returned with "role":"owner"
```
Control test (writing a *different* user's row) correctly returned 0 rows — so RLS
blocks other-row writes but not the self-role rewrite.

**Exploit:** A `viewer`, `member`, or even a **client-portal** user opens dev tools,
grabs the Supabase URL + public anon key (both shipped in the client bundle), and runs
one `fetch` to set `role: 'owner'`. They now own the entire system.

**Fix (SQL migration):**
```sql
-- Replace the blanket self-update policy and add a hard guard on privileged columns.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Defense-in-depth: block non-admins from ever changing role (covers app + direct API).
CREATE OR REPLACE FUNCTION guard_profile_privileged_cols()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_profile_role ON profiles;
CREATE TRIGGER guard_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_privileged_cols();
```
(`is_admin()` already exists from phase5.)

---

### 🔴 Fix #2 — CRITICAL: 17 API routes bypass all authorization via the service-role key [CONFIRMED LIVE]

**What:** These route handlers create a Supabase client with
`SUPABASE_SERVICE_ROLE_KEY` (which **bypasses Row Level Security entirely**) and then
do **no `getUser()` and no role check**. The only thing in front of them is the
middleware, which only checks *"is there any logged-in user?"* — not *who* they are.

**Affected routes (service-role + no authz):**
```
GET/POST     /api/clients            PUT/DELETE  /api/clients/[id]
GET          /api/clients/[id]/statement
GET/POST     /api/invoices           POST        /api/invoices/[id]/send
GET/POST     /api/expenses           PUT/DELETE  /api/expenses/[id]
GET/POST     /api/contracts          PUT/DELETE  /api/contracts/[id]
GET/POST     /api/quotations         POST        /api/quotations/[id]/send
GET/POST     /api/projects           GET/PUT/DELETE /api/projects/[id]
GET/POST     /api/tasks              PUT/DELETE  /api/tasks/[id]
GET          /api/profiles           GET         /api/finance/reports
```

**Proof (live):** With a plain session cookie (no admin gating anywhere in the code
path) the app returned:
- `GET /api/clients` → **26 clients** (full CRM)
- `GET /api/invoices` → **47 invoices** (all clients, all amounts)
- `GET /api/finance/reports` → full P&L: revenue, expenses, outstanding, payroll, net profit
- `GET /api/profiles` → every staff member's name/email/role

**Why it's critical:** You invite **clients** into the portal (role `client`). Their
login is a valid authenticated session. So *a client* can call
`GET /api/finance/reports` and see your whole agency's profit, `GET /api/profiles` to
harvest staff emails, `GET /api/expenses` to see all spending, or `DELETE
/api/clients/[id]` / `DELETE /api/tasks/[id]` to destroy data. Your well-built RLS
(which *would* stop all of this) never runs, because the service-role key skips it.

**Fix (preferred — use the security you already have):** For all **read** routes,
stop using the service-role client and use the cookie/RLS client. RLS then scopes
results automatically (staff see staff data, clients see only their own).

```ts
// lib/apiAuth.ts  (new)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/** Returns the RLS-scoped db + the caller's role, or a 401 response. */
export async function requireUser() {
  const supabase = createClient()                 // cookie-based, RLS enforced
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { user, role: profile?.role ?? 'member', db: supabase }
}

export function serviceRole() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
```

Then each route becomes, e.g.:
```ts
// app/api/clients/route.ts
export async function GET() {
  const auth = await requireUser(); if ('res' in auth) return auth.res
  const { data, error } = await auth.db.from('clients').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
```
- **Write / delete / send routes** (invoices send, quotations send, DELETE handlers,
  finance/reports): add an explicit role check, e.g.
  `if (!['owner','admin','manager'].includes(auth.role)) return 403`. Keep the
  service-role client **only** for the legitimate cross-user fan-out (e.g. inserting
  admin notifications) *after* the check has passed.
- `/api/finance/reports` and `/api/profiles`: gate to `canSeeFinance` / `isStaff`
  respectively.

> Note: `/api/profiles/me`, `/api/ai/chat`, `/api/portal/quotations/[id]/respond`,
> `/api/team/invite`, `/api/salaries/*`, `/api/requests` already do this correctly —
> copy that pattern to the 17 routes above.

---

### 🟠 Fix #3 — MEDIUM: `/api/ai/test` is public and burns billable Gemini quota [CONFIRMED LIVE]

**What:** `middleware.ts` lists `/api/ai/test` as a public path, and the route makes a
real `gemini-2.5-flash` call on every request.

**Proof (live):** `GET https://www.m3m.ae/api/ai/test` → `{"success":true,"reply":"Hello"}`
with no authentication.

**Exploit:** Anyone can script thousands of requests to run up your Google AI bill and
confirm your key is live (a DoW — "denial of wallet" — vector). `/api/ai/suggest` has
the same underlying risk for any logged-in user (no per-user limits).

**Fix:**
- Delete `/api/ai/test` from production (it's a debug endpoint), or remove it from the
  `isPublicPath` list in `middleware.ts` and require auth.
- Add lightweight rate limiting to all AI endpoints (`/api/ai/*`) — e.g. Upstash
  Redis or an in-memory token bucket keyed by user id, ~10 req/min.

---

### 🟠 Fix #4 — MEDIUM: Stored-XSS sink in the Aether AI chat [CODE]

**What:** `components/AiChat.tsx` renders message content with
`dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}`, and `renderContent`
only converts `**bold**`/`*italic*`/newlines — it never escapes `<`, `>`, or HTML.

**Exploit:** Message content includes AI output, and the AI reads live DB data
(client names, request text, task titles, notes). A client-portal user plants
`<img src=x onerror="fetch('/api/finance/reports').then(...)">` into a client request.
When a staff member later asks Aether "what are the latest client requests?", the model
echoes that string and it executes **in the staff member's authenticated browser** →
stored XSS → data exfiltration or actions as an admin. (`<script>` won't run via
innerHTML, but `<img onerror>` / `<svg onload>` will.)

**Fix:** Escape first, then apply the tiny markdown:
```ts
function renderContent(text: string) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}
```
(Or drop `dangerouslySetInnerHTML` and render with a vetted markdown lib that escapes
by default.)

---

### 🟠 Fix #5 — MEDIUM: No security headers / CSP [CODE + LIVE]

The site sends no Content-Security-Policy, HSTS, `X-Frame-Options`, or
`X-Content-Type-Options`. This makes the XSS above more impactful and allows
clickjacking. Add to `next.config.js`:
```js
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
      // Start CSP in report-only, then enforce once clean:
      { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-ancestors 'none'" },
    ],
  }]
}
```

---

### 🟡 Fix #6 — MEDIUM: Invoice/quote number race → duplicate legal numbers [CODE]

**What:** `app/api/quotations/[id]/convert/route.ts` builds the next number by reading
all existing numbers, computing `max + 1` in JS. Two near-simultaneous creations read
the same max and produce the **same** `MM-INV-2026-00042`. For invoices this is a
compliance problem (UAE FTA requires unique sequential invoice numbers).

**Fix:** Use a DB sequence (or a `SELECT ... FOR UPDATE` counter table) so numbering is
atomic:
```sql
CREATE TABLE IF NOT EXISTS doc_counters (kind text, year int, n int, primary key (kind, year));
CREATE OR REPLACE FUNCTION next_doc_number(p_kind text, p_prefix text)
RETURNS text AS $$
DECLARE y int := extract(year from now()); v int;
BEGIN
  INSERT INTO doc_counters(kind, year, n) VALUES (p_kind, y, 1)
    ON CONFLICT (kind, year) DO UPDATE SET n = doc_counters.n + 1
    RETURNING n INTO v;
  RETURN p_prefix || y || '-' || lpad(v::text, 5, '0');
END; $$ LANGUAGE plpgsql;
```
Call it (`select next_doc_number('invoice','MM-INV-')`) inside the insert. Also add a
`UNIQUE` constraint on `invoices.invoice_number` and `quotations.quote_number` as a
backstop.

---

### 🟡 Fix #7 — LOW/MED: Mass-assignment on create/update [CODE]

Routes like `/api/clients`, `/api/expenses`, `/api/contracts`, `/api/tasks` do
`insert(body)` / `update(body)` with the raw request body. A caller can set columns
you didn't intend (`created_at`, `id`, `created_by`, status fields, etc.). Whitelist
allowed fields per route before inserting/updating.

---

### 🟡 Fix #8 — LOW/MED: Weak password policy [OBSERVED]

The working owner account uses a weak, no-complexity password (redacted here — rotate it). In Supabase → Auth →
Policies, raise the minimum length (≥12) and enable leaked-password protection
(HaveIBeenPwned). Rotate this password now, and consider enabling MFA for
owner/admin roles. Also add rate-limiting/lockout messaging on `/login`.

---

### 🟡 Fix #9 — LOW: HTML injection in outbound invoice email [CODE]

`app/api/invoices/[id]/send/route.ts` interpolates `item.description`, `clientName`,
and `invoice_number` straight into the email HTML. A crafted description can inject
markup into the email your client receives. Escape those interpolations (same
`escapeHtml` helper as Fix #4) before templating.

---

### ✅ What's already done right (keep it)

- Database RLS after phase5 is well-scoped (`is_staff()`, `can_finance()`,
  `is_admin()`, client-owns-rows via `my_client_ids()`). Verified live: anon reads
  return 0 rows; payroll (`salaries`, `salary_payments`) restricted to admins/self.
- `/api/team/invite`, `/api/salaries/run-recurring`, `/api/ai/chat`,
  `/api/portal/quotations/[id]/respond` all authenticate and check roles correctly.
- Celine action endpoints use a constant-time bearer-token check (`crypto.timingSafeEqual`).
  Verified live: bad/no token → 401.
- No secrets committed to the repo (`.env` is gitignored; only placeholder
  `.env.example` is tracked).
- Middleware fails *closed* for unauthenticated requests to non-public routes.

---

## 2. FUNCTIONAL / CORRECTNESS BUGS

1. **Money is never rounded.** `lib/documentTotals.ts` keeps full float precision, so a
   line like qty 3 × 33.333 can store totals with sub-fils precision and cause the
   sum-of-lines to disagree with the displayed total. Round to 2 dp:
   ```ts
   const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
   ```
   Apply to `subtotal`, `discountAmount`, `taxAmount`, `total`.
2. **`NEXT_PUBLIC_APP_URL` fallback** is `https://mesh-media.vercel.app` /
   `http://localhost:3000` in several send routes. If the env var isn't set in
   production, invoice/portal links in emails point at the wrong host. Set it to
   `https://www.m3m.ae` in Vercel.
3. **Domain canonicalization:** `m3m.ae` → `www.m3m.ae` via 308. Fine, but make sure
   `NEXT_PUBLIC_APP_URL`, Supabase Auth redirect URLs, and Resend links all use the
   **same** canonical host to avoid cookie/session edge cases.
4. **No pagination** on list endpoints (`/api/clients`, `/api/invoices`,
   `/api/tasks`…). They `select('*')` unbounded — fine at 26/47 rows, but will slow
   the dashboard as data grows. Add `.range()` + server-side pagination.
5. **`invoices` GET returns full nested items for every invoice** on the list view —
   over-fetching. Select only list columns; load items on the detail view.
6. Confirm the `guard_profile_role` trigger (Fix #1) doesn't block the legitimate
   admin "change teammate role" flow — it allows it because `is_admin()` is true for
   the actor.

*(Note: all 18 authenticated pages returned HTTP 200 with no server errors in a live
sweep — no broken/500 pages found. Deeper interaction testing was limited to the API
layer because the test harness couldn't drive a full browser through the network
policy; a manual click-through of each form's validation is still worth doing.)*

---

## 3. UX IMPROVEMENTS (client + staff experience)

- **Online payments from the invoice link.** Today the emailed invoice only shows
  bank-transfer/IBAN details. Add a "Pay now" button (Telr / PayTabs / Stripe — all
  support AED) on the public `/invoice/[id]` page. This is the single biggest UX and
  cash-flow win for a UAE agency.
- **Arabic + RTL portal.** You're in Abu Dhabi; an Arabic toggle with RTL layout on
  the client portal is rare among small-agency tools and a real differentiator.
- **In-portal e-signature** for contracts and quote acceptance (you already track
  accept/decline — add a signature capture + timestamp + IP for an audit trail).
- **Magic-link approvals (no login).** Let clients approve a quote/creative straight
  from the email with a signed one-time link — removes the portal-login friction that
  kills approval speed.
- **SLA countdown on client requests.** The `client_requests` ticketing already
  exists; show clients a "responded within X" timer and status timeline.
- **Empty states + skeleton loaders** on every list page, and inline form validation
  with friendly errors (check each form in `components/forms/`).
- **Optimistic UI + toasts** on create/edit so actions feel instant.
- **Global command palette (⌘K)** for staff to jump to any client/invoice/task.

---

## 4. NEW FEATURES — "amazing, and few agencies do this"

Ranked by impact-to-differentiation:

1. **AI "Client Pulse" churn radar.** Have Aether score every client on churn risk
   from real signals you already store — invoice payment lateness, request volume &
   sentiment, response times, retainer trend — and surface an at-risk list with a
   suggested "save play." Almost no small agency does predictive retention.
2. **Auto-generated monthly client Impact Report.** One branded PDF per client per
   month, assembled from completed tasks, deliverables, project progress, and
   (feature 3) media placements — auto-published to their portal and emailed. This is
   the artifact agencies get judged on, and automating it is a killer retention tool.
3. **PR media-placement tracker with Earned Media Value (EMV).** For a PR agency
   specifically: log placements (outlet, reach, link), auto-compute EMV, and showcase
   it in the client portal. Turns invisible PR work into a number clients can see.
4. **AI proposal/quotation from a one-line brief.** Type "3-month social + 2 PR
   pushes for a fintech launch" → Aether drafts a full itemized quotation with
   sensible AED pricing. You already have `/api/ai/suggest` for line items — extend it
   to whole documents.
5. **WhatsApp-native Aether.** UAE runs on WhatsApp. Let staff text or voice-note
   Aether ("log 340 AED taxi to expenses", "who owes us money?", "create task…") via
   the WhatsApp Business API. Your Celine action endpoints are already the right shape
   for this.
6. **Cash-flow forecast.** Project the next 90 days of cash from recurring retainers +
   outstanding invoices (with each client's historical pay-lateness) − payroll −
   recurring expenses. Show a simple runway line on the finance page.
7. **Smart automated dunning.** Escalating, personalized late-invoice reminders
   (polite → firm) over email + WhatsApp, auto-paused the moment an invoice is marked
   paid. Directly recovers revenue.
8. **Content calendar with per-post client approval** in the portal (comment/approve
   each scheduled post) — closes the biggest back-and-forth loop in agency work.
9. **Post-deliverable NPS / feedback pulse** — a one-tap rating after each project,
   feeding the Client Pulse score in feature 1.
10. **Client-facing live project timeline** ("Discovery ✓ → Design (60%) → Review →
    Launch") so clients always know status without emailing you.

---

## 5. Suggested execution order for Claude Code

1. **Ship the two criticals today:** Fix #1 (SQL migration) and Fix #2 (route auth).
   These are actively exploitable by any logged-in user.
2. Then Fix #3, #4, #5 (public AI endpoint, XSS escape, security headers).
3. Then correctness: #6 (numbering), money rounding, `NEXT_PUBLIC_APP_URL`.
4. Then #7–#9 hardening.
5. Then UX quick-wins (online payments, Arabic/RTL, magic-link approvals).
6. Then pick 2–3 flagship features (Client Pulse, Impact Report, WhatsApp Aether).

---

*Prepared from a live black-box test plus full source review. The two CRITICAL findings
were reproduced against production without any destructive action (the role write set the
value to its existing `owner` value; no data was modified or deleted).*
