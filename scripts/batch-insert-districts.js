/**
 * Generate district INSERT statements as individual chunks
 * Writes to separate files for easy reading
 */
const fs = require('fs');
const path = require('path');
const districts = require('../resource/districts.json');

const esc = (s) => s ? s.replace(/'/g, "''") : null;

// Generate full SQL
let sql = 'INSERT INTO ref_districts (id, name_th, name_en, province_id) VALUES\n';
sql += districts.map(d => `(${d.id}, '${esc(d.name_th)}', '${esc(d.name_en)}', ${d.province_id})`).join(',\n');
sql += ';';

// Write to file
const outputPath = path.join(__dirname, '..', 'districts_insert.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Generated:', outputPath);
console.log('Total districts:', districts.length);
console.log('File size:', (sql.length / 1024).toFixed(2), 'KB');

