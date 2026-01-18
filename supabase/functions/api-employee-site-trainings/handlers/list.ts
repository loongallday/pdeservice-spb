/**
 * List employee-site trainings handler
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { EmployeeSiteTrainingService } from '../services/employeeSiteTrainingService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Level 0+: all authenticated users can view
  await requireMinLevel(employee, 0);

  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const employeeId = url.searchParams.get('employee_id') || undefined;
  const siteId = url.searchParams.get('site_id') || undefined;

  const result = await EmployeeSiteTrainingService.getAll({
    page,
    limit,
    employeeId,
    siteId,
  });

  return successWithPagination(result.data, result.pagination);
}

