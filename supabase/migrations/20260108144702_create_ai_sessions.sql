-- AI Assistant Sessions Table
-- Stores conversation context, entity memory, and history for AI assistant
-- Enables persistence across sessions and devices (RAG-like retrieval)

CREATE TABLE IF NOT EXISTS main_ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES main_employees(id) ON DELETE CASCADE,

  -- Entity memory (RAG-like storage)
  -- Stores: sites, companies, employees, tickets, preferences
  entity_memory JSONB NOT NULL DEFAULT '{
    "sites": {},
    "companies": {},
    "employees": {},
    "tickets": {},
    "preferences": {}
  }'::jsonb,

  -- Compressed conversation summary
  -- Stores: topics, actions, pendingTasks, keyDecisions
  conversation_summary JSONB NOT NULL DEFAULT '{
    "topics": [],
    "actions": [],
    "pendingTasks": [],
    "keyDecisions": [],
    "recentSummaries": []
  }'::jsonb,

  -- Recent messages (last 2 turns kept in full)
  recent_messages JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Session metadata
  title TEXT, -- Auto-generated from first query
  message_count INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_sessions_employee_id ON main_ai_sessions(employee_id);
CREATE INDEX idx_ai_sessions_updated_at ON main_ai_sessions(updated_at DESC);
CREATE INDEX idx_ai_sessions_last_message ON main_ai_sessions(last_message_at DESC);

-- RLS Policies
ALTER TABLE main_ai_sessions ENABLE ROW LEVEL SECURITY;

-- Employees can only see their own sessions
CREATE POLICY "ai_sessions_select_own" ON main_ai_sessions
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "ai_sessions_insert_own" ON main_ai_sessions
  FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "ai_sessions_update_own" ON main_ai_sessions
  FOR UPDATE USING (employee_id = auth.uid());

CREATE POLICY "ai_sessions_delete_own" ON main_ai_sessions
  FOR DELETE USING (employee_id = auth.uid());

-- Service role can do everything
CREATE POLICY "ai_sessions_service_role" ON main_ai_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON main_ai_sessions TO authenticated;
GRANT ALL ON main_ai_sessions TO service_role;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_sessions_updated_at
  BEFORE UPDATE ON main_ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_session_timestamp();

-- Comment
COMMENT ON TABLE main_ai_sessions IS 'AI Assistant conversation sessions with entity memory (RAG-like) for context persistence';
