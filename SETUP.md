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
update profiles set role = 'admin', full_name = 'Your Name' where email = 'your@email.com';
```

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

## What's built

| Module | Description |
|--------|-------------|
| Dashboard | Stats overview, open tasks, recent clients & invoices |
| Clients | Full CRM: profiles, contacts, status pipeline, onboarding checklist |
| Client Detail | Tasks, contracts, invoices, files, notes — all per client |
| Tasks | Kanban board + list view with priority, assignee, due date |
| Files | Per-client file storage with Google Drive link support |
| Contracts | Draft, send, sign tracking with value and period |
| Finance | Invoices, expenses, salary management, P&L overview |
| Team | Team profiles, roles, salary cards, open task counts |

## Next steps Claude Code can build for you
- Add/edit forms for all modules (clients, tasks, contracts, invoices)
- Google Drive folder auto-creation on new client
- PDF invoice generation and email sending
- Contract builder with e-signature flow
- Role-based permission enforcement (admin-only pages)
- Notifications and activity feed
