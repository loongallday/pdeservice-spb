/**
 * Stock Movement Service
 * Fast atomic operations using DB functions
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, ValidationError } from '../../_shared/error.ts';
import type {
  StockMovement,
  ReceiveStockInput,
  TransferStockInput,
  AdjustStockInput,
  ConsumeStockInput
} from '../types.ts';

const MOVEMENT_SELECT = `
  id, stock_item_id, movement_type, quantity, quantity_before, quantity_after,
  reference_id, reference_type, related_location_id, notes, performed_by, performed_at, created_at,
  performer:main_employees(id, name),
  related_location:main_stock_locations(id, name, code)
`;

export async function getMovementHistory(
  stockItemId: string,
  options?: { page?: number; limit?: number }
): Promise<{ movements: StockMovement[]; total: number }> {
  const supabase = createServiceClient();
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('child_stock_movements')
    .select(MOVEMENT_SELECT, { count: 'exact' })
    .eq('stock_item_id', stockItemId)
    .order('performed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new DatabaseError(`Failed to get movement history: ${error.message}`);
  }

  return { movements: data as StockMovement[], total: count || 0 };
}

export async function receiveStock(
  input: ReceiveStockInput,
  performedBy: string
): Promise<{ stock_item_id: string; new_quantity: number }> {
  const supabase = createServiceClient();

  if (input.quantity <= 0) {
    throw new ValidationError('จำนวนต้องมากกว่า 0');
  }

  // Check if model requires serial tracking
  const { data: model, error: modelError } = await supabase
    .from('main_models')
    .select('id, model, has_serial')
    .eq('id', input.model_id)
    .single();

  if (modelError || !model) {
    throw new ValidationError('ไม่พบรายการสินค้า');
  }

  if (model.has_serial) {
    throw new ValidationError(`สินค้า "${model.model}" ต้องรับเข้าแบบมีซีเรียล กรุณาใช้หน้ารับสินค้าซีเรียล`);
  }

  const { data, error } = await supabase.rpc('receive_stock', {
    p_location_id: input.location_id,
    p_model_id: input.model_id,
    p_quantity: input.quantity,
    p_performed_by: performedBy,
    p_notes: input.notes || null,
  });

  if (error) {
    throw new DatabaseError(`Failed to receive stock: ${error.message}`);
  }

  const result = data[0];
  if (!result.success) {
    throw new DatabaseError(result.message || 'รับสต็อกไม่สำเร็จ');
  }

  return {
    stock_item_id: result.stock_item_id,
    new_quantity: result.new_quantity,
  };
}

export async function transferStock(
  input: TransferStockInput,
  performedBy: string
): Promise<{ from_remaining: number; to_new_quantity: number }> {
  const supabase = createServiceClient();

  if (input.quantity <= 0) {
    throw new ValidationError('จำนวนต้องมากกว่า 0');
  }

  if (input.from_location_id === input.to_location_id) {
    throw new ValidationError('ตำแหน่งต้นทางและปลายทางต้องไม่เหมือนกัน');
  }

  const { data, error } = await supabase.rpc('transfer_stock', {
    p_from_location_id: input.from_location_id,
    p_to_location_id: input.to_location_id,
    p_model_id: input.model_id,
    p_quantity: input.quantity,
    p_performed_by: performedBy,
    p_notes: input.notes || null,
  });

  if (error) {
    throw new DatabaseError(`Failed to transfer stock: ${error.message}`);
  }

  const result = data[0];
  if (!result.success) {
    throw new ValidationError(result.message || 'โอนสต็อกไม่สำเร็จ');
  }

  return {
    from_remaining: result.from_remaining,
    to_new_quantity: result.to_new_quantity,
  };
}

export async function adjustStock(
  stockItemId: string,
  input: AdjustStockInput,
  performedBy: string
): Promise<{ new_quantity: number }> {
  const supabase = createServiceClient();

  if (input.adjustment === 0) {
    throw new ValidationError('จำนวนปรับปรุงต้องไม่เป็น 0');
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new ValidationError('กรุณาระบุเหตุผลในการปรับปรุง');
  }

  const { data, error } = await supabase.rpc('adjust_stock', {
    p_stock_item_id: stockItemId,
    p_adjustment: input.adjustment,
    p_performed_by: performedBy,
    p_reason: input.reason,
  });

  if (error) {
    throw new DatabaseError(`Failed to adjust stock: ${error.message}`);
  }

  const result = data[0];
  if (!result.success) {
    throw new ValidationError(result.message || 'ปรับปรุงสต็อกไม่สำเร็จ');
  }

  return { new_quantity: result.new_quantity };
}

export async function consumeStockForTicket(
  ticketId: string,
  input: ConsumeStockInput,
  performedBy: string
): Promise<{ consumed: Array<{ stock_item_id: string; remaining: number }> }> {
  const supabase = createServiceClient();

  if (!input.items || input.items.length === 0) {
    throw new ValidationError('กรุณาระบุรายการสต็อกที่ต้องการใช้');
  }

  const results: Array<{ stock_item_id: string; remaining: number }> = [];

  // Process each item atomically using DB function
  for (const item of input.items) {
    if (item.quantity <= 0) {
      throw new ValidationError('จำนวนต้องมากกว่า 0');
    }

    const { data, error } = await supabase.rpc('consume_stock', {
      p_stock_item_id: item.stock_item_id,
      p_quantity: item.quantity,
      p_ticket_id: ticketId,
      p_performed_by: performedBy,
      p_notes: input.notes || null,
    });

    if (error) {
      throw new DatabaseError(`Failed to consume stock: ${error.message}`);
    }

    const result = data[0];
    if (!result.success) {
      throw new ValidationError(result.message || 'ใช้สต็อกไม่สำเร็จ');
    }

    results.push({
      stock_item_id: item.stock_item_id,
      remaining: result.remaining_quantity,
    });
  }

  return { consumed: results };
}
