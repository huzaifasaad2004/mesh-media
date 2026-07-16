# Mesh Media — Setup Guide

## Step 1: Install Node.js
Go to https://nodejs.org → Download the LTS version → Install it.

## Step 2: Install dependencies
Open Terminal, navigate to this folder, and run:
```bash
cd ~/Desktop/mesh-media
npm install
```

## Step 3: Set up Supabase

1. Go to https://supabase.com → Create a free account → New Project
2. Once created, go to **Settings → API** and copy:
   - Project URL
   - anon/public key
   - service_role key (keep this secret)

3. Update `.env.local` with your real values:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. In Supabase, go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run

## Step 4: Create your admin user

In Supabase → **Authentication → Users → Invite User**
Enter your email. Once you sign in, go to **SQL Editor** and run:
```sql
update profiles set role = 'owner', full_name = 'Your Name' where email = 'your@email.com';
```
(Roles are `owner | admin | manager | member | viewer | client` — see `lib/roles.ts`.)

Note: `schema.sql` is only the base schema. Also run the `phase2`–`phase16` migration files
in `supabase/` in order to get the current feature set (projects, portal, payroll, etc.).

## Step 5: Run the app
```bash
npm run dev
```

Open http://localhost:3000 — log in and you're live.

## Step 6: Deploy to Vercel (optional)

1. Go to https://vercel.com → Import project from your folder (or push to GitHub first)
2. Add the same environment variables from `.env.local` in Vercel's project settings
3. Deploy — your app will be live at a public URL

---

## Step 7: Enable Google Meet auto-links for Meetings (optional)

The Meetings module works today with a manually-pasted Meet link. To have it auto-generate a
real Google Meet link (and put the event on a real calendar) when you schedule a meeting:

1. Go to https://console.cloud.google.com → create a project (or reuse one) → **APIs & Services →
   Library** → search "Google Calendar API" → Enable.
2. **IAM & Admin → Service Accounts → Create Service Account** (any name, e.g. `mm-calendar-bot`).
   Open it → **Keys → Add Key → Create new key → JSON** — this downloads a `.json` file. Keep it
   somewhere safe; you'll copy two fields out of it, then you're done with the file itself.
3. Still on the service account's details page, copy its **Unique ID** (a long number under
   "IAM" — not the email address).
4. Go to https://admin.google.com (your Google Workspace admin console, the account that owns
   `m3m.ae`/`hello@m3m.ae`) → **Security → Access and data control → API controls → Domain-wide
   delegation → Add new**:
   - Client ID: the **Unique ID** from step 3
   - OAuth scopes: `https://www.googleapis.com/auth/calendar`
   - Authorize.
5. Add three environment variables (in `.env.local` for local dev, and in Vercel's project
   settings for production — same names both places):
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the `client_email` field from the JSON key
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — the `private_key` field from the JSON key, pasted
     as-is (Vercel/`.env` handle the embedded `\n` line breaks fine — don't try to reformat it)
   - `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` — a real mailbox in your Workspace domain whose calendar
     the events get created on, e.g. `hello@m3m.ae`
6. Redeploy (or restart `npm run dev`). Schedule a test meeting — it should come back with a real
   `meet.google.com/...` link with no manual entry needed.

Until these are set, scheduling still works — you (or whoever's scheduling) just pastes a Meet
link you created manually, and every attendee still gets emailed the invite and a reminder.

## What's built

| Module | Description |
|--------|-------------|
| Dashboard | Stats overview, open tasks, recent clients & invoices |
| Clients | Full CRM: profiles, contacts, status pipeline, onboarding checklist |
| Client Detail | Tasks, contracts, invoices, files, notes — all per client |
| Tasks | Kanban board + list view with priority, assignee, due date |
| Files | Per-client file storage with Google Drive link support |
| Contracts | Draft, send, sign tracking with value and period |
| Finance | Invoices (VAT, discounts, PDF, email send), expenses (receipt AI), quotations, P&L reports |
| Payroll | Multi-currency salaries, payslips, recurring runs |
| Projects | Projects + milestones linking clients ↔ tasks ↔ invoices |
| Client portal | Clients view projects/invoices, approve/decline quotations, submit requests |
| Team | Profiles, six roles + per-user permission overrides, invites |
| Meetings | Manager+ schedules with staff/contractors/client contacts, auto Google Meet links, email invites + reminders |
| Aether AI | Gemini-powered assistant (chat + expense capture) |
| Celine API | `/api/celine/*` action endpoints for the external Celine assistant |

## What's next
See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for the roadmap (status header shows what's done)
and [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) for the **open security fixes — do those first**.
