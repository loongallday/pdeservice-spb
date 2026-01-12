/**
 * API Reports Edge Function
 * Provides analytics and reporting endpoints
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
