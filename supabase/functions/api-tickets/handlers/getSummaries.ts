/**
 * @fileoverview Get ticket summaries grouped by technician handler
 * @endpoint GET /api-tickets/summaries
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {string} date - Required: Date to get summaries for (YYYY-MM-DD)
 * @queryParam {string} [format=full] - Response format: full|compact
 *
 * @returns {TechnicianSummary[]} Summaries grouped by technician
 * @throws {ValidationError} 400 - Missing or invalid date parameter
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Returns ticket summaries for a specific date, grouped by assigned technician.
 * Useful for daily dispatch views and workload planning.
 *
 * Format Options:
 * - full: Complete ticket details with all related data
 * - compact: Lightweight summary for quick overview
 *
 * Each technician group contains:
 * - Technician details (name, code, contact info)
 * - List of assigned tickets for the date
 * - Ticket count and status breakdown
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TechnicianConfirmationService } from '../services/technicianConfirmationService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getSummaries(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view summaries
  await requireMinLevel(employee, 0);

  // Get query parameters
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const formatParam = url.searchParams.get('format');

  // Parse format parameter: 'full' (default) or 'compact'
  const format: 'full' | 'compact' = formatParam === 'compact' ? 'compact' : 'full';

  if (!date) {
    throw new ValidationError('กรุณาระบุวันที่ (date parameter)');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
  }

  // Validate date is valid
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new ValidationError('วันที่ไม่ถูกต้อง');
  }

  // Get summaries grouped by technicians
  const result = await TechnicianConfirmationService.getSummariesGroupedByTechnicians(date, format);

  return success(result);
}

