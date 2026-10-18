import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const d=JSON.parse(readFileSync(new URL('./dist/data.json',import.meta.url),'utf8'));
assert.equal(d.pages.length,369);
assert.equal(d.records.length,781);
assert.equal(new Set(d.records.map(r=>r.id)).size,781);
for(const p of d.pages)assert.ok(existsSync(new URL(`./dist/assets/pages/${p.doc}-${p.page}.webp`,import.meta.url)));
console.log('OK: 369 páginas, 781 fichas e todos os arquivos visuais presentes.');
