/**
 * Location Matcher Service
 * Matches Google Places address components to Thai location codes
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import type { AddressComponents } from './placesService.ts';

export interface MatchedLocation {
  province_code: number | null;
  district_code: number | null;
  subdistrict_code: number | null;
}

/**
 * Match Google address components to Thai location codes
 * Uses fuzzy matching to find the best match
 */
export async function matchLocationCodes(
  addressComponents: AddressComponents
): Promise<MatchedLocation | null> {
  const supabase = createServiceClient();

  let provinceCode: number | null = null;
  let districtCode: number | null = null;
  let subdistrictCode: number | null = null;

  // Step 1: Match province
  if (addressComponents.province) {
    const provinceName = normalizeThaiLocation(addressComponents.province);

    const { data: provinces } = await supabase
      .from('ref_provinces')
      .select('id, name_th, name_en')
      .or(`name_th.ilike.%${provinceName}%,name_en.ilike.%${provinceName}%`)
      .limit(1);

    if (provinces && provinces.length > 0) {
      provinceCode = provinces[0].id;
    }
  }

  // Step 2: Match district (within province if found)
  if (addressComponents.district) {
    const districtName = normalizeThaiLocation(addressComponents.district);

    let districtQuery = supabase
      .from('ref_districts')
      .select('id, name_th, name_en, province_id')
      .or(`name_th.ilike.%${districtName}%,name_en.ilike.%${districtName}%`);

    if (provinceCode) {
      districtQuery = districtQuery.eq('province_id', provinceCode);
    }

    const { data: districts } = await districtQuery.limit(1);

    if (districts && districts.length > 0) {
      districtCode = districts[0].id;
      // Update province code if not already set
      if (!provinceCode) {
        provinceCode = districts[0].province_id;
      }
    }
  }

  // Step 3: Match subdistrict (within district if found)
  if (addressComponents.subdistrict) {
    const subdistrictName = normalizeThaiLocation(addressComponents.subdistrict);

    let subdistrictQuery = supabase
      .from('ref_sub_districts')
      .select('id, name_th, name_en, district_id, zip_code')
      .or(`name_th.ilike.%${subdistrictName}%,name_en.ilike.%${subdistrictName}%`);

    if (districtCode) {
      subdistrictQuery = subdistrictQuery.eq('district_id', districtCode);
    }

    const { data: subdistricts } = await subdistrictQuery.limit(1);

    if (subdistricts && subdistricts.length > 0) {
      subdistrictCode = subdistricts[0].id;
      // Update district code if not already set
      if (!districtCode) {
        districtCode = subdistricts[0].district_id;
      }
    }
  }

  // Step 4: Try matching by postal code as fallback
  if (!subdistrictCode && addressComponents.postal_code) {
    const postalCode = parseInt(addressComponents.postal_code, 10);
    if (!isNaN(postalCode)) {
      const { data: subdistricts } = await supabase
        .from('ref_sub_districts')
        .select('id, district_id')
        .eq('zip_code', postalCode)
        .limit(1);

      if (subdistricts && subdistricts.length > 0) {
        subdistrictCode = subdistricts[0].id;
        if (!districtCode) {
          districtCode = subdistricts[0].district_id;
        }
      }
    }
  }

  // If we found at least one code, return the result
  if (provinceCode || districtCode || subdistrictCode) {
    // Backfill missing codes by traversing up the hierarchy
    if (subdistrictCode && !districtCode) {
      const { data } = await supabase
        .from('ref_sub_districts')
        .select('district_id')
        .eq('id', subdistrictCode)
        .single();
      if (data) districtCode = data.district_id;
    }

    if (districtCode && !provinceCode) {
      const { data } = await supabase
        .from('ref_districts')
        .select('province_id')
        .eq('id', districtCode)
        .single();
      if (data) provinceCode = data.province_id;
    }

    return {
      province_code: provinceCode,
      district_code: districtCode,
      subdistrict_code: subdistrictCode,
    };
  }

  return null;
}

/**
 * Normalize Thai location name for matching
 * Removes common prefixes and normalizes spaces
 */
function normalizeThaiLocation(name: string): string {
  return name
    // Remove common Thai prefixes
    .replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง|อ\.|ต\.|จ\.)\s*/g, '')
    // Remove "กรุงเทพมหานคร" variations
    .replace(/กรุงเทพมหานคร/g, 'กรุงเทพ')
    .replace(/กรุงเทพฯ/g, 'กรุงเทพ')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}
