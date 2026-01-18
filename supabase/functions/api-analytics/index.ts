/**
 * @fileoverview Analytics API Edge Function - Technician utilization analytics
 * @module api-analytics
 *
 * @description
 * Provides comprehensive analytics endpoints focused on technician utilization.
 * Used by planners and managers to track workforce efficiency.
 *
 * Analytics Types:
 * - Utilization: Percentage of time technicians are assigned/working
 * - Workload: Number of tickets/appointments per technician
 * - Trends: Historical patterns over time
 * - Distribution: Workload spread across team
 *
 * Time Periods:
 * - Daily: Single day analysis
 * - Weekly: 7-day rolling window
 * - Monthly: Calendar month analysis
 *
 * @endpoints
 * ## Utilization Analytics
 * - GET    /technicians/utilization          - Get utilization by date
 * - GET    /technicians/utilization/summary  - Get utilization summary
 *
 * ## Workload Analytics
 * - GET    /technicians/workload             - Get workload by date
 * - GET    /technicians/workload/distribution - Get workload distribution
 *
 * ## Trends & Details
 * - GET    /technicians/trends               - Get historical trends
 * - GET    /technicians/:id                  - Get individual detail
 *
 * @auth Level 1+ required (Assigner, PM, Sales and above)
 * @table main_tickets - Ticket data for analytics
 * @table main_appointments - Appointment data
 * @table main_employees - Technician data
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';
import { getUtilization, getUtilizationSummary } from './handlers/utilization.ts';
import { getWorkload, getWorkloadDistribution } from './handlers/workload.ts';
import { getTrends } from './handlers/trends.ts';
import { getTechnicianDetail } from './handlers/technicianDetail.ts';

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
    const functionIndex = pathParts.indexOf('api-analytics');
    const relativePath = functionIndex >= 0
      ? pathParts.slice(functionIndex + 1)
      : [];
    const method = req.method;

    // Route handling
    if (method === 'GET') {
      // GET /api-analytics/technicians/utilization/summary
      // Query params: start_date, end_date
      // NOTE: Must be checked BEFORE /utilization (more specific route first)
      if (relativePath[0] === 'technicians' && relativePath[1] === 'utilization' && relativePath[2] === 'summary') {
        return await getUtilizationSummary(req, employee);
      }

      // GET /api-analytics/technicians/utilization
      // Query params: date (required), period (daily|weekly|monthly)
      if (relativePath[0] === 'technicians' && relativePath[1] === 'utilization' && !relativePath[2]) {
        return await getUtilization(req, employee);
      }

      // GET /api-analytics/technicians/workload/distribution
      // Query params: start_date, end_date
      // NOTE: Must be checked BEFORE /workload (more specific route first)
      if (relativePath[0] === 'technicians' && relativePath[1] === 'workload' && relativePath[2] === 'distribution') {
        return await getWorkloadDistribution(req, employee);
      }

      // GET /api-analytics/technicians/workload
      // Query params: date (required)
      if (relativePath[0] === 'technicians' && relativePath[1] === 'workload' && !relativePath[2]) {
        return await getWorkload(req, employee);
      }

      // GET /api-analytics/technicians/trends
      // Query params: start_date, end_date, interval (daily|weekly)
      if (relativePath[0] === 'technicians' && relativePath[1] === 'trends') {
        return await getTrends(req, employee);
      }

      // GET /api-analytics/technicians/:id
      // Query params: start_date, end_date
      if (relativePath[0] === 'technicians' && relativePath[1] && relativePath[1] !== 'utilization' && relativePath[1] !== 'workload' && relativePath[1] !== 'trends') {
        return await getTechnicianDetail(req, employee, relativePath[1]);
      }
    }

    return error('ไม่พบ endpoint ที่ร้องขอ', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
