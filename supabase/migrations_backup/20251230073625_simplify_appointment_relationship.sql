-- Simplify the ticket/appointment relationship
-- Change from dual relationship (tickets.appointment_id AND appointments.ticket_id)
-- to single relationship (tickets.appointment_id only)

-- Step 1: Migrate any data from appointments.ticket_id to tickets.appointment_id
-- This ensures tickets that only had the reverse relationship are properly linked
UPDATE tickets t
SET appointment_id = a.id
FROM appointments a
WHERE a.ticket_id = t.id
  AND t.appointment_id IS NULL;

-- Step 2: Populate denormalized appointment fields from appointments table
UPDATE tickets t
SET 
  appointment_date = a.appointment_date,
  appointment_time_start = a.appointment_time_start,
  appointment_time_end = a.appointment_time_end,
  appointment_is_approved = a.is_approved,
  appointment_type = a.appointment_type
FROM appointments a
WHERE t.appointment_id = a.id;

-- Step 3: Remove the ticket_id column from appointments (one-way relationship now)
-- First drop any index on ticket_id
DROP INDEX IF EXISTS idx_appointments_ticket_id;

-- Then drop the column
ALTER TABLE appointments DROP COLUMN IF EXISTS ticket_id;

