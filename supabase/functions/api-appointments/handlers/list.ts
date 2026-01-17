/**
 * @fileoverview List appointments handler with pagination
 * @endpoint GET /api-appointments
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {number} [page=1] - Page number for pagination
 * @queryParam {number} [limit=50] - Items per page (max 100)
 * @queryParam {string} [ticket_id] - Filter to get appointment linked to specific ticket
 *
 * @returns {PaginatedResponse<Appointment>} List of appointments sorted by date descending
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @example
 * // Get first page of appointments
 * GET /api-appointments?page=1&limit=20
 *
 * @example
 * // Get appointment for a specific ticket
 * GET /api-appointments?ticket_id=uuid-here
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * Handles GET /api-appointments request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @returns HTTP response with paginated appointments
 */
export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view appointments
  await requireMinLevel(employee, 0);

  // Parse pagination and filters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const ticket_id = url.searchParams.get('ticket_id') || undefined;

  // Fetch appointments
  const result = await AppointmentService.getAll({ page, limit, ticket_id });

  return successWithPagination(result.data, result.pagination);
}
