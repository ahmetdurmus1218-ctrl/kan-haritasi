// CI kapısı: üretim derlemesinin güvenlik sözleşmesini denetler.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'apps/web/dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const headers = readFileSync(join(dist, '_headers'), 'utf8');
const errors = [];
const need = (cond, msg) => cond || errors.push(msg);

const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
need(meta, 'index.html içinde CSP meta etiketi yok');
const csp = (meta?.[1] ?? '').replaceAll('&#39;', "'");
need(/connect-src 'self'(;|$)/.test(csp), "connect-src yalnızca 'self' olmalı");
need(/script-src 'self' 'wasm-unsafe-eval'(;|$)/.test(csp), "script-src yalnızca 'self' 'wasm-unsafe-eval' olmalı");
need(!csp.includes("'unsafe-inline'") && !/'unsafe-eval'/.test(csp.replace("'wasm-unsafe-eval'", '')), 'unsafe-inline / unsafe-eval kullanılamaz');
need(csp.includes("require-trusted-types-for 'script'"), 'Trusted Types zorunlu olmalı');
need(csp.includes("object-src 'none'") && csp.includes("base-uri 'none'"), "object-src/base-uri 'none' olmalı");
need(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<script'), 'CSP meta, ilk script etiketinden önce gelmeli');

for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  need(/\bsrc="\.\//.test(m[1] ?? ''), 'Satır içi veya harici script bulundu: ' + (m[1] ?? '').trim());
  need(!(m[2] ?? '').trim(), 'Satır içi script içeriği bulundu');
}
need(!/<(link|script|img)[^>]+(href|src)="https?:\/\//i.test(html), 'index.html harici kaynak yüklüyor');

need(headers.includes("frame-ancestors 'none'"), "_headers: frame-ancestors 'none' yok");
for (const h of ['Strict-Transport-Security', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'Permissions-Policy']) {
  need(headers.includes(h), `_headers: ${h} yok`);
}

// Bilinen izleme/analitik/çökme raporlama alan adları paketlere girmemeli.
const TRACKERS = /googletagmanager|google-analytics|googlesyndication|connect\.facebook|facebook\.net|sentry\.io|segment\.(io|com)|mixpanel|amplitude\.com|hotjar|clarity\.ms/i;
for (const f of readdirSync(join(dist, 'assets'))) {
  if (!/\.(m?js|css)$/.test(f)) continue;
  const src = readFileSync(join(dist, 'assets', f), 'utf8');
  const hit = src.match(TRACKERS);
  need(!hit, `${f}: izleme alan adı bulundu (${hit?.[0]})`);
}

if (errors.filter(Boolean).length) {
  console.error('Güvenlik kontrolü başarısız:\n- ' + errors.filter(Boolean).join('\n- '));
  process.exit(1);
}
console.log('dist security check: ok');
