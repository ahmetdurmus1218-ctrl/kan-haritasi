/**
 * Görüntüleme ölçümleri: rapordaki sayılar ve kullanıcının görüntü üzerinde yaptığı ölçümler,
 * tahlil sonuçları gibi genel referans aralığına göre değerlendirilir.
 */
import {
  type ImagingMeasureDef,
  type RangeValue,
  type ResultStatus,
  type Sex,
  evaluateMeasure,
  findMeasurements,
  imagingMeasureByKey,
} from '@kh/catalog';
import type { ImagingNote } from './imagingRecords';

export interface MeasureResult {
  def: ImagingMeasureDef;
  value: number;
  site?: string;
  source: 'report' | 'manual';
  /** Rapordaki ifade ya da elle ölçümün açıklaması. */
  text?: string;
  manualId?: string;
  fileId: string;
  status: ResultStatus;
  range: RangeValue;
  grade?: string;
}

const ORDER: Record<ResultStatus, number> = { high: 0, low: 0, unknown: 1, normal: 2 };

export function measurementsOf(note: ImagingNote | undefined, region: string | undefined, sex: Sex): MeasureResult[] {
  if (!note) return [];
  const out: MeasureResult[] = [];
  for (const f of note.text.trim() ? findMeasurements(note.text, { region }) : []) {
    const def = imagingMeasureByKey.get(f.key);
    if (!def) continue;
    out.push({ def, value: f.value, site: f.site, source: 'report', text: f.text, fileId: note.fileId, ...evaluateMeasure(def, f.value, sex) });
  }
  for (const m of note.measurements ?? []) {
    const def = imagingMeasureByKey.get(m.key);
    if (!def) continue;
    out.push({ def, value: m.value, site: m.site, source: 'manual', text: m.detail, manualId: m.id, fileId: note.fileId, ...evaluateMeasure(def, m.value, sex) });
  }
  return out.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

export const isAbnormal = (m: Pick<MeasureResult, 'status'>) => m.status === 'high' || m.status === 'low';
