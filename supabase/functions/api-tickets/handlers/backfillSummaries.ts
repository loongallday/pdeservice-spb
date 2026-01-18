/**
 * @fileoverview Background job handler for AI summary generation
 * @module api-tickets/handlers/backfillSummaries
 *
 * Endpoints:
 * - POST /api-tickets/backfill-summaries - Start new backfill job
 * - GET /api-tickets/backfill-summaries?job_id=xxx - Check job status
 *
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @description
 * Regenerates AI summaries for existing tickets. Operates as a background job
 * to avoid timeout issues when processing many tickets.
 *
 * POST Request Body:
 * - limit: Max tickets to process (default: 50, max: 500)
 * - forceRefresh: Regenerate even if summary exists (default: false)
 * - ticketIds: Specific ticket IDs or codes (UUID or PDE-123 format)
 *
 * Job Status:
 * - Job ID is returned immediately after starting
 * - Use GET with job_id to check progress
 * - Status includes: processed, succeeded, failed, skipped counts
 *
 * The AI summary is generated from comprehensive ticket data including:
 * - Ticket details and work type
 * - Site and company information
 * - Contact details
 * - Appointment schedule
 * - Assigned and confirmed technicians
 * - Merchandise/equipment details
 */

import { success, error } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { createServiceClient } from '../../_shared/supabase.ts';
import {
  generateTicketSummary,
  TicketSummaryContext,
  MerchandiseItem,
  ContactInfo,
  AppointmentInfo,
  SiteInfo,
} from '../../_shared/summaryUtils.ts';
import type { Employee } from '../../_shared/auth.ts';

interface BackfillRequest {
  limit?: number; // Max tickets to process (default: 50)
  forceRefresh?: boolean; // Regenerate even if summary exists
  ticketIds?: string[]; // Specific ticket IDs or codes (UUID or PDE-123 format)
}

/**
 * Resolve ticket identifiers (UUIDs or codes like PDE-123) to UUIDs
 */
async function resolveTicketIds(
  supabase: ReturnType<typeof createServiceClient>,
  identifiers: string[]
): Promise<string[]> {
  const uuids: string[] = [];
  const codes: string[] = [];

  // Separate UUIDs from ticket codes
  for (const id of identifiers) {
    // Check if it looks like a ticket code (PDE-123 format)
    if (/^PDE-\d+$/i.test(id)) {
      codes.push(id.toUpperCase());
    } else {
      // Assume it's a UUID
      uuids.push(id);
    }
  }

  // Resolve ticket codes to UUIDs
  if (codes.length > 0) {
    const { data: tickets, error } = await supabase
      .from('main_tickets')
      .select('id')
      .in('ticket_code', codes);

    if (!error && tickets) {
      for (const ticket of tickets) {
        uuids.push(ticket.id);
      }
    }
  }

  return uuids;
}

/**
 * Fetch complete ticket data with ALL related information
 */
