-- ═══════════════════════════════════════════════════════════════
-- PHASE 36: pgvector embeddings for RAG-grounded Aether — semantic
-- search over clients, projects, tasks, and client notes. Run this
-- whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. One row per embedded chunk ────────────────────────────────
-- Gemini text-embedding-004 produces 768-dimension vectors.
CREATE TABLE IF NOT EXISTS embeddings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'project', 'task', 'client_note')),
  entity_id   uuid NOT NULL,
  client_id   uuid REFERENCES clients ON DELETE CASCADE, -- denormalized for RLS scoping; null for entities with no client
  content     text NOT NULL,
  embedding   vector(768) NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS embeddings_client_idx ON embeddings (client_id);

-- Read scoping mirrors the exact same pattern phase25 uses on the
-- underlying tables (clients/projects/tasks/client_notes), so a
-- member can only ever retrieve chunks for clients they're assigned
-- to — the RAG tool inherits real row-level security, not a manual
-- filter Aether could be prompted around.
CREATE POLICY "embeddings read scoped" ON embeddings FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR client_id IN (SELECT my_client_ids())
    OR (my_role() = 'member' AND (client_id IS NULL OR client_id IN (SELECT my_assigned_client_ids())))
  );
-- Writes only ever happen from the embeddings-refresh cron job via service-role.

-- ─── 2. Similarity search, run AS the caller (SECURITY INVOKER) ──
-- This is the whole point: a plain "top-K nearest neighbors" query
-- would ignore RLS if wrapped in a SECURITY DEFINER function like most
-- pgvector tutorials use. SECURITY INVOKER keeps it running as the
-- calling user, so the embeddings RLS policy above still applies.
CREATE OR REPLACE FUNCTION match_embeddings(query_embedding vector(768), match_count int DEFAULT 8)
RETURNS TABLE (entity_type text, entity_id uuid, client_id uuid, content text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT entity_type, entity_id, client_id, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM embeddings
  ORDER BY embedding <=> query_embedding
  LIMIT match_count
$$;
