/**
 * Technician Detail Handler
 * Endpoint for individual technician analytics
 */

import { Employee } from '../../_shared/auth.ts';
import { success } from '../../_shared/response.ts';
import { ValidationError, NotFoundError } from '../../_shared/error.ts';
import { TrendAnalyticsService } from '../services/trendAnalyticsService.ts';

/**
 * GET /api-analytics/technicians/:id
 * Get detailed analytics for a specific technician
 * Query params:
 *   - start_date (required, YYYY-MM-DD)
 *   - end_date (required, YYYY-MM-DD)
 */
export async function getTechnicianDetail(
  req: Request,
  _employee: Employee,
  technicianId: string
): Promise<Response> {
  const url = new URL(req.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  if (!startDate || !endDate) {
    throw new ValidationError('กรุณาระบุ start_date และ end_date');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(technicianId)) {
    throw new ValidationError('รหัสพนักงานไม่ถูกต้อง');
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

  const detail = await TrendAnalyticsService.getTechnicianDetail(
    technicianId,
    startDate,
    endDate
  );

  if (!detail) {
    throw new NotFoundError('ไม่พบข้อมูลช่างเทคนิค');
  }

  return success({
    ...detail,
    generated_at: new Date().toISOString(),
  });
}