async function fetchCompleteTicketData(
  supabase: ReturnType<typeof createServiceClient>,
  ticketId: string
): Promise<TicketSummaryContext | null> {
  // Fetch ticket with all joins
  const { data: ticket, error: ticketError } = await supabase
    .from('main_tickets')
    .select(`
      id,
      details,
      additional,
      work_type_id,
      status_id,
      site_id,
      contact_id,
      appointment_id,
      assigner_id,
      created_at,
      updated_at,
      work_type:ref_ticket_work_types(name, code),
      status:ref_ticket_statuses(name, code),
      assigner:main_employees!main_tickets_assigner_id_fkey(name, nickname)
    `)
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    console.error(`[backfill] Failed to fetch ticket ${ticketId}:`, ticketError?.message);
    return null;
  }

  const context: TicketSummaryContext = {
    ticketId: ticket.id,
    details: ticket.details,
    additional: ticket.additional,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  };

  // Work type
  const workType = ticket.work_type as { name?: string; code?: string } | null;
  if (workType) {
    context.workType = workType.name || null;
    context.workTypeCode = workType.code || null;
  }

  // Status
  const status = ticket.status as { name?: string; code?: string } | null;
  if (status) {
    context.status = status.name || null;
    context.statusCode = status.code || null;
  }

  // Assigner
  const assigner = ticket.assigner as { name?: string; nickname?: string } | null;
  if (assigner) {
    context.assignerName = assigner.nickname || assigner.name || null;
  }

  // Fetch site with location resolution
  if (ticket.site_id) {
    const { data: site } = await supabase
      .from('main_sites')
      .select(`
        name,
        address_detail,
        province_code,
        district_code,
        subdistrict_code,
        postal_code,
        map_url,
        company:main_companies(name_th, name_en, tax_id)
      `)
      .eq('id', ticket.site_id)
      .single();

    if (site) {
      const siteInfo: SiteInfo = {
        name: site.name,
        addressDetail: site.address_detail,
        postalCode: site.postal_code?.toString() || null,
        mapUrl: site.map_url,
      };

      // Resolve location names
      if (site.province_code) {
        const { data: province } = await supabase
          .from('ref_provinces')
          .select('name_th')
          .eq('code', site.province_code)
          .single();
        siteInfo.provinceName = province?.name_th || null;
      }

      if (site.district_code) {
        const { data: district } = await supabase
          .from('ref_districts')
          .select('name_th')
          .eq('code', site.district_code)
          .single();
        siteInfo.districtName = district?.name_th || null;
      }

      if (site.subdistrict_code) {
        const { data: subdistrict } = await supabase
          .from('ref_subdistricts')
          .select('name_th')
          .eq('code', site.subdistrict_code)
          .single();
        siteInfo.subdistrictName = subdistrict?.name_th || null;
      }

      context.site = siteInfo;

      // Company from site
      const company = site.company as { name_th?: string; name_en?: string; tax_id?: string } | null;
      if (company) {
        context.companyName = company.name_th || company.name_en || null;
        context.companyTaxId = company.tax_id || null;
      }
    }
  }

  // Fetch contact
  if (ticket.contact_id) {
    const { data: contact } = await supabase
      .from('child_site_contacts')
      .select('person_name, nickname, phone, email, line_id, note')
      .eq('id', ticket.contact_id)
      .single();

    if (contact) {
      const contactInfo: ContactInfo = {
        name: contact.person_name,
        nickname: contact.nickname,
        phone: Array.isArray(contact.phone) ? contact.phone : null,
        email: Array.isArray(contact.email) ? contact.email : null,
        lineId: contact.line_id,
        note: contact.note,
      };
      context.contact = contactInfo;
    }
  }

  // Fetch appointment
  if (ticket.appointment_id) {
    const { data: appt } = await supabase
      .from('main_appointments')
      .select('appointment_date, appointment_time_start, appointment_time_end, appointment_type, is_approved')
      .eq('id', ticket.appointment_id)
      .single();

    if (appt) {
      const apptInfo: AppointmentInfo = {
        date: appt.appointment_date,
        timeStart: appt.appointment_time_start,
        timeEnd: appt.appointment_time_end,
        type: appt.appointment_type,
        isApproved: appt.is_approved,
      };
      context.appointment = apptInfo;
    }
  }

  // Fetch employees
  const { data: ticketEmps } = await supabase
    .from('jct_ticket_employees')
    .select('is_key_employee, employee:main_employees(nickname, first_name, name)')
    .eq('ticket_id', ticketId);

  if (ticketEmps && ticketEmps.length > 0) {
    const employeeNames: string[] = [];
    let keyEmployee: string | null = null;

    for (const te of ticketEmps) {
      const emp = te.employee as { nickname?: string; first_name?: string; name?: string } | null;
      const empName = emp?.nickname || emp?.first_name || emp?.name || 'ช่าง';
      employeeNames.push(empName);

      if (te.is_key_employee) {
        keyEmployee = empName;
      }
    }

    context.employees = employeeNames;
    context.keyEmployee = keyEmployee;
  }

  // Fetch confirmed employees
  const { data: confirmedEmps } = await supabase
    .from('jct_ticket_employees_cf')
    .select('employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(nickname, first_name, name)')
    .eq('ticket_id', ticketId);

  if (confirmedEmps && confirmedEmps.length > 0) {
    context.confirmedEmployees = confirmedEmps.map(ce => {
      const emp = ce.employee as { nickname?: string; first_name?: string; name?: string } | null;
      return emp?.nickname || emp?.first_name || emp?.name || 'ช่าง';
    });
  }

  // Fetch merchandise with model details
  const { data: ticketMerch } = await supabase
    .from('jct_ticket_merchandise')
    .select(`
      merchandise:main_merchandise(
        serial_no,
        model:main_models(
          model,
          brand:ref_brands(name),
          capacity:ref_capacities(name)
        )
      )
    `)
    .eq('ticket_id', ticketId);

  if (ticketMerch && ticketMerch.length > 0) {
    const merchItems: MerchandiseItem[] = [];

    for (const tm of ticketMerch) {
      const merch = tm.merchandise as {
        serial_no?: string;
        model?: {
          model?: string;
          brand?: { name?: string } | null;
          capacity?: { name?: string } | null;
        } | null;
      } | null;

      if (merch) {
        merchItems.push({
          serialNo: merch.serial_no,
          modelName: merch.model?.model || null,
          brand: merch.model?.brand?.name || null,
          capacity: merch.model?.capacity?.name || null,
        });
      }
    }

    if (merchItems.length > 0) {
      context.merchandise = merchItems;
    }
  }

  // Fetch work giver
  const { data: workGiverData } = await supabase
    .from('child_ticket_work_givers')
    .select('ref_work_givers:work_giver_id(name)')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (workGiverData?.ref_work_givers) {
    const wg = workGiverData.ref_work_givers as { name?: string };
    context.workGiver = wg.name || null;
  }

  return context;
}

/**
 * Process tickets in background and update job status in database
 */
