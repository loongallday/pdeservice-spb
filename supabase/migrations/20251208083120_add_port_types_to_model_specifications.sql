-- Migration: Add input/output port types to model_specifications
-- Description: Adds columns for input and output port/connector types

-- Add input port type column
ALTER TABLE model_specifications
ADD COLUMN input_port_type VARCHAR(100);

-- Add output port type column  
ALTER TABLE model_specifications
ADD COLUMN output_port_type VARCHAR(100);

-- Add comments
COMMENT ON COLUMN model_specifications.input_port_type IS 'Input port/connector type (e.g., IEC C14, IEC C20, Hardwired, NEMA 5-15P)';
COMMENT ON COLUMN model_specifications.output_port_type IS 'Output port/connector type (e.g., IEC C13, IEC C19, NEMA, Universal)';

