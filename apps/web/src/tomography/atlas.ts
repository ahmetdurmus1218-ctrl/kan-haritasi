/**
 * Gerçek BT atlası ("tomografi görünümü") çekirdeği — saf TypeScript (test edilebilir).
 *
 * Veri: tek bir gerçek, anonim, kontrastlı göğüs–karın–pelvis BT taraması (CC BY 4.0) ve uygulamayla gelen
 * TotalSegmentator modelinin bu taramadaki organ etiketleri (scripts/atlas/build_ct_atlas.py). 1,5 mm izotropik,
 * RAS ekseninde, x en hızlı. Yoğunluk 8 bite parçalı doğrusal HU eşlemesiyle saklanır.
 *
 * Bu atlas kullanıcının vücudu DEĞİLDİR ve tanı/karşılaştırma için kullanılmaz; normal anatominin gerçek BT
 * yoğunluklarıyla nasıl göründüğünü gösterir. Kullanıcının kendi BT/MR serisi ayrı ve "Senin görüntünden"
 * etiketiyle gösterilir.
 */

export interface AtlasLabel {
  id: number;
  key: string;
  finding: string;
  structure?: string;
  node?: string;
  ml: number;
}

export interface AtlasManifest {
  schema: 'kh-ct-atlas/1';
  id: string;
  name: string;
  shape: [number, number, number];
  spacing: number;
  origin: [number, number, number];
  huMap: Array<[number, number]>;
  files: Record<'volume.bin' | 'labels.bin', { bytes: number; raw: number; sha256: string; rawSha256: string }>;
  labels: AtlasLabel[];
  segmentation: string;
  source: string;
  doi: string;
  license: string;
  attribution: string;
  notes: string[];
}

export interface Atlas {
  manifest: AtlasManifest;
  volume: Uint8Array;
  labels: Uint8Array;
}

/* ------------------------------------------------------------------ HU eşlemesi */

/** 8 bit değer → HU (parçalı doğrusal eşlemenin tersi). */
export function u8ToHu(v: number, map: AtlasManifest['huMap']): number {
  for (let i = 1; i < map.length; i++) {
    const [h0, v0] = map[i - 1]!;
    const [h1, v1] = map[i]!;
    if (v <= v1) return h0 + ((v - v0) / Math.max(1e-6, v1 - v0)) * (h1 - h0);
  }
  return map[map.length - 1]![0];
}

/** HU → 8 bit (eşleme). */
export function huToU8(hu: number, map: AtlasManifest['huMap']): number {
  if (hu <= map[0]![0]) return map[0]![1];
  for (let i = 1; i < map.length; i++) {
    const [h0, v0] = map[i - 1]!;
    const [h1, v1] = map[i]!;
    if (hu <= h1) return Math.round(v0 + ((hu - h0) / (h1 - h0)) * (v1 - v0));
  }
  return map[map.length - 1]![1];
}

/* ------------------------------------------------------------------ yapı kategorileri */

export type AtlasGroup = 'heart' | 'vessels' | 'bones' | 'lungs' | 'digestive' | 'urinary' | 'muscles' | 'glands' | 'nervous' | 'other';

export const GROUP_TR: Record<AtlasGroup, string> = {
  heart: 'Kalp',
  vessels: 'Damarlar',
  bones: 'Kemikler',
  lungs: 'Akciğerler ve hava yolu',
  digestive: 'Sindirim organları',
  urinary: 'Böbrek ve idrar yolu',
  muscles: 'Kaslar',
  glands: 'Bezler',
  nervous: 'Sinir sistemi',
  other: 'Diğer',
};

/** Grup renkleri (organlar önayarında ve etiket boyamada). */
export const GROUP_COLOR: Record<AtlasGroup, [number, number, number]> = {
  heart: [0.86, 0.16, 0.18],
  vessels: [0.93, 0.27, 0.22],
  bones: [0.95, 0.91, 0.82],
  lungs: [0.55, 0.72, 0.95],
  digestive: [0.86, 0.6, 0.42],
  urinary: [0.85, 0.75, 0.3],
  muscles: [0.7, 0.32, 0.3],
  glands: [0.78, 0.55, 0.85],
  nervous: [0.95, 0.85, 0.6],
  other: [0.7, 0.7, 0.7],
};

