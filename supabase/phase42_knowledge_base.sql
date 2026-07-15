-- ═══════════════════════════════════════════════════════════════
-- PHASE 42: Knowledge base / SOPs — internal docs staff can browse,
-- search, and (once published) get surfaced by Aether automatically
-- through the existing embeddings/search_knowledge pipeline.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (key, description) VALUES
  ('kb.read',  'View the knowledge base / SOPs'),
  ('kb.write', 'Create, edit, publish, and delete knowledge base articles')
ON CONFLICT (key) DO NOTHING;

-- Reading company SOPs is not a client-scoped, sensitive action like
-- clients/finance/documents — every staff role gets kb.read by default.
-- Authoring/publishing is a manager+ action, same as everything else
-- tightened this session, so drafts and edits go through review.
INSERT INTO role_permissions (role, permission) VALUES
  ('owner','kb.read'),   ('owner','kb.write'),
  ('admin','kb.read'),   ('admin','kb.write'),
  ('manager','kb.read'), ('manager','kb.write'),
  ('member','kb.read'),
  ('viewer','kb.read')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS kb_articles (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  category    text NOT NULL DEFAULT 'General',
  content     text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by  uuid REFERENCES profiles ON DELETE SET NULL,
  updated_by  uuid REFERENCES profiles ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER kb_articles_updated_at BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE INDEX IF NOT EXISTS kb_articles_category_idx ON kb_articles (category);
CREATE INDEX IF NOT EXISTS kb_articles_status_idx ON kb_articles (status);

-- Anyone with kb.read sees published articles; an author (or manager+)
-- also sees their own drafts so they can keep editing before publishing.
CREATE POLICY "kb articles read scoped" ON kb_articles FOR SELECT
  USING (
    (status = 'published' AND has_permission(auth.uid(), 'kb.read'))
    OR created_by = auth.uid()
    OR my_role() IN ('owner','admin','manager')
  );
CREATE POLICY "kb articles insert managers" ON kb_articles FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'kb.write'));
CREATE POLICY "kb articles update managers" ON kb_articles FOR UPDATE
  USING (has_permission(auth.uid(), 'kb.write'));
CREATE POLICY "kb articles delete managers" ON kb_articles FOR DELETE
  USING (has_permission(auth.uid(), 'kb.write'));

-- ─── Wire into the existing RAG pipeline — Aether's search_knowledge
--     tool already returns any matching embedding regardless of
--     entity_type, so adding 'kb_article' here is the entire
--     integration; no new tool code needed. ────────────────────────
ALTER TABLE embeddings DROP CONSTRAINT IF EXISTS embeddings_entity_type_check;
ALTER TABLE embeddings ADD CONSTRAINT embeddings_entity_type_check
  CHECK (entity_type IN ('client', 'project', 'task', 'client_note', 'kb_article'));

SELECT 'Phase 42 knowledge-base migration complete' AS status;
