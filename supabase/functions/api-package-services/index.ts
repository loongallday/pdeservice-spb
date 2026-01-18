/**
 * @fileoverview Package Services API Edge Function - Service package catalog
 * @module api-package-services
 *
 * @description
 * Manages package service definitions that can be included with equipment models.
 * Package services define standard maintenance or support items for UPS/equipment.
 *
 * Package Service Examples:
 * - PM (Preventive Maintenance) visits
 * - Battery replacement service
 * - Extended warranty coverage
 * - 24/7 support hotline
 *
 * @endpoints
 * ## Package Service Operations
 * - GET    /       - List all package services
 * - GET    /:id    - Get single package service
 * - POST   /       - Create package service
 * - PUT    /:id    - Update package service
 * - DELETE /:id    - Delete package service
 *
 * @auth All endpoints require JWT authentication
 * @table ref_package_services - Package service definitions
 * @table jct_model_package_services - Model-to-service assignments
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { getById } from './handlers/getById.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deletePackageService } from './handlers/delete.ts';

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
    const functionIndex = pathParts.indexOf('api-package-services');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case 'GET':
        // GET / - List all package services
        if (relativePath.length === 0) {
          return await list(req, employee);
        }

        // GET /:id - Get single package service
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getById(req, employee, id);
        }
        break;

      case 'POST':
        // POST / - Create package service
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case 'PUT':
        // PUT /:id - Update package service
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /:id - Delete package service
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deletePackageService(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

