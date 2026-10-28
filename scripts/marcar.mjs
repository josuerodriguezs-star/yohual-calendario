// Marca premios como verificados hoy:  node scripts/marcar.mjs 3 7 12   |   node scripts/marcar.mjs todos
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('awards.json', 'utf8'));
const hoy = new Date().toISOString().slice(0, 10);
const ids = process.argv.slice(2);
if (!ids.length) { console.log('Uso: node scripts/marcar.mjs ID [ID…] | todos'); process.exit(1); }
let n = 0;
for (const a of d.awards) if (ids.includes('todos') || ids.includes(String(a.id))) { a.verified = hoy; n++; console.log('✓', a.id, a.name); }
d.meta.updated = hoy;
fs.writeFileSync('awards.json', JSON.stringify(d, null, 1) + '\n');
console.log(n + ' premio(s) marcados como verificados el ' + hoy);
