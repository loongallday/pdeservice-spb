/**
 * Extract INSERT statements from migration file and write to separate files
 */
const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260102082403_add_location_reference_tables.sql');
const content = fs.readFileSync(migrationPath, 'utf8');

// Split by INSERT INTO statements
const insertRegex = /INSERT INTO (ref_\w+)/g;
let match;
const inserts = [];

// Find all INSERT positions
let lastIndex = 0;
const insertPositions = [];
while ((match = insertRegex.exec(content)) !== null) {
  insertPositions.push({ table: match[1], start: match.index });
}

// Extract each INSERT statement
for (let i = 0; i < insertPositions.length; i++) {
  const start = insertPositions[i].start;
  const end = i < insertPositions.length - 1 ? insertPositions[i + 1].start : content.indexOf('-- Add table comments');
  const sql = content.slice(start, end).trim();
  
  // Write to separate file
  const filename = `insert_${insertPositions[i].table}.sql`;
  fs.writeFileSync(path.join(__dirname, '..', filename), sql);
  console.log(`Wrote ${filename} (${sql.length} bytes)`);
}

