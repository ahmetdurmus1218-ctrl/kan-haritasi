import { type Vault, randomId } from '@kh/vault';
import type { AnalysisStatus, ImageObservation, MedicalFinding, Modality, ModelStructure, SequenceInfo, StudyCoverage, VolumeStructure } from '@kh/analysis';

/** Kullanıcının görüntü üzerinde yaptığı ölçüm (cetvel, yoğunluk, oran). */
export interface ManualMeasurement {
  id: string;
  /** Ölçüm kataloğu anahtarı (ör. "dalak-boyu"). */
  key: string;
  /** Kanonik birimde değer. */
  value: number;
  site?: string;
  /** Nasıl ölçüldüğü (ör. "Kesit 12 · iki çizgi: 142 / 280 mm"). */
  detail?: string;
  createdAt: string;
}

/**
 * Sağ-sol simetri ön kontrolünün kaydedilen özeti. Yalnızca kullanıcı
 * "sonuçlarıma ekle" dediğinde `confirmed` olur ve 3B vurgulara katılır. Tanı değildir.
 */
export interface StoredReview {
  at: string;
  /** İncelenen dosya (DICOM serisinde açık olan kesit). */
  sourceId: string;
  panels: number;
  compared: number;
  headLike: boolean;
  regions: Array<{ panel: number; side: 'left' | 'right'; vertical: 'top' | 'middle' | 'bottom'; brighter: boolean; areaPct: number; strength: number }>;
  confirmed: boolean;
}

/**
 * Ham görüntü analizinin (rapordan bağımsız) kaydedilen özeti. Kaynağı her zaman IMAGE_ANALYSIS'tir;
 * Vücudum / organ sayfaları ve zaman çizelgesi bunu "doğrulanmamış görüntü gözlemi" olarak gösterir.
 */
export interface StoredAnalysis {
  at: string;
  /** İncelenen dosya (DICOM serisinde açık olan kesit). */
  sourceId: string;
  modality: Modality;
  modalitySource: string;
  structure?: string;
  status: AnalysisStatus;
  adapterId: string;
  model: { id: string; name: string; version: string };
  summary: string;
  observations: ImageObservation[];
  qualityIssues: string[];
  /** İnceleme kapsamı ve sekans (eski kayıtlarda yok). */
  coverage?: StudyCoverage;
  sequence?: SequenceInfo;
  kind?: 'precheck' | 'model';
  /** Yerel tıbbi modelin bulguları ve kimliği (model çalıştıysa). */
  modelFindings?: MedicalFinding[];
  /** Yerel modelin bölütlediği anatomik yapılar (bulgu değil). */
  modelStructures?: ModelStructure[];
  /** Çalışan tüm yerel modeller ve aralarındaki uyuşmazlıklar. */
  models?: Array<{ id: string; name: string; version: string; sha256?: string; license?: string }>;
  disagreements?: string[];
  modelInfo?: { id: string; name: string; version: string; sha256?: string; license?: string; at: string };
}

/**
 * 3B hacim modelinin (ör. TotalSegmentator) seri sonucu: etiket hacmi (RLE), yapılar, geometri ve model kökeni.
 * Serinin baş belgesinin notunda, kasada şifreli durur.
 */
export interface StoredVolume {
  at: string;
  model: { id: string; name: string; version: string; sha256: string; license: string; source: string };
  /** Hacim içi kesit sırası → belge kimliği. */
  fileIds: string[];
  geometry: { rows: number; cols: number; slices: number; origin: [number, number, number]; iVec: [number, number, number]; jVec: [number, number, number]; kVec: [number, number, number] };
  grid: { shape: [number, number, number]; spacing: number | [number, number, number]; lo: [number, number, number] };
  labelsRle: number[];
  structures: VolumeStructure[];
  tiles: number;
  seconds: number;
  modality: Modality;
  /** Basamaklı (patoloji) model: hangi anatomi sonucuna göre kırpıldığı (model kimliği ve sonuç zamanı). */
  cascadeFrom?: { model: string; at: string };
}

function isVolume(v: unknown): v is StoredVolume {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.at === 'string' && Array.isArray(o.fileIds) && Array.isArray(o.labelsRle) && Array.isArray(o.structures) && typeof o.grid === 'object' && typeof o.geometry === 'object';
}

function isAnalysis(v: unknown): v is StoredAnalysis {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.at === 'string' && typeof o.modality === 'string' && typeof o.status === 'string' && Array.isArray(o.observations);
}

function isReview(v: unknown): v is StoredReview {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.at === 'string' && typeof o.sourceId === 'string' && typeof o.compared === 'number' && Array.isArray(o.regions) && typeof o.confirmed === 'boolean';
}

/** Görüntüleme raporundan okunan (ve kullanıcının düzeltebildiği) metin ve elle yapılan ölçümler; kasada şifreli. */
export interface ImagingNote {
  id: string;
  fileId: string;
  text: string;
  method: 'text' | 'ocr' | 'mixed' | 'manual';
  updatedAt: string;
  measurements?: ManualMeasurement[];
  review?: StoredReview;
  analysis?: StoredAnalysis;
  volume?: StoredVolume;
  /** Aynı seride anatomi sonucuna dayanarak çalışan patoloji (basamaklı) modellerinin sonuçları; model başına bir tane. */
  pathology?: StoredVolume[];
}

function isManual(v: unknown): v is ManualMeasurement {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.key === 'string' && typeof o.value === 'number' && Number.isFinite(o.value) && typeof o.createdAt === 'string';
}

export const MAX_NOTE_CHARS = 20_000;

function isNote(v: unknown): v is ImagingNote {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.fileId === 'string' && typeof o.text === 'string' && typeof o.updatedAt === 'string';
}

