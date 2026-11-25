# Mesh Media mobile app — build plan

Written 2026-11-23. Companion to `BUILD_PLAN.md` (web). Two tracks: **A. the app**, **B. web upgrades**.

## Status — 25 Nov 2026

**Built and tested on the simulator** (code: `~/mesh-media-app`, private repo `huzaifasaad2004/mesh-media-app`, Expo project `@huzaifabinsaad/mesh-media`):

- Sign-in, Face ID lock (relocks after 5 min), session-expiry → back to sign-in, push registration (`/api/push/device`).
- **Admin portal**: Home (money, overdue invoices, tasks to finish, waiting-on-you, meetings, quick actions), Tasks (filters with counts, search, detail with status/priority/reassign/comments/delete, new task), Review (content to approve → forward/send back, team time-off/expense requests → approve/decline), Money (outstanding/overdue/collected/spent, unpaid/overdue/paid/expenses), invoice detail (record payment, email invoice, share PDF), receipt scanner (photo → AI reads supplier/amount/date/category → expense).
- **Team portal**: Today, Tasks, Requests & pay (time off, expense claims → manager approval, salary history/payslips).
- **Client portal**: Home (to review, to pay, meetings, projects, files), Content (approve / request changes), Invoices (pay online via Stripe), Requests.
- Shared: notifications inbox + bell with unread count (push taps open the right screen), meetings (join/accept/decline, schedule with Google Meet), Ask Aether chat, email preferences, in-app account deletion request, privacy policy link.

**Website changes shipped for the app:** bearer-token auth, Expo push for every in-app notification, `/api/push/device`, `/api/account/delete-request`, public `/privacy`, expense `created_by`, test logins hidden from pickers, Gemini 2.5 "thinking" fix (receipt reading was failing on web too).

**Test logins:** `hello+app-{admin,team,client}@m3m.ae` (client → "Test Client (App)"); passwords in `~/mesh-media-test-logins.env`. Give Apple the team or client login, never admin (admin sees live finance).

**Next:** first EAS builds (free quota resets 1 Dec 2026) → TestFlight + Play internal testing; App Store listing; Track B web upgrades. Known gap: `GET /api/invoices/[id]` is public by ID (used by emailed print links) — move to a signed token.

## The approach in one paragraph

A real native iOS + Android app built with **Expo / React Native** — the same toolchain as Forme
(`~/appearance-os`: Expo 57, expo-router, EAS builds, Apple team `JJSDBVHC78`). **One app, three
portals**: after sign-in the app reads the person's role and opens the admin, team, or client
experience. It talks to the **same Supabase database and the same m3m.ae API** as the website, so
there is no data migration and nothing gets out of sync — a task ticked on the phone is ticked on
the web. Not a website-in-a-wrapper: native camera, Face ID, push notifications, swipe gestures.

Costs: none new. Expo push is free, EAS builds run on the account Forme already uses, receipt
scanning reuses the existing Gemini extraction (`lib/expenseExtraction.ts`).

## Identity (defaults — change before first store submission, not after)

| | |
|---|---|
| App name | Mesh Media |
| Bundle / package id | `ae.m3m.app` |
| Deep-link scheme | `meshmedia://` |
| Code location | `~/mesh-media-app` (its own git repo, like Forme — not inside this one) |
| Brand | Same tokens as web: maroon `#6E1318`, cream paper, Cormorant + Inter, light + dark |

## The one change the website needs first

Every one of the 150 API routes signs people in through browser cookies
(`lib/supabase/server.ts`). A phone app has no cookies — it sends a token instead. So
`createClient()` must also accept `Authorization: Bearer <token>`, and `middleware.ts` must let
`/api/*` requests carrying a token through instead of redirecting them to `/login`. That is one
small, central change; every existing route then works for the app unchanged, with the same
RLS and permission checks. Ship and verify this on web before building screens.

Also needed server-side: a `device_push_tokens` table and an Expo-push sender beside the existing
browser push (`lib/push.ts`), called from the same `notifyUsers()` so every notification that
already exists reaches the phone with no per-feature work.

## Phases

**0 — Foundation.** Scaffold, design system, sign-in (email + password, Face ID to reopen, magic
link for clients), role router, bearer-token API client, push registration, offline-tolerant data
layer. Done when: all three roles can sign in on a real phone and land in the right shell.

**1 — Team portal** (most daily use, smallest surface — build first).
Today screen (my tasks, next meeting, unread) · tasks with status change, feedback thread and
reference images · team chat · meetings (join, accept/decline) · time tracking start/stop ·
requests and approvals · My Pay · notifications with inline actions.

**2 — Admin portal.**
Dashboard KPIs · one approvals inbox (content, requests, expenses) · **scan a receipt → expense**
(camera → auto-filled amount, date, category → confirm) · invoices (list, record payment, send,
view/resend receipt) · clients and CRM (add a lead in ten seconds) · schedule meetings · Aether
with voice input. Heavy desktop tools stay web-only on purpose: document studio, automation
builder, campaign report studio, permissions matrix, e-sign field placement.

**3 — Client portal.**
Project progress · content approvals (approve / request changes with a comment) · invoices with
Pay Now · quotations and documents to sign · files and monthly reports · meetings.

**4 — Release.** TestFlight + Play internal testing with the team → store submission. Needs from
Huzaifa at that point: a demo login for Apple's reviewer, and a decision on public listing vs
Apple's unlisted distribution (link-only, suits a client/staff app). Apple also requires an
in-app way to request account deletion.

## Track B — web upgrades (surfaced while planning; each is independent)

1. **Failures look like "nothing here".** List pages fall back to an empty list when the API
   errors (this hid the meetings bug for a day). Show an error state with Retry everywhere.
2. **Sidebar has 25+ items in one flat list.** Group into Work / Clients / Money / Company,
   collapsible, with the existing unread dots; bottom tab bar on phones.
3. **Client portal is thin** (one 221-line page). Rebuild it alongside the app's client portal
   so both share one design: progress, approvals, payments, documents.
4. **Client payment receipts** exist only as an auto-email. Add View / Resend on each paid
   invoice, receipts for partial payments, and a standalone receipt voucher for money received
   outside an invoice.
5. **One timezone helper.** Server-rendered dates (emails, PDFs, notifications) should all go
   through a single Asia/Dubai formatter — the meeting-email bug was one instance of several.
6. **Role home screens.** Admin, manager and member currently share one dashboard; give each a
   focused home (the app's "Today" screens are the model).
7. **Design polish pass.** Consistent page headers, skeleton loading instead of "Loading…",
   one table → card pattern below `md`, verify dark mode on every module.

## Order of work

Foundation (0) → Team (1) → Admin (2) → Client (3) → Release (4). Track B items 1, 4, 5 are small
and can ship any time; 2, 3, 6, 7 are best done after the app's design system exists so web and
app converge on one look.
