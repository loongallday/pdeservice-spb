-- AI Session Helper Functions

-- Update token counts atomically
CREATE OR REPLACE FUNCTION update_ai_session_tokens(
  p_session_id UUID,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE main_ai_sessions
  SET
    total_input_tokens = total_input_tokens + p_input_tokens,
    total_output_tokens = total_output_tokens + p_output_tokens,
    message_count = message_count + 1,
    last_message_at = NOW()
  WHERE id = p_session_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_ai_session_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION update_ai_session_tokens TO service_role;

COMMENT ON FUNCTION update_ai_session_tokens IS 'Atomically update AI session token counts and message count';
