/**
 * Search roles handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search roles
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  // Search roles
  const results = await RoleService.search(query);

  return success(results);
}

