/**
 * Kapsam raporu verisi: üretilmiş GLB dosyalarındaki düğüm adlarından (yapı|bölüm) her vücut için
 * hangi yapının ve bölümün gerçekten modelde bulunduğunu çıkarır. Uydurma yok: rapor dosyalardan gelir.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const root = new URL('../apps/web/public/models/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as { bodies: Record<string, Record<string, { file: string }>> };

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const out: Record<string, Record<string, string[]>> = {};
for (const [body, assets] of Object.entries(manifest.bodies)) {
  const map: Record<string, Set<string>> = {};
  for (const a of Object.values(assets)) {
    const doc = await io.read(new URL(a.file, root).pathname);
    for (const n of doc.getRoot().listNodes()) {
      if (!n.getMesh()) continue;
      const [structure, part] = n.getName().split('|');
      if (!structure) continue;
      (map[structure] ??= new Set()).add(part ?? '');
    }
  }
  out[body] = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].filter(Boolean).sort()]));
}
const text = `// Otomatik üretildi (assets-pipeline/coverage.ts). Elle düzenlemeyin.
/** Her vücut modelinde gerçekten bulunan yapılar ve bölüm adları (GLB düğümlerinden). */
export const MODEL_COVERAGE: Record<'male' | 'female', Record<string, string[]>> = ${JSON.stringify(out, null, 1)};
`;
writeFileSync(new URL('../apps/web/src/anatomy/coverage.generated.ts', import.meta.url), text);
for (const [b, m] of Object.entries(out)) console.log(b, Object.keys(m).length, 'yapı', Object.values(m).reduce((n, p) => n + p.length, 0), 'bölüm');
