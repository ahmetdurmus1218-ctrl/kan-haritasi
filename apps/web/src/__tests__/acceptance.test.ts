/**
 * Kabul senaryoları (analiz çekirdeği + uygulama köprüsü, Node'da). Tarayıcıdaki karşılığı:
 * tests/e2e/multimodal.py. Yalnızca sentetik veri kullanılır.
 *
 *  A. Yalnızca MR (rapor yok)            E. Yalnızca EKG
 *  B. MR + rapor                         F. Yalnızca ultrason (pankreas)
 *  C. MR + kan                           G. Yalnızca patoloji görüntüsü
 *  D. Eski MR + yeni MR                  H. Yalnızca laboratuvar fotoğrafı
 *  + İkinci kabul testi: MR + radyoloji raporu + kan + önceki MR → birleşik sağlık modeli
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  type ImageAnalysisRun,
  type LabObservation,
  REPORTED,
  analyzeImage,
  buildHealthModel,
  buildOrganView,
  explainWhy,
  rasterFromRgba,
  resolveReference,
  statusAgainst,
} from '@kh/analysis';
import { parseReport, type TextItem } from '@kh/parser';
import { extractFindings } from '../lib/imagingFindings';
import { reportFindingsFrom } from '../lib/analysisBridge';
import { documentImage, ecgImage, pathologyImage, ultrasoundImage } from '../../../../packages/analysis/src/__tests__/synthetic';

const IMG = fileURLToPath(new URL('../../../../fixtures/imaging/', import.meta.url));

/** Fikstür fotoğrafını tarayıcıdaki gibi en fazla 1024 piksele küçültüp RGBA'ya çevirir. */
async function photo(name: string) {
  const img = await loadImage(readFileSync(IMG + name));
  const k = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = createCanvas(Math.round(img.width * k), Math.round(img.height * k));
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return rasterFromRgba(new Uint8ClampedArray(d.data), d.width, d.height);
}
const raster = (r: { rgba: Uint8ClampedArray; width: number; height: number }) => rasterFromRgba(r.rgba, r.width, r.height);

const lab = (testKey: string, name: string, value: number, unit: string, status: LabObservation['status'], date: string, refMin?: number, refMax?: number): LabObservation => ({
  testKey,
  name,
  value,
  unit,
  status,
  date,
  source: 'LAB',
  confidence: REPORTED,
  ...(refMin !== undefined ? { refMin } : {}),
  ...(refMax !== undefined ? { refMax } : {}),
  refSource: 'report',
});

const REPORT_NEW = `BEYİN MR
BULGULAR:
Sağ frontal lobda subkortikal beyaz cevherde 9 mm T2/FLAIR hiperintens odak izlendi; önceki tetkike göre artmıştır.
Ventriküller normal genişliktedir. Orta hat yapıları simetriktir. Kitle izlenmedi.
SONUÇ: Sağ frontal nonspesifik odak. Klinik korelasyon önerilir.`;
const REPORT_OLD = `BEYİN MR
BULGULAR:
Sağ frontal lobda subkortikal beyaz cevherde 6 mm T2/FLAIR hiperintens odak izlendi.
Ventriküller normal genişliktedir.
SONUÇ: Sağ frontal nonspesifik odak.`;

let mriRun: ImageAnalysisRun;

