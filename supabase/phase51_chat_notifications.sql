-- PHASE 51: email preference category for Mesh Chat notifications
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_category_check;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_category_check
  CHECK (category IN ('task_assignment','approval_request','content_review','critical_alert','task_feedback','meeting','chat'));

SELECT 'Phase 51 chat notifications migration complete' AS status;
