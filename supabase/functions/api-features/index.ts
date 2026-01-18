/**
 * @fileoverview Features API Edge Function - Feature flag management
 * @module api-features
 *
 * @description
 * Handles feature retrieval based on employee permission level.
 * Controls which features are visible/accessible to different user roles.
 *
 * Feature System:
 * - Features are gated by minimum permission level (0-3)
 * - Menu items grouped by category (group_label)
 * - Used for dynamic UI rendering based on user role
 *
 * Permission Levels:
 * - Level 0: Technician - Basic features
 * - Level 1: Planner/Sales - Scheduling features
 * - Level 2: Admin - Management features
 * - Level 3: Superadmin - All features
 *
 * @endpoints
 * ## Feature Endpoints
 * - GET    /       - Get enabled features for employee level
 * - GET    /menu   - Get menu items grouped by group_label
 *
 * @auth All endpoints require JWT authentication
 * @table main_features - Feature & menu definitions (is_menu_item flag)
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getEnabled } from './handlers/getEnabled.ts';
import { getMenuItems } from './handlers/getMenuItems.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf('api-features');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET / - Get enabled features for employee level
    if (method === 'GET' && relativePath.length === 0) {
      return await getEnabled(req, employee);
    }

    // GET /menu - Get menu items grouped by group_label
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'menu') {
      return await getMenuItems(req, employee);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

