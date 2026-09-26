import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { CameraControlsImpl } from '@react-three/drei';
import { BufferGeometry, Color, Fog, IcosahedronGeometry, LatheGeometry, Vector2, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { InsideState } from './state';

/**
 * İçeri-gir sahneleri için ortak araçlar. Bu sahnelerdeki her şey prosedürel ve temsilidir
 * (gerçek mikroskopi verisi değildir); arayüz bunu sürekli etiketler.
 */

export interface InsideSceneProps {
  state: InsideState;
  onSelect: (key: string | null) => void;
  reducedMotion: boolean;
}

/** Sahne ortamı: arka plan, sis ve ortam ışığı yoğunluğu; sahneden çıkınca geri alınır. */
export function useAtmosphere(background: string, fog: [string, number, number] | null, envIntensity = 0.35) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const prev = { bg: scene.background, fog: scene.fog, env: scene.environmentIntensity };
    scene.background = new Color(background);
    scene.fog = fog ? new Fog(fog[0], fog[1], fog[2]) : null;
    scene.environmentIntensity = envIntensity;
    invalidate();
    return () => {
      scene.background = prev.bg;
      scene.fog = prev.fog;
      scene.environmentIntensity = prev.env;
    };
  }, [scene, background, fog?.[0], fog?.[1], fog?.[2], envIntensity, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps
}

export interface Shot {
  position: [number, number, number];
  target: [number, number, number];
}

/** Sahneye girerken kamerayı hemen yerleştirir, sonra aşama çekimine yumuşakça gider. */
export function useStageCamera(shot: Shot, limits: { min: number; max: number }, entry?: Shot) {
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null;
  const placed = useRef(false);
  useEffect(() => {
    if (!controls) return;
    controls.minDistance = limits.min;
    controls.maxDistance = limits.max;
    if (!placed.current) {
      placed.current = true;
      const e = entry ?? shot;
      void controls.setFocalOffset(0, 0, 0, false);
      void controls.setLookAt(...e.position, ...e.target, false);
    }
    void controls.setLookAt(...shot.position, ...shot.target, true);
  }, [controls, shot.position.join(), shot.target.join(), limits.min, limits.max]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Yalnızca oynatılırken ve hıza göre ilerleyen simülasyon saati. */
export function useSimClock(state: InsideState, reducedMotion: boolean) {
  const time = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const live = useRef({ playing: state.playing, speed: state.speed });
  live.current = { playing: state.playing, speed: state.speed };
  useFrame((_, dt) => {
    if (!live.current.playing) return;
    time.current += Math.min(dt, 0.05) * live.current.speed * (reducedMotion ? 0.35 : 1);
    invalidate();
  });
  useEffect(() => invalidate(), [state.playing, state.speed, state.stage, invalidate]);
  return time;
}

/** Değeri hedefe yumuşakça yaklaştıran yardımcı (aşama geçişlerinde ani sıçrama olmasın). */
export function useEased(target: number, rate = 1.6) {
  const v = useRef(target);
  const t = useRef(target);
  t.current = target;
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const d = t.current - v.current;
    if (Math.abs(d) < 1e-4) {
      v.current = t.current;
      return;
    }
    v.current += d * (1 - Math.exp(-Math.min(dt, 0.1) * rate));
    invalidate();
  });
  return v;
}

/** Alyuvar: Evans–Fung bikonkav disk profili (çap 1). */
export function rbcGeometry(segments = 28): BufferGeometry {
  const pts: Vector2[] = [];
  const n = 14;
  const h = (rho: number) => 0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.207 + 2.003 * rho * rho - 1.123 * rho ** 4);
  for (let i = 0; i <= n; i++) {
    const rho = Math.sin((i / n) * (Math.PI / 2));
    pts.push(new Vector2(rho * 0.5, h(rho) * 0.5));
  }
  for (let i = n - 1; i >= 0; i--) {
    const rho = Math.sin((i / n) * (Math.PI / 2));
    pts.push(new Vector2(rho * 0.5, -h(rho) * 0.5));
  }
  const g = new LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/** Hafif pürüzlü küre (hücre yüzeyi). */
export function bumpySphere(detail = 2, amount = 0.08, seed = 1): BufferGeometry {
  const raw = new IcosahedronGeometry(1, detail + 1);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  // Köşeleri birleştir: yumuşak normaller (köşeli "low-poly" görünüm olmasın)
  const g = mergeVertices(raw);
  raw.dispose();
  const pos = g.attributes.position!;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) * Math.sin(v.z * 6.7 + seed * 3);
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Deterministik rastgele (sahneler her açılışta aynı görünsün). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Işık: kamerayı izleyen yumuşak nokta ışığı (endoskop hissi). */
export function Headlight({ intensity = 5, color = '#ffe8e0', distance = 9 }: { intensity?: number; color?: string; distance?: number }) {
  const ref = useRef<import('three').PointLight>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    ref.current?.position.copy(camera.position);
  });
  return <pointLight ref={ref} intensity={intensity} color={color} distance={distance} decay={1.4} />;
}

export function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: unknown[] = []): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}
