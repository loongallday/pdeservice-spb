import { success, error } from '../../_shared/response.ts';
import { handleError } from '../../_shared/error.ts';
import { createServiceClient } from '../../_shared/supabase.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getDashboard(_req: Request, _employee: Employee): Promise<Response> {
  try {
    const supabase = createServiceClient();

    // Run all queries in parallel for speed
    const [
      locationsResult,
      itemsResult,
      lowStockResult,
      recentMovementsResult
    ] = await Promise.all([
      // Total locations count
      supabase
        .from('main_stock_locations')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),

      // Total stock items count
      supabase
        .from('main_stock_items')
        .select('id', { count: 'exact', head: true }),

      // Low stock count
      supabase.rpc('get_low_stock_items'),

      // Recent movements (last 10)
      supabase
        .from('child_stock_movements')
        .select(`
          id,
          movement_type,
          quantity,
          performed_at,
          stock_item:main_stock_items(
            id,
            location:main_stock_locations(id, name, code),
            model:main_models(id, model, name_th)
          ),
          performer:main_employees(id, name)
        `)
        .order('performed_at', { ascending: false })
        .limit(10)
    ]);

    const dashboard = {
      summary: {
        total_locations: locationsResult.count || 0,
        total_items: itemsResult.count || 0,
        low_stock_count: lowStockResult.data?.length || 0,
      },
      low_stock_items: (lowStockResult.data || []).slice(0, 5),
      recent_movements: recentMovementsResult.data || [],
    };

    return success(dashboard);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}
