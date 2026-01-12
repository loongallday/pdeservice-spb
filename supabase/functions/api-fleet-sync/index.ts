/**
 * Fleet Sync Function - Called by pg_cron every 5 minutes
 * Pulls data from external fleet system and stores in database
 */

import { handleCORS } from '../_shared/cors.ts';
import { success, error as errorResponse } from '../_shared/response.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { crypto } from 'jsr:@std/crypto';
import { encodeHex } from 'jsr:@std/encoding/hex';

const FLEET_BASE_URL = 'http://bgfleet.loginto.me/Tracking/mobile';
const FLEET_LOGIN_URL = `${FLEET_BASE_URL}/main.php`;
const FLEET_API_URL = `${FLEET_BASE_URL}/ajax_listInfo.php`;
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';

// Expected secret key for cron authentication
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Note: This function is called by pg_cron internally
    // No auth required as it's not publicly accessible
    console.log('[fleet-sync] Starting sync...');

    const result = await syncFleetData();

    console.log(`[fleet-sync] Completed: ${result.synced} vehicles synced, ${result.history_logged} history records`);

    return success(result);
  } catch (err) {
    console.error('[fleet-sync] Error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Sync failed', 500);
  }
});

/**
 * Main sync function
 */
async function syncFleetData(): Promise<{ synced: number; history_logged: number }> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Login and fetch data from external API
  const sessionCookie = await login();
  const rawData = await fetchFleetData(sessionCookie);

  if (!Array.isArray(rawData)) {
    throw new Error('Invalid response from fleet API');
  }

  // Get all garages for proximity detection
  const { data: garages } = await supabase
    .from('fleet_garages')
    .select('id, name, latitude, longitude, radius_meters')
    .eq('is_active', true);

  let synced = 0;
  let historyLogged = 0;

  for (const item of rawData) {
    const arr = item as unknown[];
    const vehicleId = String(arr[0] ?? '');
    const fullName = String(arr[1] ?? '');
    const { plateNumber, driverName } = parseVehicleName(fullName);

    const lat = typeof arr[3] === 'number' ? arr[3] : parseFloat(String(arr[3])) || 0;
    const lng = typeof arr[5] === 'number' ? arr[5] : parseFloat(String(arr[5])) || 0;
    const speed = typeof arr[7] === 'number' ? arr[7] : parseFloat(String(arr[7])) || 0;
    const heading = typeof arr[8] === 'number' ? arr[8] : parseInt(String(arr[8])) || 0;
    const signalStrength = typeof arr[9] === 'number' ? arr[9] : parseInt(String(arr[9])) || 0;
    const isMoving = arr[2] === 1 || arr[2] === '1';

    // Find nearest garage
    const { garage, isAtBase } = findNearestGarage(lat, lng, garages || []);

    // Determine status
    let status: 'moving' | 'stopped' | 'parked_at_base' = 'stopped';
    if (isMoving) {
      status = 'moving';
    } else if (isAtBase) {
      status = 'parked_at_base';
    }

    // Check existing vehicle for address caching
    const { data: existingVehicle } = await supabase
      .from('fleet_vehicles')
      .select('address, latitude, longitude')
      .eq('id', vehicleId)
      .single();

    // Geocode if location changed significantly (>50m) or no address
    let address: string | null = existingVehicle?.address || null;
    if (existingVehicle?.latitude && existingVehicle?.longitude) {
      const distance = calculateDistance(lat, lng, existingVehicle.latitude, existingVehicle.longitude);
      if (distance > 50) {
        address = await reverseGeocode(lat, lng);
      }
    } else {
      address = await reverseGeocode(lat, lng);
    }

    // Upsert current vehicle state
    const { error: upsertError } = await supabase
      .from('fleet_vehicles')
      .upsert({
        id: vehicleId,
        name: fullName,
        plate_number: plateNumber,
        driver_name: driverName,
        status,
        latitude: lat,
        longitude: lng,
        speed,
        heading,
        signal_strength: signalStrength,
        address,
        current_garage_id: isAtBase && garage ? garage.id : null,
        last_sync_at: now,
        updated_at: now,
      }, { onConflict: 'id' });

    if (!upsertError) synced++;

    // Insert history record for route tracking (skip if parked at base to save DB space)
    if (status !== 'parked_at_base') {
      const { error: historyError } = await supabase
        .from('fleet_vehicle_history')
        .insert({
          vehicle_id: vehicleId,
          latitude: lat,
          longitude: lng,
          speed,
          heading,
          status,
          address,
          recorded_at: now,
        });

      if (!historyError) historyLogged++;
    }
  }

  return { synced, history_logged: historyLogged };
}

