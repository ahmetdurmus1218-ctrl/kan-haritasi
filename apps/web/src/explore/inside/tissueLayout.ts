import { Color, Quaternion, Vector3 } from 'three';
import { rng } from './rng';
import type { LayerKind, TissueLayer, TissueProfile } from './tissues';

/**
 * Doku atlası profilini 3B yerleşime çevirir (saf fonksiyon; WebGL gerektirmez, test edilebilir).
 * Blok x ekseni boyunca uzanan bir organ duvarı kesitidir: üstte lümen, aşağı doğru katmanlar.
 * Hücreler her katmanın ön (kesit) bandına ve epitelde tüm üst yüzeye yerleştirilir; katman
 * matrisi yarı saydam bir bloktur. Sayılar ve boyutlar temsilidir.
 */

export const X0 = -4.2;
export const X1 = 4.2;
export const Z0 = -1.8;
export const Z1 = 0.9;
/** Doku bloğunun üst yüzeyi (lümen bunun üstündedir). */
export const TOP = 2.2;
/** Lümen hariç toplam doku yüksekliği. */
export const DEPTH = 5.4;
const LUMEN_MAX = 1.8;
const BAND: [number, number] = [Z1 - 0.85, Z1 - 0.12];
/** Tek bir katmanda izin verilen en fazla hücre örneği (mobil GPU için). */
export const MAX_PER_LAYER = 2600;

/** Ölçek (s) her geometride yarıçap/yarı boy olarak yorumlanır; siller için s.y boydur. */
export type GeoKey = 'blob' | 'sphere' | 'capsule' | 'box' | 'cilium' | 'fiber';
export type AnimKey = 'peristalsis' | 'contract' | 'sway' | 'none';

export interface Placed {
  p: Vector3;
  s: Vector3;
  q?: Quaternion;
  color?: string;
}

export interface CellGroup {
  geo: GeoKey;
  color: string;
  cells: Placed[];
  anim: AnimKey;
  /** Hücre adı (erişilebilirlik ve testler için). */
  label: string;
}

export interface Channel {
  /** Eğri noktaları (damar, sinüzoid, kanal). */
  points: [number, number, number][];
  radius: number;
  kind: 'artery' | 'vein' | 'sinusoid' | 'duct';
}

export interface Flow {
  from: Vector3;
  to: Vector3;
}

export interface PlacedLayer {
  layer: TissueLayer;
  yTop: number;
  yBot: number;
  /** Yarı saydam matris bloğu çizilsin mi (epitelde yalnızca ince bazal zar). */
  slab: 'full' | 'membrane' | 'none';
  groups: CellGroup[];
  channels: Channel[];
  /** Salgı/taşıma yolları (lümene doğru). */
  flows: Flow[];
}

export interface TissueLayout {
  lumen: { yBot: number; yTop: number; layer: TissueLayer } | null;
  layers: PlacedLayer[];
  bottom: number;
}

const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const along = (axis: Vector3) => new Quaternion().setFromUnitVectors(UP, axis.clone().normalize());
const Q_X = along(X_AXIS);
const Q_Z = along(Z_AXIS);

function shade(hex: string, amount: number): string {
  const c = new Color(hex);
  if (amount >= 0) c.lerp(new Color('#ffffff'), amount);
  else c.lerp(new Color('#000000'), -amount);
  return `#${c.getHexString()}`;
}

function randomQ(r: () => number, horizontal = false): Quaternion {
  if (horizontal) {
    const a = r() * Math.PI * 2;
    return along(new Vector3(Math.cos(a), (r() - 0.5) * 0.3, Math.sin(a)));
  }
  return along(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5));
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-6; v += step) out.push(v);
  return out;
}

const EPI: LayerKind[] = ['epi-squamous', 'epi-columnar', 'epi-ciliated', 'epi-transitional', 'epi-cuboidal', 'endothelium'];

export function isEpithelium(kind: LayerKind): boolean {
  return EPI.includes(kind);
}

function muscleAnim(l: TissueLayer): AnimKey {
  return l.motion === 'peristalsis' ? 'peristalsis' : l.motion === 'contract' ? 'contract' : 'none';
}

