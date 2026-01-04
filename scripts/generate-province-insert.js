const provinces = require('../resource/provinces.json');
const esc = (s) => s ? s.replace(/'/g, "''") : null;

let sql = 'INSERT INTO ref_provinces (id, name_th, name_en, geography_id) VALUES\n';
sql += provinces.map(p => `(${p.id}, '${esc(p.name_th)}', '${esc(p.name_en)}', ${p.geography_id})`).join(',\n');
sql += ';';

console.log(sql);

