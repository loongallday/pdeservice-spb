/**
 * Daily Report Handler
 * Returns comprehensive analytics for a single day
 */

import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { DailyReportService } from '../services/dailyReportService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getDailyReport(req: Request, _employee: Employee) {
  // Get query parameters
  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  // Validate required date parameter
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

  // Prevent dates too far in the future (3 months)
  const maxFuture = new Date();
  maxFuture.setMonth(maxFuture.getMonth() + 3);
  if (dateObj > maxFuture) {
    throw new ValidationError('ไม่สามารถสร้างรายงานสำหรับวันที่ในอนาคตที่ไกลเกินไป');
  }

  // Generate report
  const result = await DailyReportService.generateReport(date);

  return success(result);
}
