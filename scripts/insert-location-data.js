/**
 * Script to generate location data INSERT SQL
 * Outputs to stdout with proper UTF-8 encoding
 */

const provinces = require('../resource/provinces.json');
const districts = require('../resource/districts.json');
const subDistricts = require('../resource/sub_districts.json');

// Escape single quotes for SQL
const esc = (s) => s ? s.replace(/'/g, "''") : null;

// Generate provinces INSERT
function getProvincesSQL() {
  let sql = 'INSERT INTO ref_provinces (id, name_th, name_en, geography_id) VALUES\n';
  sql += provinces.map(p => `(${p.id}, '${esc(p.name_th)}', '${esc(p.name_en)}', ${p.geography_id})`).join(',\n');
  sql += ';';
  return sql;
}

// Generate districts INSERT
function getDistrictsSQL() {
  let sql = 'INSERT INTO ref_districts (id, name_th, name_en, province_id) VALUES\n';
  sql += districts.map(d => `(${d.id}, '${esc(d.name_th)}', '${esc(d.name_en)}', ${d.province_id})`).join(',\n');
  sql += ';';
  return sql;
}

// Generate sub_districts INSERT
function getSubDistrictsSQL() {
  let sql = 'INSERT INTO ref_sub_districts (id, name_th, name_en, district_id, zip_code) VALUES\n';
  sql += subDistricts.map(s => `(${s.id}, '${esc(s.name_th)}', '${esc(s.name_en)}', ${s.district_id}, ${s.zip_code || 'NULL'})`).join(',\n');
  sql += ';';
  return sql;
}

// Output based on command line argument
const type = process.argv[2];
switch(type) {
  case 'provinces':
    console.log(getProvincesSQL());
    break;
  case 'districts':
    console.log(getDistrictsSQL());
    break;
  case 'subdistricts':
    console.log(getSubDistrictsSQL());
    break;
  case 'all':
    console.log(getProvincesSQL());
    console.log('\n');
    console.log(getDistrictsSQL());
    console.log('\n');
    console.log(getSubDistrictsSQL());
    break;
  default:
    console.log('Usage: node insert-location-data.js [provinces|districts|subdistricts|all]');
}

