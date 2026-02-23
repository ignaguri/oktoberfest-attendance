-- Group message board: messages and alerts within groups

-- Message type enum
CREATE TYPE group_message_type AS ENUM ('message', 'alert');

-- Group messages table
CREATE TABLE group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  message_type group_message_type NOT NULL DEFAULT 'message',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_group_messages_group ON group_messages(group_id, created_at DESC);
CREATE INDEX idx_group_messages_pinned ON group_messages(group_id, pinned) WHERE pinned = true;

-- RLS
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- View: Only group members can see messages
CREATE POLICY "Group members can view messages" ON group_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));

-- Insert: Only group members can post
CREATE POLICY "Group members can post messages" ON group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid())
  );

-- Update: Only author can update own messages
CREATE POLICY "Users can update own messages" ON group_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Delete: Only author can delete own messages
CREATE POLICY "Users can delete own messages" ON group_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
