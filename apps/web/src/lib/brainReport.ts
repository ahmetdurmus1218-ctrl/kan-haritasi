/**
 * Beyin haritası: radyoloji raporundaki cümleler → beynin bölgeleri → sade dil → adım adım yol.
 *
 * Kaynak YALNIZCA rapor metnidir (ImagingFinding): konum rapordaki anatomik sözcükten gelir
 * ("rapor metninden yaklaşık konum"), görüntü pikselinden değil. Fotoğraftan bölge tahmini yapılmaz.
 * Sade anlatım sözcüklerin genel anlamıdır; cümlenin kişi için ne anlama geldiğini hekim değerlendirir.
 */
import { BRAIN_REGIONS, GRAPH, brainPath, interiorById, interiorFor } from '@kh/analysis';
import { normalizeText } from '@kh/catalog';
import type { ImagingFinding } from './imagingFindings';
import type { ImagingStudy } from './imagingStudies';
import { IMAGING_QUESTIONS } from './imaging';

/** Beyin haritasına giren yapılar (rapor bölgesi). */
const BRAIN_STRUCTURES = new Set(['brain', 'pituitary']);

export interface BrainFinding {
  finding: ImagingFinding;
  /** Bilgi grafiğinde en özel düğüm (ör. "brain.frontal"); bölüm yazmıyorsa "brain". */
  node: string;
  /** Genelden özele yol: Beyin → Sol yarıküre → Alın lobu. */
  path: string[];
  fileId: string;
  docName: string;
  date: string;
  dateKnown: boolean;
}

export type RegionStatus = 'attention' | 'uncertain' | 'normal' | 'not-assessed' | 'none';

export const REGION_STATUS_TEXT: Record<RegionStatus, string> = {
  attention: 'Raporda dikkat çeken ifade',
  uncertain: 'Raporda kesin olmayan ifade',
  normal: 'Raporda olağan',
  'not-assessed': 'Değerlendirilememiş',
  none: 'Raporda geçmiyor',
};

/** Rapor bulgusunun beyin düğümü ve yolu (tarafı yazılmışsa o yarıküre üzerinden). */
export function brainNodeOf(f: Pick<ImagingFinding, 'structure' | 'part' | 'side'>): { node: string; path: string[] } | null {
  if (!f.structure || !BRAIN_STRUCTURES.has(f.structure)) return null;
  const n = GRAPH.nodeForStructure(f.structure, f.part) ?? GRAPH.node(f.structure);
  if (!n) return null;
  return { node: n.id, path: f.structure === 'brain' ? brainPath(n.id, f.side) : GRAPH.pathTo(n.id).map((x) => x.id) };
}

/** Tüm görüntüleme çalışmalarındaki beyinle ilgili rapor cümleleri (en yeni çalışma önce). */
export function brainFindings(studies: readonly ImagingStudy[]): BrainFinding[] {
  const out: BrainFinding[] = [];
  for (const st of studies)
    for (const f of st.findings) {
      const loc = brainNodeOf(f);
      if (!loc) continue;
      out.push({ finding: f, ...loc, fileId: st.head.id, docName: st.head.displayName, date: st.date, dateKnown: st.dateKnown });
    }
  return out;
}

/** Bu bölgeye (ya da alt bölümlerine) yerleşen cümleler. "brain" yalnızca bölüm yazmayan genel cümleleri alır. */
export function findingsAt(region: string, all: readonly BrainFinding[]): BrainFinding[] {
  if (region === 'brain') return all.filter((b) => b.node === 'brain');
  return all.filter((b) => b.path.includes(region));
}

const RANK: Record<RegionStatus, number> = { attention: 4, uncertain: 3, 'not-assessed': 2, normal: 1, none: 0 };

export function regionStatus(items: readonly BrainFinding[]): RegionStatus {
  let best: RegionStatus = 'none';
  for (const { finding: f } of items) {
    const s: RegionStatus = f.status === 'abnormal' ? 'attention' : f.status === 'uncertain' ? 'uncertain' : f.status === 'not-assessed' ? 'not-assessed' : 'normal';
    if (RANK[s] > RANK[best]) best = s;
  }
  return best;
}

/** Haritadaki bölgeler: bilgi grafiği adı, grup ve iç dünya. */
export function brainRegions(): Array<{ node: string; name: string; group: string; interior: string }> {
  return BRAIN_REGIONS.map((r) => ({ ...r, name: GRAPH.node(r.node)?.nameTr ?? r.node }));
}

