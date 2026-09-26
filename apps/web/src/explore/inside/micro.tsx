import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { type BufferGeometry, CatmullRomCurve3, Color, type Curve, type InstancedMesh, type Material, Matrix4, Quaternion, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './kit';

/**
 * Mikro sahneler için yeniden kullanılabilir yapı taşları: damar/kanal tüpleri, eğri boyunca
 * akan hücreler, iki nokta arasında gidip gelen moleküller ve sabit hücre kümeleri.
 * Hepsi tek çizim çağrılı (instanced) çalışır.
 */

export type Pick = (key: string) => (e: ThreeEvent<MouseEvent>) => void;

export function makePick(onSelect: (key: string | null) => void): Pick {
  return (key) => (e) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    onSelect(key);
  };
}

const M = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const C = new Color();
const HIDE = new Matrix4().makeScale(0, 0, 0);

export function curve(points: [number, number, number][], closed = false): CatmullRomCurve3 {
  return new CatmullRomCurve3(
    points.map((p) => new Vector3(...p)),
    closed,
    'catmullrom',
    0.5,
  );
}

/** Birden çok eğriyi tek tüp ağında birleştirir. */
export function Tubes({
  curves,
  radius,
  material,
  onClick,
  segments = 64,
  radial = 10,
  visible = true,
}: {
  curves: Curve<Vector3>[];
  radius: number | number[];
  material: Material;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  segments?: number;
  radial?: number;
  visible?: boolean;
}) {
  const geometry = useMemo(() => {
    const parts = curves.map((c, i) => new TubeGeometry(c, segments, Array.isArray(radius) ? (radius[i] ?? radius[0]!) : radius, radial, false));
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [curves, radius, segments, radial]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} onClick={onClick} visible={visible} />;
}

/** Eğriler boyunca akan nesneler (ör. kılcalda alyuvar). */
export function CurveMovers({
  curves,
  count,
  geometry,
  material,
  time,
  speed = 0.08,
  size = 0.06,
  seed = 1,
  jitter = 0,
  tumble = 1,
  color,
  onClick,
  visible = true,
  flat = false,
  shown,
}: {
  curves: Curve<Vector3>[];
  /** Ayrılan en fazla örnek sayısı. */
  count: number;
  /** Görünen örnek sayısı (kişisel değere göre değişir; yeniden oluşturmadan). */
  shown?: number;
  geometry: BufferGeometry;
  material: Material;
  time: RefObject<number>;
  speed?: number;
  size?: number;
  seed?: number;
  jitter?: number;
  tumble?: number;
  /** u: eğri üzerindeki konum (0..1) → renk. */
  color?: (u: number, i: number, out: Color) => Color;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  visible?: boolean;
  flat?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => ({
      c: i % curves.length,
      o: r(),
      v: 0.75 + r() * 0.5,
      j: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(jitter),
      axis: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      spin: r() * 6.28,
    }));
  }, [count, curves.length, seed, jitter]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = time.current ?? 0;
    mesh.count = Math.min(data.length, Math.max(0, shown ?? data.length));
    for (let i = 0; i < mesh.count; i++) {
      const d = data[i]!;
      const cv = curves[d.c]!;
      const u = (d.o + t * speed * d.v) % 1;
      cv.getPointAt(u, P).add(d.j);
      Q.setFromAxisAngle(d.axis, d.spin + t * tumble);
      if (flat) S.set(size, size, size);
      else S.setScalar(size);
      M.compose(P, Q, S);
      mesh.setMatrixAt(i, M);
      if (color) mesh.setColorAt(i, color(u, i, C));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geometry, material, count]} onClick={onClick} visible={visible} frustumCulled={false} />;
}

export interface Hop {
  from: Vector3;
  to: Vector3;
  /** Yol ortasında kavis (isteğe bağlı). */
  lift?: Vector3;
}

