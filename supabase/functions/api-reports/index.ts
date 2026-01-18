/**
 * @fileoverview Reports API Edge Function - Excel report generation
 * @module api-reports
 *
 * @description
 * Provides report generation endpoints with Excel export capability.
 * Used for daily operations reports and work type specific exports.
 *
 * Report Types:
 * - Daily: Summary of day's operations (tickets, appointments, status)
 * - RMA Excel: RMA work orders with warranty/repair details
 * - PM Excel: Preventive maintenance work orders
 * - Sales Excel: Sales/installation work orders
 *
 * Excel Features:
 * - Multi-sheet workbooks
 * - Formatted headers and data
 * - Auto-column width
 * - Thai date formatting
 *
 * @endpoints
 * ## Report Generation
 * - GET    /daily         - Get daily operations report (JSON)
 * - GET    /rma/excel     - Download RMA report (Excel)
 * - GET    /pm/excel      - Download PM report (Excel)
 * - GET    /sales/excel   - Download Sales report (Excel)
 *
 * @auth Level 1+ required (Assigner, PM, Sales and above)
 * @table main_tickets - Ticket data for reports
 * @table main_appointments - Appointment data
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { getDailyReport } from './handlers/daily.ts';
import { getRmaExcel } from './handlers/rmaExcel.ts';
import { getPmExcel, getSalesExcel } from './handlers/workTypeExcel.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate request
    const { employee } = await authenticate(req);

    // Require Level 1+ (Assigner, PM, Sales and above)
    await requireMinLevel(employee, 1);

    // Parse URL and route
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-reports');
    const relativePath = functionIndex >= 0
      ? pathParts.slice(functionIndex + 1)
      : [];
    const method = req.method;

    // Route handling
    if (method === 'GET') {
      // GET /api-reports/daily
      if (relativePath[0] === 'daily') {
        return await getDailyReport(req, employee);
      }

      // GET /api-reports/rma/excel
      if (relativePath[0] === 'rma' && relativePath[1] === 'excel') {
        return await getRmaExcel(req, employee);
      }

      // GET /api-reports/pm/excel
      if (relativePath[0] === 'pm' && relativePath[1] === 'excel') {
        return await getPmExcel(req, employee);
      }

      // GET /api-reports/sales/excel
      if (relativePath[0] === 'sales' && relativePath[1] === 'excel') {
        return await getSalesExcel(req, employee);
      }
    }

    return error('ไม่พบ endpoint ที่ร้องขอ', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