/* ------------------------------------------------------------------ sade dil */

/** Beyin MR/BT raporlarında sık geçen ve sözlükte (GLOSSARY) olmayan sözcüklerin sade karşılığı. */
const PLAIN_WORDS: Array<{ re: RegExp; text: string }> = [
  { re: /\bmilimetrik\b/, text: 'Milimetrik: milimetre boyutunda, yani çok küçük.' },
  { re: /\bnonspesifik|non spesifik\b/, text: 'Nonspesifik: tek bir nedene özgü değil; birçok farklı nedeni olabilir (ör. yaşla, migrenle, tansiyonla ilişkili küçük damar değişiklikleri). Tek başına bir hastalık adı değildir.' },
  { re: /\bodak(lar|lari|larin)?\b/, text: 'Odak: çevresinden farklı görünen küçük, sınırlı alan.' },
  { re: /\bflair\b/, text: 'FLAIR: sıvının karartıldığı bir MR çekim türü; beyin dokusundaki küçük değişiklikleri görünür kılar.' },
  { re: /\bt2\b/, text: 'T2: suyun parlak göründüğü MR çekim türü.' },
  { re: /\bt1\b/, text: 'T1: anatomiyi net gösteren MR çekim türü; kontrastlı çekimlerde de kullanılır.' },
  { re: /\bdemiyelin/, text: 'Demiyelinizan: sinir liflerini saran miyelin kılıfının hasarını düşündüren görünüm. Nedenini hekim değerlendirir.' },
  { re: /\bperivaskuler (aralik|bosluk)|virchow/, text: 'Perivasküler aralık (Virchow-Robin): beyin damarlarının çevresindeki sıvı dolu ince boşluklar; çoğu kişide görülür.' },
  { re: /\blakun|lakuner\b/, text: 'Laküner: derin beyin bölgelerinde küçük (genelde 15 mm altı) damar kaynaklı alan.' },
  { re: /\bmikrohemoraji|mikrokanama|hemosiderin\b/, text: 'Mikrokanama / hemosiderin: eski, çok küçük kanamalardan kalan demir birikintisi.' },
  { re: /\bhidrosefali|ventrikulomegali\b/, text: 'Hidrosefali / ventrikülomegali: beyin karıncıklarının genişlemesi.' },
  { re: /\bsulkus|sulkuslar\b/, text: 'Sulkus: beyin yüzeyindeki kıvrımlar arasındaki oluklar; genişliği beynin hacmi hakkında fikir verir.' },
  { re: /\bventrikul/, text: 'Ventrikül: beynin içindeki beyin-omurilik sıvısı dolu boşluklar (karıncıklar).' },
  { re: /\borta hat\b/, text: 'Orta hat: beynin iki yarısını ayıran çizgi; "orta hat yapıları normal" kayma olmadığını anlatır.' },
  { re: /\bkitle etkisi|sift\b/, text: 'Kitle etkisi / şift: bir alanın çevresini itmesi ya da orta hattı kaydırması.' },
  { re: /\bkontrastsiz\b/, text: 'Kontrastsız: damardan ilaç verilmeden çekilmiş.' },
  { re: /\bmukozal kalinlasma\b/, text: 'Mukozal kalınlaşma: sinüs iç zarının kalınlaşması; nezle, alerji ya da sinüzitte sık görülür ve beyinle ilgili değildir.' },
  { re: /\bretansiyon kist/, text: 'Retansiyon kisti: sinüs zarında küçük sıvı kesesi; çoğunlukla zararsızdır.' },
  { re: /\bfazekas\b/, text: 'Fazekas derecesi: beyaz cevherdeki küçük damar değişikliklerinin ne kadar yaygın olduğunu 0–3 arasında anlatan ölçek.' },
  { re: /\bloko?araioz|lokoaraiozis\b/, text: 'Lökoaraiozis: beyaz cevherde yaygın küçük damar değişiklikleri.' },
  { re: /\btonsiller ektopi|chiari\b/, text: 'Tonsiller ektopi / Chiari: beyinciğin alt ucunun kafatası deliğinden aşağı sarkması.' },
  { re: /\bpineal kist/, text: 'Pineal kist: epifiz bezinde küçük sıvı kesesi; sık ve çoğunlukla zararsızdır.' },
  { re: /\bmikroadenom|adenom\b/, text: 'Adenom: bezden (ör. hipofiz) gelişen, çoğunlukla iyi huylu doku artışı.' },
];

