/**
 * Kemik adları: BodyParts3D / HRA İngilizce adlarından Türkçe ad ve Latince (Terminologia Anatomica)
 * karşılık. Yalnızca sözlükteki kalıplar çevrilir; eşleşmeyen ad için `null` döner ve uygulama
 * uluslararası (İngilizce) adı gösterir — tahminle ad uydurulmaz.
 */

export interface ElementName {
  tr: string;
  la?: string;
}

const ORD: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const SINGLE: Record<string, ElementName> = {
  atlas: { tr: 'Atlas (1. boyun omuru, C1)', la: 'Atlas' },
  axis: { tr: 'Aksis (2. boyun omuru, C2)', la: 'Axis' },
  sacrum: { tr: 'Sakrum', la: 'Os sacrum' },
  coccyx: { tr: 'Kuyruk sokumu (koksiks)', la: 'Os coccygis' },
  manubrium: { tr: 'Göğüs kemiği sapı', la: 'Manubrium sterni' },
  'body of sternum': { tr: 'Göğüs kemiği gövdesi', la: 'Corpus sterni' },
  'xiphoid process': { tr: 'Ksifoid çıkıntı', la: 'Processus xiphoideus' },
  clavicle: { tr: 'Köprücük kemiği', la: 'Clavicula' },
  scapula: { tr: 'Kürek kemiği', la: 'Scapula' },
  humerus: { tr: 'Pazu kemiği (humerus)', la: 'Humerus' },
  radius: { tr: 'Döner kemik (radius)', la: 'Radius' },
  ulna: { tr: 'Dirsek kemiği (ulna)', la: 'Ulna' },
  scaphoid: { tr: 'Kayık kemiği', la: 'Os scaphoideum' },
  lunate: { tr: 'Ay kemiği', la: 'Os lunatum' },
  triquetral: { tr: 'Üçgen kemik', la: 'Os triquetrum' },
  pisiform: { tr: 'Bezelye kemiği', la: 'Os pisiforme' },
  trapezium: { tr: 'Büyük trapez kemiği', la: 'Os trapezium' },
  trapezoid: { tr: 'Küçük trapez kemiği', la: 'Os trapezoideum' },
  capitate: { tr: 'Başlı kemik', la: 'Os capitatum' },
  hamate: { tr: 'Çengelli kemik', la: 'Os hamatum' },
  'hip bone': { tr: 'Kalça kemiği', la: 'Os coxae' },
  femur: { tr: 'Uyluk kemiği (femur)', la: 'Femur' },
  patella: { tr: 'Diz kapağı kemiği', la: 'Patella' },
  tibia: { tr: 'Kaval kemiği (tibia)', la: 'Tibia' },
  fibula: { tr: 'Kamış kemiği (fibula)', la: 'Fibula' },
  talus: { tr: 'Aşık kemiği', la: 'Talus' },
  calcaneus: { tr: 'Topuk kemiği', la: 'Calcaneus' },
  'cuboid bone': { tr: 'Küboid kemik', la: 'Os cuboideum' },
  'navicular bone of foot': { tr: 'Naviküler kemik (ayak)', la: 'Os naviculare' },
  'medial cuneiform bone': { tr: 'İç çivi kemiği', la: 'Os cuneiforme mediale' },
  'intermediate cuneiform bone': { tr: 'Orta çivi kemiği', la: 'Os cuneiforme intermedium' },
  'lateral cuneiform bone': { tr: 'Dış çivi kemiği', la: 'Os cuneiforme laterale' },
  'sesamoid bone of foot': { tr: 'Ayak susam kemikleri', la: 'Ossa sesamoidea pedis' },
  'frontal bone': { tr: 'Alın kemiği', la: 'Os frontale' },
  'parietal bone': { tr: 'Yan kafa kemiği', la: 'Os parietale' },
  'occipital bone': { tr: 'Art kafa kemiği', la: 'Os occipitale' },
  'temporal bone': { tr: 'Şakak kemiği', la: 'Os temporale' },
  'sphenoid bone': { tr: 'Kama kemiği', la: 'Os sphenoidale' },
  ethmoid: { tr: 'Kalbur kemiği', la: 'Os ethmoidale' },
  maxilla: { tr: 'Üst çene kemiği', la: 'Maxilla' },
  mandible: { tr: 'Alt çene kemiği', la: 'Mandibula' },
  'nasal bone': { tr: 'Burun kemiği', la: 'Os nasale' },
  'lacrimal bone': { tr: 'Gözyaşı kemiği', la: 'Os lacrimale' },
  'palatine bone': { tr: 'Damak kemiği', la: 'Os palatinum' },
  vomer: { tr: 'Sapan kemiği (vomer)', la: 'Vomer' },
  'zygomatic bone': { tr: 'Elmacık kemiği', la: 'Os zygomaticum' },
  'inferior nasal concha': { tr: 'Alt burun kabuğu', la: 'Concha nasalis inferior' },
  'hyoid bone': { tr: 'Dil kemiği', la: 'Os hyoideum' },
  'interosseous membrane of forearm': { tr: 'Önkol kemikler arası zarı', la: 'Membrana interossea antebrachii' },
  'interosseous membrane of leg': { tr: 'Bacak kemikler arası zarı', la: 'Membrana interossea cruris' },
  'long plantar ligament': { tr: 'Uzun taban bağı', la: 'Ligamentum plantare longum' },
};

