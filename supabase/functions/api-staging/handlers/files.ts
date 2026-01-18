/**
 * Files handlers - CRUD operations for staged files
 */

import { success, successWithPagination } from '../../_shared/response.ts';
import { parsePaginationParams, validateUUID } from '../../_shared/validation.ts';
import { StagingService } from '../services/stagingService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { StagedFileStatus, CreateStagedFileInput, LinkFileInput, GroupedFileQueryOptions } from '../types.ts';

/**
 * GET /files - List staged files
 */
export async function listFiles(
  req: Request,
  _employee: Employee
): Promise<Response> {
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Parse filters
  const statusParam = url.searchParams.get('status');
  const employeeId = url.searchParams.get('employee_id');
  const ticketId = url.searchParams.get('ticket_id');

  let status: StagedFileStatus | StagedFileStatus[] | undefined;
  if (statusParam) {
    if (statusParam.includes(',')) {
      status = statusParam.split(',') as StagedFileStatus[];
    } else {
      status = statusParam as StagedFileStatus;
    }
  }

  const result = await StagingService.list({
    page,
    limit,
    status,
    employee_id: employeeId || undefined,
    ticket_id: ticketId || undefined,
  });

  return successWithPagination(result.data, result.pagination);
}

/**
 * GET /files/grouped - List files grouped by ticket
 * Returns { groups, summary } without data wrapper for this specific endpoint
 */
export async function listFilesGrouped(
  req: Request,
  _employee: Employee
): Promise<Response> {
  const url = new URL(req.url);

  // Parse filters
  const statusParam = url.searchParams.get('status');
  const employeeId = url.searchParams.get('employee_id');

  const options: GroupedFileQueryOptions = {};

  if (statusParam) {
    if (statusParam.includes(',')) {
      options.status = statusParam.split(',') as StagedFileStatus[];
    } else {
      options.status = statusParam as StagedFileStatus;
    }
  }
  if (employeeId) {
    options.employee_id = employeeId;
  }

  const result = await StagingService.listGroupedByTicket(options);

  // Return groups and summary directly (no data wrapper for grouped response)
  return success({ groups: result.groups, summary: result.summary });
}

/**
 * GET /files/:id - Get single staged file
 */
export async function getFile(
  _req: Request,
  _employee: Employee,
  id: string
): Promise<Response> {
  validateUUID(id, 'File ID');

  const file = await StagingService.getById(id);
  return success(file);
}

/**
 * POST /files - Create staged file (n8n, service_role)
 */
export async function createFile(
  req: Request
): Promise<Response> {
  const body = await req.json() as CreateStagedFileInput;

  const file = await StagingService.create(body);
  return success(file);
}

/**
 * PUT /files/:id/link - Link file to ticket (n8n, service_role)
 */
export async function linkFile(
  req: Request,
  id: string
): Promise<Response> {
  validateUUID(id, 'File ID');

  const body = await req.json() as LinkFileInput;
  const file = await StagingService.linkToTicket(id, body);

  return success(file);
}

/**
 * DELETE /files/:id - Delete staged file
 */
export async function deleteFile(
  _req: Request,
  _employee: Employee,
  id: string
): Promise<Response> {
  validateUUID(id, 'File ID');

  await StagingService.delete(id);
  return success({ deleted: true });
}
