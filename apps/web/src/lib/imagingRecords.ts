import { type Vault, randomId } from '@kh/vault';

/** Görüntüleme raporundan okunan (ve kullanıcının düzeltebildiği) metin; kasada şifreli. */
export interface ImagingNote {
  id: string;
  fileId: string;
  text: string;
  method: 'text' | 'ocr' | 'mixed' | 'manual';
  updatedAt: string;
}

export const MAX_NOTE_CHARS = 20_000;

function isNote(v: unknown): v is ImagingNote {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.fileId === 'string' && typeof o.text === 'string' && typeof o.updatedAt === 'string';
}

export async function listImagingNotes(vault: Vault): Promise<ImagingNote[]> {
  const { items } = await vault.listRecords<ImagingNote>('imaging');
  return items.map((i) => i.value).filter(isNote);
}

export async function noteForFile(vault: Vault, fileId: string): Promise<ImagingNote | undefined> {
  return (await listImagingNotes(vault)).find((n) => n.fileId === fileId);
}

/** Aynı belgenin eski notu yenisiyle değiştirilir. */
export async function saveImagingNote(vault: Vault, fileId: string, text: string, method: ImagingNote['method']): Promise<ImagingNote> {
  const previous = (await listImagingNotes(vault)).filter((n) => n.fileId === fileId);
  const note: ImagingNote = { id: randomId(), fileId, text: text.slice(0, MAX_NOTE_CHARS), method, updatedAt: new Date().toISOString() };
  await vault.putRecord('imaging', note.id, note);
  for (const p of previous) await vault.deleteRecord('imaging', p.id);
  return note;
}

export async function deleteImagingNotes(vault: Vault, fileId: string): Promise<void> {
  for (const n of (await listImagingNotes(vault)).filter((x) => x.fileId === fileId)) await vault.deleteRecord('imaging', n.id);
}
