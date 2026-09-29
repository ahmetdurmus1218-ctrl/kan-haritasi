import { type Vault, randomId } from '@kh/vault';

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

/** Görüntüleme raporundan okunan (ve kullanıcının düzeltebildiği) metin ve elle yapılan ölçümler; kasada şifreli. */
export interface ImagingNote {
  id: string;
  fileId: string;
  text: string;
  method: 'text' | 'ocr' | 'mixed' | 'manual';
  updatedAt: string;
  measurements?: ManualMeasurement[];
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
    .map((n) => ({ ...n, measurements: Array.isArray(n.measurements) ? n.measurements.filter(isManual) : undefined }));
}

export async function noteForFile(vault: Vault, fileId: string): Promise<ImagingNote | undefined> {
  return (await listImagingNotes(vault)).find((n) => n.fileId === fileId);
}

/** Aynı belgenin eski notu yenisiyle değiştirilir; elle yapılan ölçümler korunur. */
export async function saveImagingNote(
  vault: Vault,
  fileId: string,
  text: string,
  method: ImagingNote['method'],
  measurements?: ManualMeasurement[],
): Promise<ImagingNote> {
  const previous = (await listImagingNotes(vault)).filter((n) => n.fileId === fileId);
  const kept = measurements ?? previous.flatMap((p) => p.measurements ?? []);
  const note: ImagingNote = { id: randomId(), fileId, text: text.slice(0, MAX_NOTE_CHARS), method, updatedAt: new Date().toISOString() };
  if (kept.length) note.measurements = kept.slice(0, 200);
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