/** Cümlenin beyin dokusunun hangi katmanını anlattığı (raporda yazıyorsa). */
const DEPTH: Array<{ re: RegExp; text: string; tissue: 'white' | 'gray' }> = [
  { re: /\bperiventrikul/, text: 'Karıncıkların hemen çevresindeki beyaz cevher (periventriküler)', tissue: 'white' },
  { re: /\bjukstakortikal|juxtakortikal\b/, text: 'Korteksin hemen bitişiği (jukstakortikal)', tissue: 'white' },
  { re: /\bsubkortikal\b/, text: 'Korteksin hemen altındaki beyaz cevher (subkortikal)', tissue: 'white' },
  { re: /\bsentrum semiovale\b/, text: 'Yarıkürenin ortasındaki geniş beyaz cevher (sentrum semiovale)', tissue: 'white' },
  { re: /\bderin beyaz\b/, text: 'Derin beyaz cevher', tissue: 'white' },
  { re: /\bbeyaz cevher\b/, text: 'Beyaz cevher (sinir lifleri)', tissue: 'white' },
  { re: /(^| )kortikal\b|\bgri cevher\b|\bkorteks\b/, text: 'Korteks (yüzeydeki gri cevher)', tissue: 'gray' },
];

export function depthOf(sentence: string): { text: string; tissue: 'white' | 'gray' } | undefined {
  const n = normalizeText(sentence);
  return DEPTH.find((d) => d.re.test(n));
}

const SIDE_TEXT = { left: 'Sol taraf', right: 'Sağ taraf', both: 'İki tarafta' } as const;
const SEVERITY_TEXT = { mild: 'Raporda derecesi: hafif.', moderate: 'Raporda derecesi: orta.', severe: 'Raporda derecesi: belirgin / ileri.' } as const;
const TEMPORAL_TEXT = {
  new: 'Önceki çekime göre yeni olduğu yazılmış.',
  stable: 'Önceki çekime göre değişmediği (stabil) yazılmış.',
  increased: 'Önceki çekime göre arttığı yazılmış.',
  decreased: 'Önceki çekime göre azaldığı yazılmış.',
  resolved: 'Önceki çekimdeki bulgunun kaybolduğu yazılmış.',
} as const;

export interface PlainReading {
  /** Tek cümlelik sade özet. */
  headline: string;
  /** Sözcüklerin anlamları, ölçü, derece, karşılaştırma. */
  lines: string[];
  where?: string;
  side?: string;
  depth?: { text: string; tissue: 'white' | 'gray' };
}

/** Rapor cümlesinin sade anlatımı (yalnızca cümlede yazanlardan; tahmin eklenmez). */
export function plainReading(f: ImagingFinding): PlainReading {
  const n = normalizeText(f.text);
  const where = f.where ?? (f.structure === 'brain' ? 'Beyin' : undefined);
  const place = where ? where.charAt(0).toLocaleLowerCase('tr') + where.slice(1) : 'bu bölge';
  const headline =
    f.status === 'abnormal'
      ? `Raporda ${place} için dikkat çeken bir ifade var. Bu bir tanı değildir; anlamını raporu yazan ve seni izleyen hekim değerlendirir.`
      : f.status === 'uncertain'
        ? `Raporda ${place} için kesin olmayan (olasılık bildiren) bir ifade var.`
        : f.status === 'not-assessed'
          ? `Raporda ${place} değerlendirilemediği yazıyor: normal ya da anormal denemez.`
          : f.negated
            ? `Raporda ${place} için bir şeyin OLMADIĞI yazıyor; bu bir bulgu değil.`
            : `Raporda ${place} olağan (normal sınırlarda) bildirilmiş.`;
  const lines: string[] = [];
  for (const t of f.terms) if (t.key !== 'klinik-korelasyon') lines.push(`${t.term}: ${t.meaning}`);
  for (const w of PLAIN_WORDS) if (w.re.test(n) && !lines.some((l) => l.startsWith(w.text.split(':')[0]!))) lines.push(w.text);
  if (/\b(birkac|birden fazla|coklu|multipl|cok sayida)\b/.test(n)) lines.push('Sayı: birden fazla.');
  else if (/\b(tek|soliter|bir adet)\b/.test(n)) lines.push('Sayı: tek.');
  if (f.size) lines.push(`Raporda yazan ölçü: ${f.size}.`);
  if (f.severity) lines.push(SEVERITY_TEXT[f.severity]);
  if (f.temporal) lines.push(TEMPORAL_TEXT[f.temporal]);
  if (f.recommendation) lines.push('Radyolog bir öneri yazmış (ör. klinik korelasyon ya da kontrol): bunu hekiminle konuş.');
  const depth = depthOf(f.text);
  return { headline, lines, ...(where ? { where } : {}), ...(f.side ? { side: SIDE_TEXT[f.side] } : {}), ...(depth ? { depth } : {}) };
}

