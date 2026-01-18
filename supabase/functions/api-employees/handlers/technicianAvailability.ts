/**
 * @fileoverview Get technician availability/workload handler
 * @endpoint GET /api-employees/technicians/availability
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @queryParam {string} [date] - Date to check (YYYY-MM-DD format)
 *
 * @returns {TechnicianWithWorkload[]} Array of technicians with workload levels
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 1
 * @throws {ValidationError} 400 - If date format is invalid
 * @throws {DatabaseError} 500 - If technical department not found
 *
 * @description
 * Returns all active technicians from the "technical" department with their
 * workload status for a given date. Used for ticket assignment UI to show
 * technician availability.
 *
 * Workload levels based on appointment count on the date:
 * - no_work: 0 appointments
 * - light: 1-2 appointments
 * - medium: 3-4 appointments
 * - heavy: 5+ appointments
 *
 * If no date is provided, returns all technicians with "no_work" status.
 *
 * @example
 * GET /api-employees/technicians/availability?date=2026-01-20
 *
 * Response:
 * {
 *   "data": [
 *     { "id": "uuid", "name": "ช่างสมชาย", "workload": "light" },
 *     { "id": "uuid", "name": "ช่างสมหญิง", "workload": "heavy" }
 *   ]
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getTechnicianAvailability(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can view technician workload
  await requireMinLevel(employee, 1);

  // Parse query parameters
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || undefined;

  // Validate date format if provided
  if (date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
    }

    // Validate date is a valid date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new ValidationError('วันที่ไม่ถูกต้อง');
    }
  }

  // Get technicians with workload (if no date, all return "no_work")
  const technicians = await EmployeeService.getTechniciansWithWorkload(date);

  return success(technicians);
}