function place(l: TissueLayer, yTop: number, yBot: number, seed: number, surface: boolean): Omit<PlacedLayer, 'layer' | 'yTop' | 'yBot'> {
  const r = rng(seed);
  const h = yTop - yBot;
  const mid = (yTop + yBot) / 2;
  const groups: CellGroup[] = [];
  const channels: Channel[] = [];
  const flows: Flow[] = [];
  const bandZ = () => BAND[0] + r() * (BAND[1] - BAND[0]);
  const zFull = (step: number) => range(Z0 + step / 2, Z1 - step / 2, step);
  const zBand = (step: number) => range(BAND[0], BAND[1], step);
  // Yüzey epiteli tüm üst yüzeyi kaplar; derindeki epitel yalnızca kesit bandında görünür.
  const epiZ = (step: number) => (surface ? zFull(step) : zBand(step));
  const add = (g: CellGroup) => {
    if (g.cells.length) groups.push(g);
  };
  const vessels = (count: number, kind: Channel['kind'] = 'artery', radius = Math.min(0.11, h * 0.22)) => {
    for (let i = 0; i < count; i++) {
      const y = yBot + h * (0.3 + 0.4 * ((i + 0.5) / count)) + (r() - 0.5) * h * 0.1;
      const z = Z1 - 0.3 - i * 0.35;
      channels.push({
        kind: i % 2 && kind === 'artery' ? 'vein' : kind,
        radius,
        points: range(X0 + 0.1, X1 - 0.1, (X1 - X0 - 0.2) / 6).map((x, k) => [x, y + Math.sin(k * 1.3 + i) * h * 0.12, z + Math.cos(k * 0.9 + i) * 0.12]),
      });
    }
  };

  switch (l.kind) {
    case 'epi-squamous': {
      const rows = 4;
      for (let j = 0; j < rows; j++) {
        const t = j / (rows - 1);
        const y = yBot + (j + 0.5) * (h / rows);
        const topRow = j === rows - 1;
        const step = topRow ? 0.34 : 0.26;
        const cells: Placed[] = [];
        for (const x of range(X0 + 0.15, X1 - 0.15, step))
          for (const z of topRow ? epiZ(step) : zBand(step))
            cells.push({ p: new Vector3(x + (r() - 0.5) * 0.05, y, z + (r() - 0.5) * 0.05), s: new Vector3(0.13 + t * 0.09, Math.max(0.03, (h / rows) * (0.55 - t * 0.35)), 0.13 + t * 0.09) });
        add({ geo: 'blob', color: j === 0 ? shade(l.color, -0.25) : shade(l.color, t * 0.25), cells, anim: 'none', label: j === 0 ? 'Bazal (bölünen) hücreler' : topRow ? 'Yassılaşmış yüzey hücreleri' : 'Ara hücreler' });
      }
      break;
    }
    case 'epi-columnar':
    case 'epi-ciliated': {
      const step = 0.2;
      const cols: Placed[] = [];
      const goblets: Placed[] = [];
      const cilia: Placed[] = [];
      const hh = Math.max(0.12, h * 0.42);
      for (const x of range(X0 + 0.12, X1 - 0.12, step))
        for (const z of epiZ(step)) {
          const goblet = l.goblet && r() < 0.18;
          const p = new Vector3(x, yBot + h * 0.48, z);
          if (goblet) goblets.push({ p, s: new Vector3(0.13, hh, 0.13) });
          else cols.push({ p, s: new Vector3(0.09, hh, 0.09) });
          if (l.kind === 'epi-ciliated' && !goblet)
            for (let k = 0; k < 3; k++) cilia.push({ p: new Vector3(x + (k - 1) * 0.045, yTop - h * 0.02, z + (r() - 0.5) * 0.06), s: new Vector3(1, Math.min(0.28, h * 0.4), 1) });
        }
      add({ geo: 'capsule', color: l.color, cells: cols, anim: 'none', label: l.kind === 'epi-ciliated' ? 'Silli hücreler' : 'Silindirik hücreler' });
      add({ geo: 'capsule', color: '#eef2fb', cells: goblets, anim: 'none', label: 'Goblet (mukus) hücreleri' });
      add({ geo: 'cilium', color: shade(l.color, 0.45), cells: cilia, anim: l.motion === 'cilia' ? 'sway' : 'none', label: 'Siller' });
      if (l.motion === 'secretion') for (const g of (goblets.length ? goblets : cols).slice(0, 40)) flows.push({ from: g.p.clone().setY(yTop), to: g.p.clone().add(new Vector3((r() - 0.3) * 0.8, 0.5 + r() * 0.8, (r() - 0.5) * 0.4)) });
      break;
    }
    case 'epi-transitional': {
      const base: Placed[] = [];
      for (let j = 0; j < 2; j++)
        for (const x of range(X0 + 0.15, X1 - 0.15, 0.24)) for (const z of zBand(0.24)) base.push({ p: new Vector3(x, yBot + (j + 0.5) * h * 0.28, z), s: new Vector3(0.12, 0.11, 0.12) });
      const umbrella: Placed[] = [];
      for (const x of range(X0 + 0.3, X1 - 0.3, 0.52)) for (const z of epiZ(0.52)) umbrella.push({ p: new Vector3(x, yTop - h * 0.2, z), s: new Vector3(0.28, Math.min(0.2, h * 0.22), 0.28) });
      add({ geo: 'blob', color: shade(l.color, -0.2), cells: base, anim: 'none', label: 'Bazal ve ara hücreler' });
      add({ geo: 'blob', color: shade(l.color, 0.2), cells: umbrella, anim: 'none', label: 'Şemsiye hücreleri' });
      break;
    }
    case 'epi-cuboidal': {
      const rows = Math.max(1, Math.min(3, Math.round(h / 0.3)));
      const cells: Placed[] = [];
      for (let j = 0; j < rows; j++)
        for (const x of range(X0 + 0.12, X1 - 0.12, 0.2)) for (const z of j === rows - 1 ? epiZ(0.2) : zBand(0.2)) cells.push({ p: new Vector3(x, yBot + (j + 0.5) * (h / rows), z), s: new Vector3(0.09, Math.min(0.09, (h / rows) * 0.42), 0.09) });
      add({ geo: 'box', color: l.color, cells, anim: 'none', label: 'Küboidal hücreler' });
      if (l.motion === 'secretion') for (const c of cells.slice(-30)) flows.push({ from: c.p.clone().setY(yTop), to: c.p.clone().add(new Vector3(r() - 0.5, 0.6 + r() * 0.6, (r() - 0.5) * 0.4)) });
      break;
    }
    case 'endothelium': {
      const cells: Placed[] = [];
      for (const x of range(X0 + 0.2, X1 - 0.2, 0.36)) for (const z of epiZ(0.24)) cells.push({ p: new Vector3(x + (r() - 0.5) * 0.1, mid, z), s: new Vector3(0.2, Math.max(0.025, h * 0.25), 0.12), q: randomQ(r, false).slerp(new Quaternion(), 0.92) });
      add({ geo: 'blob', color: l.color, cells, anim: 'none', label: 'Endotel hücreleri' });
      break;
    }
    case 'smooth-muscle': {
      const cells: Placed[] = [];
      const arr = l.arrangement ?? 'circular';
      const rowStep = 0.13;
      const rows = range(yBot + rowStep * 0.6, yTop - rowStep * 0.6, rowStep);
      if (arr === 'longitudinal') {
        for (const y of rows) for (const z of zBand(0.15)) for (const x of range(X0 + 0.35, X1 - 0.35, 0.62)) cells.push({ p: new Vector3(x + (r() - 0.5) * 0.3, y, z), s: new Vector3(0.055, 0.3, 0.055), q: Q_X });
      } else if (arr === 'circular') {
        for (const y of rows) for (const x of range(X0 + 0.1, X1 - 0.1, 0.13)) for (const z of [BAND[0] + 0.25, BAND[1] - 0.15]) cells.push({ p: new Vector3(x, y + (r() - 0.5) * 0.03, z + (r() - 0.5) * 0.1), s: new Vector3(0.055, 0.28, 0.055), q: Q_Z });
      } else {
        for (const y of rows) for (const x of range(X0 + 0.2, X1 - 0.2, 0.3)) cells.push({ p: new Vector3(x + (r() - 0.5) * 0.15, y, bandZ()), s: new Vector3(0.055, 0.26, 0.055), q: randomQ(r, true) });
      }
      add({ geo: 'capsule', color: l.color, cells: cells.slice(0, MAX_PER_LAYER), anim: muscleAnim(l), label: 'Düz kas hücreleri' });
      break;
    }
    case 'connective':
    case 'capsule':
    case 'serosa': {
      const dense = l.kind === 'capsule';
      const fibers: Placed[] = [];
      const n = Math.round((X1 - X0) * h * (dense ? 26 : 12));
      for (let i = 0; i < n; i++)
        fibers.push({ p: new Vector3(X0 + 0.2 + r() * (X1 - X0 - 0.4), yBot + 0.04 + r() * (h - 0.08), bandZ()), s: new Vector3(0.018, dense ? 0.45 : 0.2 + r() * 0.25, 0.018), q: dense ? Q_X.clone().slerp(randomQ(r, true), 0.12) : randomQ(r, true) });
      add({ geo: 'fiber', color: shade(l.color, 0.3), cells: fibers, anim: 'none', label: 'Kolajen lifleri' });
      const blasts: Placed[] = [];
      for (let i = 0; i < n / 4; i++) blasts.push({ p: new Vector3(X0 + 0.2 + r() * (X1 - X0 - 0.4), yBot + 0.05 + r() * (h - 0.1), bandZ()), s: new Vector3(0.04, 0.11, 0.04), q: randomQ(r, true) });
      add({ geo: 'capsule', color: shade(l.color, -0.35), cells: blasts, anim: 'none', label: 'Fibroblastlar' });
      if (l.kind === 'serosa') {
        const meso: Placed[] = [];
        for (const x of range(X0 + 0.2, X1 - 0.2, 0.34)) for (const z of zBand(0.3)) meso.push({ p: new Vector3(x, yBot + 0.02, z), s: new Vector3(0.16, 0.025, 0.14) });
        add({ geo: 'blob', color: shade(l.color, 0.15), cells: meso, anim: 'none', label: 'Mezotel hücreleri' });
      }
      if (!dense && l.kind === 'connective') {
        const immune: Placed[] = [];
        for (let i = 0; i < n / 10; i++) immune.push({ p: new Vector3(X0 + 0.2 + r() * (X1 - X0 - 0.4), yBot + 0.05 + r() * (h - 0.1), bandZ()), s: new Vector3(0.05, 0.05, 0.05) });
        add({ geo: 'sphere', color: '#6a58c8', cells: immune, anim: 'none', label: 'Bağışıklık hücreleri' });
      }
      if (l.vessels) vessels(h > 0.45 ? 2 : 1);
      break;
    }
    case 'glands': {
      const acini: Placed[] = [];
      const rows = Math.max(1, Math.min(3, Math.floor(h / 0.7)));
      const cy = range(0, rows - 1, 1).map((j) => yBot + (j + 0.5) * (h / rows));
      for (const y of cy)
        for (const x of range(X0 + 0.45, X1 - 0.45, 0.85))
          for (const z of [BAND[0] + 0.2, BAND[1] - 0.25]) {
            const c = new Vector3(x + (r() - 0.5) * 0.2, y + (r() - 0.5) * 0.1, z);
            const rad = Math.min(0.3, (h / rows) * 0.38);
            const n = 12;
            const g = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < n; i++) {
              const yy = 1 - (i / (n - 1)) * 2;
              const rr = Math.sqrt(1 - yy * yy);
              const d = new Vector3(Math.cos(g * i) * rr, yy, Math.sin(g * i) * rr);
              acini.push({ p: c.clone().addScaledVector(d, rad), s: new Vector3(rad * 0.42, rad * 0.42, rad * 0.42) });
            }
            if (z > BAND[1] - 0.3) channels.push({ kind: 'duct', radius: 0.035, points: [[c.x, c.y, c.z], [c.x + 0.1, (c.y + yTop) / 2, c.z], [c.x, yTop, c.z]] });
            if (l.motion === 'secretion') flows.push({ from: c.clone(), to: new Vector3(c.x + (r() - 0.5) * 0.3, TOP + 0.3 + r() * 0.6, c.z) });
          }
      add({ geo: 'blob', color: l.color, cells: acini.slice(0, MAX_PER_LAYER), anim: 'none', label: l.goblet ? 'Mukus bezi hücreleri' : 'Salgı (asinus) hücreleri' });
      if (l.vessels) vessels(1);
      break;
    }
    case 'crypts': {
      const absorb: Placed[] = [];
      const goblet: Placed[] = [];
      const stem: Placed[] = [];
      const surfaceCells: Placed[] = [];
      const xs = range(X0 + 0.5, X1 - 0.5, 0.8);
      const zs = [Z1 - 0.35, Z1 - 1.15, Z1 - 1.95];
      const ring = 0.2;
      const depth = h * 0.9;
      for (const cx of xs)
        for (const cz of zs) {
          const front = cz === zs[0];
          for (let k = 0, y = yTop - 0.08; y > yTop - depth; k++, y -= 0.17)
            for (let j = 0; j < 7; j++) {
              const a = (j / 7) * Math.PI * 2 + k * 0.4;
              const nrm = new Vector3(Math.cos(a), 0, Math.sin(a));
              if (front && nrm.z > 0.3) continue;
              const p = new Vector3(cx, y, cz).addScaledVector(nrm, ring);
              const bottom = y < yTop - depth + 0.2;
              const s = new Vector3(0.09, 0.08, 0.09);
              if (bottom) stem.push({ p, s });
              else if (l.goblet && r() < 0.4) goblet.push({ p, s: s.clone().multiplyScalar(1.2) });
              else absorb.push({ p, s });
            }
          if (l.motion === 'secretion') flows.push({ from: new Vector3(cx, yTop - depth * 0.6, cz), to: new Vector3(cx + (r() - 0.5) * 0.6, TOP + 0.4 + r() * 0.6, cz) });
        }
      for (const x of range(X0 + 0.12, X1 - 0.12, 0.24))
        for (const z of zFull(0.24)) {
          if (xs.some((cx) => zs.some((cz) => Math.hypot(cx - x, cz - z) < ring + 0.12))) continue;
          surfaceCells.push({ p: new Vector3(x, yTop - 0.06, z), s: new Vector3(0.11, 0.07, 0.11) });
        }
      add({ geo: 'blob', color: l.color, cells: absorb, anim: 'none', label: 'Emici hücreler' });
      add({ geo: 'blob', color: '#eef2fb', cells: goblet, anim: 'none', label: 'Goblet (mukus) hücreleri' });
      add({ geo: 'blob', color: '#7a5ad0', cells: stem, anim: 'none', label: 'Kök hücreler (kript dibi)' });
      add({ geo: 'box', color: shade(l.color, 0.12), cells: surfaceCells, anim: 'none', label: 'Yüzey epiteli' });
      break;
    }
    case 'lymphoid': {
      const small: Placed[] = [];
      const centers: Placed[] = [];
      const follicles = range(X0 + 0.9, X1 - 0.9, 1.7).map((x) => new Vector3(x + (r() - 0.5) * 0.3, mid, BAND[0] + 0.45));
      const rad = Math.min(0.55, h * 0.4);
      for (let i = 0; i < Math.min(MAX_PER_LAYER, Math.round((X1 - X0) * h * 90)); i++) {
        const p = new Vector3(X0 + 0.1 + r() * (X1 - X0 - 0.2), yBot + 0.05 + r() * (h - 0.1), bandZ());
        const f = follicles.find((c) => c.distanceTo(p) < rad);
        if (f && f.distanceTo(p) < rad * 0.55) centers.push({ p, s: new Vector3(0.06, 0.06, 0.06) });
        else small.push({ p, s: new Vector3(0.045, 0.045, 0.045) });
      }
      add({ geo: 'sphere', color: l.color, cells: small, anim: 'none', label: 'Lenfositler' });
      add({ geo: 'sphere', color: shade(l.color, 0.4), cells: centers, anim: 'none', label: 'Germinal merkez (çoğalan B hücreleri)' });
      if (l.vessels) vessels(1);
      break;
    }
    case 'cartilage': {
      const cells: Placed[] = [];
      const arr = l.arrangement ?? 'clusters';
      for (const x of range(X0 + 0.3, X1 - 0.3, arr === 'columns' ? 0.38 : 0.55))
        for (const y of range(yBot + 0.15, yTop - 0.15, arr === 'columns' ? 0.14 : 0.4)) {
          const z = bandZ();
          if (arr === 'flat') cells.push({ p: new Vector3(x + (r() - 0.5) * 0.2, y, z), s: new Vector3(0.14, 0.04, 0.1) });
          else if (arr === 'columns') cells.push({ p: new Vector3(x, y, BAND[1] - 0.2), s: new Vector3(0.1, 0.05, 0.1) });
          else for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) cells.push({ p: new Vector3(x + (k - n / 2) * 0.1, y + (r() - 0.5) * 0.06, z), s: new Vector3(0.06, 0.05, 0.06) });
        }
      add({ geo: 'blob', color: shade(l.color, -0.45), cells, anim: 'none', label: 'Kondrositler (lakünlerde)' });
      break;
    }
    case 'bone': {
      const cells: Placed[] = [];
      for (let i = 0; i < Math.round((X1 - X0) * h * 14); i++) cells.push({ p: new Vector3(X0 + 0.2 + r() * (X1 - X0 - 0.4), yBot + 0.05 + r() * (h - 0.1), bandZ()), s: new Vector3(0.07, 0.03, 0.04), q: randomQ(r, true) });
      add({ geo: 'blob', color: shade(l.color, -0.5), cells, anim: 'none', label: 'Osteositler' });
      break;
    }
    case 'fat': {
      const cells: Placed[] = [];
      for (const x of range(X0 + 0.3, X1 - 0.3, 0.5)) for (const y of range(yBot + 0.25, yTop - 0.2, 0.46)) cells.push({ p: new Vector3(x + (r() - 0.5) * 0.1, y, BAND[1] - 0.25), s: new Vector3(0.24, 0.22, 0.24) });
      add({ geo: 'blob', color: l.color, cells, anim: 'none', label: 'Yağ hücreleri' });
      break;
    }
    case 'cords': {
      const cells: Placed[] = [];
      const arr = l.arrangement ?? 'clusters';
      if (arr === 'columns') {
        const xs = range(X0 + 0.3, X1 - 0.3, 0.5);
        for (const x of xs) for (const y of range(yBot + 0.1, yTop - 0.1, 0.16)) for (const z of [BAND[1] - 0.2, BAND[0] + 0.3]) cells.push({ p: new Vector3(x, y, z), s: new Vector3(0.14, 0.13, 0.14) });
        xs.slice(0, -1).forEach((x, i) => {
          if (i % 2 === 0) channels.push({ kind: 'sinusoid', radius: 0.06, points: [[x + 0.25, yBot, BAND[1] - 0.2], [x + 0.27, mid, BAND[1] - 0.22], [x + 0.25, yTop, BAND[1] - 0.2]] });
        });
      } else {
        for (const x of range(X0 + 0.4, X1 - 0.4, 0.75))
          for (const y of range(yBot + 0.25, yTop - 0.25, 0.55)) {
            const c = new Vector3(x + (r() - 0.5) * 0.2, y, BAND[1] - 0.3);
            for (let k = 0; k < 7; k++) cells.push({ p: c.clone().add(new Vector3((r() - 0.5) * 0.36, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3)), s: new Vector3(0.1, 0.1, 0.1), color: r() < 0.25 ? shade(l.color, 0.3) : r() < 0.3 ? shade(l.color, -0.3) : undefined });
          }
        vessels(2, 'sinusoid', 0.06);
      }
      add({ geo: 'blob', color: l.color, cells: cells.slice(0, MAX_PER_LAYER), anim: 'none', label: 'Salgı hücresi kordonları' });
      break;
    }
    case 'sinusoids': {
      const macro: Placed[] = [];
      for (let i = 0; i < 40; i++) macro.push({ p: new Vector3(X0 + 0.3 + r() * (X1 - X0 - 0.6), yBot + 0.1 + r() * (h - 0.2), bandZ()), s: new Vector3(0.1, 0.08, 0.1) });
      add({ geo: 'blob', color: '#c8a0e0', cells: macro, anim: 'none', label: 'Makrofajlar' });
      const rows = Math.max(2, Math.min(4, Math.round(h / 0.4)));
      for (let i = 0; i < rows; i++) {
        const y = yBot + (i + 0.5) * (h / rows);
        const z = i % 2 ? BAND[0] + 0.3 : BAND[1] - 0.2;
        channels.push({ kind: 'sinusoid', radius: Math.min(0.15, (h / rows) * 0.35), points: range(X0 + 0.1, X1 - 0.1, (X1 - X0 - 0.2) / 5).map((x, k) => [x, y + Math.sin(k * 1.7 + i) * 0.08, z + Math.cos(k + i) * 0.1]) });
      }
      break;
    }
    case 'neural': {
      const glia: Placed[] = [];
      for (let i = 0; i < Math.round((X1 - X0) * h * 12); i++) glia.push({ p: new Vector3(X0 + 0.2 + r() * (X1 - X0 - 0.4), yBot + 0.08 + r() * (h - 0.16), bandZ()), s: new Vector3(0.08, 0.08, 0.08) });
      add({ geo: 'blob', color: l.color, cells: glia, anim: 'none', label: 'Sinir/salgı hücresi gövdeleri' });
      for (let i = 0; i < 8; i++) {
        const y = yBot + 0.1 + r() * (h - 0.2);
        const z = bandZ();
        channels.push({ kind: 'duct', radius: 0.018, points: range(0, 4, 1).map((k) => [X0 + 0.3 + i + k * 0.45, y + (r() - 0.5) * 0.3, z + (r() - 0.5) * 0.2] as [number, number, number]) });
      }
      break;
    }
    case 'dense-cells': {
      const cells: Placed[] = [];
      for (const x of range(X0 + 0.12, X1 - 0.12, 0.2)) for (const y of range(yBot + 0.1, yTop - 0.1, 0.2)) for (const z of [BAND[1] - 0.12, BAND[0] + 0.4]) cells.push({ p: new Vector3(x + (r() - 0.5) * 0.04, y, z), s: new Vector3(0.09, 0.09, 0.09), color: r() < 0.2 ? shade(l.color, 0.25) : undefined });
      add({ geo: 'blob', color: l.color, cells: cells.slice(0, MAX_PER_LAYER), anim: 'none', label: 'Hücreler' });
      break;
    }
    case 'lumen':
      break;
  }
  const slab: PlacedLayer['slab'] = l.kind === 'lumen' ? 'none' : isEpithelium(l.kind) ? 'membrane' : 'full';
  return { slab, groups, channels, flows };
}