const VERT = {
  cervical: { tr: 'boyun omuru', la: 'Vertebra cervicalis', c: 'C' },
  thoracic: { tr: 'göğüs omuru', la: 'Vertebra thoracica', c: 'T' },
  lumbar: { tr: 'bel omuru', la: 'Vertebra lumbalis', c: 'L' },
} as const;

const FINGER: Record<string, string> = { thumb: 'başparmak', 'index finger': 'işaret parmağı', 'middle finger': 'orta parmak', 'ring finger': 'yüzük parmağı', 'little finger': 'serçe parmak' };
const TOE: Record<string, string> = { 'big toe': 'ayak başparmağı', 'second toe': '2. ayak parmağı', 'third toe': '3. ayak parmağı', 'fourth toe': '4. ayak parmağı', 'little toe': 'ayak serçe parmağı' };
const PHALANX: Record<string, { tr: string; la: string }> = {
  proximal: { tr: 'ilk (proksimal) falanksı', la: 'Phalanx proximalis' },
  middle: { tr: 'orta falanksı', la: 'Phalanx media' },
  distal: { tr: 'uç (distal) falanksı', la: 'Phalanx distalis' },
};

/** Omur seviyesi: "fifth lumbar vertebra" → L5; atlas → C1; axis → C2. */
function level(name: string): { code: string; n: number; kind: keyof typeof VERT } | null {
  if (name === 'atlas') return { code: 'C1', n: 1, kind: 'cervical' };
  if (name === 'axis') return { code: 'C2', n: 2, kind: 'cervical' };
  const m = /^(\w+) (cervical|thoracic|lumbar) vertebra$/.exec(name);
  if (!m || !ORD[m[1]!]) return null;
  const kind = m[2] as keyof typeof VERT;
  return { code: `${VERT[kind].c}${ORD[m[1]!]}`, n: ORD[m[1]!]!, kind };
}
const NEXT: Record<string, string> = { C7: 'T1', T12: 'L1', L5: 'S1' };
function below(code: string): string {
  if (NEXT[code]) return NEXT[code]!;
  return `${code[0]}${Number(code.slice(1)) + 1}`;
}