/** Hekime sorulabilecek sorular: önce cümledeki sözcüklere özgü olanlar, sonra genel. */
export function doctorQuestions(f: ImagingFinding): string[] {
  const n = normalizeText(f.text);
  const keys = new Set(f.terms.map((t) => t.key));
  const out: string[] = [];
  if (keys.has('hiperintens') || /\bodak/.test(n)) out.push('Bu odakların olası nedeni ne? Şikâyetlerimle ilişkili mi?', 'Kontrol MR gerekiyor mu, gerekiyorsa ne zaman?');
  if (keys.has('iskemik') || /\bnonspesifik/.test(n)) out.push('Tansiyon, kan şekeri ve kolesterol gibi damar risklerimin kontrolü gerekiyor mu?');
  if (keys.has('difuzyon') && f.status !== 'normal') out.push('Difüzyon kısıtlanması yeni (akut) bir durumu mu gösteriyor?');
  if (keys.has('atrofi')) out.push('Bu hacim azalması yaşıma göre beklenen düzeyde mi?');
  if (keys.has('kist') || keys.has('lezyon') || keys.has('kitle') || keys.has('nodul')) out.push('Bunun takibi ya da ek tetkiki gerekiyor mu?');
  // Genel sorular: cümleye özgü soru zaten şikâyet ve kontrol çekimini soruyorsa yalnızca karşılaştırma eklenir.
  for (const q of out.length ? IMAGING_QUESTIONS.slice(2, 4) : IMAGING_QUESTIONS.slice(0, 3)) if (!out.includes(q)) out.push(q);
  return out.slice(0, 5);
}

/* ------------------------------------------------------------------ adım adım yol */

/** Bölgenin iç dünyası ve rapor cümlesinin o iç dünyada göründüğü basamak (1'den başlar). */
export function interiorStep(region: string, b: Pick<BrainFinding, 'path'> & { finding: Pick<ImagingFinding, 'text'> }): { interior: string; stage: number; deeperStage?: number } | null {
  const def = interiorById(BRAIN_REGIONS.find((r) => r.node === region)?.interior ?? '') ?? interiorFor(region);
  if (!def) return null;
  const at = def.stages.findIndex((s) => s.node !== undefined && b.path.includes(s.node));
  const depth = depthOf(b.finding.text);
  const want = depth?.tissue === 'white' ? 'tissue.white-matter' : depth?.tissue === 'gray' ? 'tissue.cortical-layers' : undefined;
  const deeper = want ? def.stages.findIndex((s) => s.node === want) : -1;
  return { interior: def.organId, stage: Math.max(0, at) + 1, ...(deeper >= 0 ? { deeperStage: deeper + 1 } : {}) };
}

/** "Daha derine in" başlangıcı: cümle beyaz cevheri anlatıyorsa miyelin yolu, gri cevheri anlatıyorsa nöron yolu. */
export function deeperTrail(b: Pick<BrainFinding, 'node'> & { finding: Pick<ImagingFinding, 'text'> }): { organ: string; trail: string[]; label: string } {
  const d = depthOf(b.finding.text);
  if (d?.tissue === 'white' || b.node === 'brain.white-matter' || b.node === 'brain.corpus-callosum')
    return { organ: 'brain.white-matter', trail: ['tissue.white-matter', 'cell.oligodendrocyte'], label: 'Beyaz cevher → oligodendrosit → miyelin' };
  // Gri cevherden yapılmış bölge (lob, çekirdek) kendi düğümünden; değilse bir lob üzerinden inilir.
  const gray = GRAPH.edgesFrom(b.node, 'made_of').some((e) => e.to === 'tissue.gray-matter');
  return { organ: gray ? b.node : 'brain.frontal', trail: ['tissue.gray-matter', 'cell.neuron'], label: 'Gri cevher → nöron → sinaps' };
}