/**
 * Login to fleet system
 */
async function login(): Promise<string> {
  const username = Deno.env.get('FLEET_USERNAME');
  const password = Deno.env.get('FLEET_PASSWORD');

  if (!username || !password) {
    throw new Error('Fleet credentials not configured');
  }

  // Get initial session
  const initialResponse = await fetch(FLEET_LOGIN_URL, { method: 'GET' });
  const setCookieHeader = initialResponse.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('Failed to get initial session cookie');
  }

  const sessionMatch = setCookieHeader.match(/PHPSESSID=([^;]+)/);
  if (!sessionMatch) {
    throw new Error('Failed to parse session cookie');
  }

  const sessionCookie = `PHPSESSID=${sessionMatch[1]}`;

  // Encode credentials
  const encodedUsername = btoa(username.toLowerCase());
  const md5Password = await md5(password);
  const encodedPassword = btoa(md5Password);

  // Login
  const formData = new URLSearchParams();
  formData.append('entered_login', encodedUsername);
  formData.append('entered_password', encodedPassword);

  const loginResponse = await fetch(FLEET_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': sessionCookie,
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  const newSetCookie = loginResponse.headers.get('set-cookie');
  const finalCookie = newSetCookie
    ? `PHPSESSID=${newSetCookie.match(/PHPSESSID=([^;]+)/)?.[1] || sessionMatch[1]}`
    : sessionCookie;

  const responseText = await loginResponse.text();
  if (responseText.includes('id="LoginFormID"') && !responseText.includes('map.php')) {
    throw new Error('Fleet login failed - invalid credentials');
  }

  return finalCookie;
}

/**
 * Fetch fleet data from external API
 */
async function fetchFleetData(sessionCookie: string): Promise<unknown[]> {
  const url = `${FLEET_API_URL}?group=-1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': sessionCookie,
    },
  });

  const text = await response.text();

  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    throw new Error('Session expired - got HTML instead of JSON');
  }

  return JSON.parse(text);
}

/**
 * MD5 hash
 */
async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  return encodeHex(new Uint8Array(hashBuffer));
}

/**
 * Parse vehicle name
 */
function parseVehicleName(name: string): { plateNumber: string | null; driverName: string | null } {
  if (!name) return { plateNumber: null, driverName: null };

  const plateMatch = name.match(/^([\dก-ฮ]+-?[\d]+(?:\s*กท\.?)?)/);
  const plateNumber = plateMatch ? plateMatch[1].trim() : null;
  const driverMatch = name.match(/คุณ[\u0E00-\u0E7F\w+]+/);
  const driverName = driverMatch ? driverMatch[0] : null;

  return { plateNumber, driverName };
}

/**
 * Calculate distance (Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find nearest garage
 */
function findNearestGarage(
  lat: number,
  lng: number,
  garages: Array<{ id: string; name: string; latitude: number; longitude: number; radius_meters: number }>
): { garage: { id: string; name: string; distance_meters: number } | null; isAtBase: boolean } {
  if (!garages.length) return { garage: null, isAtBase: false };

  let nearest: { id: string; name: string; distance_meters: number } | null = null;
  let minDistance = Infinity;
  let isAtBase = false;

  for (const g of garages) {
    const distance = calculateDistance(lat, lng, g.latitude, g.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { id: g.id, name: g.name, distance_meters: Math.round(distance) };
      isAtBase = distance <= g.radius_meters;
    }
  }

  return { garage: nearest, isAtBase };
}

/**
 * Reverse geocode
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.[0]) {
      return data.results[0].formatted_address;
    }
    return null;
  } catch {
    return null;
  }
}
