-- ═══════════════════════════════════════════════════════════════
-- PHASE 46: Meetings module — manager+ schedules a meeting with any
-- mix of staff/contractors/client contacts, auto-generates a Google
-- Meet link via Calendar API (falls back to a manual link if Google
-- isn't connected yet), emails every attendee, and reminds them
-- before it starts. Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (key, description) VALUES
  ('meetings.read',  'View meetings'),
  ('meetings.write', 'Schedule, edit, and cancel meetings')
ON CONFLICT (key) DO NOTHING;

-- Reading your own meetings isn't a manager-only concern (everyone needs to
-- see what they've been invited to) — but that's handled by the attendee-row
-- RLS branch below, not this permission. This permission just governs the
-- "see the whole company calendar" and "schedule/edit/cancel" actions.
INSERT INTO role_permissions (role, permission) VALUES
  ('owner','meetings.read'),   ('owner','meetings.write'),
  ('admin','meetings.read'),   ('admin','meetings.write'),
  ('manager','meetings.read'), ('manager','meetings.write')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS meetings (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title                text NOT NULL,
  description          text,
  client_id            uuid REFERENCES clients ON DELETE SET NULL,
  organizer_id         uuid REFERENCES profiles ON DELETE SET NULL,
  start_time           timestamptz NOT NULL,
  end_time             timestamptz NOT NULL,
  meet_link            text,               -- Google Meet URL once created (or a manually pasted fallback)
  calendar_event_id    text,               -- Google Calendar event id — needed to patch/cancel later
  calendar_sync_error  text,               -- set if Google Calendar creation failed; meeting still exists, meet_link stays null until fixed
  status               text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  reminder_24h_sent_at timestamptz,
  reminder_15m_sent_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE INDEX IF NOT EXISTS meetings_start_idx ON meetings (start_time);
CREATE INDEX IF NOT EXISTS meetings_client_idx ON meetings (client_id);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id      uuid REFERENCES meetings ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES profiles ON DELETE SET NULL, -- set when the attendee has an account (staff/contractor/client-portal user)
  name            text NOT NULL,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff','contractor','client','other')),
  response_status text NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending','accepted','declined')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS meeting_attendees_meeting_idx ON meeting_attendees (meeting_id);
CREATE INDEX IF NOT EXISTS meeting_attendees_user_idx ON meeting_attendees (user_id);

-- Reads: managers+ see every meeting; anyone else (member, contractor,
-- client-portal user) sees meetings they're actually invited to, or —
-- for a client contact — any meeting tagged with their own company.
CREATE POLICY "meetings read scoped" ON meetings FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager')
    OR id IN (SELECT meeting_id FROM meeting_attendees WHERE user_id = auth.uid())
    OR client_id IN (SELECT my_client_ids())
  );
CREATE POLICY "meetings insert managers" ON meetings FOR INSERT WITH CHECK (has_permission(auth.uid(), 'meetings.write'));
CREATE POLICY "meetings update managers" ON meetings FOR UPDATE USING (has_permission(auth.uid(), 'meetings.write') OR organizer_id = auth.uid());
CREATE POLICY "meetings delete managers" ON meetings FOR DELETE USING (has_permission(auth.uid(), 'meetings.write'));

CREATE POLICY "meeting attendees read scoped" ON meeting_attendees FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager')
    OR user_id = auth.uid()
    OR meeting_id IN (SELECT id FROM meetings WHERE organizer_id = auth.uid())
    OR meeting_id IN (SELECT id FROM meetings WHERE client_id IN (SELECT my_client_ids()))
  );
CREATE POLICY "meeting attendees write managers" ON meeting_attendees FOR ALL USING (has_permission(auth.uid(), 'meetings.write'));
-- An attendee may update their OWN response (accept/decline) without needing meetings.write.
CREATE POLICY "meeting attendees self respond" ON meeting_attendees FOR UPDATE USING (user_id = auth.uid());

SELECT 'Phase 46 meetings migration complete' AS status;
