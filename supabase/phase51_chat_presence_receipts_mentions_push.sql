-- PHASE 51: Mesh Chat upgrade — durable receipts, mentions and browser push
-- Prepare with the application code, then run once in the Supabase SQL editor.
-- Do not run before the matching application deployment is ready.

CREATE TABLE chat_message_receipts (
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT chat_receipt_read_after_delivery CHECK (read_at IS NULL OR delivered_at IS NOT NULL)
);

CREATE TABLE chat_mentions (
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE browser_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_receipts_user_unread ON chat_message_receipts(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX chat_mentions_user_created ON chat_mentions(user_id, created_at DESC);
CREATE INDEX browser_push_subscriptions_user ON browser_push_subscriptions(user_id);

ALTER TABLE chat_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_push_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON chat_message_receipts, chat_mentions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON browser_push_subscriptions TO authenticated;

CREATE POLICY "chat users see accessible receipts" ON chat_message_receipts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_messages m
    WHERE m.id = message_id AND chat_can_access_channel(m.channel_id)
  ));

CREATE POLICY "chat users see accessible mentions" ON chat_mentions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_messages m
    WHERE m.id = message_id AND chat_can_access_channel(m.channel_id)
  ));

CREATE POLICY "users manage own push subscriptions" ON browser_push_subscriptions FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION chat_can_access_realtime_topic(target_topic text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE channel_id uuid;
BEGIN
  IF target_topic = 'mesh-chat-presence' THEN RETURN is_staff(); END IF;
  IF target_topic !~ '^mesh-chat-room:[0-9a-f-]{36}$' THEN RETURN false; END IF;
  channel_id := split_part(target_topic, ':', 2)::uuid;
  RETURN chat_can_access_channel(channel_id);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION chat_can_access_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chat_can_access_realtime_topic(text) TO authenticated;

CREATE POLICY "staff receive private chat realtime" ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND chat_can_access_realtime_topic((SELECT realtime.topic()))
  );

CREATE POLICY "staff send private chat realtime" ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND chat_can_access_realtime_topic((SELECT realtime.topic()))
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_receipts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'Phase 51 Mesh Chat upgrade migration complete' AS status;
