-- Migration: Change port type columns from VARCHAR to TEXT arrays
-- Description: UPS units can have multiple input/output port types, so we need arrays instead of single values

-- Drop the single-value columns
ALTER TABLE model_specifications
DROP COLUMN IF EXISTS input_port_type,
DROP COLUMN IF EXISTS output_port_type;

-- Add array columns for multiple port types
ALTER TABLE model_specifications
ADD COLUMN input_port_types TEXT[],
ADD COLUMN output_port_types TEXT[];

-- Add comments
COMMENT ON COLUMN model_specifications.input_port_types IS 'Array of input port/connector types (e.g., IEC C14, IEC C20, Hardwired, NEMA 5-15P)';
COMMENT ON COLUMN model_specifications.output_port_types IS 'Array of output port/connector types (e.g., IEC C13, IEC C19, NEMA, Universal)';

