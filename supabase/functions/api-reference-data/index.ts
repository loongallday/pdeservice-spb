/**
 * @fileoverview Reference Data API Edge Function - Read-only lookup tables
 * @module api-reference-data
 *
 * @description
 * Provides read-only access to reference/lookup data used throughout the system.
 * All data is cacheable and rarely changes.
 *
 * Reference Data Types:
 * - Work Types: Service categories (PM, RMA, Sales, etc.)
 * - Statuses: Ticket lifecycle states
 * - Leave Types: Employee leave categories
 * - Provinces: Thai administrative regions
 * - Work Givers: External work assignment sources
 *
 * Note: /constants endpoint removed - use GET /api-initialize/me instead
 * for bootstrapping all constants in a single request.
 *
 * @endpoints
 * ## Reference Data Endpoints
 * - GET    /work-types     - List all work types
 * - GET    /statuses       - List all ticket statuses
 * - GET    /leave-types    - List all leave types
 * - GET    /provinces      - List Thai provinces with districts
 * - GET    /work-givers    - List external work sources
 *
 * @auth All endpoints require JWT authentication
 * @table ref_work_types - Work type definitions
 * @table ref_ticket_statuses - Ticket status definitions
 * @table ref_leave_types - Leave type definitions
 * @table ref_provinces - Thai provinces
 * @table ref_districts - Thai districts
 * @table ref_subdistricts - Thai subdistricts
 * @table ref_work_givers - External work sources
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getWorkTypes } from './handlers/workTypes.ts';
import { getStatuses } from './handlers/statuses.ts';
import { getLeaveTypes } from './handlers/leaveTypes.ts';
import { getProvinces } from './handlers/provinces.ts';
import { getWorkGivers } from './handlers/workGivers.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Only GET requests allowed for reference data
    const method = req.method;
    if (method !== 'GET') {
      return error('Method not allowed', 405);
    }

    // Parse URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf('api-reference-data');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const endpoint = relativePath[0] || '';

    // Route based on endpoint
    if (endpoint === 'work-types') {
      return await getWorkTypes(req, employee);
    }

    if (endpoint === 'statuses') {
      return await getStatuses(req, employee);
    }

    if (endpoint === 'leave-types') {
      return await getLeaveTypes(req, employee);
    }

    if (endpoint === 'provinces') {
      return await getProvinces(req, employee);
    }

    if (endpoint === 'work-givers') {
      return await getWorkGivers(req, employee);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
