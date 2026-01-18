-- Create table to store complete AI conversation message history
-- This enables fetching past conversations and complete context

CREATE TABLE child_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES main_ai_sessions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_session_sequence UNIQUE (session_id, sequence_number)
);

-- Index for efficient message retrieval by session
CREATE INDEX idx_ai_messages_session_id ON child_ai_messages(session_id);
CREATE INDEX idx_ai_messages_session_sequence ON child_ai_messages(session_id, sequence_number);

-- Enable RLS
ALTER TABLE child_ai_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own session messages
CREATE POLICY "Users can view own session messages" ON child_ai_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM main_ai_sessions s
      JOIN main_employees e ON s.employee_id = e.id
      WHERE s.id = session_id
      AND e.auth_user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to messages" ON child_ai_messages
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT SELECT ON child_ai_messages TO authenticated;
GRANT ALL ON child_ai_messages TO service_role;

-- Add comment
COMMENT ON TABLE child_ai_messages IS 'Stores complete AI conversation message history for each session';
