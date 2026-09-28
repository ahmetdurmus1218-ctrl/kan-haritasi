import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InsideId } from './registry';
import { INSIDE_CONTENT } from './content';

export interface InsideState {
  scene: InsideId;
  stage: number;
  playing: boolean;
  speed: number;
  /** Aşamalar kendiliğinden ilerlesin mi? */
  auto: boolean;
  selected: string | null;
  /** Sahne kişinin değerleriyle mi, tipik değerlerle mi gösteriliyor? */
  view: 'mine' | 'typical';
  /** Genel süreç anlatımı açıldı mı? (Açılmadıkça sahne kişisel durumu gösterir.) */
  process: boolean;
}

export interface InsideActions {
  setStage: (n: number) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  toggleAuto: () => void;
  select: (key: string | null) => void;
  setView: (v: 'mine' | 'typical') => void;
  startProcess: () => void;
  closeProcess: () => void;
}

export const SPEEDS = [0.25, 0.5, 1, 2] as const;
/** Bir aşamanın süresi (1× hızda, saniye). */
export const STAGE_SECONDS = 11;

/**
 * mode: 'temel' → süreç tipik değerlerle ("organ temelde nasıl çalışır"), 'benim' → sonuçlarıma göre;
 * ikisinde de süreç anlatımı hemen başlar.
 */
export function useInside(scene: InsideId | null, startSimulation: boolean, mode?: 'temel' | 'benim'): [InsideState | null, InsideActions] {
  const [state, setState] = useState<InsideState | null>(null);

  useEffect(() => {
    if (!scene) {
      setState(null);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = startSimulation || !!mode;
    setState({ scene, stage: start ? 1 : 0, playing: !reduced, speed: 1, auto: start, selected: null, view: mode === 'temel' ? 'typical' : 'mine', process: start });
  }, [scene, startSimulation, mode]);

  // Sahne değiştiği anda (efekt çalışmadan önceki çizimde) eski sahnenin aşama numarası yeni
  // sahnede geçersiz olabilir; bu yüzden geçerli durum çizim sırasında türetilir.
  const valid: InsideState | null = scene
    ? state && state.scene === scene
      ? state
      : { scene, stage: 0, playing: false, speed: 1, auto: false, selected: null, view: 'mine', process: false }
    : null;
  const count = scene ? INSIDE_CONTENT[scene].stages.length : 1;
  const setStage = useCallback(
    (n: number) => setState((s) => (s ? { ...s, stage: Math.max(0, Math.min(count - 1, n)), process: s.process || n > 0 } : s)),
    [count],
  );

  const actions = useMemo<InsideActions>(
    () => ({
      setStage,
      next: () =>
        setState((s) => {
          if (!s) return s;
          if (s.stage >= count - 1) return { ...s, auto: false };
          return { ...s, stage: s.stage + 1, process: true };
        }),
      prev: () => setState((s) => (s ? { ...s, stage: Math.max(0, s.stage - 1) } : s)),
      togglePlay: () => setState((s) => (s ? { ...s, playing: !s.playing } : s)),
      setSpeed: (speed) => setState((s) => (s ? { ...s, speed } : s)),
      toggleAuto: () => setState((s) => (s ? { ...s, auto: !s.auto, playing: s.auto ? s.playing : true } : s)),
      select: (selected) => setState((s) => (s ? { ...s, selected } : s)),
      setView: (view) => setState((s) => (s ? { ...s, view } : s)),
      startProcess: () => setState((s) => (s ? { ...s, process: true, stage: Math.max(1, s.stage), auto: true, playing: true } : s)),
      closeProcess: () => setState((s) => (s ? { ...s, process: false, stage: 0, auto: false } : s)),
    }),
    [count, setStage],
  );

  return [valid, actions];
}
