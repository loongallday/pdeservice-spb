/**
 * Script to generate location reference data migration
 * Run with: node scripts/generate-location-migration.js
 */

const fs = require('fs');
const path = require('path');

const provinces = require('../resource/provinces.json');
const districts = require('../resource/districts.json');
const subDistricts = require('../resource/sub_districts.json');

// Escape single quotes for SQL
const esc = (s) => s ? s.replace(/'/g, "''") : null;

let sql = `-- Migration: Add location reference tables (provinces, districts, sub_districts)
-- Import data from resource JSON files
-- Provinces: ${provinces.length}, Districts: ${districts.length}, SubDistricts: ${subDistricts.length}

-- Create provinces table
CREATE TABLE IF NOT EXISTS ref_provinces (
  id INTEGER PRIMARY KEY,
  name_th VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  geography_id INTEGER
);

-- Create districts table  
CREATE TABLE IF NOT EXISTS ref_districts (
  id INTEGER PRIMARY KEY,
  name_th VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  province_id INTEGER REFERENCES ref_provinces(id)
);

-- Create sub_districts table
CREATE TABLE IF NOT EXISTS ref_sub_districts (
  id INTEGER PRIMARY KEY,
  name_th VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  district_id INTEGER REFERENCES ref_districts(id),
  zip_code INTEGER
);

-- Enable RLS
ALTER TABLE ref_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_sub_districts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for read access
CREATE POLICY "Allow all users to read provinces" ON ref_provinces FOR SELECT USING (true);
CREATE POLICY "Allow all users to read districts" ON ref_districts FOR SELECT USING (true);
CREATE POLICY "Allow all users to read sub_districts" ON ref_sub_districts FOR SELECT USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_districts_province_id ON ref_districts(province_id);
CREATE INDEX IF NOT EXISTS idx_sub_districts_district_id ON ref_sub_districts(district_id);
CREATE INDEX IF NOT EXISTS idx_sub_districts_zip_code ON ref_sub_districts(zip_code);

-- Insert provinces
`;

// Insert provinces
sql += 'INSERT INTO ref_provinces (id, name_th, name_en, geography_id) VALUES\n';
sql += provinces.map(p => `  (${p.id}, '${esc(p.name_th)}', '${esc(p.name_en)}', ${p.geography_id})`).join(',\n');
sql += ';\n\n';

// Insert districts  
sql += '-- Insert districts\n';
sql += 'INSERT INTO ref_districts (id, name_th, name_en, province_id) VALUES\n';
sql += districts.map(d => `  (${d.id}, '${esc(d.name_th)}', '${esc(d.name_en)}', ${d.province_id})`).join(',\n');
sql += ';\n\n';

// Insert sub_districts
sql += '-- Insert sub_districts\n';
sql += 'INSERT INTO ref_sub_districts (id, name_th, name_en, district_id, zip_code) VALUES\n';
sql += subDistricts.map(s => `  (${s.id}, '${esc(s.name_th)}', '${esc(s.name_en)}', ${s.district_id}, ${s.zip_code || 'NULL'})`).join(',\n');
sql += ';\n\n';

// Add table comments
sql += `-- Add table comments
COMMENT ON TABLE ref_provinces IS 'Reference: Thai provinces';
COMMENT ON TABLE ref_districts IS 'Reference: Thai districts (amphoe)';
COMMENT ON TABLE ref_sub_districts IS 'Reference: Thai sub-districts (tambon)';
`;

// Generate timestamp for filename
const now = new Date();
const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14);
const filename = path.join(__dirname, '..', 'supabase', 'migrations', `${timestamp}_add_location_reference_tables.sql`);

fs.writeFileSync(filename, sql);
console.log('Created migration:', filename);
console.log('Total lines:', sql.split('\n').length);
console.log('File size:', (sql.length / 1024).toFixed(2), 'KB');

