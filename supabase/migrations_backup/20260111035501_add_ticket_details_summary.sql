-- Add details_summary column to main_tickets table
-- This column stores AI-generated summary of the ticket details

ALTER TABLE main_tickets
ADD COLUMN IF NOT EXISTS details_summary TEXT;

-- Add comment for documentation
COMMENT ON COLUMN main_tickets.details_summary IS 'AI-generated summary of ticket details (auto-generated when summarize flag is true)';
