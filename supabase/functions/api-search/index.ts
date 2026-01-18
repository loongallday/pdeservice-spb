/**
 * @fileoverview Global Search API Edge Function - Cross-entity search
 * @module api-search
 *
 * @description
 * Provides unified search across multiple entity types.
 * Returns categorized results from companies, sites, tickets, merchandise, and employees.
 *
 * Search Features:
 * - Multi-entity search in single request
 * - Relevance-based ranking
 * - Thai and English text matching
 * - Partial word matching (prefix search)
 * - Results grouped by entity type
 *
 * Searchable Entities:
 * - Companies: By name, tax ID
 * - Sites: By name, address, contact info
 * - Tickets: By code, description, merchandise serial
 * - Merchandise: By serial number, model
 * - Employees: By name, code, phone
 *
 * @endpoints
 * ## Search Operations
 * - GET    /   - Global search (query: q)
 *
 * @auth All endpoints require JWT authentication
 * @table main_companies - Company search
 * @table main_sites - Site search
 * @table main_tickets - Ticket search
 * @table main_merchandise - Merchandise search
 * @table main_employees - Employee search
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';
import { search } from './handlers/search.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate
    const { employee } = await authenticate(req);

    const method = req.method;

    if (method === 'GET') {
      return await search(req, employee);
    }

    return error('Method not allowed', 405);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
