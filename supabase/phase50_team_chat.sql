-- PHASE 50: Mesh Chat — channels, DMs, messages, voice notes and reactions
-- Run once in the Supabase SQL editor. Never edit after it is applied.

CREATE TABLE chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  kind text NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'group', 'direct')),
  is_private boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_channel_name CHECK (kind <> 'channel' OR nullif(trim(name), '') IS NOT NULL)
);

CREATE TABLE chat_channel_members (
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'voice')),
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  voice_duration_seconds integer,
  reply_to_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_content CHECK (nullif(trim(body), '') IS NOT NULL OR attachment_path IS NOT NULL)
);

CREATE TABLE chat_reactions (
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX chat_messages_channel_created ON chat_messages(channel_id, created_at DESC);
CREATE INDEX chat_members_user ON chat_channel_members(user_id, channel_id);

CREATE OR REPLACE FUNCTION chat_can_access_channel(target_channel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channels c
    WHERE c.id = target_channel
      AND is_staff()
      AND (NOT c.is_private OR EXISTS (
        SELECT 1 FROM chat_channel_members m
        WHERE m.channel_id = c.id AND m.user_id = auth.uid()
      ))
  );
$$;

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- The helper must be SECURITY DEFINER to inspect membership without recursive
-- RLS, but it is not a public RPC: only signed-in users may execute it.
REVOKE ALL ON FUNCTION chat_can_access_channel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chat_can_access_channel(uuid) TO authenticated;

GRANT SELECT ON chat_channels, chat_channel_members, chat_messages, chat_reactions TO authenticated;
GRANT UPDATE ON chat_channel_members TO authenticated;
GRANT INSERT, UPDATE ON chat_messages TO authenticated;
GRANT INSERT, DELETE ON chat_reactions TO authenticated;

CREATE POLICY "staff see accessible chat channels" ON chat_channels FOR SELECT
  TO authenticated
  USING (chat_can_access_channel(id));
CREATE POLICY "staff see accessible chat members" ON chat_channel_members FOR SELECT
  TO authenticated
  USING (chat_can_access_channel(channel_id));
CREATE POLICY "members update own read marker" ON chat_channel_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff see accessible messages" ON chat_messages FOR SELECT
  TO authenticated
  USING (chat_can_access_channel(channel_id));
CREATE POLICY "staff send accessible messages" ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND chat_can_access_channel(channel_id));
CREATE POLICY "senders edit own messages" ON chat_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() AND chat_can_access_channel(channel_id));
CREATE POLICY "staff see accessible reactions" ON chat_reactions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_messages m WHERE m.id = message_id AND chat_can_access_channel(m.channel_id)));
CREATE POLICY "staff add own reactions" ON chat_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM chat_messages m WHERE m.id = message_id AND chat_can_access_channel(m.channel_id)));
CREATE POLICY "staff remove own reactions" ON chat_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', false, 20971520,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf','audio/webm','audio/mp4','audio/mpeg','audio/ogg','video/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat users read attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND chat_can_access_channel((storage.foldername(name))[1]::uuid));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A shared starting point. The creator/member records are deliberately made
-- by the application when the first admin opens Chat.
SELECT 'Phase 50 Mesh Chat migration complete' AS status;
