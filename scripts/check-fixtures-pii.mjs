// CI kapısı: test verisine gerçek kimlik numarası veya gerçek rapor girmesin.
// Taranan yerler: fixtures/, tests/, tüm __tests__ klasörleri. Geçerli sağlama toplamına sahip
// 11 haneli her sayı (TC Kimlik No biçimi) derlemeyi durdurur.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findTcKimlik } from './tc-kimlik.mjs';

const root = new URL('..', import.meta.url).pathname;
const targets = ['fixtures', 'tests'];
const skip = new Set(['node_modules', 'dist', '.git']);
const hits = [];

function walk(dir, forceInclude = false) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, forceInclude || name === '__tests__');
    else if (forceInclude && st.size < 50 * 1024 * 1024) {
      const text = readFileSync(p).toString('latin1');
      for (const n of findTcKimlik(text)) hits.push(`${relative(root, p)}: ${n.slice(0, 3)}******${n.slice(-2)}`);
    }
  }
}

for (const t of targets) {
  try {
    walk(join(root, t), true);
  } catch {
    /* klasör yoksa geç */
  }
}
walk(join(root, 'packages'));
walk(join(root, 'apps'));

if (hits.length) {
  console.error('Test verisinde TC Kimlik No biçiminde geçerli numara bulundu:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('fixtures PII check: ok');
