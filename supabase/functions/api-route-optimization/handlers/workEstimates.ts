/**
 * Work Estimates Handler for Route Optimization API
 */

import { success, error as errorResponse } from '../../_shared/response.ts';
import { ValidationError, NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { createServiceClient } from '../../_shared/supabase.ts';

interface Employee {
  id: string;
}

interface WorkEstimate {
  id: string;
  ticket_id: string;
  estimated_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkEstimateWithTicket extends WorkEstimate {
  ticket_code: string | null;
  site_name: string | null;
  work_type_name: string | null;
}

/**
 * GET /work-estimates/ticket/:ticketId - Get work estimate by ticket ID
 */
export async function handleGetByTicket(
  req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .select(`
      *,
      ticket:main_tickets (
        ticket_code,
        main_sites (name),
        ref_ticket_work_types (name)
      )
    `)
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching work estimate:', error);
    throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
  }

  if (!data) {
    throw new NotFoundError('ไม่พบข้อมูลเวลาทำงานสำหรับ ticket นี้');
  }

  const result: WorkEstimateWithTicket = {
    id: data.id,
    ticket_id: data.ticket_id,
    estimated_minutes: data.estimated_minutes,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    ticket_code: data.ticket?.ticket_code || null,
    site_name: data.ticket?.main_sites?.name || null,
    work_type_name: data.ticket?.ref_ticket_work_types?.name || null,
  };

  return success(result);
}

/**
 * GET /work-estimates/date/:date - Get all work estimates for tickets on a date
 */
export async function handleGetByDate(
  req: Request,
  employee: Employee,
  date: string
): Promise<Response> {
  // Validate date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
  }

  const supabase = createServiceClient();

  // Get tickets for the date via main_appointments
  const { data: tickets, error: ticketError } = await supabase
    .from('main_tickets')
    .select(`
      id,
      ticket_code,
      main_sites (name),
      main_appointments!inner (appointment_date),
      ref_ticket_work_types (name)
    `)
    .eq('main_appointments.appointment_date', date);

  if (ticketError) {
    console.error('Error fetching tickets:', ticketError);
    throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
  }

  if (!tickets || tickets.length === 0) {
    return success([]);
  }

  // Fetch work estimates separately for reliability
  const ticketIds = tickets.map((t: any) => t.id);
  const { data: workEstimates, error: weError } = await supabase
    .from('child_ticket_work_estimates')
    .select('id, ticket_id, estimated_minutes, notes')
    .in('ticket_id', ticketIds);

  if (weError) {
    console.error('Error fetching work estimates:', weError);
  }

  // Create a map for quick lookup
  const weMap = new Map<string, { id: string; estimated_minutes: number; notes: string | null }>();
  for (const we of workEstimates || []) {
    weMap.set(we.ticket_id, {
      id: we.id,
      estimated_minutes: we.estimated_minutes,
      notes: we.notes,
    });
  }

  const result = tickets.map((ticket: any) => ({
    ticket_id: ticket.id,
    ticket_code: ticket.ticket_code,
    site_name: ticket.main_sites?.name || null,
    work_type_name: ticket.ref_ticket_work_types?.name || null,
    work_estimate: weMap.get(ticket.id) || null,
  }));

  return success(result);
}

interface UpsertRequest {
  ticket_id: string;
  estimated_minutes: number;
  notes?: string;
}

/**
 * POST /work-estimates - Create or update work estimate
 */
export async function handleUpsert(req: Request, employee: Employee): Promise<Response> {
  const body: UpsertRequest = await req.json();

  // Validate
  if (!body.ticket_id) {
    throw new ValidationError('กรุณาระบุ ticket_id');
  }

  if (!body.estimated_minutes || body.estimated_minutes < 1 || body.estimated_minutes > 480) {
    throw new ValidationError('เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที');
  }

  const supabase = createServiceClient();

  // Check if ticket exists
  const { data: ticket, error: ticketError } = await supabase
    .from('main_tickets')
    .select('id')
    .eq('id', body.ticket_id)
    .maybeSingle();

  if (ticketError || !ticket) {
    throw new NotFoundError('ไม่พบ ticket ที่ระบุ');
  }

  // Check if work estimate exists
  const { data: existing } = await supabase
    .from('child_ticket_work_estimates')
    .select('id')
    .eq('ticket_id', body.ticket_id)
    .maybeSingle();

  let result;
  let isNew = false;

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from('child_ticket_work_estimates')
      .update({
        estimated_minutes: body.estimated_minutes,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating work estimate:', error);
      throw new DatabaseError('ไม่สามารถอัปเดตข้อมูลได้');
    }
    result = data;
  } else {
    // Create
    const { data, error } = await supabase
      .from('child_ticket_work_estimates')
      .insert({
        ticket_id: body.ticket_id,
        estimated_minutes: body.estimated_minutes,
        notes: body.notes || null,
        created_by: employee.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating work estimate:', error);
      throw new DatabaseError('ไม่สามารถสร้างข้อมูลได้');
    }
    result = data;
    isNew = true;
  }

  return success({ ...result, is_new: isNew });
}

interface BulkUpsertRequest {
  estimates: UpsertRequest[];
}

/**
 * POST /work-estimates/bulk - Bulk create/update work estimates
 */
export async function handleBulkUpsert(req: Request, employee: Employee): Promise<Response> {
  const body: BulkUpsertRequest = await req.json();

  if (!body.estimates || !Array.isArray(body.estimates)) {
    throw new ValidationError('กรุณาระบุ estimates เป็น array');
  }

  if (body.estimates.length === 0) {
    throw new ValidationError('ต้องมีอย่างน้อย 1 รายการ');
  }

  if (body.estimates.length > 100) {
    throw new ValidationError('สูงสุด 100 รายการต่อครั้ง');
  }

  const supabase = createServiceClient();
  const results = {
    created: 0,
    updated: 0,
    errors: [] as Array<{ ticket_id: string; error: string }>,
  };

  for (const estimate of body.estimates) {
    try {
      if (!estimate.ticket_id) {
        results.errors.push({ ticket_id: 'unknown', error: 'ไม่ได้ระบุ ticket_id' });
        continue;
      }

      if (!estimate.estimated_minutes || estimate.estimated_minutes < 1 || estimate.estimated_minutes > 480) {
        results.errors.push({ ticket_id: estimate.ticket_id, error: 'เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที' });
        continue;
      }

      // Check if exists
      const { data: existing } = await supabase
        .from('child_ticket_work_estimates')
        .select('id')
        .eq('ticket_id', estimate.ticket_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('child_ticket_work_estimates')
          .update({
            estimated_minutes: estimate.estimated_minutes,
            notes: estimate.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        results.updated++;
      } else {
        await supabase
          .from('child_ticket_work_estimates')
          .insert({
            ticket_id: estimate.ticket_id,
            estimated_minutes: estimate.estimated_minutes,
            notes: estimate.notes || null,
            created_by: employee.id,
          });
        results.created++;
      }
    } catch (err) {
      results.errors.push({
        ticket_id: estimate.ticket_id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return success(results);
}

/**
 * DELETE /work-estimates/ticket/:ticketId - Delete work estimate by ticket ID
 */
export async function handleDeleteByTicket(
  req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('child_ticket_work_estimates')
    .delete()
    .eq('ticket_id', ticketId);

  if (error) {
    console.error('Error deleting work estimate:', error);
    throw new DatabaseError('ไม่สามารถลบข้อมูลได้');
  }

  return success({ message: 'ลบข้อมูลสำเร็จ' });
}
