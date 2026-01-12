/**
 * Utilization Handlers
 * Endpoints for technician utilization metrics
 */

import { Employee } from '../../_shared/auth.ts';
import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TechnicianUtilizationService } from '../services/technicianUtilizationService.ts';

/**
 * GET /api-analytics/technicians/utilization
 * Get utilization metrics for a specific date
 * Query params: date (required, YYYY-MM-DD)
 */
export async function getUtilization(
  req: Request,
  _employee: Employee
): Promise<Response> {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  if (!date) {
    throw new ValidationError('กรุณาระบุวันที่ (date)');
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
  }

  const metrics = await TechnicianUtilizationService.getUtilizationForDate(date);

  return success({
    ...metrics,
    generated_at: new Date().toISOString(),
  });
}

/**
 * GET /api-analytics/technicians/utilization/summary
 * Get utilization summary over a date range
 * Query params: start_date, end_date (both required, YYYY-MM-DD)
 */
export async function getUtilizationSummary(
  req: Request,
  _employee: Employee
): Promise<Response> {
  const url = new URL(req.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  if (!startDate || !endDate) {
    throw new ValidationError('กรุณาระบุ start_date และ end_date');
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
  }

  // Validate date range
  if (startDate > endDate) {
    throw new ValidationError('start_date ต้องน้อยกว่าหรือเท่ากับ end_date');
  }

  // Limit range to 90 days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 90) {
    throw new ValidationError('ช่วงเวลาต้องไม่เกิน 90 วัน');
  }

  const summary = await TechnicianUtilizationService.getUtilizationSummary(startDate, endDate);

  return success({
    ...summary,
    generated_at: new Date().toISOString(),
  });
}
