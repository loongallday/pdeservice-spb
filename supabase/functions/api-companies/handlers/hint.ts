/**
 * Hint companies handler
 * Returns up to 5 company hints based on query string
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function hint(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get company hints
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';

  // Get company hints
  const companies = await CompanyService.hint(q);

  return success(companies);
}

