-- =============================================
-- Migration: Merge ref_package_items into main_models
-- Creates unified product/item catalog
-- =============================================

-- =============================================
-- STEP 1: Add new columns to main_models
-- =============================================

-- Thai name (for items/spare parts)
ALTER TABLE main_models ADD COLUMN IF NOT EXISTS name_th VARCHAR;

-- English name
ALTER TABLE main_models ADD COLUMN IF NOT EXISTS name_en VARCHAR;

-- Detailed description
ALTER TABLE main_models ADD COLUMN IF NOT EXISTS description TEXT;

-- Category for filtering (ups, battery, cable, accessory, etc.)
ALTER TABLE main_models ADD COLUMN IF NOT EXISTS category VARCHAR;

-- Unit of measurement (piece, meter, etc.)
ALTER TABLE main_models ADD COLUMN IF NOT EXISTS unit VARCHAR DEFAULT 'piece';

-- Active status flag
ALTER TABLE main_models ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_main_models_category ON main_models(category);
CREATE INDEX IF NOT EXISTS idx_main_models_is_active ON main_models(is_active);

-- Comments
COMMENT ON COLUMN main_models.name_th IS 'Thai name for the model/item';
COMMENT ON COLUMN main_models.name_en IS 'English name for the model/item';
COMMENT ON COLUMN main_models.description IS 'Detailed description';
COMMENT ON COLUMN main_models.category IS 'Category for filtering (ups, battery, cable, accessory)';
COMMENT ON COLUMN main_models.unit IS 'Unit of measurement (default: piece)';
COMMENT ON COLUMN main_models.is_active IS 'Whether this model/item is active';

-- =============================================
-- STEP 2: Update Foreign Keys
-- =============================================

-- 2.1 Drop existing FK constraints referencing ref_package_items
ALTER TABLE main_stock_items
  DROP CONSTRAINT IF EXISTS main_stock_items_package_item_id_fkey;

ALTER TABLE main_stock_serial_items
  DROP CONSTRAINT IF EXISTS main_stock_serial_items_package_item_id_fkey;

ALTER TABLE jct_ticket_stock_items
  DROP CONSTRAINT IF EXISTS jct_ticket_stock_items_package_item_id_fkey;

ALTER TABLE jct_model_package_items
  DROP CONSTRAINT IF EXISTS jct_model_package_items_item_id_fkey;

-- 2.2 Rename columns: package_item_id -> model_id
ALTER TABLE main_stock_items
  RENAME COLUMN package_item_id TO model_id;

ALTER TABLE main_stock_serial_items
  RENAME COLUMN package_item_id TO model_id;

ALTER TABLE jct_ticket_stock_items
  RENAME COLUMN package_item_id TO model_id;

-- For junction table: item_id -> component_model_id
ALTER TABLE jct_model_package_items
  RENAME COLUMN item_id TO component_model_id;

-- 2.3 Add new FK constraints pointing to main_models
ALTER TABLE main_stock_items
  ADD CONSTRAINT main_stock_items_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES main_models(id);

ALTER TABLE main_stock_serial_items
  ADD CONSTRAINT main_stock_serial_items_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES main_models(id);

ALTER TABLE jct_ticket_stock_items
  ADD CONSTRAINT jct_ticket_stock_items_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES main_models(id);

ALTER TABLE jct_model_package_items
  ADD CONSTRAINT jct_model_package_items_component_model_id_fkey
  FOREIGN KEY (component_model_id) REFERENCES main_models(id) ON DELETE CASCADE;

-- 2.4 Rename junction table for clarity
ALTER TABLE jct_model_package_items RENAME TO jct_model_components;

-- Update comments
COMMENT ON TABLE jct_model_components IS 'Junction table linking parent models to their component models';
COMMENT ON COLUMN jct_model_components.model_id IS 'The parent model (e.g., UPS system)';
COMMENT ON COLUMN jct_model_components.component_model_id IS 'The component model (e.g., battery, accessory)';

-- =============================================
-- STEP 3: Update Database Functions
-- =============================================

-- 3.1 Update get_low_stock_items function
DROP FUNCTION IF EXISTS get_low_stock_items();

CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE (
  stock_item_id UUID,
  location_id UUID,
  location_name VARCHAR,
  location_code VARCHAR,
  model_id UUID,
  item_code TEXT,
  item_name VARCHAR,
  quantity INTEGER,
  minimum_quantity INTEGER,
  deficit INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    sl.id,
    sl.name,
    sl.code,
    m.id,
    m.model,
    m.name_th,
    si.quantity,
    si.minimum_quantity,
    (si.minimum_quantity - si.quantity) as deficit
  FROM main_stock_items si
  JOIN main_stock_locations sl ON si.location_id = sl.id
  JOIN main_models m ON si.model_id = m.id
  WHERE si.quantity <= si.minimum_quantity
    AND sl.is_active = true
    AND (m.is_active IS NULL OR m.is_active = true)
  ORDER BY deficit DESC, sl.name, m.model;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 Update transfer_stock function
DROP FUNCTION IF EXISTS transfer_stock(UUID, UUID, UUID, INTEGER, UUID, TEXT);

CREATE OR REPLACE FUNCTION transfer_stock(
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_model_id UUID,
  p_quantity INTEGER,
  p_performed_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  from_remaining INTEGER,
  to_new_quantity INTEGER
) AS $$
DECLARE
  v_from_stock_id UUID;
  v_to_stock_id UUID;
  v_from_quantity INTEGER;
  v_from_reserved INTEGER;
  v_to_quantity INTEGER;
  v_available INTEGER;
  v_transfer_id UUID;
BEGIN
  v_transfer_id := gen_random_uuid();

  SELECT id, quantity, reserved_quantity
  INTO v_from_stock_id, v_from_quantity, v_from_reserved
  FROM main_stock_items
  WHERE location_id = p_from_location_id AND model_id = p_model_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Source stock not found'::TEXT, 0, 0;
    RETURN;
  END IF;

  v_available := v_from_quantity - v_from_reserved;

  IF p_quantity > v_available THEN
    RETURN QUERY SELECT false, format('Insufficient stock at source (available: %s)', v_available)::TEXT, v_available, 0;
    RETURN;
  END IF;

  SELECT id, quantity INTO v_to_stock_id, v_to_quantity
  FROM main_stock_items
  WHERE location_id = p_to_location_id AND model_id = p_model_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO main_stock_items (location_id, model_id, quantity)
    VALUES (p_to_location_id, p_model_id, 0)
    RETURNING id, quantity INTO v_to_stock_id, v_to_quantity;
  END IF;

  UPDATE main_stock_items
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE id = v_from_stock_id;

  UPDATE main_stock_items
  SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE id = v_to_stock_id;

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, related_location_id, notes, performed_by)
  VALUES (v_from_stock_id, 'transfer_out', -p_quantity, v_from_quantity, v_from_quantity - p_quantity, v_transfer_id, 'transfer', p_to_location_id, p_notes, p_performed_by);

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, related_location_id, notes, performed_by)
  VALUES (v_to_stock_id, 'transfer_in', p_quantity, v_to_quantity, v_to_quantity + p_quantity, v_transfer_id, 'transfer', p_from_location_id, p_notes, p_performed_by);

  RETURN QUERY SELECT true, 'Transfer completed'::TEXT, (v_from_quantity - p_quantity), (v_to_quantity + p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.3 Update receive_stock function
DROP FUNCTION IF EXISTS receive_stock(UUID, UUID, INTEGER, UUID, TEXT);

CREATE OR REPLACE FUNCTION receive_stock(
  p_location_id UUID,
  p_model_id UUID,
  p_quantity INTEGER,
  p_performed_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  stock_item_id UUID,
  new_quantity INTEGER
) AS $$
DECLARE
  v_stock_id UUID;
  v_current_quantity INTEGER;
BEGIN
  SELECT id, quantity INTO v_stock_id, v_current_quantity
  FROM main_stock_items
  WHERE location_id = p_location_id AND model_id = p_model_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO main_stock_items (location_id, model_id, quantity)
    VALUES (p_location_id, p_model_id, p_quantity)
    RETURNING id, quantity INTO v_stock_id, v_current_quantity;

    INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
    VALUES (v_stock_id, 'receive', p_quantity, 0, p_quantity, p_notes, p_performed_by);

    RETURN QUERY SELECT true, v_stock_id, p_quantity;
    RETURN;
  END IF;

  UPDATE main_stock_items
  SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE id = v_stock_id;

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
  VALUES (v_stock_id, 'receive', p_quantity, v_current_quantity, v_current_quantity + p_quantity, p_notes, p_performed_by);

  RETURN QUERY SELECT true, v_stock_id, (v_current_quantity + p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.4 Update consume_stock function
DROP FUNCTION IF EXISTS consume_stock(UUID, INTEGER, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION consume_stock(
  p_stock_item_id UUID,
  p_quantity INTEGER,
  p_ticket_id UUID,
  p_performed_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  remaining_quantity INTEGER
) AS $$
DECLARE
  v_current_quantity INTEGER;
  v_reserved_quantity INTEGER;
  v_available INTEGER;
  v_model_id UUID;
BEGIN
  SELECT quantity, reserved_quantity, model_id
  INTO v_current_quantity, v_reserved_quantity, v_model_id
  FROM main_stock_items
  WHERE id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Stock item not found'::TEXT, 0;
    RETURN;
  END IF;

  v_available := v_current_quantity - v_reserved_quantity;

  IF p_quantity > v_available THEN
    RETURN QUERY SELECT false, format('Insufficient stock (available: %s, requested: %s)', v_available, p_quantity)::TEXT, v_available;
    RETURN;
  END IF;

  UPDATE main_stock_items
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_stock_item_id;

  INSERT INTO jct_ticket_stock_items (ticket_id, stock_item_id, model_id, quantity, status, consumed_by)
  VALUES (p_ticket_id, p_stock_item_id, v_model_id, p_quantity, 'consumed', p_performed_by);

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, notes, performed_by)
  VALUES (p_stock_item_id, 'consume', -p_quantity, v_current_quantity, v_current_quantity - p_quantity, p_ticket_id, 'ticket', p_notes, p_performed_by);

  RETURN QUERY SELECT true, 'Stock consumed successfully'::TEXT, (v_current_quantity - p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION consume_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION transfer_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION receive_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_low_stock_items TO authenticated, service_role;

-- =============================================
-- STEP 4: Drop obsolete tables
-- =============================================

-- 4.1 Drop ext_model_specifications
DROP POLICY IF EXISTS "Authenticated can read model_specifications" ON ext_model_specifications;
DROP POLICY IF EXISTS "Authenticated can insert model_specifications" ON ext_model_specifications;
DROP POLICY IF EXISTS "Authenticated can update model_specifications" ON ext_model_specifications;
DROP POLICY IF EXISTS "Authenticated can delete model_specifications" ON ext_model_specifications;
DROP TRIGGER IF EXISTS trg_ext_model_specifications_updated_at ON ext_model_specifications;
DROP TABLE IF EXISTS ext_model_specifications;

-- 4.2 Drop ref_package_items
DROP POLICY IF EXISTS "Authenticated can read package_items" ON ref_package_items;
DROP POLICY IF EXISTS "Authenticated can insert package_items" ON ref_package_items;
DROP POLICY IF EXISTS "Authenticated can update package_items" ON ref_package_items;
DROP POLICY IF EXISTS "Authenticated can delete package_items" ON ref_package_items;
DROP TRIGGER IF EXISTS trg_ref_package_items_updated_at ON ref_package_items;
DROP TABLE IF EXISTS ref_package_items;

-- =============================================
-- STEP 5: Update unique constraints
-- =============================================

-- Update the unique constraint on main_stock_items
ALTER TABLE main_stock_items DROP CONSTRAINT IF EXISTS main_stock_items_location_id_package_item_id_key;
ALTER TABLE main_stock_items ADD CONSTRAINT main_stock_items_location_model_unique UNIQUE (location_id, model_id);

-- Update indexes
DROP INDEX IF EXISTS idx_stock_items_location_item;
CREATE INDEX IF NOT EXISTS idx_stock_items_location_model ON main_stock_items(location_id, model_id);
