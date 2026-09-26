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
}

export interface InsideActions {
  setStage: (n: number) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  toggleAuto: () => void;
  select: (key: string | null) => void;
}

export const SPEEDS = [0.25, 0.5, 1, 2] as const;
/** Bir aşamanın süresi (1× hızda, saniye). */
export const STAGE_SECONDS = 11;

export function useInside(scene: InsideId | null, startSimulation: boolean): [InsideState | null, InsideActions] {
  const [state, setState] = useState<InsideState | null>(null);

  useEffect(() => {
    if (!scene) {
      setState(null);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setState({ scene, stage: startSimulation ? 1 : 0, playing: !reduced, speed: 1, auto: startSimulation, selected: null });
  }, [scene, startSimulation]);

  // Sahne değiştiği anda (efekt çalışmadan önceki çizimde) eski sahnenin aşama numarası yeni
  // sahnede geçersiz olabilir; bu yüzden geçerli durum çizim sırasında türetilir.
  const valid: InsideState | null = scene ? (state && state.scene === scene ? state : { scene, stage: 0, playing: false, speed: 1, auto: false, selected: null }) : null;
  const count = scene ? INSIDE_CONTENT[scene].stages.length : 1;
  const setStage = useCallback((n: number) => setState((s) => (s ? { ...s, stage: Math.max(0, Math.min(count - 1, n)) } : s)), [count]);

  const actions = useMemo<InsideActions>(
    () => ({
      setStage,
      next: () =>
        setState((s) => {
          if (!s) return s;
          if (s.stage >= count - 1) return { ...s, auto: false };
          return { ...s, stage: s.stage + 1 };
        }),
      prev: () => setState((s) => (s ? { ...s, stage: Math.max(0, s.stage - 1) } : s)),
      togglePlay: () => setState((s) => (s ? { ...s, playing: !s.playing } : s)),
      setSpeed: (speed) => setState((s) => (s ? { ...s, speed } : s)),
      toggleAuto: () => setState((s) => (s ? { ...s, auto: !s.auto, playing: s.auto ? s.playing : true } : s)),
      select: (selected) => setState((s) => (s ? { ...s, selected } : s)),
    }),
    [count, setStage],
  );

  return [valid, actions];
}
