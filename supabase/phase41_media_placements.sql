-- ═══════════════════════════════════════════════════════════════
-- PHASE 41: PR media-placement / EMV tracker — log press coverage
-- secured for clients and estimate its Earned Media Value.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (key, description) VALUES
  ('media.read',  'View the PR media-placement / EMV tracker'),
  ('media.write', 'Log, edit, and delete media placements')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission) VALUES
  ('owner','media.read'),   ('owner','media.write'),
  ('admin','media.read'),   ('admin','media.write'),
  ('manager','media.read'), ('manager','media.write'),
  ('member','media.read'),  ('member','media.write')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS media_placements (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  project_id       uuid REFERENCES projects ON DELETE SET NULL,
  title            text NOT NULL,
  outlet_name      text NOT NULL,
  outlet_type      text NOT NULL DEFAULT 'online' CHECK (outlet_type IN
                      ('print','online','tv','radio','podcast','social','other')),
  placement_type   text NOT NULL DEFAULT 'mention' CHECK (placement_type IN
                      ('feature','mention','interview','byline','review','other')),
  sentiment        text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive','neutral','negative')),
  url              text,
  publish_date     date NOT NULL DEFAULT CURRENT_DATE,
  reach            bigint,               -- estimated audience/circulation/views
  ave              numeric(12,2),        -- Ad Value Equivalent — what the space would cost as paid media
  emv_multiplier   numeric(4,2) NOT NULL DEFAULT 3.0, -- earned-vs-paid credibility multiplier (industry norm 2-10x)
  notes            text,
  created_by       uuid REFERENCES profiles ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE media_placements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER media_placements_updated_at BEFORE UPDATE ON media_placements
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE INDEX IF NOT EXISTS media_placements_client_idx ON media_placements (client_id, publish_date DESC);

-- Reads: managers+ (and viewer) see everything; a member sees placements
-- for clients they're actually assigned to — same scoping pattern as
-- every other member-visible table since phase25. A client-portal user
-- sees their own company's coverage (nice to show off in the portal).
CREATE POLICY "media placements read scoped" ON media_placements FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
    OR client_id IN (SELECT my_client_ids())
  );

CREATE POLICY "media placements insert scoped" ON media_placements FOR INSERT
  WITH CHECK (
    has_permission(auth.uid(), 'media.write')
    AND (
      my_role() IN ('owner','admin','manager')
      OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
    )
  );
CREATE POLICY "media placements update scoped" ON media_placements FOR UPDATE
  USING (
    has_permission(auth.uid(), 'media.write')
    AND (
      my_role() IN ('owner','admin','manager')
      OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
    )
  );
CREATE POLICY "media placements delete scoped" ON media_placements FOR DELETE
  USING (
    my_role() IN ('owner','admin','manager')
    OR (my_role() = 'member' AND created_by = auth.uid() AND client_id IN (SELECT my_assigned_client_ids()))
  );

SELECT 'Phase 41 media-placements migration complete' AS status;
