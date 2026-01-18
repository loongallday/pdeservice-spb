/**
 * @fileoverview Employee-Site Trainings API Edge Function - Training assignment tracking
 * @module api-employee-site-trainings
 *
 * @description
 * Manages training assignments between employees and sites.
 * Tracks which employees have been trained on which customer sites.
 *
 * Use Cases:
 * - Record site-specific training completion
 * - Track technician certifications for equipment at sites
 * - Manage safety training requirements
 *
 * @endpoints
 * ## Training Operations
 * - GET    /      - List trainings (with filters)
 * - GET    /:id   - Get training by ID
 * - POST   /      - Create new training assignment
 * - PUT    /:id   - Update training assignment
 *
 * @auth All endpoints require JWT authentication
 * @table jct_employee_site_trainings - Training assignment junction table
 * @table main_employees - Employee reference
 * @table main_sites - Site reference
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';

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
    const functionIndex = pathParts.indexOf('api-employee-site-trainings');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET / - List trainings
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get single training
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create training
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update training
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

