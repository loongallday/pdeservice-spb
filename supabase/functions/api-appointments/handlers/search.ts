/**
 * @fileoverview Search appointments handler
 * @endpoint GET /api-appointments/search
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {string} q - Search query text (searches appointment_type)
 *
 * @returns {Appointment[]} Array of matching appointments (max 20)
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Searches appointments by appointment type. Returns up to 20 results
 * sorted by appointment date descending.
 *
 * Search is case-insensitive and matches partial strings.
 *
 * @example
 * // Search for morning appointments
 * GET /api-appointments/search?q=morning
 *
 * @example
 * // Search for call-to-schedule appointments
 * GET /api-appointments/search?q=call
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * Handles GET /api-appointments/search request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @returns HTTP response with array of matching appointments
 */
export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search appointments
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  // Search appointments by type
  const results = await AppointmentService.search(query);

  return success(results);
}