async function processTicketsInBackground(
  jobId: string,
  ticketIds: string[],
  forceRefresh: boolean
): Promise<void> {
  const supabase = createServiceClient();
  const errors: string[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`[backfill] Starting background job ${jobId} with ${ticketIds.length} tickets`);

  for (const ticketId of ticketIds) {
    try {
      // Check if ticket already has summary (unless forceRefresh)
      if (!forceRefresh) {
        const { data: existing } = await supabase
          .from('main_tickets')
          .select('details_summary')
          .eq('id', ticketId)
          .single();

        if (existing?.details_summary) {
          skipped++;
          processed++;
          continue;
        }
      }

      // Fetch complete ticket data
      const context = await fetchCompleteTicketData(supabase, ticketId);

      if (!context) {
        failed++;
        processed++;
        errors.push(`${ticketId}: ไม่พบข้อมูลตั๋ว`);
        continue;
      }

      // Generate summary
      const summary = await generateTicketSummary(context);

      if (summary) {
        // Update ticket
        const { error: updateError } = await supabase
          .from('main_tickets')
          .update({ details_summary: summary })
          .eq('id', ticketId);

        if (updateError) {
          failed++;
          errors.push(`${ticketId}: ${updateError.message}`);
        } else {
          succeeded++;
          console.log(`[backfill] Generated summary for ${ticketId}: ${summary.substring(0, 50)}...`);
        }
      } else {
        skipped++;
      }

      processed++;

      // Update job progress after each ticket
      await supabase
        .from('main_background_jobs')
        .update({
          processed,
          succeeded,
          failed,
          skipped,
          errors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    } catch (err) {
      failed++;
      processed++;
      errors.push(`${ticketId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(`[backfill] Error processing ${ticketId}:`, err);

      // Update job progress after error
      await supabase
        .from('main_background_jobs')
        .update({
          processed,
          succeeded,
          failed,
          skipped,
          errors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  }

  // Final update - mark as completed
  await supabase
    .from('main_background_jobs')
    .update({
      status: 'completed',
      processed,
      succeeded,
      failed,
      skipped,
      errors,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  console.log(`[backfill] Job ${jobId} completed: processed=${processed}, succeeded=${succeeded}, failed=${failed}, skipped=${skipped}`);
}

export async function backfillSummaries(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Require admin level (level 2+)
  await requireMinLevel(employee, 2);

  const supabase = createServiceClient();
  const url = new URL(req.url);

  // GET request = status check
  if (req.method === 'GET') {
    const jobId = url.searchParams.get('job_id');
    if (!jobId) {
      return error('กรุณาระบุ job_id', 400);
    }

    // Fetch job from database
    const { data: job, error: jobError } = await supabase
      .from('main_background_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return error('ไม่พบ Job ID ที่ระบุ', 404);
    }

    return success({
      job_id: job.id,
      status: job.status,
      started_at: job.started_at,
      completed_at: job.completed_at,
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      skipped: job.skipped,
      errors: job.errors || [],
    });
  }

  // POST request = start new job
  // Parse request body
  let body: BackfillRequest = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine, use defaults
  }

  const limit = Math.min(body.limit || 50, 500); // Max 500 per request
  const forceRefresh = body.forceRefresh || false;
  const specificIds = body.ticketIds || [];

  // Resolve ticket codes to UUIDs if specific IDs provided
  let resolvedIds: string[] = [];
  if (specificIds.length > 0) {
    resolvedIds = await resolveTicketIds(supabase, specificIds);
    if (resolvedIds.length === 0) {
      return error('ไม่พบตั๋วงานที่ระบุ', 404);
    }
  }

  // Build query for tickets to process
  let query = supabase
    .from('main_tickets')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Filter by specific IDs if provided
  if (resolvedIds.length > 0) {
    query = query.in('id', resolvedIds);
  } else if (!forceRefresh) {
    // Only process tickets without summaries
    query = query.is('details_summary', null);
  }

  const { data: tickets, error: fetchError } = await query;

  if (fetchError) {
    return error(`ไม่สามารถดึงข้อมูลตั๋วงานได้: ${fetchError.message}`, 500);
  }

  if (!tickets || tickets.length === 0) {
    return success({
      message: 'ไม่พบตั๋วงานที่ต้องสร้าง summary',
      job_id: null,
      total: 0,
    });
  }

  const ticketIds = tickets.map(t => t.id);

  // Create job in database
  const { data: newJob, error: jobError } = await supabase
    .from('main_background_jobs')
    .insert({
      job_type: 'backfill_summaries',
      status: 'running',
      total: ticketIds.length,
      input_data: { forceRefresh, ticketIds },
      created_by: employee.id,
    })
    .select('id')
    .single();

  if (jobError || !newJob) {
    return error(`ไม่สามารถสร้าง Job ได้: ${jobError?.message}`, 500);
  }

  const jobId = newJob.id;

  // Start background processing (don't await)
  processTicketsInBackground(jobId, ticketIds, forceRefresh);

  // Return immediately with job ID
  return success({
    message: `เริ่มประมวลผล ${ticketIds.length} ตั๋วงานในพื้นหลัง`,
    job_id: jobId,
    total: ticketIds.length,
    status_url: `/api-tickets/backfill-summaries?job_id=${jobId}`,
  });
}