describe('A — yalnızca MR görüntüsü, rapor yok (en önemli kabul testi)', () => {
  it('20 adımın tamamı: tür, bölge, kalite, model, gözlem, güven, konum, 3B, normal anatomi/işlev, ilişkiler, sınırlar', async () => {
    const image = await photo('mr-kolaj-foto.jpg');
    mriRun = analyzeImage(image, { fileName: 'brain_mri.jpg' });
    const run = mriRun;
    // 1–2. MR ve beyin
    expect(run.modality!.primary.modality).toBe('MRI');
    expect(run.anatomy!.structure).toBe('brain');
    // 3. kalite kontrolü yapıldı
    expect(run.quality.usable).toBe(true);
    expect(run.quality.metrics.edgeWidth).toBeGreaterThan(0);
    // 4. görüntü analiz modeli çağrıldı (sürümüyle)
    expect(run.result.model).toMatchObject({ id: 'kh-lr-symmetry', version: '1.1.0', local: true });
    // 5–7. görülebilir aday gözlem ve güven; fotoğraftaki parlaklık farkı bir loba EŞLENMEZ (sahte konum yok)
    expect(run.result.observations.length).toBeGreaterThanOrEqual(1);
    const o = run.result.observations[0]!;
    expect(o.source).toBe('IMAGE_ANALYSIS');
    expect(o.confidence.kind).toBe('score');
    expect(o.location).toBeUndefined();
    // 8. 3B modele yalnızca görüntünün bölgesi (beyin) bağlanır, bölüm değil
    const region = run.anatomy!.location!;
    expect(region.structure).toBe('brain');
    // 9–10. gerçek görüntü üzerinde piksel konumu
    expect(o.localization.kind).toBe('pixel');
    // 11–13. normal anatomi, işlev, olası anlam zinciri
    const model = buildHealthModel({ images: [{ run, date: '2026-05-01', structure: 'brain', modality: 'MRI' }], reports: [], labs: [] });
    const view = buildOrganView('brain', model)!;
    expect(view.normal.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['brain.hemisphere-left', 'brain.hemisphere-right']));
    const why = explainWhy(region, model);
    expect(why.map((s) => s.title)).toEqual(expect.arrayContaining(['Etkilenen anatomi', 'Normalde ne yapar', 'Olası etkilenen süreçler', 'Senin ilişkili verilerin']));
    // 14–17. diğer sonuçlar ve eski görüntüler arandı (bulunmadı, açıkça)
    expect(model.steps.find((s) => s.step === 'analyze_labs')!.ran).toBe(false);
    expect(model.steps.find((s) => s.step === 'compare_temporally')!.ran).toBe(false);
    // 18. belirsizlik
    // Fotoğraftan olasılık bildiren bir organ gözlemi üretilmez; eksik olan açıkça yazılır.
    expect(view.uncertainty.probabilistic).toHaveLength(0);
    expect(view.uncertainty.missing).toContain('Bu organ için okunmuş bir rapor ya da tıbbi model sonucu yok');
    // 19–20. analizin yalnızca görüntüye dayandığı ve rapor olmadığı
    expect(run.statements.join(' ')).toMatch(/Rapor: yok/);
    expect(model.statements.join(' ')).toMatch(/yalnızca görüntünün kendisine dayanıyor/);
    expect(model.concordance[0]!.relation).toBe('no-report');
  });
});

describe('B — MR + rapor', () => {
  it('görüntü gözlemi ve rapor bulgusu ayrı kaynak; olumsuzlama bulgu sayılmaz; uyum değerlendirilir', () => {
    const findings = reportFindingsFrom(extractFindings(REPORT_NEW, 'beyin'), { date: '2026-05-01', documentId: 'r1' });
    expect(findings.every((f) => f.source === 'RADIOLOGY_REPORT')).toBe(true);
    const lesion = findings.find((f) => f.text.startsWith('Sağ frontal lobda'))!;
    expect(lesion.location).toMatchObject({ structure: 'brain', part: 'frontal', side: 'right', basis: 'report-text' });
    expect(lesion.localization.kind).toBe('report-approximate');
    expect(lesion.temporal).toBe('increased');
    expect(findings.find((f) => f.text.includes('Kitle izlenmedi'))!.negated).toBe(true);
    expect(findings.some((f) => f.recommendation)).toBe(true);
    const model = buildHealthModel({ images: [{ run: mriRun, studyKey: 's1' }], reports: [{ findings, studyKey: 's1' }], labs: [] });
    expect(model.available).toMatchObject({ image: true, report: true });
    for (const c of model.concordance) expect(['supported-by-report', 'report-says-normal', 'not-mentioned-in-report']).toContain(c.relation);
    // Kaynaklar karışmaz
    expect(model.imageObservations.every((o) => o.source === 'IMAGE_ANALYSIS')).toBe(true);
    expect(model.reportFindings.every((f) => f.localization.kind !== ('pixel' as string))).toBe(true);
  });
});

