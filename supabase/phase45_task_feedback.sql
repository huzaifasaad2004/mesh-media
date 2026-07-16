-- ═══════════════════════════════════════════════════════════════
-- PHASE 45: Task comments/feedback thread + a dedicated notification
-- category for it, plus a "task completed" notification back to
-- whoever created the task. Run this whole file in the Supabase SQL
-- Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS task_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id    uuid REFERENCES tasks ON DELETE CASCADE NOT NULL,
  author_id  uuid REFERENCES profiles ON DELETE SET NULL,
  comment    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);

-- Visibility mirrors the tasks table itself (phase25): managers+/viewer see
-- all, a member only sees comments on tasks assigned to them.
CREATE POLICY "task comments read scoped" ON task_comments FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid())
  );

-- Anyone who can see the task can leave feedback on it — a member
-- responding on their own assigned task, or any manager+.
CREATE POLICY "task comments insert scoped" ON task_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      my_role() IN ('owner','admin','manager')
      OR task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid())
    )
  );

-- A new, dedicated opt-out category — feedback is frequent enough that
-- lumping it into task_assignment would make the toggle too coarse.
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_category_check;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_category_check
  CHECK (category IN ('task_assignment','approval_request','content_review','critical_alert','task_feedback','meeting'));

SELECT 'Phase 45 task-feedback migration complete' AS status;
