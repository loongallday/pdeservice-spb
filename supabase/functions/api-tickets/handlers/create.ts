/**
 * @fileoverview Create new ticket handler with idempotency support
 * @endpoint POST /api-tickets
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @header {string} [Idempotency-Key] - Optional key for idempotent requests
 *
 * @bodyParam {object} ticket - Required: Core ticket data
 * @bodyParam {string} ticket.work_type_id - Required: Work type UUID
 * @bodyParam {string} ticket.assigner_id - Required: Assigner employee UUID
 * @bodyParam {string} ticket.status_id - Required: Initial status UUID
 * @bodyParam {string} [ticket.details] - Ticket description
 * @bodyParam {string} [ticket.site_id] - Site UUID
 * @bodyParam {string} [ticket.company_id] - Company UUID
 * @bodyParam {object} [contact] - Contact information
 * @bodyParam {object} [appointment] - Appointment scheduling
 * @bodyParam {object[]} [employees] - Assigned technicians
 * @bodyParam {object[]} [upses] - Equipment to service
 *
 * @returns {Ticket} Created ticket object (HTTP 201)
 * @throws {ValidationError} 400 - Missing required fields or invalid JSON
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - Insufficient permissions (Level < 1)
 *
 * @description
 * Creates a comprehensive ticket with all related data in a single transaction.
 *
 * Idempotency Support:
 * - When Idempotency-Key header is provided, duplicate requests with the
 *   same key will return the cached response instead of creating duplicates
 * - Cached responses include both success and error states
 * - Use for critical operations to prevent duplicate ticket creation from
 *   network retries or user double-clicks
 *
 * Related Data:
 * - Contact: Creates or links contact for the ticket
 * - Appointment: Creates scheduled appointment with date/time
 * - Employees: Assigns technicians to the ticket
 * - UPSes: Links equipment to be serviced
 */

import { success, error } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { MasterTicketCreateInput } from '../services/ticketService.ts';
import {
  getIdempotencyKey,
  checkIdempotencyKey,
  saveIdempotencyResponse,
  saveIdempotencyError,
} from '../../_shared/idempotency.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create tickets
  await requireMinLevel(employee, 1);

  // Parse request body with error handling
  let body: MasterTicketCreateInput;
  try {
    body = await req.json() as MasterTicketCreateInput;
  } catch (_err) {
    throw new ValidationError('ข้อมูล JSON ไม่ถูกต้อง');
  }

  // Validate required fields
  if (!body.ticket) {
    throw new ValidationError('กรุณาระบุข้อมูลตั๋วงาน');
  }

  if (!body.ticket.work_type_id) {
    throw new ValidationError('กรุณาระบุประเภทงาน');
  }

  if (!body.ticket.assigner_id) {
    throw new ValidationError('กรุณาระบุผู้มอบหมายงาน');
  }

  if (!body.ticket.status_id) {
    throw new ValidationError('กรุณาระบุสถานะตั๋วงาน');
  }

  // Check for idempotency key
  const idempotencyKey = getIdempotencyKey(req);

  if (idempotencyKey) {
    // Idempotency key provided - check if we've seen this request before
    const idempotencyResult = await checkIdempotencyKey(
      idempotencyKey,
      'create_ticket',
      employee.id,
      body as unknown as Record<string, unknown>
    );

    if (!idempotencyResult.isNew) {
      // This is a duplicate request - return the cached response
      if (idempotencyResult.errorMessage) {
        return error(idempotencyResult.errorMessage, idempotencyResult.statusCode || 500);
      }
      return success(idempotencyResult.responseData, idempotencyResult.statusCode || 201);
    }

    // New request - proceed with creation
    try {
      const result = await TicketService.create(body, employee.id);

      // Save the successful response for future duplicate requests
      await saveIdempotencyResponse(idempotencyKey, 'create_ticket', result, 201);

      return success(result, 201);
    } catch (err) {
      // Save the error for future duplicate requests
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      const statusCode = (err instanceof Error && 'statusCode' in err) 
        ? (err as { statusCode: number }).statusCode 
        : 500;
      await saveIdempotencyError(idempotencyKey, 'create_ticket', errorMessage, statusCode);

      // Re-throw the error
      throw err;
    }
  }

  // No idempotency key - proceed normally (legacy behavior)
  const result = await TicketService.create(body, employee.id);
  return success(result, 201);
}

