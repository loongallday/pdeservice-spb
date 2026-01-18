/**
 * Search serial items by serial number
 * GET /serials/search?q=...
 */

import { success } from '../../../_shared/response.ts';
import { ValidationError } from '../../../_shared/error.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

export async function searchSerials(req: Request, _employee: Employee): Promise<Response> {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  if (!query || query.length < 2) {
    throw new ValidationError('กรุณาระบุคำค้นหาอย่างน้อย 2 ตัวอักษร');
  }

  const items = await SerialService.searchSerialItems(query, limit);
  return success(items);
}
