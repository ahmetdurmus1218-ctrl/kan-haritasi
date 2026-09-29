/**
 * Uyum denetimi: üretilmiş model dosyalarında her parçanın ne kadarının o vücudun derisi dışında
 * kaldığını ölçer (erkek ve kadın ayrı). Kol/bacak ve diz uyumunun bozulmadığını doğrulamak için
 * derlemeden sonra çalıştırılır; eşik aşılırsa hata koduyla çıkar.
 *
 * Kullanım: pnpm --filter @kh/assets-pipeline check-fit
 */
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { PointGrid, type V3, Volume } from './fit';

const root = new URL('../apps/web/public/models/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as { bodies: Record<string, Record<string, { file: string }>> };
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/** Düğüm başına dünya koordinatlı noktalar (nicemleme/düğüm dönüşümü uygulanmış). */
async function nodePoints(file: string, triangles = false): Promise<Map<string, Float32Array>> {
  const doc = await io.read(new URL(file, root).pathname);
  const out = new Map<string, Float32Array>();
  const seen = new Map<string, number>();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const M = node.getWorldMatrix();
    const pts: number[] = [];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!;
      const idx = prim.getIndices();
      const e: number[] = [0, 0, 0];
      const n = triangles && idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i < n; i++) {
        pos.getElement(triangles && idx ? idx.getScalar(i) : i, e);
        const [x, y, z] = e as [number, number, number];
        pts.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
      }
    }
    // Aynı adlı düğümler (ör. iki tarafın diz bağı) ayrı tutulur
    const name = node.getName();
    const k = seen.get(name) ?? 0;
    seen.set(name, k + 1);
    out.set(k ? `${name}#${k}` : name, Float32Array.from(pts));
  }
  return out;
}

/** Bu parçaların derinin dışında kalması beklenir ya da ölçüm anlamsızdır. */
const EXEMPT = /^(skin|breasts\|nipple|male-genitals|urinary-tract\|urethra)/;
/**
 * Eşikler: bir parçanın en fazla %40'ı derinin dışında olabilir ve dışarı taşan kısmın %95'i deriden
 * en fazla 12 mm uzakta kalmalıdır (deri altındaki toplardamarlar, diz önü bağı gibi yüzeysel yapılar
 * ve iki farklı vücudun biçim farkı birkaç milimetrelik taşma yaratır; bu ekranda görünmez).
 */
const LIMIT = 0.4;
const DEPTH = 0.012;

/**
 * Bilinen, açıklanmış istisnalar (kendi, daha geniş ama yine sınırlı eşikleriyle):
 *  - Kadın el kemikleri: el katı olarak döndürülüp ölçeklenir; parmak duruşu iki vücutta farklıdır.
 *  - Erkek bağırsakları (çekum, transvers kolon, ileumun ucu): HRA organı ile BodyParts3D derisi farklı
 *    kişilerdendir; karın ön duvarı BodyParts3D'de daha incedir.
 */
const KNOWN: Array<{ body: string; match: RegExp; limit: number; depth: number; why: string }> = [
  { body: 'female', match: /^skeleton:bones\|hand-/, limit: 0.25, depth: 0.022, why: 'parmak duruşu farklı' },
  { body: 'male', match: /^digestive:(large|small)-intestine\|/, limit: 0.2, depth: 0.022, why: 'HRA organı ↔ BodyParts3D derisi' },
];

const worst: Array<[string, number]> = [];
type Row = [string, number, number];
let failed = 0;
for (const [body, assets] of Object.entries(manifest.bodies)) {
  const skinTris = [...(await nodePoints(assets.body!.file, true)).values()][0]!;
  const skin = new Volume(skinTris, 0.005);
  const rows: Row[] = [];
  for (const [asset, a] of Object.entries(assets)) {
    if (asset === 'body') continue;
    for (const [name, pts] of await nodePoints(a.file)) {
      if (EXEMPT.test(name)) continue;
      const n = pts.length / 3;
      const step = Math.max(1, Math.floor(n / 600));
      let out = 0;
      let k = 0;
      const depth: number[] = [];
      for (let i = 0; i < n; i += step, k++) {
        const p = [pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!] as V3;
        if (skin.inside(p)) continue;
        out++;
        depth.push(skin.surface.nearest(p, 0.2)?.d ?? 0.2);
      }
      depth.sort((a, b) => a - b);
      rows.push([`${asset}:${name}`, out / k, depth.length ? depth[Math.floor(depth.length * 0.95)]! : 0]);
    }
  }
  rows.sort((a, b) => b[1] * b[2] - a[1] * a[2]);
  const rule = (r: Row) => KNOWN.find((k) => k.body === body && k.match.test(r[0]));
  const bad = (r: Row) => {
    const k = rule(r);
    return r[1] > (k?.limit ?? LIMIT) || r[2] > (k?.depth ?? DEPTH);
  };
  failed += rows.filter(bad).length;
  console.log(`\n${body}: ${rows.length} parça; derinin dışına en çok taşan 8 parça (oran · taşmanın %95'i şu uzaklıkta):`);
  for (const r of [...rows.slice(0, 8), ...rows.slice(8).filter(bad)]) {
    const k = rule(r);
    console.log(`  ${bad(r) ? '✗' : '✓'} ${r[0].padEnd(50)} %${(r[1] * 100).toFixed(1).padStart(5)} · ${(r[2] * 1000).toFixed(1)} mm${k ? `  (bilinen: ${k.why})` : ''}`);
  }
  worst.push([`${body} ${rows[0]?.[0]}`, rows[0]?.[1] ?? 0]);

  // Diz: kıkırdak ve menisküs femur/tibiaya yapışık olmalı
  const skel = await nodePoints(assets.skeleton!.file);
  for (const s of ['l', 'r']) {
    const bone = [...(skel.get(`bones|femur-${s}`) ?? []), ...(skel.get(`bones|leg-${s}`) ?? [])];
    const grid = new PointGrid(Float32Array.from(bone), 0.01);
    const side = s === 'l' ? 1 : -1;
    const cart = [...skel].filter(([k]) => /^knee\|(cartilage|meniscus)/.test(k)).map(([, v]) => v);
    const pts: V3[] = [];
    for (const a of cart) for (let i = 0; i < a.length; i += 9) if (Math.sign(a[i]!) === side) pts.push([a[i]!, a[i + 1]!, a[i + 2]!]);
    const d = pts.reduce((sum, p) => sum + (grid.nearest(p, 0.2)?.d ?? 0.2), 0) / Math.max(1, pts.length);
    const ok = d < 0.012;
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} diz (${s}): kıkırdak/menisküs – kemik ortalama uzaklığı ${(d * 1000).toFixed(1)} mm`);
  }
}
if (failed) {
  console.error(`\n${failed} uyum sorunu (eşik: deri dışında en fazla %${LIMIT * 100}, taşma ${DEPTH * 1000} mm; diz 12 mm).`);
  process.exit(1);
}
console.log('\nUyum denetimi: tamam');