export function groupOf(key: string): AtlasGroup {
  if (/^heart|atrial_appendage/.test(key)) return 'heart';
  if (/aorta|artery|vein|vena|trunk|portal|pulmonary/.test(key)) return 'vessels';
  if (/vertebra|rib_|sternum|costal|clavicula|scapula|humerus|hip_|sacrum|femur|skull/.test(key)) return 'bones';
  if (/lung|trachea/.test(key)) return 'lungs';
  if (/liver|stomach|esophagus|bowel|duodenum|colon|pancreas|gallbladder|spleen/.test(key)) return key === 'spleen' ? 'other' : 'digestive';
  if (/kidney|bladder|prostate/.test(key)) return 'urinary';
  if (/gluteus|iliopsoas|autochthon/.test(key)) return 'muscles';
  if (/thyroid|adrenal/.test(key)) return 'glands';
  if (/brain|spinal/.test(key)) return 'nervous';
  return 'other';
}

/** Etiketlerin birden çok parçasını (ör. 24 omur, 24 kaburga) tek seçimde toplayan aile adı. */
export function familyOf(l: Pick<AtlasLabel, 'key' | 'finding'>): string {
  if (/^vertebrae_/.test(l.key)) return 'Omurlar';
  if (/^rib_/.test(l.key)) return 'Kaburgalar';
  if (/^lung_/.test(l.key)) return 'Akciğerler';
  if (/^kidney_(left|right)$/.test(l.key)) return 'Böbrekler';
  if (/^adrenal/.test(l.key)) return 'Böbreküstü bezleri';
  if (/^gluteus/.test(l.key)) return 'Kalça kasları';
  if (/^iliopsoas/.test(l.key)) return 'İliopsoas kasları';
  if (/^autochthon/.test(l.key)) return 'Sırt kasları';
  if (/^(hip|femur|humerus|scapula|clavicula)_/.test(l.key)) return l.finding.replace(/^(Sağ|Sol) /, '').replace(/^./, (c) => c.toLocaleUpperCase('tr'));
  if (/_(left|right)$/.test(l.key)) return l.finding.replace(/^(Sağ|Sol) /, '').replace(/^./, (c) => c.toLocaleUpperCase('tr'));
  return l.finding;
}

export interface AtlasFamily {
  name: string;
  group: AtlasGroup;
  ids: number[];
  structure?: string;
  node?: string;
  ml: number;
}

/** Seçim listesi: aileler (gruplara göre, hacmi büyükten küçüğe). */
export function families(labels: readonly AtlasLabel[]): AtlasFamily[] {
  const m = new Map<string, AtlasFamily>();
  for (const l of labels) {
    const name = familyOf(l);
    const f = m.get(name) ?? { name, group: groupOf(l.key), ids: [], ml: 0, ...(l.structure ? { structure: l.structure } : {}), ...(l.node ? { node: l.node } : {}) };
    f.ids.push(l.id);
    f.ml += l.ml;
    m.set(name, f);
  }
  return [...m.values()].sort((a, b) => b.ml - a.ml);
}

/* ------------------------------------------------------------------ aktarım fonksiyonları (önayarlar) */

export type PresetId = 'cinematic' | 'organs' | 'bones' | 'lungs' | 'mip' | 'grey';

/** HU kontrol noktası: [HU, r, g, b, opaklık]. Aradaki değerler doğrusal. */
type Stop = [number, number, number, number, number];

export interface Preset {
  id: PresetId;
  name: string;
  text: string;
  stops: Stop[];
  /** Etiket renginin aktarım rengine karışma oranı (0 = yalnızca yoğunluk rengi). */
  labelMix: number;
  /** Bu gruplar gizlenir (opaklık 0). */
  hide?: AtlasGroup[];
  mode: 'composite' | 'mip';
  /** MIP penceresi (HU). */
  mip?: [number, number];
}

