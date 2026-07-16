-- ═══════════════════════════════════════════════════════════════
-- PHASE 47: Switch meeting reminders from a polling cron to Resend's
-- native scheduled sending — exact-time reminders (24h and 15min
-- before) regardless of the Vercel plan's cron-frequency limits.
-- Superseded pieces from phase46 (meetings.reminder_24h_sent_at /
-- reminder_15m_sent_at, /api/cron/meeting-reminders) are left in
-- place but unused rather than dropped — harmless, and avoids a
-- destructive migration.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS reminder_24h_email_id text;
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS reminder_15m_email_id text;

SELECT 'Phase 47 meeting-reminder-scheduling migration complete' AS status;
