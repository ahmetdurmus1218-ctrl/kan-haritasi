/**
 * Seri (3B hacim) model sonucunu birleşik sağlık modelinin diline çevirir: anatomik yapılar → ModelStructure
 * (hacim ölçümüyle), "finding" türündeki sınıflar → MedicalFinding. Konum gerçek voksel kümesidir
 * (Localization 'volume'); köken model-derived (model, sürüm, SHA-256, lisans, belge, kesit).
 */
import { type ImageAnalysisRun, type MedicalFinding, type ModelStructure, type Provenance, anatomyForLabel, decodeRle, findingClass, score, sliceLabels } from '@kh/analysis';
import type { StoredVolume } from './imagingRecords';

export function volumeStructures(v: StoredVolume): { structures: ModelStructure[]; findings: MedicalFinding[] } {
  const conf = score(1, `${v.model.name} bölütlemesi`);
  const structures: ModelStructure[] = [];
  const findings: MedicalFinding[] = [];
  for (const s of v.structures) {
    const cls = findingClass(s);
    // Gösterim eşiğinin altındaki bulgu sınıfı birleşik modele girmez (panelde "eşik altı" diye ayrıca yazılır).
    if (cls === 'below') continue;
    const localization = { kind: 'volume' as const, labelId: s.labelId, voxels: s.voxels, volumeMl: s.volumeMl, centroid: s.centroid, bboxMin: s.bboxMin, bboxMax: s.bboxMax, sliceRange: s.sliceRange, centroidSlice: s.centroidSlice };
    const provenance: Provenance = {
      derivation: 'model-derived',
      source: 'IMAGE_MODEL',
      model: { id: v.model.id, name: v.model.name, version: v.model.version, kind: 'learned', local: true, sha256: v.model.sha256, license: v.model.license },
      ...(v.fileIds[s.centroidSlice] ? { documentId: v.fileIds[s.centroidSlice] } : {}),
      frame: s.centroidSlice,
      at: v.at,
    };
    const anatomicalStructure = anatomyForLabel(s, localization, conf);
    const id = `vol-${v.model.id}-${s.labelId}`;
    if (cls === 'finding')
      findings.push({
        id,
        source: 'IMAGE_MODEL',
        provenance,
        finding: s.name,
        model: { id: v.model.id, name: v.model.name, version: v.model.version, kind: 'learned', local: true },
        confidence: conf,
        localization,
        ...(anatomicalStructure ? { anatomicalStructure } : {}),
        limitations: [v.cascadeFrom ? `Ayrı bir patoloji modelinin (${v.model.name}) bölütlemesidir; anatomi sonucuna göre kırpılan bölgede çalıştı. Tanı değildir; hekim değerlendirmesi gerekir.` : 'Bölütleme modelinin bir sınıfıdır; ayrı bir lezyon modeli değildir. Tanı değildir.'],
      });
    else
      structures.push({
        id,
        key: s.key,
        name: s.name,
        source: 'IMAGE_MODEL',
        provenance,
        localization,
        ...(anatomicalStructure ? { anatomicalStructure } : {}),
        measurements: [{ name: 'Hacim', value: s.volumeMl, unit: 'mL', method: `${v.model.name} bölütlemesinden (voksel sayısı × ${v.grid.spacing} mm³)`, ...(cls === 'normal' && s.normalMaxMl !== undefined ? { refMax: s.normalMaxMl } : {}) }],
        confidence: conf,
        limitations: [
          cls === 'normal'
            ? `Fizyolojik sınırda (≤ ${s.normalMaxMl} mL). ${s.normalNote ?? ''} Tanı değildir.`.replace('  ', ' ')
            : 'Bölütleme normal anatomiyi gösterir; bölütlenmesi organın sağlıklı olduğu anlamına gelmez. Hacim referans aralığıyla karşılaştırılmadı.',
        ],
      });
  }
  return { structures, findings };
}

/** Birleşik sağlık modeli için: serinin model sonucu ayrı bir görüntü çalışması olarak. */
export function volumeRun(v: StoredVolume, reportAvailable: boolean): ImageAnalysisRun {
  const { structures, findings } = volumeStructures(v);
  return {
    id: `vol-${v.at}`,
    at: v.at,
    quality: { usable: true, score: 1, issues: [], metrics: { width: 0, height: 0, edgeWidth: 0, glareFraction: 0, contrast: null, median: null } },
    route: 'image-analysis',
    kind: 'model',
    modelFindings: findings,
    modelStructures: structures,
    modelInfo: { id: v.model.id, name: v.model.name, version: v.model.version, sha256: v.model.sha256, license: v.model.license, at: v.at },
    coverage: { kind: 'dicom-series', frames: v.geometry.slices, label: `DICOM seri · ${v.geometry.slices} kesit` },
    sequence: { source: 'none', text: '—' },
    reportAvailable,
    statements: [],
    result: { adapterId: 'local-volume-model', modality: v.modality, status: 'AVAILABLE', model: { id: v.model.id, name: v.model.name, version: v.model.version, kind: 'learned', local: true }, capabilities: [], observations: [], limitations: [], summary: v.cascadeFrom ? `${v.model.name}: ${findings.length ? findings.map((f) => f.finding).join(', ') : 'modelin bulgu sınıfı bu seride bulunmadı'}.` : `${v.model.name}: ${v.structures.length} yapı bölütlendi.` },
  };
}

const cache = new WeakMap<StoredVolume, Uint8Array>();

/** Görüntüleyici için: hacim içi k kesitinin piksel etiketleri. */
export function storedSliceLabels(v: StoredVolume, k: number): Uint8Array {
  let labels = cache.get(v);
  if (!labels) {
    labels = decodeRle(v.labelsRle, v.grid.shape[0] * v.grid.shape[1] * v.grid.shape[2]);
    cache.set(v, labels);
  }
  return sliceLabels({ grid: v.grid, labels }, v.geometry, k);
}
