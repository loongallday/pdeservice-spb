/**
 * Reference Data API Edge Function
 * Handles read-only reference data (work_types, ticket_statuses, leave_types, provinces)
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
import { getAllConstants } from './handlers/constants.ts';

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
    // GET /constants - Get all constants
    if (endpoint === 'constants' && relativePath.length === 1) {
      return await getAllConstants(req, employee);
    }

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