describe('C — MR + kan', () => {
  it('kan sonuçları organlara bağlanır; örüntüler kaynaklı kanıtla üretilir', () => {
    const labs = [lab('glucose', 'Glukoz', 128, 'mg/dL', 'high', '2026-05-02', 70, 100), lab('hba1c', 'HbA1c', 6.4, '%', 'high', '2026-05-02', 4, 5.6), lab('alt', 'ALT', 22, 'U/L', 'normal', '2026-05-02', 0, 40)];
    const model = buildHealthModel({ images: [{ run: mriRun }], reports: [], labs });
    expect(model.available).toMatchObject({ image: true, lab: true, report: false });
    expect(model.organs.get('pancreas')!.labs.map((l) => l.testKey)).toEqual(expect.arrayContaining(['glucose', 'hba1c']));
    const p = model.patterns.find((x) => x.id === 'glucose')!;
    expect(p.supporting.map((s) => s.source)).toEqual(['LAB', 'LAB']);
    expect(p.explanation).toMatch(/tanı değildir/);
    expect(model.patterns.find((x) => x.id === 'hepatocellular')).toBeUndefined();
  });
});

describe('D — eski MR + yeni MR', () => {
  it('büyüme ve rapor karşılaştırma ifadesi; çakıştırma olmadığı açıkça yazılır', () => {
    const now = reportFindingsFrom(extractFindings(REPORT_NEW, 'beyin'), { date: '2026-05-01' });
    const old = reportFindingsFrom(extractFindings(REPORT_OLD, 'beyin'), { date: '2024-04-10' });
    const model = buildHealthModel({
      images: [],
      reports: [
        { findings: old, date: '2024-04-10', modality: 'MRI', structure: 'brain' },
        { findings: now, date: '2026-05-01', modality: 'MRI', structure: 'brain' },
      ],
      labs: [],
    });
    expect(model.available.previous).toBe(true);
    const c = model.comparisons[0]!;
    expect(c.changes.some((x) => x.change === 'growing' && /6 mm → 9 mm/.test(x.detail))).toBe(true);
    expect(c.changes.some((x) => x.change === 'report-states')).toBe(true);
    expect(c.reliability.join(' ')).toMatch(/registration/);
  });
});

describe('E — yalnızca EKG fotoğrafı', () => {
  it('ölçülebileni ölçer, ölçülemeyeni uydurmaz', () => {
    const run = analyzeImage(raster(ecgImage({ mm: 8, bpm: 75 })), { fileName: 'ECG_photo.jpg' });
    expect(run.modality!.primary.modality).toBe('ECG');
    expect(run.anatomy!.structure).toBe('heart');
    const hr = run.result.observations.find((o) => o.kind === 'heart-rate')!;
    expect(hr.measurement!.value).toBeGreaterThanOrEqual(72);
    expect(hr.measurement!.value).toBeLessThanOrEqual(78);
    for (const k of ['pr', 'qrs', 'qt', 'st', 'axis']) expect(run.result.capabilities.find((c) => c.key === k)!.status).toBe('not-implemented');
    expect(run.result.observations.some((o) => /QT|PR aralığı \d/.test(o.text))).toBe(false);
  });
});

describe('F — yalnızca pankreas ultrasonu (üçüncü kabul testi)', () => {
  it('ultrasonu tanır, pankreası bağlamdan bağlar, organ tanıma yok der, normal fizyoloji + ilgili tahliller', () => {
    const run = analyzeImage(raster(ultrasoundImage()), { fileName: 'pancreas_ultrasound.jpg' });
    expect(run.modality!.primary.modality).toBe('ULTRASOUND');
    expect(run.anatomy).toMatchObject({ structure: 'pancreas', source: 'USER_INPUT' });
    expect(run.result.capabilities.find((c) => c.key === 'organ')!.status).toBe('not-implemented');
    const labs = [lab('lipase', 'Lipaz', 210, 'U/L', 'high', '2026-03-01', 13, 60), lab('glucose', 'Glukoz', 92, 'mg/dL', 'normal', '2026-03-01', 70, 100)];
    const model = buildHealthModel({ images: [{ run, structure: 'pancreas' }], reports: [], labs });
    const view = buildOrganView('pancreas', model)!;
    expect(view.normal.physiology.some((c) => c.some((n) => n.id === 'mol.insulin'))).toBe(true);
    expect(view.personal.labs.map((l) => l.testKey)).toEqual(expect.arrayContaining(['lipase', 'glucose']));
    expect(view.difference.some((d) => d.label.startsWith('Lipaz'))).toBe(true);
    expect(view.relations.some((r) => r.overlay.some((o) => o.text.startsWith('Lipaz')))).toBe(true);
  });
});

