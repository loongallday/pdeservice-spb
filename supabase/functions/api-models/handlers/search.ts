/**
 * Search models handler - Search by description and code
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search models
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const description = url.searchParams.get('description') || undefined;
  const code = url.searchParams.get('code') || undefined;

  // Search models by description and/or code
  const results = await ModelService.search({ description, code });

  return success(results);
}