/** BodyParts3D kemik/kıkırdak adının Türkçesi ve Latincesi; bilinmiyorsa null. */
export function boneName(en: string): ElementName | null {
  const raw = en.trim().toLowerCase();
  const side = /\bright\b/.test(raw) ? 'Sağ' : /\bleft\b/.test(raw) ? 'Sol' : '';
  const name = raw.replace(/\b(right|left) /g, '').replace(/ of (right|left) /, ' of ').trim();
  const sided = (t: ElementName): ElementName => (side ? { tr: `${side} ${t.tr.charAt(0).toLocaleLowerCase('tr')}${t.tr.slice(1)}`, la: t.la } : t);

  if (SINGLE[name]) return sided(SINGLE[name]!);
  const v = level(name);
  if (v) return { tr: `${v.n}. ${VERT[v.kind].tr} (${v.code})`, la: `${VERT[v.kind].la} ${v.code}` };
  const disk = /^intervertebral disk of (.+)$/.exec(name);
  if (disk) {
    const lv = level(disk[1]!);
    if (lv) return { tr: `Omurlar arası disk (${lv.code}–${below(lv.code)})`, la: `Discus intervertebralis ${lv.code}–${below(lv.code)}` };
  }
  let m = /^(\w+) rib$/.exec(name);
  if (m && ORD[m[1]!]) return sided({ tr: `${ORD[m[1]!]}. kaburga`, la: `Costa ${ROMAN[ORD[m[1]!]!]}` });
  m = /^(\w+) costal cartilage$/.exec(name);
  if (m && ORD[m[1]!]) return sided({ tr: `${ORD[m[1]!]}. kaburga kıkırdağı`, la: `Cartilago costalis ${ROMAN[ORD[m[1]!]!]}` });
  m = /^(\w+) metacarpal bone$/.exec(name);
  if (m && ORD[m[1]!]) return sided({ tr: `${ORD[m[1]!]}. el tarak kemiği`, la: `Os metacarpi ${ROMAN[ORD[m[1]!]!]}` });
  m = /^(\w+) metatarsal bone$/.exec(name);
  if (m && ORD[m[1]!]) return sided({ tr: `${ORD[m[1]!]}. ayak tarak kemiği`, la: `Os metatarsi ${ROMAN[ORD[m[1]!]!]}` });
  m = /^(proximal|middle|distal) phalanx of (.+)$/.exec(name);
  if (m) {
    const ph = PHALANX[m[1]!]!;
    const digit = FINGER[m[2]!] ?? TOE[m[2]!];
    if (digit) return sided({ tr: `${digit.charAt(0).toLocaleUpperCase('tr')}${digit.slice(1)} ${ph.tr}`, la: `${ph.la} ${FINGER[m[2]!] ? 'manus' : 'pedis'}` });
  }
  return null;
}

/** HRA (VH) kemik düğüm adları: "lumbar vertebra 3", "ilium compact bone r", "sacrum". */
export function hraBoneName(clean: string): ElementName | null {
  const v = /^(cervical|thoracic|lumbar) vertebra (\d+)$/.exec(clean);
  if (v) {
    const kind = v[1] as keyof typeof VERT;
    const n = Number(v[2]);
    if (kind === 'cervical' && n === 1) return SINGLE.atlas!;
    if (kind === 'cervical' && n === 2) return SINGLE.axis!;
    const code = `${VERT[kind].c}${n}`;
    const variant = kind === 'lumbar' && n === 6 ? ' — kaynak modelde altı bel omuru var' : '';
    return { tr: `${n}. ${VERT[kind].tr} (${code})${variant}`, la: `${VERT[kind].la} ${code}` };
  }
  const p = /^(ilium|ischium|pubis) compact bone ([lr])$/.exec(clean);
  if (p) {
    const side = p[2] === 'r' ? 'Sağ' : 'Sol';
    const t = { ilium: ['kalça kemiğinin kanat bölümü (ilium)', 'Os ilium'], ischium: ['oturga kemiği (iskium)', 'Os ischii'], pubis: ['çatı kemiği (pubis)', 'Os pubis'] }[p[1] as 'ilium']!;
    return { tr: `${side} ${t[0]}`, la: t[1] };
  }
  if (SINGLE[clean]) return SINGLE[clean]!;
  return null;
}
