/**
 * @fileoverview Merchandise API Edge Function - Equipment/UPS inventory management
 * @module api-merchandise
 *
 * @description
 * Manages merchandise (equipment/UPS units) inventory including serial numbers,
 * models, locations, and replacement chains for tracking equipment history.
 *
 * @endpoints
 * ## Merchandise Operations
 * - GET    /                           - List merchandise (paginated)
 * - GET    /search                     - Search merchandise
 * - GET    /hint                       - Quick search (up to 5 results)
 * - GET    /check-duplicate            - Check for duplicate serial number
 * - GET    /model/:modelId             - Get merchandise by model
 * - GET    /site/:siteId               - Get merchandise by site
 * - GET    /:id                        - Get merchandise by ID
 * - POST   /                           - Create new merchandise
 * - PUT    /:id                        - Update merchandise
 * - DELETE /:id                        - Delete merchandise
 *
 * ## Location Management
 * - GET    /:id/location               - Get merchandise location
 * - POST   /:id/location               - Create/upsert location
 * - PUT    /:id/location               - Update location
 * - DELETE /:id/location               - Delete location
 *
 * ## Replacement Chain
 * - GET    /:id/replacement-chain      - Get equipment replacement history
 *
 * @auth All endpoints require JWT authentication
 * @table main_merchandise - Primary merchandise data
 * @table ext_merchandise_locations - Equipment location tracking
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteMerchandise } from './handlers/delete.ts';
import { search } from './handlers/search.ts';
import { hint } from './handlers/hint.ts';
import { checkDuplicate } from './handlers/checkDuplicate.ts';
import { getLocation, upsertLocation, updateLocation, deleteLocation } from './handlers/location.ts';
import { getReplacementChain } from './handlers/replacementChain.ts';
import { getByModel } from './handlers/getByModel.ts';
import { getBySite } from './handlers/getBySite.ts';

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
    const functionIndex = pathParts.indexOf('api-merchandise');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Route based on method and path
    switch (method) {
      case 'GET':
        // GET /check-duplicate - Check for duplicate serial number
        if (relativePath.length === 1 && relativePath[0] === 'check-duplicate') {
          return await checkDuplicate(req, employee);
        }
        // GET /hint - Get merchandise hints (up to 5 merchandise)
        if (relativePath.length === 1 && relativePath[0] === 'hint') {
          return await hint(req, employee);
        }
        // GET /search - Search merchandise
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }
        // GET / - List merchandise with pagination
        if (relativePath.length === 0) {
          return await list(req, employee);
        }
        // GET /model/:modelId - Get merchandise by model
        if (relativePath.length === 2 && relativePath[0] === 'model') {
          const modelId = relativePath[1];
          return await getByModel(req, employee, modelId);
        }
        // GET /site/:siteId - Get merchandise by site
        if (relativePath.length === 2 && relativePath[0] === 'site') {
          const siteId = relativePath[1];
          return await getBySite(req, employee, siteId);
        }
        // GET /:id/location - Get location for merchandise
        if (relativePath.length === 2 && relativePath[1] === 'location') {
          const merchandiseId = relativePath[0];
          return await getLocation(req, employee, merchandiseId);
        }
        // GET /:id/replacement-chain - Get replacement chain for merchandise
        if (relativePath.length === 2 && relativePath[1] === 'replacement-chain') {
          const merchandiseId = relativePath[0];
          return await getReplacementChain(req, employee, merchandiseId);
        }
        // GET /:id - Get single merchandise by ID
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Prevent special keywords from being treated as IDs
          if (['hint', 'search', 'check-duplicate', 'model', 'site'].includes(id)) {
            return error('Not found', 404);
          }
          return await get(req, employee, id);
        }
        break;

      case 'POST':
        // POST /:id/location - Create/upsert location for merchandise
        if (relativePath.length === 2 && relativePath[1] === 'location') {
          const merchandiseId = relativePath[0];
          return await upsertLocation(req, employee, merchandiseId);
        }
        // POST / - Create merchandise
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case 'PUT':
        // PUT /:id/location - Update location for merchandise
        if (relativePath.length === 2 && relativePath[1] === 'location') {
          const merchandiseId = relativePath[0];
          return await updateLocation(req, employee, merchandiseId);
        }
        // PUT /:id - Update merchandise
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /:id/location - Delete location for merchandise
        if (relativePath.length === 2 && relativePath[1] === 'location') {
          const merchandiseId = relativePath[0];
          return await deleteLocation(req, employee, merchandiseId);
        }
        // DELETE /:id - Delete merchandise
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteMerchandise(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

