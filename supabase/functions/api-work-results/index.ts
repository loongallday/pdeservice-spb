/**
 * Work Results API Edge Function
 * Handles work results, photos, and documents
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { getByTicket } from './handlers/getByTicket.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteWorkResult } from './handlers/delete.ts';
import { addPhoto } from './handlers/addPhoto.ts';
import { deletePhoto } from './handlers/deletePhoto.ts';
import { addDocument } from './handlers/addDocument.ts';
import { deleteDocument } from './handlers/deleteDocument.ts';
import { addDocumentPage } from './handlers/addDocumentPage.ts';
import { deleteDocumentPage } from './handlers/deleteDocumentPage.ts';

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
    const functionIndex = pathParts.indexOf('api-work-results');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /ticket/:ticketId - Get work result by ticket
    if (method === 'GET' && relativePath[0] === 'ticket' && relativePath[1]) {
      const ticketId = relativePath[1];
      return await getByTicket(req, employee, ticketId);
    }

    // GET /:id - Get work result by ID
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create work result
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // POST /photos - Add photo to work result
    if (method === 'POST' && relativePath[0] === 'photos') {
      return await addPhoto(req, employee);
    }

    // DELETE /photos/:id - Delete photo
    if (method === 'DELETE' && relativePath[0] === 'photos' && relativePath[1]) {
      const photoId = relativePath[1];
      return await deletePhoto(req, employee, photoId);
    }

    // POST /documents - Add document to work result
    if (method === 'POST' && relativePath[0] === 'documents' && relativePath.length === 1) {
      return await addDocument(req, employee);
    }

    // DELETE /documents/:id - Delete document
    if (method === 'DELETE' && relativePath[0] === 'documents' && relativePath.length === 2) {
      const documentId = relativePath[1];
      return await deleteDocument(req, employee, documentId);
    }

    // POST /documents/pages - Add page to document
    if (method === 'POST' && relativePath[0] === 'documents' && relativePath[1] === 'pages') {
      return await addDocumentPage(req, employee);
    }

    // DELETE /documents/pages/:id - Delete document page
    if (method === 'DELETE' && relativePath[0] === 'documents' && relativePath[1] === 'pages' && relativePath[2]) {
      const pageId = relativePath[2];
      return await deleteDocumentPage(req, employee, pageId);
    }

    // PUT /:id - Update work result
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete work result
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteWorkResult(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
