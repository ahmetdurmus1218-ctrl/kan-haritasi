import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Atlas yüzeylerini yakın plana hazırlar. HRA ağları sadeleştirilmiş ve nicemlenmiştir; yakından köşeli
 * görünürler. Burada (1) nicemlenmiş konumlar dünya koordinatına (metre) açılır, (2) aynı konumdaki köşeler
 * birleştirilir, (3) hacmi küçültmeyen Taubin yumuşatması uygulanır (λ/μ adımları; şekil ve oran korunur),
 * (4) yumuşak normaller hesaplanır. Sonuç dünya koordinatındadır (birim matrisle çizilir).
 */
export function smoothWorldGeometry(src: BufferGeometry, matrix: Matrix4, iterations = 6): BufferGeometry {
  const pos = src.attributes.position!;
  const flat = new Float32Array(pos.count * 3);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    flat[i * 3] = v.x;
    flat[i * 3 + 1] = v.y;
    flat[i * 3 + 2] = v.z;
  }
  const g0 = new BufferGeometry();
  g0.setAttribute('position', new BufferAttribute(flat, 3));
  if (src.index) g0.setIndex(Array.from(src.index.array));
  const g = mergeVertices(g0, 1e-6);
  g0.dispose();
  const p = g.attributes.position!.array as Float32Array;
  const idx = g.index!.array;
  const n = p.length / 3;
  // Komşuluk (kenarlar)
  const nb: Array<Set<number>> = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]!;
    const b = idx[t + 1]!;
    const c = idx[t + 2]!;
    nb[a]!.add(b).add(c);
    nb[b]!.add(a).add(c);
    nb[c]!.add(a).add(b);
  }
  const tmp = new Float32Array(p.length);
  const step = (k: number) => {
    for (let i = 0; i < n; i++) {
      const s = nb[i]!;
      if (!s.size) {
        tmp[i * 3] = p[i * 3]!;
        tmp[i * 3 + 1] = p[i * 3 + 1]!;
        tmp[i * 3 + 2] = p[i * 3 + 2]!;
        continue;
      }
      let x = 0;
      let y = 0;
      let z = 0;
      for (const j of s) {
        x += p[j * 3]!;
        y += p[j * 3 + 1]!;
        z += p[j * 3 + 2]!;
      }
      x = x / s.size - p[i * 3]!;
      y = y / s.size - p[i * 3 + 1]!;
      z = z / s.size - p[i * 3 + 2]!;
      tmp[i * 3] = p[i * 3]! + k * x;
      tmp[i * 3 + 1] = p[i * 3 + 1]! + k * y;
      tmp[i * 3 + 2] = p[i * 3 + 2]! + k * z;
    }
    p.set(tmp);
  };
  for (let it = 0; it < iterations; it++) {
    step(0.5);
    step(-0.53);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Epikard yağı özniteliği ("khFat", 0–1): köşenin en yakın damar (koroner arter / kalp veni) noktasına
 * uzaklığından. Gerçek kalpte yağ, koroner damarların geçtiği oluklarda (atriyoventriküler ve
 * interventriküler oluk) toplanır. `near` içindeyse 1, `far` ötesinde 0 (metre).
 */
export function addFatAttribute(g: BufferGeometry, vessels: Float32Array, near = 0.004, far = 0.013) {
  const cell = far;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < vessels.length; i += 3) {
    const k = key(vessels[i]!, vessels[i + 1]!, vessels[i + 2]!);
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(i);
  }
  const p = g.attributes.position!;
  const out = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const l = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!l) continue;
          for (const j of l) {
            const d = (vessels[j]! - x) ** 2 + (vessels[j + 1]! - y) ** 2 + (vessels[j + 2]! - z) ** 2;
            if (d < best) best = d;
          }
        }
    const d = Math.sqrt(best);
    out[i] = d <= near ? 1 : d >= far ? 0 : 1 - (d - near) / (far - near);
  }
  g.setAttribute('khFat', new BufferAttribute(out, 1));
}

/** Parçaların köşeleri dünya koordinatında, düz dizi olarak (yakınlık hesapları için). */
export function worldPoints(parts: Array<{ geometry: BufferGeometry; matrix: Matrix4 }>): Float32Array {
  const total = parts.reduce((a, p) => a + p.geometry.attributes.position!.count, 0);
  const out = new Float32Array(total * 3);
  const v = new Vector3();
  let o = 0;
  for (const p of parts) {
    const pos = p.geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(p.matrix);
      out[o++] = v.x;
      out[o++] = v.y;
      out[o++] = v.z;
    }
  }
  return out;
}
