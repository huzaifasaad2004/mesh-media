# Mesh Media mobile app — build plan

Written 2026-11-23. Companion to `BUILD_PLAN.md` (web). Two tracks: **A. the app**, **B. web upgrades**.

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