/** İki nokta arasında tekrar tekrar giden moleküller (difüzyon, salgı, emilim). */
export function Hoppers({
  hops,
  count,
  geometry,
  material,
  time,
  duration = 3,
  size = 0.04,
  seed = 5,
  active = true,
  fade = true,
  onClick,
  color,
  shown,
}: {
  hops: Hop[];
  count: number;
  shown?: number;
  geometry: BufferGeometry;
  material: Material;
  time: RefObject<number>;
  duration?: number;
  size?: number;
  seed?: number;
  active?: boolean;
  fade?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  color?: (k: number, out: Color) => Color;
}) {
  const ref = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => ({ h: i % Math.max(1, hops.length), o: r(), v: 0.8 + r() * 0.4 }));
  }, [count, hops.length, seed]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = time.current ?? 0;
    mesh.count = Math.min(data.length, Math.max(0, shown ?? data.length));
    for (let i = 0; i < mesh.count; i++) {
      const d = data[i]!;
      const hop = hops[d.h];
      if (!active || !hop) {
        mesh.setMatrixAt(i, HIDE);
        continue;
      }
      const k = (d.o + t / (duration * d.v)) % 1;
      const e = k * k * (3 - 2 * k);
      P.lerpVectors(hop.from, hop.to, e);
      if (hop.lift) P.addScaledVector(hop.lift, Math.sin(Math.PI * e));
      const s = size * (fade ? Math.min(1, Math.sin(Math.PI * k) * 3) : 1);
      S.setScalar(Math.max(0.0001, s));
      Q.identity();
      M.compose(P, Q, S);
      mesh.setMatrixAt(i, M);
      if (color) mesh.setColorAt(i, color(k, C));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geometry, material, count]} onClick={onClick} frustumCulled={false} />;
}

export interface CellSpec {
  p: Vector3;
  s: number | Vector3;
  q?: Quaternion;
  color?: string;
}

/** Sabit hücre kümesi; `animate` ile her karede ölçek/renk ayarlanabilir. */
export function Cells({
  cells,
  geometry,
  material,
  onClick,
  time,
  animate,
  visible = true,
}: {
  cells: CellSpec[];
  geometry: BufferGeometry;
  material: Material;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  time?: RefObject<number>;
  /** i, t → ölçek çarpanı; renk değiştirmek için out'u doldurup true döndür. */
  animate?: (i: number, t: number, out: Color) => { scale?: number; color?: boolean } | void;
  visible?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const place = (mesh: InstancedMesh, t: number) => {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      const a = animate?.(i, t, C);
      const k = a?.scale ?? 1;
      if (typeof c.s === 'number') S.setScalar(c.s * k);
      else S.copy(c.s).multiplyScalar(k);
      M.compose(c.p, c.q ?? Q.identity(), S);
      mesh.setMatrixAt(i, M);
      if (a?.color) mesh.setColorAt(i, C);
      else if (c.color) mesh.setColorAt(i, C.set(c.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  useEffect(() => {
    if (ref.current) place(ref.current, time?.current ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells]);
  useFrame(() => {
    if (animate && ref.current) place(ref.current, time?.current ?? 0);
  });
  return <instancedMesh ref={ref} args={[geometry, material, cells.length]} onClick={onClick} visible={visible} frustumCulled={false} />;
}

/** Küre yüzeyine eşit dağılmış noktalar (Fibonacci). */
export function fibonacciSphere(n: number, radius: number, center = new Vector3()): Vector3[] {
  const out: Vector3[] = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = g * i;
    out.push(new Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(radius).add(center));
  }
  return out;
}

/** Küre üzerinde gezinen rastgele bir kılcal eğrisi. */
export function sphereCurve(center: Vector3, radius: number, r: () => number, turns = 1.2, points = 9): CatmullRomCurve3 {
  const a = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
  const b = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
  const axis = new Vector3().crossVectors(a, b).normalize();
  const pts: Vector3[] = [];
  const q = new Quaternion();
  for (let i = 0; i < points; i++) {
    const ang = (i / (points - 1)) * Math.PI * turns;
    q.setFromAxisAngle(axis, ang);
    const p = a.clone().applyQuaternion(q);
    p.add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.25)).normalize();
    pts.push(p.multiplyScalar(radius).add(center));
  }
  return new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

/** Bir hücrenin "yüzüne" dik yönlendirme (yüzey hücreleri için). */
export function faceOut(normal: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), normal.clone().normalize());
}
