/**
 * Work Type Excel Export Handler
 * Returns Excel file for technician assignment schedule by work type
 */

import { ValidationError } from '../../_shared/error.ts';
import { fetchTicketsByWorkType, WORK_TYPE_DISPLAY } from '../services/rmaReportService.ts';
import { generateWorkTypeExcel, transformToReportRows, getWorkTypeFilePrefix } from '../services/excelService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /api-reports/{workType}/excel
 * Query params:
 *   - start_date: YYYY-MM-DD (required)
 *   - end_date: YYYY-MM-DD (required)
 *
 * Returns: Excel file download
 */
export async function getWorkTypeExcel(
  req: Request,
  _employee: Employee,
  workTypeCode: string
): Promise<Response> {
  // Parse query parameters
  const url = new URL(req.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  const workTypeDisplay = WORK_TYPE_DISPLAY[workTypeCode] || workTypeCode.toUpperCase();

  // Validate required parameters
  if (!startDate) {
    throw new ValidationError('กรุณาระบุวันที่เริ่มต้น (start_date)');
  }
  if (!endDate) {
    throw new ValidationError('กรุณาระบุวันที่สิ้นสุด (end_date)');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) {
    throw new ValidationError('รูปแบบวันที่เริ่มต้นไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
  }
  if (!dateRegex.test(endDate)) {
    throw new ValidationError('รูปแบบวันที่สิ้นสุดไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
  }

  // Validate dates are valid
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  if (isNaN(startDateObj.getTime())) {
    throw new ValidationError('วันที่เริ่มต้นไม่ถูกต้อง');
  }
  if (isNaN(endDateObj.getTime())) {
    throw new ValidationError('วันที่สิ้นสุดไม่ถูกต้อง');
  }

  // Validate start_date <= end_date
  if (startDateObj > endDateObj) {
    throw new ValidationError('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
  }

  // Prevent date range too large (max 31 days)
  const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 31) {
    throw new ValidationError('ช่วงวันที่ต้องไม่เกิน 31 วัน');
  }

  // Fetch tickets by work type
  const tickets = await fetchTicketsByWorkType(workTypeCode, startDate, endDate);

  // Transform to report rows
  const reportRows = transformToReportRows(tickets);

  // Generate Excel file
  const excelBuffer = await generateWorkTypeExcel(reportRows, workTypeCode);

  // Generate filename
  const filePrefix = getWorkTypeFilePrefix(workTypeCode);
  const filename = `${filePrefix}_Report_${startDate}_to_${endDate}.xlsx`;

  // Return as file download
  return new Response(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

/**
 * GET /api-reports/pm/excel
 */
export async function getPmExcel(req: Request, employee: Employee): Promise<Response> {
  return getWorkTypeExcel(req, employee, 'pm');
}

/**
 * GET /api-reports/sales/excel
 */
export async function getSalesExcel(req: Request, employee: Employee): Promise<Response> {
  return getWorkTypeExcel(req, employee, 'sales');
}
