/**
 * @fileoverview Route Optimization API Edge Function - Intelligent route planning
 * @module api-route-optimization
 *
 * @description
 * Provides route optimization for planners to help technicians navigate work efficiently.
 * Uses Google Routes API for intelligent route optimization.
 *
 * @endpoints
 * ## Route Optimization
 * - POST   /optimize              - Optimize route (sync mode, ~60s)
 * - POST   /optimize/async        - Start async optimization, returns job ID
 * - POST   /calculate             - Calculate travel times (no optimization)
 * - GET    /jobs/:jobId           - Poll job status and get result
 *
 * ## Work Estimates
 * - GET    /work-estimates/ticket/:ticketId - Get estimate by ticket
 * - GET    /work-estimates/date/:date       - Get all estimates for date
 * - POST   /work-estimates                  - Create/update estimate
 * - POST   /work-estimates/bulk             - Bulk create/update
 * - DELETE /work-estimates/ticket/:ticketId - Delete estimate
 *
 * @auth Level 1+ required (planners/approvers)
 * @env GOOGLE_ROUTES_API_KEY - Google Routes API key
 * @table child_ticket_work_estimates - Work duration estimates
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';
import { handleOptimize } from './handlers/optimize.ts';
import { handleStartAsyncOptimize, handleGetJobStatus } from './handlers/asyncOptimize.ts';
import { handleCalculate } from './handlers/calculate.ts';
import {
  handleGetByTicket,
  handleGetByDate,
  handleUpsert,
  handleBulkUpsert,
  handleDeleteByTicket,
} from './handlers/workEstimates.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Require level 1+ (planners/approvers)
    await requireMinLevel(employee, 1);

    // Parse URL
    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Get relative path after function name
    const functionIndex = pathSegments.indexOf('api-route-optimization');
    const relativePath = functionIndex >= 0 ? pathSegments.slice(functionIndex + 1) : pathSegments;

    // Route handling
    switch (method) {
      case 'GET':
        // GET /jobs/:jobId - Poll job status
        if (relativePath[0] === 'jobs' && relativePath[1]) {
          return await handleGetJobStatus(req, employee, relativePath[1]);
        }
        // GET /work-estimates/ticket/:ticketId
        if (relativePath[0] === 'work-estimates' && relativePath[1] === 'ticket' && relativePath[2]) {
          return await handleGetByTicket(req, employee, relativePath[2]);
        }
        // GET /work-estimates/date/:date
        if (relativePath[0] === 'work-estimates' && relativePath[1] === 'date' && relativePath[2]) {
          return await handleGetByDate(req, employee, relativePath[2]);
        }
        break;

      case 'POST':
        // POST /optimize/async - Start async job
        if (relativePath[0] === 'optimize' && relativePath[1] === 'async') {
          return await handleStartAsyncOptimize(req, employee);
        }
        // POST /optimize - Sync mode (can be slow)
        if (relativePath[0] === 'optimize' || relativePath.length === 0) {
          return await handleOptimize(req);
        }
        // POST /calculate - Calculate times for user-specified order
        if (relativePath[0] === 'calculate') {
          return await handleCalculate(req, employee);
        }
        // POST /work-estimates/bulk
        if (relativePath[0] === 'work-estimates' && relativePath[1] === 'bulk') {
          return await handleBulkUpsert(req, employee);
        }
        // POST /work-estimates
        if (relativePath[0] === 'work-estimates' && relativePath.length === 1) {
          return await handleUpsert(req, employee);
        }
        break;

      case 'DELETE':
        // DELETE /work-estimates/ticket/:ticketId
        if (relativePath[0] === 'work-estimates' && relativePath[1] === 'ticket' && relativePath[2]) {
          return await handleDeleteByTicket(req, employee, relativePath[2]);
        }
        break;
    }

    return error('ไม่พบ endpoint ที่ระบุ', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
