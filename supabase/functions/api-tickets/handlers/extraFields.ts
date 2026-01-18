/**
 * @fileoverview Ticket extra fields (custom fields) handlers
 * @module api-tickets/handlers/extraFields
 *
 * Provides custom key-value field functionality:
 * - GET /:id/extra-fields - List all extra fields
 * - POST /:id/extra-fields - Create extra field
 * - POST /:id/extra-fields/bulk - Bulk upsert extra fields
 * - PUT /:id/extra-fields/:fieldId - Update extra field
 * - DELETE /:id/extra-fields/:fieldId - Delete extra field
 *
 * @auth All operations require Level 0+ authentication
 *
 * @description
 * Extra fields allow dynamic, schema-less data to be attached to tickets.
 * Each field has a key and value, enabling custom metadata without
 * database schema changes.
 *
 * Bulk Upsert:
 * - Creates new fields or updates existing based on field_key
 * - Useful for form submissions with multiple custom fields
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID, parseRequestBody } from '../../_shared/validation.ts';
import { ExtraFieldService, ExtraFieldInput, BulkUpsertInput } from '../services/extraFieldService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /tickets/:ticketId/extra-fields
 * List all extra fields for a ticket
 */
export async function getExtraFields(
  _req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');

  const fields = await ExtraFieldService.getByTicketId(ticketId);

  return success(fields);
}

/**
 * POST /tickets/:ticketId/extra-fields
 * Create a new extra field
 */
export async function createExtraField(
  req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');

  const body = await parseRequestBody<ExtraFieldInput>(req);

  const field = await ExtraFieldService.create(ticketId, body, employee.id);

  return success(field, 201);
}

/**
 * PUT /tickets/:ticketId/extra-fields/:fieldId
 * Update an extra field
 */
export async function updateExtraField(
  req: Request,
  employee: Employee,
  ticketId: string,
  fieldId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');
  validateUUID(fieldId, 'Field ID');

  const body = await parseRequestBody<Partial<ExtraFieldInput>>(req);

  const field = await ExtraFieldService.update(fieldId, body);

  return success(field);
}

/**
 * DELETE /tickets/:ticketId/extra-fields/:fieldId
 * Delete an extra field
 */
export async function deleteExtraField(
  _req: Request,
  employee: Employee,
  ticketId: string,
  fieldId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');
  validateUUID(fieldId, 'Field ID');

  await ExtraFieldService.delete(fieldId);

  return success({ message: 'ลบ extra field สำเร็จ' });
}

/**
 * POST /tickets/:ticketId/extra-fields/bulk
 * Bulk upsert extra fields (create or update based on field_key)
 */
export async function bulkUpsertExtraFields(
  req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');

  const body = await parseRequestBody<BulkUpsertInput>(req);

  const fields = await ExtraFieldService.bulkUpsert(ticketId, body, employee.id);

  return success(fields);
}
