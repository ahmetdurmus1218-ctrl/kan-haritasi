/**
 * Rapor cümlesi → adım adım yol (her organ için ortak): sade dil, konum, iç dünya basamağı, daha derin seviye
 * ve hekime sorular. Kaynak YALNIZCA rapor metnidir; konum rapordaki anatomik sözcükten gelir (görüntü
 * pikselinden değil). Sade anlatım sözcüklerin genel anlamıdır; kişi için anlamını hekim değerlendirir.
 */
import { BRAIN_REGIONS, GRAPH, brainPath, interiorById, interiorFor } from '@kh/analysis';
import { normalizeText } from '@kh/catalog';
import type { ImagingFinding } from './imagingFindings';
import type { ImagingStudy } from './imagingStudies';
import { IMAGING_QUESTIONS } from './imaging';

/** Bir rapor cümlesi ve nereden geldiği. */
export interface SentenceRef {
  finding: ImagingFinding;
  /** Bilgi grafiğinde en özel düğüm (ör. "brain.frontal", "liver"); yer adı yoksa undefined. */
  node?: string;
  /** Genelden özele yol (ör. Beyin → Uç beyin → Alın lobu). */
  path: string[];
  /** Çalışmanın baş dosyası (belge sayfası) ve cümlenin çalışmadaki sırası. */
  fileId: string;
  index: number;
  docName: string;
  date: string;
  dateKnown: boolean;
  /** Metin kâğıdın / ekranın fotoğrafından okundu (OCR): harf hatası olabilir. */
  ocr: boolean;
}

/** Cümlenin bilgi grafiğindeki yeri. Beyinde taraf yalnızca raporda yazıyorsa yola eklenir. */
export function sentenceLocation(f: Pick<ImagingFinding, 'structure' | 'part' | 'side'>): { node?: string; path: string[] } {
  if (!f.structure) return { path: [] };
  const n = GRAPH.nodeForStructure(f.structure, f.part) ?? GRAPH.node(f.structure);
  if (!n) return { path: [] };
  return { node: n.id, path: f.structure === 'brain' ? brainPath(n.id, f.side) : GRAPH.pathTo(n.id).map((x) => x.id) };
}

/** Tüm görüntüleme çalışmalarındaki rapor cümleleri (en yeni çalışma önce). */
export function allSentences(studies: readonly ImagingStudy[]): SentenceRef[] {
  return studies.flatMap((st) =>
    st.findings.map((f, index) => ({
      finding: f,
      ...sentenceLocation(f),
      fileId: st.head.id,
      index,
      docName: st.head.displayName,
      date: st.date,
      dateKnown: st.dateKnown,
      ocr: st.note?.method === 'ocr' || st.note?.method === 'mixed',
    })),
  );
}

/** Belgenin (ya da aynı çalışmadaki bir dosyanın) cümleleri. */
export function sentencesOf(studies: readonly ImagingStudy[], fileId: string): SentenceRef[] {
  const st = studies.find((s) => s.head.id === fileId || s.files.some((f) => f.id === fileId));
  return st ? allSentences([st]) : [];
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
export function interiorStep(region: string, b: Pick<SentenceRef, 'path'> & { finding: Pick<ImagingFinding, 'text'> }): { interior: string; stage: number; deeperStage?: number } | null {
  const def = interiorById(BRAIN_REGIONS.find((r) => r.node === region)?.interior ?? '') ?? interiorFor(region);
  if (!def) return null;
  const at = def.stages.findIndex((s) => s.node !== undefined && b.path.includes(s.node));
  const depth = depthOf(b.finding.text);
  const want = depth?.tissue === 'white' ? 'tissue.white-matter' : depth?.tissue === 'gray' ? 'tissue.cortical-layers' : undefined;
  const deeper = want ? def.stages.findIndex((s) => s.node === want) : -1;
  return { interior: def.organId, stage: Math.max(0, at) + 1, ...(deeper >= 0 ? { deeperStage: deeper + 1 } : {}) };
}

/**
 * "Daha derine in" başlangıcı. Beyinde: cümle beyaz cevheri anlatıyorsa miyelin yolu, gri cevheri anlatıyorsa
 * nöron yolu. Diğer yapılarda: yapının kendi düğümünden doku → hücre → molekül.
 */
export function deeperTrail(b: Pick<SentenceRef, 'node' | 'path'> & { finding: Pick<ImagingFinding, 'text'> }): { organ: string; trail: string[]; label: string } | null {
  if (!b.node) return null;
  if (!b.path.includes('brain')) return { organ: b.node, trail: [], label: `${GRAPH.node(b.node)?.nameTr ?? b.node}: doku → hücre → molekül` };
  const d = depthOf(b.finding.text);
  if (d?.tissue === 'white' || b.node === 'brain.white-matter' || b.node === 'brain.corpus-callosum')
    return { organ: 'brain.white-matter', trail: ['tissue.white-matter', 'cell.oligodendrocyte'], label: 'Beyaz cevher → oligodendrosit → miyelin' };
  // Gri cevherden yapılmış bölge (lob, çekirdek) kendi düğümünden; değilse bir lob üzerinden inilir.
  const gray = GRAPH.edgesFrom(b.node, 'made_of').some((e) => e.to === 'tissue.gray-matter');
  return { organ: gray ? b.node : 'brain.frontal', trail: ['tissue.gray-matter', 'cell.neuron'], label: 'Gri cevher → nöron → sinaps' };
}
