#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Generate SQL migration for location data (provinces, districts, subdistricts)
 * from JSON resource files
 */

import provincesData from '../resource/provinces.json' with { type: 'json' };
import districtsData from '../resource/districts.json' with { type: 'json' };
import subDistrictsData from '../resource/sub_districts.json' with { type: 'json' };

type Province = {
  id: number;
  name_th: string;
  name_en: string;
  geography_id: number;
};

type District = {
  id: number;
  name_th: string;
  name_en: string;
  province_id: number;
};

type SubDistrict = {
  id: number;
  name_th: string;
  name_en: string;
  district_id: number;
  zip_code: number;
};

function escapeSQL(str: string | null | undefined): string {
  if (str == null) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function generateSQL(): string {
  const lines: string[] = [];

  lines.push(`-- =============================================`);
  lines.push(`-- Migration: Seed Location Data`);
  lines.push(`-- Purpose: Populate provinces, districts, subdistricts`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- =============================================`);
  lines.push(``);

  // Provinces
  lines.push(`-- ===========================================`);
  lines.push(`-- Provinces (${provincesData.length} records)`);
  lines.push(`-- ===========================================`);
  lines.push(`INSERT INTO ref_provinces (id, name_th, name_en, geography_id) VALUES`);

  const provinceValues = (provincesData as Province[]).map((p, i) => {
    const isLast = i === provincesData.length - 1;
    return `  (${p.id}, ${escapeSQL(p.name_th)}, ${escapeSQL(p.name_en)}, ${p.geography_id || 'NULL'})${isLast ? '' : ','}`;
  });
  lines.push(...provinceValues);
  lines.push(`ON CONFLICT (id) DO UPDATE SET`);
  lines.push(`  name_th = EXCLUDED.name_th,`);
  lines.push(`  name_en = EXCLUDED.name_en,`);
  lines.push(`  geography_id = EXCLUDED.geography_id;`);
  lines.push(``);

  // Districts
  lines.push(`-- ===========================================`);
  lines.push(`-- Districts (${districtsData.length} records)`);
  lines.push(`-- ===========================================`);
  lines.push(`INSERT INTO ref_districts (id, name_th, name_en, province_id) VALUES`);

  const districtValues = (districtsData as District[]).map((d, i) => {
    const isLast = i === districtsData.length - 1;
    return `  (${d.id}, ${escapeSQL(d.name_th)}, ${escapeSQL(d.name_en)}, ${d.province_id})${isLast ? '' : ','}`;
  });
  lines.push(...districtValues);
  lines.push(`ON CONFLICT (id) DO UPDATE SET`);
  lines.push(`  name_th = EXCLUDED.name_th,`);
  lines.push(`  name_en = EXCLUDED.name_en,`);
  lines.push(`  province_id = EXCLUDED.province_id;`);
  lines.push(``);

  // SubDistricts
  lines.push(`-- ===========================================`);
  lines.push(`-- Sub-Districts (${subDistrictsData.length} records)`);
  lines.push(`-- ===========================================`);
  lines.push(`INSERT INTO ref_sub_districts (id, name_th, name_en, district_id, zip_code) VALUES`);

  const subDistrictValues = (subDistrictsData as SubDistrict[]).map((s, i) => {
    const isLast = i === subDistrictsData.length - 1;
    return `  (${s.id}, ${escapeSQL(s.name_th)}, ${escapeSQL(s.name_en)}, ${s.district_id}, ${s.zip_code || 'NULL'})${isLast ? '' : ','}`;
  });
  lines.push(...subDistrictValues);
  lines.push(`ON CONFLICT (id) DO UPDATE SET`);
  lines.push(`  name_th = EXCLUDED.name_th,`);
  lines.push(`  name_en = EXCLUDED.name_en,`);
  lines.push(`  district_id = EXCLUDED.district_id,`);
  lines.push(`  zip_code = EXCLUDED.zip_code;`);
  lines.push(``);

  lines.push(`-- Print completion message`);
  lines.push(`DO $$ BEGIN RAISE NOTICE 'Location data seeded: ${provincesData.length} provinces, ${districtsData.length} districts, ${subDistrictsData.length} subdistricts'; END $$;`);

  return lines.join('\n');
}

const sql = generateSQL();
const outputPath = './supabase/migrations/20260118080001_seed_location_data.sql';
await Deno.writeTextFile(outputPath, sql);
console.log(`Generated ${outputPath}`);
console.log(`- Provinces: ${provincesData.length}`);
console.log(`- Districts: ${districtsData.length}`);
console.log(`- SubDistricts: ${subDistrictsData.length}`);
