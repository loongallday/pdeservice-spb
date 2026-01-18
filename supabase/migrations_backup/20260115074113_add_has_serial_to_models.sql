-- =============================================
-- Add has_serial flag to main_models
-- Determines whether items of this model require serial tracking
-- =============================================

-- Add column
ALTER TABLE main_models
ADD COLUMN IF NOT EXISTS has_serial BOOLEAN NOT NULL DEFAULT false;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_main_models_has_serial ON main_models(has_serial);

-- Comment
COMMENT ON COLUMN main_models.has_serial IS 'Whether this model requires serial number tracking (true=individual units, false=quantity-based)';

-- Set has_serial=true for UPS category (individual units need serial tracking)
UPDATE main_models
SET has_serial = true
WHERE category = 'UPS';

-- Future categories that typically need serial tracking:
-- UPDATE main_models SET has_serial = true WHERE category IN ('UPS', 'PDU', 'Server');

-- Future categories that typically don't need serial tracking:
-- UPDATE main_models SET has_serial = false WHERE category IN ('Battery', 'Cable', 'Accessory');
