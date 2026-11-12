/**
 * Pürüzsüz yüzey normalleri. gltf-transform `normals()` köşeleri ayırıp düz (köşeli) normal üretir;
 * organlar ve kemikler bu yüzden poligon poligon görünüyordu. Burada önce yalnız konum bırakılır
 * (kaynak normalleri ve doku koordinatları kullanılmıyor; aynı konumdaki köşeler birleşebilsin),
 * köşeler kaynaştırılır ve alan ağırlıklı, köşe başına pürüzsüz normal hesaplanır.
 */
import type { Document } from '@gltf-transform/core';
import { weld } from '@gltf-transform/functions';

/** Konum dışındaki köşe niteliklerini siler (normal, UV, renk, teğet). */
export function positionsOnly(doc: Document) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics()) if (sem !== 'POSITION') prim.setAttribute(sem, null);
}

export function smoothNormals(doc: Document) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (!pos || !idx) continue;
      const raw = pos.getArray()!;
      const P = raw instanceof Float32Array ? raw : Float32Array.from(raw as ArrayLike<number>);
      const I = idx.getArray()!;
      const N = new Float32Array(P.length);
      for (let f = 0; f < I.length; f += 3) {
        const a = I[f]! * 3, b = I[f + 1]! * 3, c = I[f + 2]! * 3;
        const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!;
        const vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const k of [a, b, c]) {
          N[k] += nx;
          N[k + 1] += ny;
          N[k + 2] += nz;
        }
      }
      for (let i = 0; i < N.length; i += 3) {
        const l = Math.hypot(N[i]!, N[i + 1]!, N[i + 2]!) || 1;
        N[i] /= l;
        N[i + 1] /= l;
        N[i + 2] /= l;
      }
      prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(pos.getBuffer()));
    }
}

/** Yalnız konum bırak, kaynaştır, pürüzsüz normal üret. */
export async function weldSmooth(doc: Document) {
  positionsOnly(doc);
  await doc.transform(weld({}));
  smoothNormals(doc);
}