describe('G — yalnızca patoloji görüntüsü', () => {
  it('görüntü → doku → çekirdek özellikleri; yorum ve tanı için model yok', () => {
    const run = analyzeImage(raster(pathologyImage()), { fileName: 'pathology_slide.jpg' });
    expect(run.modality!.primary.modality).toBe('PATHOLOGY');
    expect(run.result.status).toBe('PARTIAL');
    expect(run.result.observations.some((o) => o.measurement?.name === 'Çekirdek yoğunluğu')).toBe(true);
    for (const k of ['tissue-type', 'morphology', 'normal-compare', 'diagnosis']) expect(run.result.capabilities.find((c) => c.key === k)!.status).toBe('not-implemented');
  });
});

describe('H — yalnızca laboratuvar fotoğrafı', () => {
  it('belge OCR yoluna gider; "Glucose 118 mg/dL Reference 70-100" yapılandırılır ve raporun aralığı kullanılır', () => {
    const run = analyzeImage(raster(documentImage()), { fileName: 'tahlil.jpg' });
    expect(run.route).toBe('ocr-document');
    // OCR çıktısı (satır parçaları) → yapılandırılmış satır
    const items: TextItem[] = ['Glucose', '118', 'mg/dL', '70-100'].map((text, i) => ({ text, x: 40 + i * 110, y: 100, w: text.length * 6, h: 10, page: 1 }));
    const draft = parseReport(items, { method: 'ocr' });
    const row = draft.rows[0]!;
    expect(row).toMatchObject({ testKey: 'glucose', value: 118, status: 'high' });
    expect([row.refMin, row.refMax]).toEqual([70, 100]);
    const ref = resolveReference({ report: { min: row.refMin, max: row.refMax }, system: { min: 74, max: 106 } })!;
    expect(ref.source).toBe('report');
    expect(statusAgainst(118, ref)).toBe('high');
  });
});

describe('İkinci kabul testi — MR + radyoloji raporu + kan + önceki MR', () => {
  it('görüntü + rapor + laboratuvar + zaman analizi tek birleşik modelde, kaynaklar ayrı', () => {
    const now = reportFindingsFrom(extractFindings(REPORT_NEW, 'beyin'), { date: '2026-05-01', documentId: 'r2' });
    const old = reportFindingsFrom(extractFindings(REPORT_OLD, 'beyin'), { date: '2024-04-10', documentId: 'r1' });
    const labs = [lab('hba1c', 'HbA1c', 5.4, '%', 'normal', '2023-03-01', 4, 5.6), lab('hba1c', 'HbA1c', 5.8, '%', 'high', '2024-03-01', 4, 5.6), lab('hba1c', 'HbA1c', 6.3, '%', 'high', '2026-03-01', 4, 5.6)];
    const model = buildHealthModel({
      images: [{ run: mriRun, date: '2026-05-01', studyKey: 'now', modality: 'MRI', structure: 'brain', documentId: 'img2' }],
      reports: [
        { findings: old, date: '2024-04-10', studyKey: 'old', modality: 'MRI', structure: 'brain' },
        { findings: now, date: '2026-05-01', studyKey: 'now', modality: 'MRI', structure: 'brain' },
      ],
      labs,
    });
    expect(model.steps.map((s) => [s.step, s.ran])).toEqual([
      ['analyze_image', true],
      ['analyze_report', true],
      ['analyze_labs', true],
      ['compare_temporally', true],
      ['merge_available_evidence', true],
    ]);
    expect(model.trends.get('hba1c')!.direction).toBe('rising');
    const brain = model.organs.get('brain')!;
    // Sağ-sol ön kontrol asimetrisi organa ve zaman çizelgesine yazılmaz; rapor bulgusu yazılır.
    expect(brain.imageObservations).toHaveLength(0);
    expect(model.imageObservations.length).toBeGreaterThan(0);
    expect(brain.reportFindings.length).toBeGreaterThan(0);
    expect(new Set(model.timeline.map((e) => e.source))).toEqual(new Set(['LAB', 'RADIOLOGY_REPORT']));
    expect(model.concordance.length).toBeGreaterThan(0);
  });
});
