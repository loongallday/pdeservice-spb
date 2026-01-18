/**
 * Work Estimate Service
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, ValidationError, DatabaseError } from '../../_shared/error.ts';
import type {
  WorkEstimate,
  WorkEstimateWithTicket,
  CreateWorkEstimateRequest,
  UpdateWorkEstimateRequest,
} from '../types.ts';

/**
 * Get work estimate by ticket ID
 */
export async function getByTicketId(ticketId: string): Promise<WorkEstimateWithTicket | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .select(`
      *,
      ticket:main_tickets!ticket_id (
        ticket_code,
        site:main_sites!site_id (name),
        work_type:ref_ticket_work_types!work_type_id (name)
      )
    `)
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching work estimate:', error);
    throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    ticket_id: data.ticket_id,
    estimated_minutes: data.estimated_minutes,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    ticket_code: data.ticket?.ticket_code || null,
    site_name: data.ticket?.site?.name || null,
    work_type_name: data.ticket?.work_type?.name || null,
  };
}

/**
 * Get work estimate by ID
 */
export async function getById(id: string): Promise<WorkEstimateWithTicket> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .select(`
      *,
      ticket:main_tickets!ticket_id (
        ticket_code,
        site:main_sites!site_id (name),
        work_type:ref_ticket_work_types!work_type_id (name)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching work estimate:', error);
    throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
  }

  if (!data) {
    throw new NotFoundError('ไม่พบข้อมูลเวลาทำงาน');
  }

  return {
    id: data.id,
    ticket_id: data.ticket_id,
    estimated_minutes: data.estimated_minutes,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    ticket_code: data.ticket?.ticket_code || null,
    site_name: data.ticket?.site?.name || null,
    work_type_name: data.ticket?.work_type?.name || null,
  };
}

/**
 * Get work estimates for multiple tickets
 */
export async function getByTicketIds(ticketIds: string[]): Promise<Map<string, WorkEstimate>> {
  if (ticketIds.length === 0) {
    return new Map();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .select('*')
    .in('ticket_id', ticketIds);

  if (error) {
    console.error('Error fetching work estimates:', error);
    throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
  }

  const map = new Map<string, WorkEstimate>();
  for (const item of data || []) {
    map.set(item.ticket_id, item);
  }

  return map;
}

/**
 * Create work estimate
 */
export async function create(
  request: CreateWorkEstimateRequest,
  employeeId: string
): Promise<WorkEstimate> {
  const supabase = createServiceClient();

  // Validate ticket exists
  const { data: ticket, error: ticketError } = await supabase
    .from('main_tickets')
    .select('id')
    .eq('id', request.ticket_id)
    .maybeSingle();

  if (ticketError || !ticket) {
    throw new NotFoundError('ไม่พบ ticket ที่ระบุ');
  }

  // Validate estimated_minutes
  if (request.estimated_minutes < 1 || request.estimated_minutes > 480) {
    throw new ValidationError('เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที');
  }

  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .insert({
      ticket_id: request.ticket_id,
      estimated_minutes: request.estimated_minutes,
      notes: request.notes || null,
      created_by: employeeId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ValidationError('ticket นี้มีข้อมูลเวลาทำงานอยู่แล้ว');
    }
    console.error('Error creating work estimate:', error);
    throw new DatabaseError('ไม่สามารถสร้างข้อมูลได้');
  }

  return data;
}

/**
 * Update work estimate
 */
export async function update(
  id: string,
  request: UpdateWorkEstimateRequest
): Promise<WorkEstimate> {
  const supabase = createServiceClient();

  // Validate estimated_minutes if provided
  if (request.estimated_minutes !== undefined) {
    if (request.estimated_minutes < 1 || request.estimated_minutes > 480) {
      throw new ValidationError('เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที');
    }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (request.estimated_minutes !== undefined) {
    updateData.estimated_minutes = request.estimated_minutes;
  }
  if (request.notes !== undefined) {
    updateData.notes = request.notes;
  }

  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบข้อมูลเวลาทำงาน');
    }
    console.error('Error updating work estimate:', error);
    throw new DatabaseError('ไม่สามารถอัปเดตข้อมูลได้');
  }

  return data;
}

/**
 * Upsert work estimate (create or update)
 */
export async function upsert(
  request: CreateWorkEstimateRequest,
  employeeId: string
): Promise<{ data: WorkEstimate; isNew: boolean }> {
  // Check if exists
  const existing = await getByTicketId(request.ticket_id);

  if (existing) {
    const updated = await update(existing.id, {
      estimated_minutes: request.estimated_minutes,
      notes: request.notes,
    });
    return { data: updated, isNew: false };
  } else {
    const created = await create(request, employeeId);
    return { data: created, isNew: true };
  }
}

/**
 * Delete work estimate
 */
export async function deleteById(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('child_ticket_work_estimates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting work estimate:', error);
    throw new DatabaseError('ไม่สามารถลบข้อมูลได้');
  }
}

/**
 * Delete work estimate by ticket ID
 */
export async function deleteByTicketId(ticketId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('child_ticket_work_estimates')
    .delete()
    .eq('ticket_id', ticketId);

  if (error) {
    console.error('Error deleting work estimate:', error);
    throw new DatabaseError('ไม่สามารถลบข้อมูลได้');
  }
}
