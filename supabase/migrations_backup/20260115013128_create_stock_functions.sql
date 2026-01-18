-- Function: Consume stock for a ticket (atomic operation)
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
  v_package_item_id UUID;
BEGIN
  -- Get current stock with row lock
  SELECT quantity, reserved_quantity, package_item_id
  INTO v_current_quantity, v_reserved_quantity, v_package_item_id
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

  -- Update stock quantity
  UPDATE main_stock_items
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_stock_item_id;

  -- Record consumption in junction table
  INSERT INTO jct_ticket_stock_items (ticket_id, stock_item_id, package_item_id, quantity, status, consumed_by)
  VALUES (p_ticket_id, p_stock_item_id, v_package_item_id, p_quantity, 'consumed', p_performed_by);

  -- Log movement
  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, notes, performed_by)
  VALUES (p_stock_item_id, 'consume', -p_quantity, v_current_quantity, v_current_quantity - p_quantity, p_ticket_id, 'ticket', p_notes, p_performed_by);

  RETURN QUERY SELECT true, 'Stock consumed successfully'::TEXT, (v_current_quantity - p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Transfer stock between locations (atomic operation)
CREATE OR REPLACE FUNCTION transfer_stock(
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_package_item_id UUID,
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

  -- Get source stock with row lock
  SELECT id, quantity, reserved_quantity
  INTO v_from_stock_id, v_from_quantity, v_from_reserved
  FROM main_stock_items
  WHERE location_id = p_from_location_id AND package_item_id = p_package_item_id
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

  -- Get or create destination stock
  SELECT id, quantity INTO v_to_stock_id, v_to_quantity
  FROM main_stock_items
  WHERE location_id = p_to_location_id AND package_item_id = p_package_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO main_stock_items (location_id, package_item_id, quantity)
    VALUES (p_to_location_id, p_package_item_id, 0)
    RETURNING id, quantity INTO v_to_stock_id, v_to_quantity;
  END IF;

  -- Update source (decrease)
  UPDATE main_stock_items
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE id = v_from_stock_id;

  -- Update destination (increase)
  UPDATE main_stock_items
  SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE id = v_to_stock_id;

  -- Log movement OUT
  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, related_location_id, notes, performed_by)
  VALUES (v_from_stock_id, 'transfer_out', -p_quantity, v_from_quantity, v_from_quantity - p_quantity, v_transfer_id, 'transfer', p_to_location_id, p_notes, p_performed_by);

  -- Log movement IN
  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, related_location_id, notes, performed_by)
  VALUES (v_to_stock_id, 'transfer_in', p_quantity, v_to_quantity, v_to_quantity + p_quantity, v_transfer_id, 'transfer', p_from_location_id, p_notes, p_performed_by);

  RETURN QUERY SELECT true, 'Transfer completed'::TEXT, (v_from_quantity - p_quantity), (v_to_quantity + p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Receive stock at a location
CREATE OR REPLACE FUNCTION receive_stock(
  p_location_id UUID,
  p_package_item_id UUID,
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
  -- Get or create stock item
  SELECT id, quantity INTO v_stock_id, v_current_quantity
  FROM main_stock_items
  WHERE location_id = p_location_id AND package_item_id = p_package_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO main_stock_items (location_id, package_item_id, quantity)
    VALUES (p_location_id, p_package_item_id, p_quantity)
    RETURNING id, quantity INTO v_stock_id, v_current_quantity;

    -- Log movement
    INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
    VALUES (v_stock_id, 'receive', p_quantity, 0, p_quantity, p_notes, p_performed_by);

    RETURN QUERY SELECT true, v_stock_id, p_quantity;
    RETURN;
  END IF;

  -- Update existing
  UPDATE main_stock_items
  SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE id = v_stock_id;

  -- Log movement
  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
  VALUES (v_stock_id, 'receive', p_quantity, v_current_quantity, v_current_quantity + p_quantity, p_notes, p_performed_by);

  RETURN QUERY SELECT true, v_stock_id, (v_current_quantity + p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Adjust stock (add or remove)
CREATE OR REPLACE FUNCTION adjust_stock(
  p_stock_item_id UUID,
  p_adjustment INTEGER,
  p_performed_by UUID,
  p_reason TEXT
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_quantity INTEGER
) AS $$
DECLARE
  v_current_quantity INTEGER;
  v_reserved_quantity INTEGER;
  v_new_quantity INTEGER;
  v_movement_type stock_movement_type;
BEGIN
  -- Get current stock with row lock
  SELECT quantity, reserved_quantity
  INTO v_current_quantity, v_reserved_quantity
  FROM main_stock_items
  WHERE id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Stock item not found'::TEXT, 0;
    RETURN;
  END IF;

  v_new_quantity := v_current_quantity + p_adjustment;

  -- Check for negative result
  IF v_new_quantity < 0 THEN
    RETURN QUERY SELECT false, format('Cannot reduce below zero (current: %s, adjustment: %s)', v_current_quantity, p_adjustment)::TEXT, v_current_quantity;
    RETURN;
  END IF;

  -- Check reserved constraint
  IF v_new_quantity < v_reserved_quantity THEN
    RETURN QUERY SELECT false, format('Cannot reduce below reserved quantity (%s)', v_reserved_quantity)::TEXT, v_current_quantity;
    RETURN;
  END IF;

  -- Determine movement type
  IF p_adjustment > 0 THEN
    v_movement_type := 'adjust_add';
  ELSE
    v_movement_type := 'adjust_remove';
  END IF;

  -- Update stock
  UPDATE main_stock_items
  SET quantity = v_new_quantity, updated_at = NOW()
  WHERE id = p_stock_item_id;

  -- Log movement
  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
  VALUES (p_stock_item_id, v_movement_type, p_adjustment, v_current_quantity, v_new_quantity, p_reason, p_performed_by);

  RETURN QUERY SELECT true, 'Adjustment completed'::TEXT, v_new_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE (
  stock_item_id UUID,
  location_id UUID,
  location_name VARCHAR,
  location_code VARCHAR,
  package_item_id UUID,
  item_code VARCHAR,
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
    pi.id,
    pi.code,
    pi.name_th,
    si.quantity,
    si.minimum_quantity,
    (si.minimum_quantity - si.quantity) as deficit
  FROM main_stock_items si
  JOIN main_stock_locations sl ON si.location_id = sl.id
  JOIN ref_package_items pi ON si.package_item_id = pi.id
  WHERE si.quantity <= si.minimum_quantity
    AND sl.is_active = true
    AND pi.is_active = true
  ORDER BY deficit DESC, sl.name, pi.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION consume_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION transfer_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION receive_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION adjust_stock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_low_stock_items TO authenticated, service_role;

COMMENT ON FUNCTION consume_stock IS 'Atomic operation to consume stock for a ticket';
COMMENT ON FUNCTION transfer_stock IS 'Atomic operation to transfer stock between locations';
COMMENT ON FUNCTION receive_stock IS 'Atomic operation to receive stock at a location';
COMMENT ON FUNCTION adjust_stock IS 'Atomic operation to adjust stock quantity';
COMMENT ON FUNCTION get_low_stock_items IS 'Get all items where quantity is at or below minimum';