export async function listImagingNotes(vault: Vault): Promise<ImagingNote[]> {
  const { items } = await vault.listRecords<ImagingNote>('imaging');
  return items
    .map((i) => i.value)
    .filter(isNote)
    .map((n) => ({
      ...n,
      measurements: Array.isArray(n.measurements) ? n.measurements.filter(isManual) : undefined,
      review: isReview(n.review) ? n.review : undefined,
      analysis: isAnalysis(n.analysis) ? n.analysis : undefined,
      volume: isVolume(n.volume) ? n.volume : undefined,
      pathology: Array.isArray(n.pathology) ? n.pathology.filter(isVolume) : undefined,
    }));
}

export async function noteForFile(vault: Vault, fileId: string): Promise<ImagingNote | undefined> {
  return (await listImagingNotes(vault)).find((n) => n.fileId === fileId);
}

/** Aynı belgenin eski notu yenisiyle değiştirilir; elle yapılan ölçümler ve inceleme korunur. */
export async function saveImagingNote(
  vault: Vault,
  fileId: string,
  text: string,
  method: ImagingNote['method'],
  measurements?: ManualMeasurement[],
  review?: StoredReview | null,
  analysis?: StoredAnalysis | null,
  volume?: StoredVolume | null,
  pathology?: StoredVolume[] | null,
): Promise<ImagingNote> {
  const previous = (await listImagingNotes(vault)).filter((n) => n.fileId === fileId);
  const kept = measurements ?? previous.flatMap((p) => p.measurements ?? []);
  const keptReview = review === undefined ? previous.find((p) => p.review)?.review : (review ?? undefined);
  const keptAnalysis = analysis === undefined ? previous.find((p) => p.analysis)?.analysis : (analysis ?? undefined);
  const keptVolume = volume === undefined ? previous.find((p) => p.volume)?.volume : (volume ?? undefined);
  const note: ImagingNote = { id: randomId(), fileId, text: text.slice(0, MAX_NOTE_CHARS), method, updatedAt: new Date().toISOString() };
  if (kept.length) note.measurements = kept.slice(0, 200);
  if (keptReview) note.review = { ...keptReview, regions: keptReview.regions.slice(0, 40) };
  if (keptAnalysis) note.analysis = { ...keptAnalysis, observations: keptAnalysis.observations.slice(0, 24) };
  // Anatomi sonucu silinir ya da yenilenirse ona dayanan patoloji sonuçları da düşer (kırpma artık geçersiz).
  const keptPathology = (pathology === undefined ? previous.find((p) => p.pathology?.length)?.pathology : (pathology ?? undefined))?.filter((v) => keptVolume && v.cascadeFrom?.at === keptVolume.at);
  if (keptVolume) note.volume = keptVolume;
  if (keptPathology?.length) note.pathology = keptPathology.slice(0, 8);
  await vault.putRecord('imaging', note.id, note);
  for (const p of previous) await vault.deleteRecord('imaging', p.id);
  return note;
}

export async function deleteImagingNotes(vault: Vault, fileId: string): Promise<void> {
  for (const n of (await listImagingNotes(vault)).filter((x) => x.fileId === fileId)) await vault.deleteRecord('imaging', n.id);
}

export async function addManualMeasurement(vault: Vault, fileId: string, m: Omit<ManualMeasurement, 'id' | 'createdAt'>): Promise<ImagingNote> {
  const current = await noteForFile(vault, fileId);
  const entry: ManualMeasurement = { ...m, id: randomId(), createdAt: new Date().toISOString() };
  return saveImagingNote(vault, fileId, current?.text ?? '', current?.method ?? 'manual', [...(current?.measurements ?? []), entry]);
}

export async function removeManualMeasurement(vault: Vault, fileId: string, id: string): Promise<void> {
  const current = await noteForFile(vault, fileId);
  if (!current) return;
  await saveImagingNote(vault, fileId, current.text, current.method, (current.measurements ?? []).filter((x) => x.id !== id));
}

/** İnceleme özetini kaydeder (null: siler). Metin ve ölçümler korunur. */
export async function saveReview(vault: Vault, fileId: string, review: StoredReview | null): Promise<ImagingNote> {
  const current = await noteForFile(vault, fileId);
  return saveImagingNote(vault, fileId, current?.text ?? '', current?.method ?? 'manual', current?.measurements ?? [], review);
}

/** Ham görüntü analizinin özetini kaydeder (null: siler). Metin, ölçümler ve inceleme korunur. */
export async function saveAnalysis(vault: Vault, fileId: string, analysis: StoredAnalysis | null): Promise<ImagingNote> {
  const current = await noteForFile(vault, fileId);
  return saveImagingNote(vault, fileId, current?.text ?? '', current?.method ?? 'manual', current?.measurements ?? [], undefined, analysis);
}

/** Patoloji (basamaklı) model sonucunu ekler / değiştirir (null: o modelin sonucunu siler). */
export async function savePathologyVolume(vault: Vault, fileId: string, modelId: string, volume: StoredVolume | null): Promise<ImagingNote> {
  const current = await noteForFile(vault, fileId);
  const rest = (current?.pathology ?? []).filter((v) => v.model.id !== modelId);
  return saveImagingNote(vault, fileId, current?.text ?? '', current?.method ?? 'manual', current?.measurements ?? [], undefined, undefined, undefined, volume ? [...rest, volume] : rest);
}

export async function saveVolume(vault: Vault, fileId: string, volume: StoredVolume | null): Promise<ImagingNote> {
  const current = await noteForFile(vault, fileId);
  return saveImagingNote(vault, fileId, current?.text ?? '', current?.method ?? 'manual', current?.measurements ?? [], undefined, undefined, volume);
}
