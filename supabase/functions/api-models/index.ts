/**
 * Models API Edge Function
 * Handles model operations including packages and specifications
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { search } from './handlers/search.ts';
import { getById } from './handlers/getById.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { getPackage } from './handlers/getPackage.ts';
import { addPackageItem } from './handlers/addPackageItem.ts';
import { removePackageItem } from './handlers/removePackageItem.ts';
import { addPackageService } from './handlers/addPackageService.ts';
import { removePackageService } from './handlers/removePackageService.ts';
import { getSpecification } from './handlers/getSpecification.ts';
import { upsertSpecification } from './handlers/upsertSpecification.ts';

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
    const functionIndex = pathParts.indexOf('api-models');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Route based on method and path
    switch (method) {
      case 'GET':
        // GET /search - Search models by description and code
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }

        // GET /:modelId/package - Get model package (items + services)
        if (relativePath.length === 2 && relativePath[1] === 'package') {
          const modelId = relativePath[0];
          return await getPackage(req, employee, modelId);
        }

        // GET /:modelId/specification - Get model specification
        if (relativePath.length === 2 && relativePath[1] === 'specification') {
          const modelId = relativePath[0];
          return await getSpecification(req, employee, modelId);
        }

        // GET /:id - Get single model by ID
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getById(req, employee, id);
        }
        break;

      case 'POST':
        // POST / - Create model
        if (relativePath.length === 0) {
          return await create(req, employee);
        }

        // POST /:modelId/package/items - Add item to model package
        if (relativePath.length === 3 && relativePath[1] === 'package' && relativePath[2] === 'items') {
          const modelId = relativePath[0];
          return await addPackageItem(req, employee, modelId);
        }

        // POST /:modelId/package/services - Add service to model package
        if (relativePath.length === 3 && relativePath[1] === 'package' && relativePath[2] === 'services') {
          const modelId = relativePath[0];
          return await addPackageService(req, employee, modelId);
        }

        // POST /:modelId/specification - Create/update specification
        if (relativePath.length === 2 && relativePath[1] === 'specification') {
          const modelId = relativePath[0];
          return await upsertSpecification(req, employee, modelId);
        }
        break;

      case 'PUT':
        // PUT /:modelId/specification - Update specification
        if (relativePath.length === 2 && relativePath[1] === 'specification') {
          const modelId = relativePath[0];
          return await upsertSpecification(req, employee, modelId);
        }

        // PUT /:id - Update model
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /:modelId/package/items/:itemId - Remove item from model package
        if (relativePath.length === 4 && relativePath[1] === 'package' && relativePath[2] === 'items') {
          const modelId = relativePath[0];
          const itemId = relativePath[3];
          return await removePackageItem(req, employee, modelId, itemId);
        }

        // DELETE /:modelId/package/services/:serviceId - Remove service from model package
        if (relativePath.length === 4 && relativePath[1] === 'package' && relativePath[2] === 'services') {
          const modelId = relativePath[0];
          const serviceId = relativePath[3];
          return await removePackageService(req, employee, modelId, serviceId);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