export const PRESETS: Preset[] = [
  {
    id: 'cinematic',
    name: 'Sinematik (BT anjiyo)',
    text: 'Kalp boşlukları ve damarlar kontrast maddeyle parlak; kemikler fildişi, organlar yarı saydam. Kalp tomografisi gibi.',
    stops: [
      [-1024, 0, 0, 0, 0],
      [-40, 0, 0, 0, 0],
      [20, 0.62, 0.28, 0.24, 0.004],
      [90, 0.78, 0.38, 0.32, 0.02],
      [150, 0.9, 0.3, 0.24, 0.2],
      [320, 0.98, 0.42, 0.3, 0.6],
      [700, 0.97, 0.93, 0.85, 0.85],
      [1500, 1, 0.98, 0.94, 0.95],
    ],
    labelMix: 0.45,
    mode: 'composite',
  },
  {
    id: 'organs',
    name: 'Organlar',
    text: 'Her organ kendi renginde (etiketler uygulamayla gelen bölütleme modelinden); yağ ve hava saydam.',
    stops: [
      [-1024, 0, 0, 0, 0],
      [-100, 0, 0, 0, 0],
      [-20, 0.8, 0.8, 0.8, 0.01],
      [60, 0.8, 0.8, 0.8, 0.05],
      [200, 0.9, 0.9, 0.9, 0.2],
      [600, 1, 1, 1, 0.5],
      [1500, 1, 1, 1, 0.6],
    ],
    labelMix: 0.92,
    mode: 'composite',
  },
  {
    id: 'bones',
    name: 'Kemikler',
    text: 'Yalnızca kemik dokusu (kaburga, omurga, leğen, femur…).',
    stops: [
      [-1024, 0, 0, 0, 0],
      [180, 0, 0, 0, 0],
      [260, 0.9, 0.82, 0.7, 0.2],
      [500, 0.97, 0.94, 0.86, 0.7],
      [1500, 1, 1, 0.97, 0.95],
    ],
    labelMix: 0,
    hide: ['heart', 'vessels', 'digestive', 'urinary', 'lungs', 'muscles', 'glands', 'nervous'],
    mode: 'composite',
  },
  {
    id: 'lungs',
    name: 'Akciğer',
    text: 'Akciğer dokusu ve içindeki damarlar (hava saydam).',
    stops: [
      [-1024, 0, 0, 0, 0],
      [-960, 0, 0, 0, 0],
      [-900, 0.5, 0.7, 0.95, 0.01],
      [-600, 0.6, 0.78, 0.98, 0.03],
      [-400, 0.8, 0.5, 0.5, 0.05],
      [100, 0.85, 0.35, 0.3, 0.04],
      [300, 0.95, 0.4, 0.3, 0.3],
      [800, 0.95, 0.93, 0.88, 0.3],
    ],
    labelMix: 0,
    hide: ['bones', 'muscles', 'digestive', 'urinary', 'glands', 'nervous', 'other'],
    mode: 'composite',
  },
  {
    id: 'mip',
    name: 'Anjiyografi (MIP)',
    text: 'En yüksek yoğunluk izdüşümü: kontrastlı damarlar ve kemikler — klasik anjiyo görüntüsü.',
    stops: [[-1024, 0, 0, 0, 0]],
    labelMix: 0,
    mode: 'mip',
    mip: [100, 700],
  },
  {
    id: 'grey',
    name: 'Klasik gri',
    text: 'Yumuşak doku penceresinde gri tonlu hacim (film görünümü).',
    stops: [
      [-1024, 0, 0, 0, 0],
      [-200, 0, 0, 0, 0],
      [-100, 0.25, 0.25, 0.25, 0.004],
      [40, 0.6, 0.6, 0.6, 0.02],
      [200, 0.9, 0.9, 0.9, 0.2],
      [1000, 1, 1, 1, 0.8],
    ],
    labelMix: 0,
    mode: 'composite',
  },
];

export const presetById = (id: PresetId): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;

