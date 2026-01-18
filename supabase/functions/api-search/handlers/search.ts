/**
 * Global search handler
 */

import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { GlobalSearchService } from '../services/globalSearchService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function search(req: Request, _employee: Employee) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const typesParam = url.searchParams.get('types'); // comma-separated: company,site,ticket,merchandise,employee
  const limitParam = url.searchParams.get('limit');

  // Validate query
  if (q.length < 2) {
    throw new ValidationError('ต้องระบุคำค้นหาอย่างน้อย 2 ตัวอักษร');
  }

  // Parse types filter
  const validTypes = ['company', 'site', 'ticket', 'merchandise', 'employee'];
  let types: string[] = validTypes;

  if (typesParam) {
    types = typesParam.split(',').map(t => t.trim().toLowerCase());
    const invalidTypes = types.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      throw new ValidationError(`ประเภทไม่ถูกต้อง: ${invalidTypes.join(', ')}`);
    }
  }

  // Parse limit (per type, max 10)
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 5, 1), 10) : 5;

  // Execute global search
  const results = await GlobalSearchService.search(q, types, limit);

  return success(results);
}
