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
real Google Meet link when you schedule a meeting, it reuses the **same Google Cloud OAuth
client already set up for Celine** (`~/celine`, see that project's `SETUP.md` §7 "Google
Calendar + Gmail") — no new Google Cloud project or service account needed, just one small
addition to that existing OAuth client plus a one-time "Connect" click in this app.

1. Go to https://console.cloud.google.com → open the same project Celine's OAuth client lives in
   → **APIs & Services → Credentials** → open that existing OAuth 2.0 Client ID (the one whose
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are in Celine's `.env`).
2. Under **Authorized redirect URIs**, click **Add URI** and add:
   `https://www.m3m.ae/api/google/oauth/callback` (and, for local testing,
   `http://localhost:3000/api/google/oauth/callback`). Save. This is additive — it does not
   affect Celine's own `http://localhost:53682/oauth2callback` redirect, which stays exactly as-is.
3. Add three environment variables (in `.env.local` for local dev, and in Vercel's project
   settings for production — same names both places):
   - `GOOGLE_CLIENT_ID` — same value as Celine's `.env`
   - `GOOGLE_CLIENT_SECRET` — same value as Celine's `.env`
   - `TOKEN_ENCRYPTION_KEY` — a **new, independent** secret for this project (don't reuse
     Celine's) — any long random string works, e.g. `openssl rand -hex 32`
4. Redeploy (or restart `npm run dev`). Sign in as an owner/admin → **Settings → Integrations** →
   **Connect Google Calendar** → sign in with whichever Google account should own the created
   events (e.g. `hello@m3m.ae`) → approve. Schedule a test meeting — it should come back with a
   real `meet.google.com/...` link with no manual entry needed.

Unlike Celine's one-time CLI auth script (`npm run google-auth`, meant for a local machine with a
browser), Mesh Media's connect flow runs entirely in the deployed app itself — Settings →
Integrations has a "Connect"/"Disconnect" button, and the resulting tokens are AES-256-GCM
encrypted and stored in Supabase (`google_oauth_tokens`), the same pattern Celine uses for its own
`oauth_tokens` table, just with a separate encryption key.

Until Google Calendar is connected, scheduling still works — you (or whoever's scheduling) just
pastes a Meet link you created manually, and every attendee still gets emailed the invite and a
reminder either way.

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