/** 256 girdili aktarım tablosu (RGBA, 0–255): her 8 bit değerin HU karşılığında kontrol noktalarından. */
export function transferLut(preset: Preset, map: AtlasManifest['huMap']): Uint8Array {
  const out = new Uint8Array(256 * 4);
  const s = preset.stops;
  for (let v = 0; v < 256; v++) {
    const hu = u8ToHu(v, map);
    let c: number[] = [0, 0, 0, 0];
    if (hu <= s[0]![0]) c = s[0]!.slice(1);
    else if (hu >= s[s.length - 1]![0]) c = s[s.length - 1]!.slice(1);
    else
      for (let i = 1; i < s.length; i++)
        if (hu <= s[i]![0]) {
          const a = s[i - 1]!;
          const b = s[i]!;
          const t = (hu - a[0]) / (b[0] - a[0]);
          c = [1, 2, 3, 4].map((k) => a[k]! + (b[k]! - a[k]!) * t);
          break;
        }
    for (let k = 0; k < 4; k++) out[v * 4 + k] = Math.round(Math.max(0, Math.min(1, c[k]!)) * 255);
  }
  return out;
}

/**
 * Etiket tablosu (256 × RGBA): renk = grup rengi; alfa = görünürlük (255 görünür, 0 gizli/soluk).
 * `selected` verilirse yalnızca o etiketler görünür; diğerleri (etiketsiz doku dahil) soluk kalır.
 */
export function labelLut(labels: readonly AtlasLabel[], preset: Preset, selected?: ReadonlySet<number>): Uint8Array {
  const out = new Uint8Array(256 * 4);
  const hide = new Set(preset.hide ?? []);
  // Etiketsiz doku (yağ, deri, bölütlenmemiş yapılar): seçimde ve akciğer önayarında soluk; diğerlerinde görünür.
  out[3] = selected?.size || preset.id === 'lungs' ? 0 : 255;
  for (const l of labels) {
    const g = groupOf(l.key);
    const [r, gg, b] = GROUP_COLOR[g];
    const k = l.id * 4;
    // Organlar önayarında aynı gruptaki organlar ayırt edilsin diye kimliğe göre hafif ton farkı
    const j = ((l.id * 37) % 11) / 40 - 0.12;
    out[k] = Math.round(Math.max(0, Math.min(1, r + j)) * 255);
    out[k + 1] = Math.round(Math.max(0, Math.min(1, gg + j * 0.6)) * 255);
    out[k + 2] = Math.round(Math.max(0, Math.min(1, b - j * 0.4)) * 255);
    const visible = selected?.size ? selected.has(l.id) : !hide.has(g);
    out[k + 3] = visible ? 255 : 0;
  }
  return out;
}

/* ------------------------------------------------------------------ seçme (CPU ışın yürütme) */

export interface PickResult {
  label: number;
  /** Dokunulan noktanın voksel koordinatı. */
  voxel: [number, number, number];
  /** Dokunulan noktadaki HU. */
  hu: number;
}

/**
 * Tıklanan pikselin ışını boyunca, ekrandakiyle aynı aktarım ve görünürlük kurallarıyla ilerler; birikmiş
 * opaklık 0,35'i geçtiği ilk noktadaki etiketi döndürür. Işın dokusal koordinatlarda ([0,1]³) verilir.
 */
