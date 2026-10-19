/// <reference lib="webworker" />
/**
 * Atlas stüdyosu geometrisi — ana iş parçacığını (çizimi) dondurmadan ayrı işçide hesaplanır:
 * köşe birleştirme, hacmi koruyan Taubin yumuşatması, yumuşak normaller, yüzey damarlarının şişirilmesi ve
 * epikard yağı özniteliği (köşenin en yakın kalp yüzeyi damarına uzaklığından). three.js gerekmez.
 */

export interface StudioJob {
  key: string;
  /** Yerel (ağın kendi) koordinatında konumlar. */
  pos: Float32Array;
  index: Uint32Array | null;
  iterations: number;
  /** Normaller boyunca şişirme (yerel birim); 0 = yok. */
  inflate: number;
  fat: { vessels: Float32Array; matrix: number[]; near: number; far: number } | null;
}

export interface StudioResult {
  key: string;
  pos: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  fat: Float32Array | null;
}

function merge(pos: Float32Array, index: Uint32Array | null): { p: Float32Array; idx: Uint32Array } {
  const n = pos.length / 3;
  const map = new Map<string, number>();
  const remap = new Uint32Array(n);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = `${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`;
    let j = map.get(k);
    if (j === undefined) {
      j = out.length / 3;
      map.set(k, j);
      out.push(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
    }
    remap[i] = j;
  }
  const src = index ?? Uint32Array.from({ length: n }, (_, i) => i);
  const idx = new Uint32Array(src.length);
  for (let t = 0; t < src.length; t++) idx[t] = remap[src[t]!]!;
  return { p: Float32Array.from(out), idx };
}

function taubin(p: Float32Array, idx: Uint32Array, iterations: number) {
  const n = p.length / 3;
  if (!iterations) return;
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
      const o = i * 3;
      if (!s.size) {
        tmp[o] = p[o]!;
        tmp[o + 1] = p[o + 1]!;
        tmp[o + 2] = p[o + 2]!;
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
      tmp[o] = p[o]! + k * (x / s.size - p[o]!);
      tmp[o + 1] = p[o + 1]! + k * (y / s.size - p[o + 1]!);
      tmp[o + 2] = p[o + 2]! + k * (z / s.size - p[o + 2]!);
    }
    p.set(tmp);
  };
  for (let it = 0; it < iterations; it++) {
    step(0.5);
    step(-0.53);
  }
}

function normals(p: Float32Array, idx: Uint32Array): Float32Array {
  const nrm = new Float32Array(p.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]! * 3;
    const b = idx[t + 1]! * 3;
    const c = idx[t + 2]! * 3;
    const ux = p[b]! - p[a]!;
    const uy = p[b + 1]! - p[a + 1]!;
    const uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!;
    const vy = p[c + 1]! - p[a + 1]!;
    const vz = p[c + 2]! - p[a + 2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) {
      nrm[o] = nrm[o]! + nx;
      nrm[o + 1] = nrm[o + 1]! + ny;
      nrm[o + 2] = nrm[o + 2]! + nz;
    }
  }
  for (let o = 0; o < nrm.length; o += 3) {
    const l = Math.hypot(nrm[o]!, nrm[o + 1]!, nrm[o + 2]!) || 1;
    nrm[o] = nrm[o]! / l;
    nrm[o + 1] = nrm[o + 1]! / l;
    nrm[o + 2] = nrm[o + 2]! / l;
  }
  return nrm;
}

function fatAttribute(p: Float32Array, job: NonNullable<StudioJob['fat']>): Float32Array {
  const { vessels, matrix: e, near, far } = job;
  const cell = far;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < vessels.length; i += 3) {
    const k = `${Math.floor(vessels[i]! / cell)},${Math.floor(vessels[i + 1]! / cell)},${Math.floor(vessels[i + 2]! / cell)}`;
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(i);
  }
  const n = p.length / 3;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lx = p[i * 3]!;
    const ly = p[i * 3 + 1]!;
    const lz = p[i * 3 + 2]!;
    // Matrix4.elements sütun öncelikli
    const x = e[0]! * lx + e[4]! * ly + e[8]! * lz + e[12]!;
    const y = e[1]! * lx + e[5]! * ly + e[9]! * lz + e[13]!;
    const z = e[2]! * lx + e[6]! * ly + e[10]! * lz + e[14]!;
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
  return out;
}

export function runStudioJob(job: StudioJob): StudioResult {
  const { p, idx } = merge(job.pos, job.index);
  taubin(p, idx, job.iterations);
  let nrm = normals(p, idx);
  if (job.inflate) {
    for (let o = 0; o < p.length; o++) p[o] = p[o]! + nrm[o]! * job.inflate;
    nrm = normals(p, idx);
  }
  return { key: job.key, pos: p, normal: nrm, index: idx, fat: job.fat ? fatAttribute(p, job.fat) : null };
}

// İşçi olarak çalışırken (testte doğrudan içe aktarılabilir)
declare const WorkerGlobalScope: { new (): unknown } | undefined;
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = (e: MessageEvent<StudioJob>) => {
    const r = runStudioJob(e.data);
    const transfer: Transferable[] = [r.pos.buffer, r.normal.buffer, r.index.buffer];
    if (r.fat) transfer.push(r.fat.buffer);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(r, transfer);
  };
}
