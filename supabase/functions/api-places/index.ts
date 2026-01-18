/**
 * @fileoverview Places API Edge Function - Google Places API proxy
 * @module api-places
 *
 * @description
 * Proxy for Google Places API with Thai location code matching.
 * Used for address autocomplete and place details lookup.
 *
 * Features:
 * - Address autocomplete for Thai addresses
 * - Place details with lat/lng coordinates
 * - Automatic matching to Thai province/district/subdistrict codes
 * - Results formatted for site creation workflow
 *
 * Location Code Matching:
 * - Parses address components from Google
 * - Matches to ref_provinces, ref_districts, ref_subdistricts
 * - Returns location_code for database storage
 *
 * @endpoints
 * ## Place Operations
 * - POST   /autocomplete   - Address autocomplete search
 * - POST   /details        - Get place details by place_id
 *
 * @auth All endpoints require JWT authentication
 * @env GOOGLE_MAPS_API_KEY - Google Places API key
 * @table ref_provinces - Thai provinces lookup
 * @table ref_districts - Thai districts lookup
 * @table ref_subdistricts - Thai subdistricts lookup
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { autocomplete } from './handlers/autocomplete.ts';
import { details } from './handlers/details.ts';

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;

    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    let url: URL;
    try {
      url = new URL(req.url);
    } catch (_err) {
      return error('Invalid URL', 400);
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-places');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Only POST methods allowed
    if (method !== 'POST') {
      return error('Method not allowed', 405);
    }

    // Route based on path
    switch (relativePath[0]) {
      case 'autocomplete':
        return await autocomplete(req, employee);

      case 'details':
        return await details(req, employee);

      default:
        return error('ไม่พบ endpoint', 404);
    }
  } catch (err) {
    console.error('api-places error:', err);
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
