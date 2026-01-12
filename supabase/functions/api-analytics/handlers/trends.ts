/**
 * Trends Handlers
 * Endpoints for utilization trend analysis
 */

import { Employee } from '../../_shared/auth.ts';
import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TrendAnalyticsService } from '../services/trendAnalyticsService.ts';

/**
 * GET /api-analytics/technicians/trends
 * Get utilization trends over a date range
 * Query params:
 *   - start_date (required, YYYY-MM-DD)
 *   - end_date (required, YYYY-MM-DD)
 *   - interval (optional, 'daily' or 'weekly', default: 'daily')
 */
export async function getTrends(
  req: Request,
  _employee: Employee
): Promise<Response> {
  const url = new URL(req.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const intervalParam = url.searchParams.get('interval') || 'daily';

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

  // Validate interval
  if (intervalParam !== 'daily' && intervalParam !== 'weekly') {
    throw new ValidationError('interval ต้องเป็น "daily" หรือ "weekly"');
  }

  // Limit range based on interval
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (intervalParam === 'daily' && diffDays > 90) {
    throw new ValidationError('ช่วงเวลาสำหรับ daily ต้องไม่เกิน 90 วัน');
  }

  if (intervalParam === 'weekly' && diffDays > 365) {
    throw new ValidationError('ช่วงเวลาสำหรับ weekly ต้องไม่เกิน 365 วัน');
  }

  const trends = await TrendAnalyticsService.getTrends(
    startDate,
    endDate,
    intervalParam as 'daily' | 'weekly'
  );

  return success({
    ...trends,
    generated_at: new Date().toISOString(),
  });
}
