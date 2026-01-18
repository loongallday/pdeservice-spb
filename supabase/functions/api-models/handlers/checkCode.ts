/**
 * Check if model code exists - Lightspeed check for barcode scanning
 * GET /api-models/check?code=UPS-3000
 *
 * NO AUTH REQUIRED - This is a public, read-only existence check
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  ...corsHeaders,
};

export async function checkCodeFast(req: Request): Promise<Response> {
  const code = new URL(req.url).searchParams.get('code')?.trim();

  if (!code) {
    return new Response('{"data":{"exists":false}}', { headers: RESPONSE_HEADERS });
  }

  const { data } = await createServiceClient()
    .from('main_models')
    .select('id, model, name, name_th, unit, has_serial')
    .eq('model', code)
    .maybeSingle();

  if (!data) {
    return new Response('{"data":{"exists":false}}', { headers: RESPONSE_HEADERS });
  }

  // Return exists + model data for single-call lookup
  return new Response(
    JSON.stringify({
      data: {
        exists: true,
        id: data.id,
        model: data.model,
        name: data.name,
        name_th: data.name_th,
        unit: data.unit,
        has_serial: data.has_serial,
      },
    }),
    { headers: RESPONSE_HEADERS }
  );
}
