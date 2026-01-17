/**
 * LINE Accounts handlers - Manage LINE account mappings
 */

import { success, successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams, validateUUID } from '../../_shared/validation.ts';
import { LineAccountService } from '../services/lineAccountService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { CreateLineAccountInput } from '../types.ts';

/**
 * GET /line-accounts - List LINE account mappings (admin only)
 */
export async function listLineAccounts(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Require admin level (level >= 2)
  await requireMinLevel(employee, 2);

  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  const result = await LineAccountService.list({ page, limit });

  return successWithPagination(result.data, result.pagination);
}

/**
 * POST /line-accounts - Create LINE account mapping (admin only)
 */
export async function createLineAccount(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Require admin level (level >= 2)
  await requireMinLevel(employee, 2);

  const body = await req.json() as CreateLineAccountInput;
  const account = await LineAccountService.create(body);

  return success(account);
}

/**
 * PUT /line-accounts/:id - Update LINE account info (admin only)
 */
export async function updateLineAccount(
  req: Request,
  employee: Employee,
  id: string
): Promise<Response> {
  // Require admin level (level >= 2)
  await requireMinLevel(employee, 2);

  validateUUID(id, 'LINE Account ID');

  const body = await req.json() as { display_name?: string; profile_picture_url?: string };
  const account = await LineAccountService.update(id, body);

  return success(account);
}

/**
 * DELETE /line-accounts/:id - Delete LINE account mapping (admin only)
 */
export async function deleteLineAccount(
  _req: Request,
  employee: Employee,
  id: string
): Promise<Response> {
  // Require admin level (level >= 2)
  await requireMinLevel(employee, 2);

  validateUUID(id, 'LINE Account ID');

  await LineAccountService.delete(id);

  return success({ deleted: true });
}

/**
 * GET /employee/:lineUserId - Get employee by LINE user ID (n8n, service_role)
 */
export async function getEmployeeByLineUserId(
  _req: Request,
  lineUserId: string
): Promise<Response> {
  const account = await LineAccountService.getEmployeeByLineUserId(lineUserId);

  return success(account);
}