export function layoutTissue(t: TissueProfile): TissueLayout {
  const lumenLayer = t.layers.find((l) => l.kind === 'lumen') ?? null;
  const tissue = t.layers.filter((l) => l.kind !== 'lumen');
  const total = tissue.reduce((s, l) => s + l.thickness, 0);
  const k = DEPTH / Math.max(0.001, total);
  let y = TOP;
  const layers: PlacedLayer[] = tissue.map((l, i) => {
    const yTop = y;
    const yBot = y - l.thickness * k;
    y = yBot;
    return { layer: l, yTop, yBot, ...place(l, yTop, yBot, 17 + i * 101 + t.id.length * 7, i === 0) };
  });
  const lumen = lumenLayer ? { layer: lumenLayer, yBot: TOP, yTop: TOP + Math.min(LUMEN_MAX, lumenLayer.thickness * k) } : null;
  return { lumen, layers, bottom: y };
}

/** Kameranın bir katmana odaklanması (hedef, konum). */
export function layerShot(layout: TissueLayout, key: string | null | undefined, shift = 1): { position: [number, number, number]; target: [number, number, number] } | null {
  if (!key) return null;
  if (layout.lumen && layout.lumen.layer.key === key) {
    const y = (layout.lumen.yTop + layout.lumen.yBot) / 2;
    return { position: [2.5 + shift, y + 1.6, Z1 + 4.2], target: [shift, y, -0.3] };
  }
  const l = layout.layers.find((p) => p.layer.key === key);
  if (!l) return null;
  const y = (l.yTop + l.yBot) / 2;
  const h = l.yTop - l.yBot;
  const d = Math.max(2.6, Math.min(4.8, 2.2 + h * 1.6));
  return { position: [1.5 + shift, y + 0.6 + h * 0.3, Z1 + d], target: [shift, y, Z1 - 0.5] };
}

/** `shift`: hedefin x kayması (masaüstünde sağ panel bloğun sağını örter). */
export function overviewShot(layout: TissueLayout, shift = 1.6): { position: [number, number, number]; target: [number, number, number] } {
  const top = layout.lumen?.yTop ?? TOP;
  const mid = (top + layout.bottom) / 2;
  return { position: [5.8 + shift, mid + 4.2, Z1 + 12.5], target: [shift, mid + 0.2, -0.4] };
}
