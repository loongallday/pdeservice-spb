/**
 * Stock System Types
 */

export interface StockLocation {
  id: string;
  name: string;
  code: string;
  location_type_id: string;
  location_type?: {
    id: string;
    code: string;
    name_th: string;
  };
  site_id?: string;
  site?: {
    id: string;
    name: string;
  };
  employee_id?: string;
  employee?: {
    id: string;
    name: string;
  };
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockItem {
  id: string;
  location_id: string;
  location?: StockLocation;
  model_id: string;
  model?: {
    id: string;
    model: string;
    name: string;
    name_th: string;
    name_en?: string;
    category: string;
    unit: string;
  };
  quantity: number;
  minimum_quantity: number;
  reserved_quantity: number;
  available_quantity?: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  stock_item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_id?: string;
  reference_type?: string;
  related_location_id?: string;
  related_location?: {
    id: string;
    name: string;
    code: string;
  };
  notes?: string;
  performed_by: string;
  performer?: {
    id: string;
    name: string;
  };
  performed_at: string;
  created_at: string;
}

export type StockMovementType =
  | 'receive'
  | 'consume'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjust_add'
  | 'adjust_remove'
  | 'reserve'
  | 'unreserve';

export interface TicketStockItem {
  id: string;
  ticket_id: string;
  stock_item_id: string;
  model_id: string;
  model?: {
    id: string;
    model: string;
    name_th: string;
  };
  quantity: number;
  status: 'reserved' | 'consumed' | 'returned';
  consumed_by: string;
  consumed_at: string;
  created_at: string;
}

// Input types
export interface CreateLocationInput {
  name: string;
  code: string;
  location_type_id: string;
  site_id?: string;
  employee_id?: string;
  address?: string;
  is_active?: boolean;
}

export interface UpdateLocationInput {
  name?: string;
  code?: string;
  location_type_id?: string;
  site_id?: string;
  employee_id?: string;
  address?: string;
  is_active?: boolean;
}

export interface ReceiveStockInput {
  location_id: string;
  model_id: string;
  quantity: number;
  notes?: string;
}

export interface TransferStockInput {
  from_location_id: string;
  to_location_id: string;
  model_id: string;
  quantity: number;
  notes?: string;
}

export interface AdjustStockInput {
  adjustment: number;
  reason: string;
}

export interface ConsumeStockInput {
  items: {
    stock_item_id: string;
    quantity: number;
  }[];
  notes?: string;
}

export interface LowStockItem {
  stock_item_id: string;
  location_id: string;
  location_name: string;
  location_code: string;
  model_id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  minimum_quantity: number;
  deficit: number;
}
