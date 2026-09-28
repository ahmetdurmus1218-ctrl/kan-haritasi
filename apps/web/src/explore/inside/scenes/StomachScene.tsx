import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, makePick } from '../micro';

/**
 * Mide duvarı (temsili kesit bloğu). Yüzeyde mide çukurcukları (foveola) ve onlardan inen tübüler
 * mide bezleri: üstte soluk mukus boyun hücreleri, ortada pembe ve üçgen pariyetal hücreler,
 * derinde mor esas (şef) hücreler. Altta kas tabakası (muscularis mucosae), damarlı submukoza ve
 * üç yönlü kas katmanı. Boşlukta (lümen) asit, pepsin, parçalanan protein zincirleri, demir ve B12;
 * iç faktör–B12 çiftleri çıkışa (bağırsağa, +x) doğru ilerler. Ölçekler anlaşılır olsun diye değiştirilmiştir.
 */

const X0 = -5;
const X1 = 5;
const Z0 = -1.6;
const Z1 = 0.8;
const SURF = 2;
const GLAND_BOTTOM = -0.42;
const MM_TOP = -0.6;
const MM_BOT = -0.85;
const SUB_BOT = -2.05;
const ME_TOP = -2.1;
const ME_BOT = -3.65;
const GX = [-4.2, -3, -1.8, -0.6, 0.6, 1.8, 3, 4.2];
const RING = 0.2;
const RINGS = 11;
const AROUND = 7;
const LINKS = 7;
const LINK = 0.17;
const CHAINS = 10;
const IF_MAX = 30;
const B12_MAX = 60;

const SHOTS = [
  { position: [2.6, 2.4, 11.8], target: [0, 0.3, -0.3] },
  { position: [-0.1, 1.1, 3.5], target: [-0.6, 0.7, 0.4] },
  { position: [1.5, 2.5, 4.6], target: [0.6, 1.5, 0.3] },
  { position: [-2.0, 2.8, 5.8], target: [-1.8, 2.2, -0.2] },
  { position: [1.6, 3.4, 3.9], target: [1.2, 2.3, 0] },
  { position: [5.6, 3.7, 6.4], target: [3.0, 2.8, -0.3] },
] as const;

const M4 = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const A = new Vector3();
const B = new Vector3();
const D = new Vector3();
const OFF = new Vector3();
const DRIFT = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const HIDE = new Matrix4().makeScale(0, 0, 0);

