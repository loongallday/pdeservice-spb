/**
 * Generate districts INSERT SQL split into chunks for the MCP tool
 */
const districts = require('../resource/districts.json');
const esc = (s) => s ? s.replace(/'/g, "''") : null;

// Split into chunks of 200
const chunkSize = 200;
for (let i = 0; i < districts.length; i += chunkSize) {
  const chunk = districts.slice(i, i + chunkSize);
  console.log(`\n--- CHUNK ${Math.floor(i/chunkSize) + 1} (${i} - ${i + chunk.length - 1}) ---\n`);
  
  let sql = 'INSERT INTO ref_districts (id, name_th, name_en, province_id) VALUES\n';
  sql += chunk.map(d => `(${d.id}, '${esc(d.name_th)}', '${esc(d.name_en)}', ${d.province_id})`).join(',\n');
  sql += ';';
  console.log(sql);
}

