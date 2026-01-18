/**
 * @fileoverview Models API Edge Function - Equipment model catalog management
 * @module api-models
 *
 * @description
 * Manages equipment models (UPS, batteries, etc.) including model codes,
 * descriptions, packages (component models), and associated services.
 *
 * @endpoints
 * ## Model Operations
 * - GET    /search                     - Search models by code/description
 * - GET    /check                      - Fast code validation (no auth)
 * - GET    /:id                        - Get model by ID
 * - POST   /                           - Create new model
 * - PUT    /:id                        - Update model
 * - DELETE /:id                        - Delete model
 *
 * ## Package Management (Model Components)
 * - GET    /:modelId/package           - Get model package (components + services)
 * - POST   /:modelId/package/components  - Add component model to package
 * - POST   /:modelId/package/services    - Add service to package
 * - DELETE /:modelId/package/components/:componentId - Remove component
 * - DELETE /:modelId/package/services/:serviceId     - Remove service
 *
 * @auth All endpoints require JWT authentication except /check
 * @table ref_models - Model catalog
 * @table jct_model_components - Model-to-component relationships
 * @table jct_model_services - Model-to-service relationships
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { search } from './handlers/search.ts';
import { getById } from './handlers/getById.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteModel } from './handlers/delete.ts';
import { getPackage } from './handlers/getPackage.ts';
import { addPackageItem } from './handlers/addPackageItem.ts';
import { removePackageItem } from './handlers/removePackageItem.ts';
import { addPackageService } from './handlers/addPackageService.ts';
import { removePackageService } from './handlers/removePackageService.ts';
import { checkCodeFast } from './handlers/checkCode.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Parse URL early for fast path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.indexOf('api-models');
  const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];

  // FAST PATH: /check - No auth required for speed
  if (req.method === 'GET' && relativePath.length === 1 && relativePath[0] === 'check') {
    return await checkCodeFast(req);
  }

  try {
    // Authenticate user (for all other routes)
    const { employee } = await authenticate(req);

    const method = req.method;

    // Route based on method and path
    switch (method) {
      case 'GET':

        // GET /search - Search models by description and code
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }

        // GET /:modelId/package - Get model package (components + services)
        if (relativePath.length === 2 && relativePath[1] === 'package') {
          const modelId = relativePath[0];
          return await getPackage(req, employee, modelId);
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

        // POST /:modelId/package/components - Add component model to package
        if (relativePath.length === 3 && relativePath[1] === 'package' && relativePath[2] === 'components') {
          const modelId = relativePath[0];
          return await addPackageItem(req, employee, modelId);
        }

        // POST /:modelId/package/services - Add service to model package
        if (relativePath.length === 3 && relativePath[1] === 'package' && relativePath[2] === 'services') {
          const modelId = relativePath[0];
          return await addPackageService(req, employee, modelId);
        }
        break;

      case 'PUT':
        // PUT /:id - Update model
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /:modelId/package/components/:componentModelId - Remove component from model package
        if (relativePath.length === 4 && relativePath[1] === 'package' && relativePath[2] === 'components') {
          const modelId = relativePath[0];
          const componentModelId = relativePath[3];
          return await removePackageItem(req, employee, modelId, componentModelId);
        }

        // DELETE /:modelId/package/services/:serviceId - Remove service from model package
        if (relativePath.length === 4 && relativePath[1] === 'package' && relativePath[2] === 'services') {
          const modelId = relativePath[0];
          const serviceId = relativePath[3];
          return await removePackageService(req, employee, modelId, serviceId);
        }

        // DELETE /:id - Delete model
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteModel(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

