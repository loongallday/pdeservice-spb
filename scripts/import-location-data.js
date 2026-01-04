/**
 * Import location data (districts and sub_districts) into Supabase
 * Uses Supabase JS client to execute SQL
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment - you can set these or use .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.log('You can find these in your Supabase project settings or run: npx supabase status');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runSQL(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // Try direct query approach
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ sql_query: sql })
    });
    if (!response.ok) {
      throw new Error(`SQL execution failed: ${await response.text()}`);
    }
  }
  return data;
}

async function importData() {
  console.log('Loading location data...');
  
  const districts = require('../resource/districts.json');
  const subDistricts = require('../resource/sub_districts.json');
  
  const esc = (s) => s ? s.replace(/'/g, "''") : null;
  
  // Insert districts in batches
  console.log(`Inserting ${districts.length} districts...`);
  const districtBatchSize = 100;
  for (let i = 0; i < districts.length; i += districtBatchSize) {
    const batch = districts.slice(i, i + districtBatchSize);
    const values = batch.map(d => 
      `(${d.id}, '${esc(d.name_th)}', '${esc(d.name_en)}', ${d.province_id})`
    ).join(',\n');
    
    const sql = `INSERT INTO ref_districts (id, name_th, name_en, province_id) VALUES\n${values};`;
    
    const { error } = await supabase.from('ref_districts').insert(
      batch.map(d => ({
        id: d.id,
        name_th: d.name_th,
        name_en: d.name_en,
        province_id: d.province_id
      }))
    );
    
    if (error) {
      console.error(`Error inserting districts batch ${i}:`, error.message);
    } else {
      console.log(`  Inserted districts ${i + 1} - ${i + batch.length}`);
    }
  }
  
  // Insert sub_districts in batches
  console.log(`Inserting ${subDistricts.length} sub_districts...`);
  const subDistrictBatchSize = 500;
  for (let i = 0; i < subDistricts.length; i += subDistrictBatchSize) {
    const batch = subDistricts.slice(i, i + subDistrictBatchSize);
    
    const { error } = await supabase.from('ref_sub_districts').insert(
      batch.map(s => ({
        id: s.id,
        name_th: s.name_th,
        name_en: s.name_en,
        district_id: s.district_id,
        zip_code: s.zip_code || null
      }))
    );
    
    if (error) {
      console.error(`Error inserting sub_districts batch ${i}:`, error.message);
    } else {
      console.log(`  Inserted sub_districts ${i + 1} - ${i + batch.length}`);
    }
  }
  
  console.log('Done!');
}

importData().catch(console.error);