function smooth(a: number, b: number, x: number): number {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** Bez ekseni: hafifçe kıvrılan dikey tüp. */
function axisX(gx: number, y: number, ph: number): number {
  return gx + 0.05 * Math.sin(y * 2.1 + ph);
}

const clampZ = (z: number) => Math.max(-1.35, Math.min(0.6, z));

interface Chain {
  c: Vector3;
  dir: Vector3;
  perp: Vector3;
  ph: number;
  spread: Vector3[];
  cut: Vector3[];
}

interface Traveler {
  c: number;
  o: number;
  v: number;
  off: Vector3;
}

function bead(ch: Chain, k: number, out: Vector3): Vector3 {
  return out
    .copy(ch.c)
    .addScaledVector(ch.dir, (k - LINKS / 2) * LINK)
    .addScaledVector(ch.perp, k % 2 ? 0.045 : -0.045);
}

export default function StomachScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0c0508', ['#0c0508', 8, 24], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 16 }, { position: [3, 4.5, 17], target: [0, 0.3, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  const boxGeo = useDisposable(() => new BoxGeometry(1, 1, 1));
  const mucosaMat = useDisposable(() => new MeshStandardMaterial({ color: '#a8505c', roughness: 0.75, side: BackSide, emissive: '#2a060c', emissiveIntensity: 0.4 }));
  const subMat = useDisposable(() => new MeshStandardMaterial({ color: '#d4ab98', roughness: 0.8, side: BackSide, emissive: '#2a160c', emissiveIntensity: 0.3 }));
  const meMat = useDisposable(() => new MeshStandardMaterial({ color: '#8a3038', roughness: 0.75, side: BackSide, emissive: '#200406', emissiveIntensity: 0.35 }));
  const mmMat = useDisposable(() => new MeshStandardMaterial({ color: '#c25a62', roughness: 0.6, transparent: true, opacity: 0.7, emissive: '#2a0508', emissiveIntensity: 0.4 }));
  const serosaMat = useDisposable(() => new MeshStandardMaterial({ color: '#f2dcd2', roughness: 0.5, transparent: true, opacity: 0.6 }));
  const capGeo = useDisposable(() => new CapsuleGeometry(1, 1, 4, 8));
  const fiberMat = useDisposable(() => new MeshStandardMaterial({ color: '#d0646c', roughness: 0.55, emissive: '#2a0508', emissiveIntensity: 0.4 }));
  const lumenMat = useDisposable(() => new MeshStandardMaterial({ color: '#4a1a28', roughness: 0.6, emissive: '#1a0408', emissiveIntensity: 0.5 }));
  const torusGeo = useDisposable(() => new TorusGeometry(0.17, 0.045, 8, 24));
  const pitMat = useDisposable(() => new MeshStandardMaterial({ color: '#7a2a3a', roughness: 0.5, emissive: '#2a0510', emissiveIntensity: 0.5 }));
  const surfGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.3));
  const neckGeo = useDisposable(() => bumpySphere(2, 0.1, 3));
  const mucousMat = useDisposable(() => new MeshStandardMaterial({ color: '#efe4d6', roughness: 0.6, emissive: '#2a2418', emissiveIntensity: 0.3 }));
  const coneGeo = useDisposable(() => new ConeGeometry(0.5, 1, 6));
  const parietalMat = useDisposable(() => new MeshStandardMaterial({ color: '#f07ea0', roughness: 0.45, emissive: '#4a0c24', emissiveIntensity: 0.45 }));
  const chiefGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.25));
  const chiefMat = useDisposable(() => new MeshStandardMaterial({ color: '#8a6ad8', roughness: 0.5, emissive: '#1c1048', emissiveIntensity: 0.45 }));
  const mucusMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#d8ecff', roughness: 0.2, transparent: true, opacity: 0.2, depthWrite: false, emissive: '#20405a', emissiveIntensity: 0.35 }),
  );
  const arteryMat = useDisposable(() => new MeshStandardMaterial({ color: '#d4454f', roughness: 0.4, emissive: '#300408', emissiveIntensity: 0.4 }));
  const veinMat = useDisposable(() => new MeshStandardMaterial({ color: '#6a4a9a', roughness: 0.45, emissive: '#140a30', emissiveIntensity: 0.4 }));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const ico = useDisposable(() => new IcosahedronGeometry(1, 0));
  const hMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff4a4a', emissive: '#a01010', emissiveIntensity: 1.1 }));
  const enzMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', emissive: '#40301a', emissiveIntensity: 0.6 }));
  const pepsinMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffb04a', emissive: '#8a4a00', emissiveIntensity: 1 }));
  const linkMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, emissive: '#3a3010', emissiveIntensity: 0.5 }));
  const ifMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fe08a', emissive: '#1a7a30', emissiveIntensity: 1 }));
  const b12Mat = useDisposable(() => new MeshStandardMaterial({ color: '#ff7ab8', emissive: '#a01a5a', emissiveIntensity: 1.1 }));
  const ironMat = useDisposable(() => new MeshStandardMaterial({ color: '#c4502e', emissive: '#6a1a08', emissiveIntensity: 0.9 }));
  const dropMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8f4ff', emissive: '#4a7aa0', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));

  const geo = useMemo(() => {
    const r = rng(71);
    const glands = [Z0 + 0.85, Z1].flatMap((gz) => GX.map((gx) => ({ x: gx + (r() - 0.5) * 0.15, z: gz, ph: r() * 6, front: gz === Z1 })));
    const lumens = glands.map((g) =>
      curve(
        Array.from({ length: 7 }, (_, k) => {
          const y = SURF + 0.02 - (k / 6) * (SURF + 0.02 - GLAND_BOTTOM);
          return [axisX(g.x, y, g.ph), y, g.z] as [number, number, number];
        }),
      ),
    );
    const pits: CellSpec[] = [];
    const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    const neck: CellSpec[] = [];
    const parietal: (CellSpec & { front: boolean; axis: Vector3 })[] = [];
    const chief: CellSpec[] = [];
    glands.forEach((g) => {
      pits.push({ p: new Vector3(axisX(g.x, SURF, g.ph), SURF + 0.015, g.z), s: 1, q: flat });
      for (let k = 0; k < RINGS; k++) {
        const y = 1.8 - k * 0.21;
        for (let j = 0; j < AROUND; j++) {
          const a = (j / AROUND) * Math.PI * 2 + k * 0.45;
          const n = new Vector3(Math.cos(a), 0, Math.sin(a));
          // Ön sıradaki bezler kesik: kameraya bakan yarı çizilmez, bez boşluğu görünür.
          if (g.front && n.z > 0.3) continue;
          const ax = new Vector3(axisX(g.x, y, g.ph), y, g.z);
          const roll = r();
          const type = k <= 2 ? 'neck' : k <= 6 ? (roll < 0.75 ? 'parietal' : 'neck') : roll < 0.7 ? 'chief' : 'parietal';
          if (type === 'neck') neck.push({ p: ax.clone().addScaledVector(n, RING), s: 0.095 });
          else if (type === 'parietal')
            parietal.push({ p: ax.clone().addScaledVector(n, RING + 0.04), s: new Vector3(0.25, 0.24, 0.25), q: faceOut(n.clone().negate()), front: g.front, axis: ax });
          else chief.push({ p: ax.clone().addScaledVector(n, RING), s: new Vector3(0.15, 0.13, 0.15), q: faceOut(n) });
        }
      }
    });
    // Yüzey mukus hücreleri (çukurcukların çevresi hariç)
    const surface: CellSpec[] = [];
    for (let x = X0 + 0.15; x < X1; x += 0.3) {
      for (let z = Z0 + 0.15; z < Z1 - 0.1; z += 0.3) {
        if (pits.some((p) => Math.hypot(p.p.x - x, p.p.z - z) < 0.3)) continue;
        surface.push({ p: new Vector3(x, SURF - 0.13, z), s: new Vector3(0.27, 0.26, 0.27) });
      }
    }
    // Salgı yolları: bez içinden çukurcuğa, oradan lümene
    const spreadEnd = (g: { x: number; z: number }, h: number): [number, number, number] => [g.x + (r() - 0.5) * 1.6 * h, SURF + 0.7 * h + r() * 0.5 * h, clampZ(g.z - 0.3 + (r() - 0.5) * 0.9 * h)];
    const secretion = glands.map((g) =>
      curve([[axisX(g.x, 0.85, g.ph), 0.85, g.z], [axisX(g.x, 1.5, g.ph), 1.5, g.z], [axisX(g.x, SURF, g.ph), SURF + 0.1, g.z], spreadEnd(g, 1), spreadEnd(g, 2)]),
    );
    const deep = glands.map((g) =>
      curve([[axisX(g.x, -0.3, g.ph), -0.3, g.z], [axisX(g.x, 0.5, g.ph), 0.5, g.z], [axisX(g.x, 1.3, g.ph), 1.3, g.z], [axisX(g.x, SURF, g.ph), SURF + 0.1, g.z], spreadEnd(g, 1), spreadEnd(g, 2)]),
    );
    // Lümen akışı: mide boşluğundan çıkışa (+x, on iki parmak bağırsağına) doğru
    const lumenCurves = Array.from({ length: 7 }, (_, i) => {
      const y0 = 2.75 + (i / 6) * 1.5;
      const z0 = -1.25 + (((i * 3) % 7) / 6) * 1.7;
      return curve(Array.from({ length: 6 }, (_, k) => [-5.4 + k * 2.26, y0 + Math.sin(k * 1.3 + i) * 0.22, clampZ(z0 + Math.cos(k * 1.1 + i * 2) * 0.28)] as [number, number, number]));
    });
    // Pariyetal hücreden bez boşluğuna H⁺ (çoğu ön, kesik bezlerden)
    const frontPar = parietal.filter((c) => c.front);
    const acidHops: Hop[] = Array.from({ length: 120 }, () => {
      const pool = r() < 0.75 && frontPar.length ? frontPar : parietal;
      const c = pool[Math.floor(r() * pool.length)]!;
      return { from: c.p.clone(), to: c.axis.clone() };
    });
    const mucusHops: Hop[] = Array.from({ length: 70 }, () => {
      const c = surface[Math.floor(r() * surface.length)]!;
      return { from: c.p.clone().add(new Vector3(0, 0.13, 0)), to: c.p.clone().add(new Vector3((r() - 0.5) * 0.2, 0.38, (r() - 0.5) * 0.2)) };
    });
    // Mukusa çarpıp geri dönen asit
    const bounce: Hop[] = Array.from({ length: 40 }, () => {
      const x = -4.5 + r() * 8.5;
      const z = -1.3 + r() * 1.8;
      return { from: new Vector3(x, 3.25, z), to: new Vector3(x + 0.55, 3.2, clampZ(z + (r() - 0.5) * 0.3)), lift: new Vector3(0, -0.82, 0) };
    });
    const randUnit = () => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const chains: Chain[] = Array.from({ length: CHAINS }, () => {
      const dir = new Vector3(r() - 0.5, (r() - 0.5) * 0.4, r() - 0.5).normalize();
      return {
        c: new Vector3(-4 + r() * 4.6, 2.95 + r() * 1.0, -1.1 + r() * 1.4),
        dir,
        perp: new Vector3().crossVectors(dir, UP).normalize(),
        ph: r(),
        spread: [randUnit().multiplyScalar(0.18), randUnit().multiplyScalar(0.12), randUnit().multiplyScalar(0.18)],
        cut: [randUnit(), randUnit()],
      };
    });
    const traveler = (): Traveler => ({ c: Math.floor(r() * 7), o: r(), v: 0.8 + r() * 0.4, off: randUnit().multiplyScalar(0.25 + r() * 0.3) });
    const pairs = Array.from({ length: IF_MAX }, () => ({ ...traveler(), e: randUnit().multiplyScalar(0.25 + r() * 0.25) }));
    const free = Array.from({ length: B12_MAX - IF_MAX }, traveler);
    // Kas katmanı lifleri: iç eğik, orta dairesel (z yönü), dış boylamsal (x yönü)
    const fibers: CellSpec[] = [];
    const fiber = (p: Vector3, dir: Vector3, len: number) => fibers.push({ p, s: new Vector3(0.045, len / 3, 0.045), q: new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()) });
    for (const y of [-2.28, -2.46]) for (let x = -4; x <= 4; x += 0.38) fiber(new Vector3(x, y, -0.4), new Vector3(1, 0, 1), 2.2);
    for (const y of [-2.68, -2.86, -3.04]) for (let x = X0 + 0.2; x < X1; x += 0.3) fiber(new Vector3(x, y, (Z0 + Z1) / 2), new Vector3(0, 0, 1), 2.25);
    for (const y of [-3.26, -3.46]) for (let z = Z0 + 0.2; z < Z1; z += 0.25) fiber(new Vector3(0, y, z), new Vector3(1, 0, 0), 9.6);
    const artery = curve([[X0, -1.42, -0.55], [-2, -1.36, -0.5], [1, -1.46, -0.6], [X1, -1.4, -0.5]]);
    const vein = curve([[X1, -1.55, 0.25], [2, -1.6, 0.2], [-1, -1.5, 0.3], [X0, -1.56, 0.22]]);
    const caps = GX.slice(0, -1).map((gx) => {
      const xb = gx + 0.6;
      return curve([[xb, -1.36, -0.5], [xb, MM_BOT, -0.2], [xb + 0.05, 0.4, 0], [xb - 0.05, 1.6, 0], [xb, 1.85, 0.1]]);
    });
    return { glands, lumens, pits, neck, parietal, chief, surface, secretion, deep, lumenCurves, acidHops, mucusHops, bounce, chains, pairs, free, fibers, artery, vein, caps };
  }, []);

  // Kişisel: lümendeki B12 ve demir miktarı (temsili)
  const nB12 = scaled(26, params.b12, B12_MAX);
  const nIron = scaled(28, params.iron, 80);
  const pep = useEased(stage === 3 ? 1 : 0, 1.2);
  const mucusE = useEased(stage === 4 ? 1 : 0, 1.2);
  const joinE = useEased(stage === 5 ? 1 : 0, 0.8);
  const linkRef = useRef<InstancedMesh>(null);
  const cutRef = useRef<InstancedMesh>(null);
  const ifRef = useRef<InstancedMesh>(null);
  const b12Ref = useRef<InstancedMesh>(null);
  const mucusRef = useRef<Mesh>(null);
  const linkColors = useMemo(() => [new Color('#f3e2a0'), new Color('#e0a860')], []);

  useFrame(() => {
    const t = time.current;
    // Mukus tabakası: koruma aşamasında kalınlaşır
    const mesh = mucusRef.current;
    if (mesh) {
      const h = 0.22 + 0.2 * mucusE.current;
      mesh.scale.set(X1 - X0, h, Z1 - Z0);
      mesh.position.set(0, SURF + h / 2, (Z0 + Z1) / 2);
      mucusMat.opacity = 0.18 + 0.17 * mucusE.current;
    }
    // Protein zincirleri: pepsin bağları keser, parçalar ayrılır
    const lm = linkRef.current;
    const cm = cutRef.current;
    if (lm && cm) {
      const pv = pep.current;
      geo.chains.forEach((ch, ci) => {
        const k = (t * 0.1 + ch.ph) % 1;
        const s = pv * smooth(0.35, 0.6, k);
        const life = 1 - pv * (1 - Math.min(smooth(0, 0.08, k), 1 - smooth(0.86, 0.98, k)));
        DRIFT.set(Math.sin(t * 0.25 + ch.ph * 6) * 0.12, Math.sin(t * 0.31 + ch.ph * 9) * 0.08, Math.cos(t * 0.22 + ch.ph * 5) * 0.1);
        for (let j = 0; j < LINKS; j++) {
          const f = j <= 1 ? 0 : j <= 4 ? 1 : 2;
          OFF.copy(ch.dir)
            .multiplyScalar((f - 1) * 0.32 * s)
            .addScaledVector(ch.spread[f]!, s)
            .add(DRIFT);
          bead(ch, j, A).add(OFF);
          bead(ch, j + 1, B).add(OFF);
          D.subVectors(B, A);
          const len = D.length();
          P.addVectors(A, B).multiplyScalar(0.5);
          Q.setFromUnitVectors(UP, D.normalize());
          const rad = 0.036 * life;
          S.set(rad, (len / 3) * 0.92 * life, rad);
          M4.compose(P, Q, S);
          lm.setMatrixAt(ci * LINKS + j, M4);
          lm.setColorAt(ci * LINKS + j, linkColors[j % 2]!);
        }
        const approach = smooth(0.12, 0.35, k) * (1 - smooth(0.62, 0.85, k));
        for (let b = 0; b < 2; b++) {
          bead(ch, b === 0 ? 2 : 5, A)
            .add(DRIFT)
            .addScaledVector(ch.cut[b]!, 0.12 + 0.8 * (1 - approach));
          M4.compose(A, Q.identity(), S.setScalar(0.065 * pv));
          cm.setMatrixAt(ci * 2 + b, M4);
        }
      });
      lm.instanceMatrix.needsUpdate = true;
      if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
      cm.instanceMatrix.needsUpdate = true;
    }
    // İç faktör ve B12: çıkışa ilerlerken çift oluşturur (son aşamada)
    const im = ifRef.current;
    const bm = b12Ref.current;
    if (im && bm) {
      const jv = joinE.current;
      const nIf = Math.round(12 + (IF_MAX - 12) * jv);
      for (let i = 0; i < B12_MAX; i++) {
        const paired = i < IF_MAX;
        const d = paired ? geo.pairs[i]! : geo.free[i - IF_MAX]!;
        const u = (d.o + t * 0.022 * d.v) % 1;
        geo.lumenCurves[d.c]!.getPointAt(u, P);
        const join = paired && i < nIf ? jv * smooth(0.18, 0.45, u) : 0;
        if (paired) {
          if (i < nIf) {
            A.copy(P)
              .addScaledVector(geo.pairs[i]!.e, 1 - join)
              .add(OFF.set(-0.045 * join, 0, 0));
            M4.compose(A, Q.identity(), S.setScalar(0.048));
            im.setMatrixAt(i, M4);
          } else im.setMatrixAt(i, HIDE);
        }
        if (i < nB12) {
          A.copy(P)
            .addScaledVector(d.off, 1 - join)
            .add(OFF.set(0.045 * join, 0, 0));
          M4.compose(A, Q.identity(), S.setScalar(0.05));
          bm.setMatrixAt(i, M4);
        } else bm.setMatrixAt(i, HIDE);
      }
      im.instanceMatrix.needsUpdate = true;
      bm.instanceMatrix.needsUpdate = true;
    }
  });

  const hl = (t: number) => Math.floor(t / 2.4) % 3;
  const glow = (out: Color, k: number) => out.setRGB(k, k, k);
  const pepsinogen = useMemo(() => new Color('#9a88e0'), []);
  const pepsin = useMemo(() => new Color('#ffb04a'), []);
  const muscleWave = stage === 0 || stage === 5;

  return (
    <group>
      <ambientLight intensity={0.4} color="#ffe0e0" />
      <directionalLight position={[3, 6, 5]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />
      {/* Katmanlar: arka yüzleri görünen (kesik) bloklar */}
      <mesh geometry={boxGeo} material={mucosaMat} position={[0, (SURF + MM_TOP) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, SURF - MM_TOP, Z1 - Z0]} onClick={pick('mucosa')} />
      <mesh geometry={boxGeo} material={mmMat} position={[0, (MM_TOP + MM_BOT) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, MM_TOP - MM_BOT, Z1 - Z0]} onClick={pick('muscle')} />
      <mesh geometry={boxGeo} material={subMat} position={[0, (MM_BOT + SUB_BOT) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, MM_BOT - SUB_BOT, Z1 - Z0]} onClick={pick('vessel')} />
      <mesh geometry={boxGeo} material={meMat} position={[0, (ME_TOP + ME_BOT) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, ME_TOP - ME_BOT, Z1 - Z0]} onClick={pick('muscle')} />
      <mesh geometry={boxGeo} material={serosaMat} position={[0, ME_BOT - 0.06, (Z0 + Z1) / 2]} scale={[X1 - X0, 0.12, Z1 - Z0]} onClick={pick('muscle')} />
      <Cells
        cells={geo.fibers}
        geometry={capGeo}
        material={fiberMat}
        onClick={pick('muscle')}
        time={time}
        animate={(i, t, out) => ({ color: !!glow(out, muscleWave ? 0.8 + 0.35 * Math.max(0, Math.sin(t * 1.1 - geo.fibers[i]!.p.x * 0.9)) : 0.9) })}
      />
      <Tubes curves={[geo.artery]} radius={0.16} material={arteryMat} onClick={pick('vessel')} />
      <Tubes curves={[geo.vein]} radius={0.21} material={veinMat} onClick={pick('vessel')} />
      <Tubes curves={geo.caps} radius={0.028} material={arteryMat} onClick={pick('vessel')} segments={48} radial={6} />
      <CurveMovers curves={[geo.artery, geo.vein]} count={40} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.13} flat onClick={pick('vessel')} />
      {/* Mukoza: yüzey, çukurcuklar ve bezler */}
      <Cells cells={geo.surface} geometry={surfGeo} material={mucousMat} onClick={pick('mucous')} />
      <Cells cells={geo.pits} geometry={torusGeo} material={pitMat} onClick={pick('pit')} />
      <Tubes curves={geo.lumens} radius={0.07} material={lumenMat} onClick={pick('gland')} segments={32} radial={8} />
      <Cells
        cells={geo.neck}
        geometry={neckGeo}
        material={mucousMat}
        onClick={pick('mucous')}
        time={time}
        animate={(_i, t, out) => ({ color: !!glow(out, stage === 1 && hl(t) === 0 ? 1.45 + 0.15 * Math.sin(t * 5) : 1) })}
      />
      <Cells
        cells={geo.parietal}
        geometry={coneGeo}
        material={parietalMat}
        onClick={pick('parietal')}
        time={time}
        animate={(i, t, out) => {
          const busy = stage === 2 || stage === 5;
          glow(out, stage === 1 && hl(t) === 1 ? 1.45 + 0.15 * Math.sin(t * 5) : busy ? 1.15 + 0.2 * Math.sin(t * 3 + i) : 1);
          return { scale: busy ? 1 + 0.05 * Math.sin(t * 3 + i) : 1, color: true };
        }}
      />
      <Cells
        cells={geo.chief}
        geometry={chiefGeo}
        material={chiefMat}
        onClick={pick('chief')}
        time={time}
        animate={(i, t, out) => {
          glow(out, stage === 1 && hl(t) === 2 ? 1.5 + 0.15 * Math.sin(t * 5) : stage === 3 ? 1.15 + 0.2 * Math.sin(t * 3 + i) : 1);
          return { scale: stage === 3 ? 1 + 0.05 * Math.sin(t * 3 + i) : 1, color: true };
        }}
      />
      {/* Koruyucu mukus tabakası */}
      <mesh ref={mucusRef} geometry={boxGeo} material={mucusMat} onClick={pick('mucus')} />
      <Hoppers hops={geo.mucusHops} count={70} geometry={small} material={dropMat} time={time} duration={2.6} size={0.04} seed={3} active={stage === 4} onClick={pick('mucus')} />
      {/* Asit (H⁺) */}
      <Hoppers hops={geo.acidHops} count={120} geometry={small} material={hMat} time={time} duration={1.6} size={0.028} seed={5} active={stage === 2} onClick={pick('acid')} />
      <CurveMovers curves={geo.secretion} count={160} shown={stage === 2 ? 150 : 24} geometry={small} material={hMat} time={time} speed={0.09} size={0.03} jitter={0.04} seed={7} onClick={pick('acid')} />
      <CurveMovers curves={geo.lumenCurves} count={90} shown={stage >= 2 ? 90 : 30} geometry={small} material={hMat} time={time} speed={0.03} size={0.03} jitter={0.7} seed={11} onClick={pick('acid')} />
      <Hoppers hops={geo.bounce} count={40} geometry={small} material={hMat} time={time} duration={2.2} size={0.034} seed={13} active={stage === 4} fade={false} onClick={pick('acid')} />
      {/* Pepsinojen → pepsin (asitli ortamda etkinleşir) ve protein zincirleri */}
      <CurveMovers
        curves={geo.deep}
        count={90}
        shown={stage === 3 ? 80 : 14}
        geometry={ico}
        material={enzMat}
        time={time}
        speed={0.07}
        size={0.05}
        jitter={0.04}
        seed={17}
        onClick={pick('pepsin')}
        color={(u, _i, out) => out.copy(pepsinogen).lerp(pepsin, smooth(0.56, 0.68, u))}
      />
      <instancedMesh ref={linkRef} args={[capGeo, linkMat, CHAINS * LINKS]} onClick={pick('protein')} frustumCulled={false} />
      <instancedMesh ref={cutRef} args={[ico, pepsinMat, CHAINS * 2]} onClick={pick('pepsin')} frustumCulled={false} />
      {/* İç faktör, B12 ve demir */}
      <CurveMovers curves={geo.secretion} count={60} shown={stage === 5 ? 50 : 6} geometry={small} material={ifMat} time={time} speed={0.08} size={0.045} jitter={0.05} seed={19} onClick={pick('intrinsic')} />
      <instancedMesh ref={ifRef} args={[small, ifMat, IF_MAX]} onClick={pick('intrinsic')} frustumCulled={false} />
      <instancedMesh ref={b12Ref} args={[small, b12Mat, B12_MAX]} onClick={pick('b12')} frustumCulled={false} />
      <CurveMovers curves={geo.lumenCurves} count={80} shown={nIron} geometry={ico} material={ironMat} time={time} speed={0.02} size={0.05} jitter={0.55} seed={41} onClick={pick('iron')} />
    </group>
  );
}
