/**
 * Seri bölütlemesinin görüntüleyici ile panel arasında paylaşılan durumu: hangi seri sonucu, görünür mü,
 * hangi yapı vurgulu, hangi kesite gidilecek. Yalnızca bellekte (sağlık verisi yazılmaz).
 */
import { useSyncExternalStore } from 'react';
import { colorFor } from '../anatomy/palette';
import { TONE_HEX } from './tone';
import type { StoredVolume } from './imagingRecords';

export interface SeriesOverlayState {
  /** Serinin baş belgesi (notun bağlı olduğu belge). */
  headId: string;
  volume: StoredVolume;
  visible: boolean;
  highlight: number | null;
  /** Görüntüleyicinin gitmesi istenen belge (kesit) ve istek sayacı. */
  goto: { fileId: string; nonce: number } | null;
}

let state: SeriesOverlayState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setSeriesOverlay(next: SeriesOverlayState | null) {
  state = next;
  emit();
}

export function updateSeriesOverlay(patch: Partial<Omit<SeriesOverlayState, 'headId' | 'volume'>>) {
  if (!state) return;
  state = { ...state, ...patch };
  emit();
}

export function useSeriesOverlay(headId: string | undefined): SeriesOverlayState | null {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null,
  );
  return s && headId && s.headId === headId ? s : null;
}

/**
 * Etiket rengi: anatomik yapıda 3B modeldeki organ rengiyle aynı (tek renk kaynağı); modelin bulgu sınıfında
 * "dikkat" tonu (yazı ve simgeyle birlikte gösterilir, yalnızca renge dayanmaz).
 */
export function labelColor(v: StoredVolume, labelId: number): [number, number, number] {
  const s = v.structures.find((x) => x.labelId === labelId);
  const hex = s?.kind === 'finding' ? TONE_HEX.high : s?.structure ? colorFor(s.structure, s.part ?? null) : TONE_HEX.model;
  const n = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
