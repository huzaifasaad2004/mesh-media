-- ═══════════════════════════════════════════════════════════════
-- PHASE 43: File versioning — track who uploaded a replacement over
-- an existing file, and when (BUILD_PLAN improvement idea #4). Run
-- this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- root_file_id is null on the original upload; every later version
-- points at the same root so the whole chain is one query away.
-- Version rows are never mutated after upload — a new version is
-- always a new row — so this table doubles as its own audit log.
ALTER TABLE files ADD COLUMN IF NOT EXISTS root_file_id uuid REFERENCES files ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS files_root_idx ON files (root_file_id);

SELECT 'Phase 43 file-versions migration complete' AS status;
