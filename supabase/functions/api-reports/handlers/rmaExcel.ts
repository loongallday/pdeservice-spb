/**
 * RMA Excel Export Handler
 * Returns Excel file for RMA technician assignment schedule
 */

import { getWorkTypeExcel } from './workTypeExcel.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /api-reports/rma/excel
 * Query params:
 *   - start_date: YYYY-MM-DD (required)
 *   - end_date: YYYY-MM-DD (required)
 *
 * Returns: Excel file download
 */
export async function getRmaExcel(req: Request, employee: Employee): Promise<Response> {
  return getWorkTypeExcel(req, employee, 'rma');
}