export function pick(atlas: Atlas, tf: Uint8Array, lab: Uint8Array, origin: [number, number, number], dir: [number, number, number], clip: { min: [number, number, number]; max: [number, number, number] }, ghost = 0.05): PickResult | null {
  const [W, H, D] = atlas.manifest.shape;
  const inv = dir.map((d) => (Math.abs(d) < 1e-9 ? 1e9 : 1 / d));
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    const ta = (clip.min[a]! - origin[a]!) * inv[a]!;
    const tb = (clip.max[a]! - origin[a]!) * inv[a]!;
    t0 = Math.max(t0, Math.min(ta, tb));
    t1 = Math.min(t1, Math.max(ta, tb));
  }
  if (t0 > t1) return null;
  t0 = Math.max(0, t0);
  const lenVox = Math.hypot(dir[0] * W, dir[1] * H, dir[2] * D);
  const dt = 0.7 / lenVox;
  let acc = 0;
  for (let t = t0; t <= t1; t += dt) {
    const x = Math.min(W - 1, Math.max(0, Math.floor((origin[0] + dir[0] * t) * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor((origin[1] + dir[1] * t) * H)));
    const z = Math.min(D - 1, Math.max(0, Math.floor((origin[2] + dir[2] * t) * D)));
    const i = x + W * (y + H * z);
    const v = atlas.volume[i]!;
    const a = tf[v * 4 + 3]! / 255;
    if (a <= 0.002) continue;
    const l = atlas.labels[i]!;
    const vis = lab[l * 4 + 3]! / 255;
    const aa = 1 - Math.pow(1 - Math.min(1, a * (ghost + (1 - ghost) * vis)), 0.7);
    acc += (1 - acc) * aa;
    if (acc > 0.35) return { label: l, voxel: [x, y, z], hu: Math.round(u8ToHu(v, atlas.manifest.huMap)) };
  }
  return null;
}

/** Etiketin ağırlık merkezi ve yarıçapı (doku koordinatlarında) — kamerayı organa odaklamak için. */
export function labelBounds(atlas: Atlas, ids: ReadonlySet<number>): { center: [number, number, number]; radius: number } | null {
  const [W, H, D] = atlas.manifest.shape;
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let lo = [W, H, D];
  let hi = [0, 0, 0];
  // Hız için her ikinci voksel
  for (let z = 0; z < D; z += 2)
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        if (!ids.has(atlas.labels[x + W * (y + H * z)]!)) continue;
        n++;
        sx += x;
        sy += y;
        sz += z;
        lo = [Math.min(lo[0]!, x), Math.min(lo[1]!, y), Math.min(lo[2]!, z)];
        hi = [Math.max(hi[0]!, x), Math.max(hi[1]!, y), Math.max(hi[2]!, z)];
      }
  if (!n) return null;
  const max = Math.max(W, H, D);
  const radius = (Math.hypot(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!) / 2 + 4) / max;
  return { center: [sx / n / W, sy / n / H, sz / n / D], radius };
}

/* ------------------------------------------------------------------ yükleme */

async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ATLAS_DIR = 'atlas/ct-body';

/**
 * Atlası uygulamanın kendi paketinden okur (aynı köken), SHA-256 ile doğrular ve açar. Okuma işlevi dışarıdan
 * verilir (uygulama: readAppAsset) ki çekirdek ağ erişimi içermesin.
 */
export async function loadAtlas(read: (path: string) => Promise<ArrayBuffer>, onProgress?: (done: number, total: number) => void): Promise<Atlas> {
  const manifest = JSON.parse(new TextDecoder().decode(await read(`${ATLAS_DIR}/manifest.json`))) as AtlasManifest;
  if (manifest.schema !== 'kh-ct-atlas/1') throw new Error('Atlas biçimi tanınmadı.');
  const out: Partial<Record<'volume' | 'labels', Uint8Array>> = {};
  let done = 0;
  for (const [name, key] of [
    ['labels.bin', 'labels'],
    ['volume.bin', 'volume'],
  ] as const) {
    const buf = await read(`${ATLAS_DIR}/${name}`);
    const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    const gz = head[0] === 0x1f && head[1] === 0x8b;
    // Sıkıştırılmış dosya (gzip) kendi özetiyle; aracı sunucu açmışsa ham özetle doğrulanır.
    if (gz && (await sha256Hex(buf)) !== manifest.files[name].sha256) throw new Error(`Atlas dosyası doğrulanamadı: ${name}`);
    const raw = gz ? await gunzip(buf) : new Uint8Array(buf);
    if (!gz && (await sha256Hex(buf)) !== manifest.files[name].rawSha256) throw new Error(`Atlas dosyası doğrulanamadı: ${name}`);
    if (raw.length !== manifest.shape[0] * manifest.shape[1] * manifest.shape[2]) throw new Error(`Atlas boyutu tutarsız: ${name}`);
    out[key] = raw;
    onProgress?.(++done, 2);
  }
  return { manifest, volume: out.volume!, labels: out.labels! };
}
