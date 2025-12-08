-- Migration: Add idempotency keys table for preventing duplicate operations
-- Created: 2024-12-03
-- 
-- This table stores idempotency keys to prevent duplicate ticket creations
-- when users double-click or experience network issues

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Idempotency key provided by client
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Type of operation (e.g., 'create_ticket', 'update_ticket')
  operation_type TEXT NOT NULL,
  
  -- Employee who made the request
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  -- Request payload (for verification)
  request_payload JSONB NOT NULL,
  
  -- Response data (for returning the same response)
  response_data JSONB,
  
  -- HTTP status code of the response
  status_code INTEGER,
  
  -- Whether the operation completed successfully
  is_completed BOOLEAN NOT NULL DEFAULT false,
  
  -- Whether the operation failed
  is_failed BOOLEAN NOT NULL DEFAULT false,
  
  -- Error message if failed
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Add comments
COMMENT ON TABLE public.idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations (e.g., duplicate ticket creation)';
COMMENT ON COLUMN public.idempotency_keys.idempotency_key IS 'Unique key provided by client (e.g., UUID v4)';
COMMENT ON COLUMN public.idempotency_keys.operation_type IS 'Type of operation being idempotent (e.g., create_ticket)';
COMMENT ON COLUMN public.idempotency_keys.request_payload IS 'Original request payload for verification';
COMMENT ON COLUMN public.idempotency_keys.response_data IS 'Response data to return for duplicate requests';
COMMENT ON COLUMN public.idempotency_keys.expires_at IS 'When this key expires (default 24 hours)';

-- Create indexes
CREATE INDEX idx_idempotency_keys_key ON public.idempotency_keys(idempotency_key);
CREATE INDEX idx_idempotency_keys_employee ON public.idempotency_keys(employee_id);
CREATE INDEX idx_idempotency_keys_created_at ON public.idempotency_keys(created_at);
CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- Composite index for common queries
CREATE INDEX idx_idempotency_keys_key_operation ON public.idempotency_keys(idempotency_key, operation_type);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Create cleanup function to remove expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW();
END;
$$;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS 'Removes expired idempotency keys (should be called periodically)';

