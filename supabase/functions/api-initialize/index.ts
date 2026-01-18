/**
 * @fileoverview Initialize API Edge Function - Application bootstrap endpoint
 * @module api-initialize
 *
 * @description
 * Returns current user information with all constants for optimized app bootstrap.
 * Single request to initialize the frontend with user data and reference data.
 *
 * Bootstrap Data Includes:
 * - Current employee profile and permissions
 * - Role information and permission level
 * - Department assignment
 * - All reference constants (work types, statuses, etc.)
 * - Enabled features for user's level
 *
 * Performance:
 * - Combines multiple API calls into one bootstrap request
 * - Includes /warmup endpoint for cold start optimization
 * - Cached reference data reduces database queries
 *
 * @endpoints
 * ## Bootstrap Endpoints
 * - GET    /me         - Get current user info with all constants
 * - GET    /features   - Get enabled features for user level
 * - GET    /warmup     - Keep function warm (no auth required)
 *
 * @auth JWT required except /warmup
 * @table main_employees - Employee profiles
 * @table main_org_roles - Role definitions
 * @table main_org_departments - Department assignments
 * @table ref_* - All reference tables for constants
 */

import { handleCORS, corsHeaders } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { me } from './handlers/me.ts';
import { features } from './handlers/features.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Parse URL path early for warmup check
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.indexOf('api-initialize');
  const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];

  // GET /warmup - Keep function warm (no auth required)
  if (req.method === 'GET' && relativePath.length === 1 && relativePath[0] === 'warmup') {
    return new Response(
      JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // Authenticate user
    const { employee } = await authenticate(req);
    const method = req.method;

    // GET /me - Get current user info with constants
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'me') {
      return await me(req, employee);
    }

    // GET /features - Get enabled features
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'features') {
      return await features(req, employee);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

