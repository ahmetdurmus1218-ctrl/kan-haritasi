import { useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { CapsuleGeometry, Color, type InstancedMesh, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';

/**
 * Kan hücreleri (temsili, "3D kan yayması"): plazmada süzülen alyuvarlar, beş akyuvar türü ve
 * trombositler. Sayılar kişinin hemogramından türetilir (oranlar görselleştirme içindir; gerçekte
 * her akyuvara ~700 alyuvar düşer). Son aşamada nötrofillerin bakteri kümesine yönelmesi gösterilir.
 */

type WbcType = 'neutrophil' | 'lymphocyte' | 'monocyte' | 'eosinophil' | 'basophil';
const TYPES: WbcType[] = ['neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil'];

/** Tipik akyuvar dağılımı (%) ve sahnede tipik düzeyde gösterilen toplam akyuvar sayısı. */
const TYPICAL_PCT: Record<WbcType, number> = { neutrophil: 60, lymphocyte: 30, monocyte: 6, eosinophil: 3, basophil: 1 };
const WBC_BASE = 22;
const WBC_MAX = 90;
const RBC_BASE = 230;
const RBC_MAX = 320;
const PLT_BASE = 55;
const PLT_MAX = 170;

/** Tür başına görünüş: hücre yarıçapı, sitoplazma rengi, çekirdek parçaları, granüller. */
const LOOK: Record<WbcType, { r: number; color: string; lobes: [number, number, number, number][]; granules: number; granuleColor?: string }> = {
  neutrophil: { r: 0.3, color: '#e9d8ee', lobes: [[-0.12, 0.05, 0, 0.085], [-0.03, -0.05, 0.03, 0.08], [0.07, 0.03, -0.02, 0.08], [0.14, -0.06, 0.02, 0.07]], granules: 0 },
  lymphocyte: { r: 0.22, color: '#dfe6f7', lobes: [[0.02, 0, 0, 0.17]], granules: 0 },
  monocyte: { r: 0.38, color: '#d9dcee', lobes: [[-0.06, 0.03, 0, 0.16], [0.08, -0.04, 0.02, 0.12]], granules: 0 },
  eosinophil: { r: 0.3, color: '#f3d9cf', lobes: [[-0.09, 0.02, 0, 0.1], [0.09, 0.0, 0, 0.1]], granules: 16, granuleColor: '#ff7a3d' },
  basophil: { r: 0.28, color: '#e3d6ee', lobes: [[0.0, 0.0, 0, 0.12]], granules: 18, granuleColor: '#3a1f6e' },
};

const BOX = { x: 5.2, y: 2.8, z: 2.6 };
const TMP = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const C = new Color();
const HIDE = new Matrix4().makeScale(0, 0, 0);
const BACTERIA = new Vector3(2.6, -0.6, 0.4);

const SHOTS = [
  { position: [0, 0.6, 7.2], target: [0, 0, 0] },
  { position: [-1.6, 0.4, 3.6], target: [-1.8, 0, 0] },
  { position: [0, 0.35, 3.4], target: [0, 0, 1.2] },
  { position: [1.6, 1.2, 3.8], target: [1.2, 0, 0] },
  { position: [3.6, 0.6, 3.8], target: [2.4, -0.5, 0.4] },
] as const;

interface Floater {
  base: Vector3;
  phase: number;
  speed: number;
  axis: Vector3;
}

function floaters(n: number, seed: number): Floater[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({
    base: new Vector3((r() * 2 - 1) * BOX.x, (r() * 2 - 1) * BOX.y, (r() * 2 - 1) * BOX.z - 0.6),
    phase: r() * Math.PI * 2,
    speed: 0.6 + r() * 0.8,
    axis: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
  }));
}

/** Akış: yavaşça +x yönünde kayar, kutunun sonunda başa sarar; üstüne küçük salınım. */
function drift(f: Floater, t: number, out: Vector3): Vector3 {
  const x = ((f.base.x + BOX.x + t * 0.12 * f.speed) % (BOX.x * 2)) - BOX.x;
  return out.set(x, f.base.y + Math.sin(t * 0.7 * f.speed + f.phase) * 0.08, f.base.z + Math.cos(t * 0.5 * f.speed + f.phase) * 0.08);
}

export default function BloodScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#12050a', ['#12050a', 6, 16], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.6, max: 12 }, { position: [0, 1, 11], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);

  // Kişisel sayılar
  const nRbc = Math.min(RBC_MAX, Math.round(RBC_BASE * (params.rbc ?? 1)));
  const nPlt = Math.min(PLT_MAX, Math.round(PLT_BASE * (params.plt ?? 1)));
  const perType = useMemo(() => {
    const out = {} as Record<WbcType, number>;
    for (const t of TYPES) out[t] = Math.round((WBC_BASE * (TYPICAL_PCT[t] / 100) * (params[t] ?? 1)) * 10) / 10;
    return out;
  }, [params]);
  const rbcSize = 0.36 * (params.rbcSize ?? 1);
  // Soluk (hipokromik) alyuvar: MCH düşükse merkezi daha açık, renk daha soluk
  const pale = Math.max(0, Math.min(1, (1 - (params.rbcColor ?? 1)) * 3));

  const rbcGeo = useDisposable(() => rbcGeometry(24));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.42, emissive: '#3a0508', emissiveIntensity: 0.45 }));
  const cellGeo = useDisposable(() => bumpySphere(3, 0.05, 5));
  const wbcMat = useDisposable(
    () => new MeshPhysicalMaterial({ roughness: 0.35, transparent: true, opacity: 0.55, transmission: 0, depthWrite: false, sheen: 1, sheenColor: new Color('#ffffff') }),
  );
  const nucGeo = useDisposable(() => bumpySphere(2, 0.12, 9));
  const nucMat = useDisposable(() => new MeshStandardMaterial({ color: '#5b2d91', roughness: 0.55, emissive: '#1e0c36', emissiveIntensity: 0.5 }));
  const granGeo = useDisposable(() => new SphereGeometry(1, 8, 6));
  const granMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.4, emissive: '#200a00', emissiveIntensity: 0.4 }));
  const pltGeo = useDisposable(() => new SphereGeometry(1, 12, 8).scale(1, 0.4, 1));
  const pltMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0c8e0', roughness: 0.5, emissive: '#3a1a30', emissiveIntensity: 0.45 }));
  const bacGeo = useDisposable(() => new CapsuleGeometry(0.035, 0.12, 4, 8));
  const bacMat = useDisposable(() => new MeshStandardMaterial({ color: '#8ee07a', roughness: 0.5, emissive: '#1a4010', emissiveIntensity: 0.6 }));

  const rbcF = useMemo(() => floaters(RBC_MAX, 3), []);
  const pltF = useMemo(() => floaters(PLT_MAX, 5), []);
  const wbcF = useMemo(() => {
    const r = rng(9);
    // Her tür için en fazla WBC_MAX örnek; hangi türün kaçıncı olduğu sabit
    return TYPES.flatMap((t, ti) => floaters(WBC_MAX, 20 + ti).map((f) => ({ ...f, type: t, granSeed: r() })));
  }, []);
  const bacteria = useMemo(() => {
    const r = rng(33);
    return Array.from({ length: 26 }, () => BACTERIA.clone().add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.7)));
  }, []);

  const lineup = useEased(stage === 2 ? 1 : 0, 1.6);
  const chase = useEased(stage === 4 ? 1 : 0, 0.5);
  const rbcRef = useRef<InstancedMesh>(null);
  const wbcRef = useRef<InstancedMesh>(null);
  const nucRef = useRef<InstancedMesh>(null);
  const granRef = useRef<InstancedMesh>(null);
  const pltRef = useRef<InstancedMesh>(null);
  const bacRef = useRef<InstancedMesh>(null);
  /** Anlık görüntü: instanceId → tür (seçim için). */
  const wbcTypes = useRef<WbcType[]>([]);

  const oxy = useMemo(() => new Color('#c21f2e'), []);
  const paleColor = useMemo(() => new Color('#f0a0a8'), []);

  useFrame(() => {
    const t = time.current;
    // Alyuvarlar
    const rm = rbcRef.current;
    if (rm) {
      rm.count = nRbc;
      for (let i = 0; i < nRbc; i++) {
        const f = rbcF[i]!;
        drift(f, t, P);
        // Aşama 2'de öndeki sıra açık kalsın
        if (lineup.current > 0.05 && P.z > 0.4 && Math.abs(P.y) < 0.8) P.z -= 1.6 * lineup.current;
        Q.setFromAxisAngle(f.axis, f.phase + t * 0.25 * f.speed);
        S.setScalar(rbcSize * (0.94 + 0.12 * ((i * 37) % 10) / 10));
        TMP.compose(P, Q, S);
        rm.setMatrixAt(i, TMP);
        rm.setColorAt(i, C.copy(oxy).lerp(paleColor, pale * (0.6 + 0.4 * ((i % 7) / 7))));
      }
      rm.instanceMatrix.needsUpdate = true;
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    }

    // Akyuvarlar: her türden kişisel sayıda; aşama 2'de her türden biri öne dizilir
    const wm = wbcRef.current;
    const nm = nucRef.current;
    const gm = granRef.current;
    if (wm && nm && gm) {
      let w = 0;
      let n = 0;
      let g = 0;
      const types: WbcType[] = [];
      TYPES.forEach((type, ti) => {
        const look = LOOK[type];
        const count = Math.min(WBC_MAX, Math.max(type === 'basophil' || type === 'eosinophil' ? 0 : 1, Math.round(perType[type])));
        for (let k = 0; k < Math.max(count, stage === 2 ? 1 : 0); k++) {
          const f = wbcF[ti * WBC_MAX + k]!;
          drift(f, t * 0.6, P);
          if (k === 0 && lineup.current > 0.001) {
            const slot = new Vector3(-2.4 + ti * 1.2, 0, 1.2);
            P.lerp(slot, lineup.current);
          }
          if (type === 'neutrophil' && chase.current > 0.001) {
            const target = BACTERIA.clone().add(new Vector3(Math.cos(k * 2.4) * 0.55, Math.sin(k * 1.7) * 0.4, Math.sin(k * 2.4) * 0.45));
            P.lerp(target, chase.current * Math.min(1, 0.4 + (k % 5) * 0.15));
          }
          Q.setFromAxisAngle(f.axis, f.phase + t * 0.2);
          S.setScalar(look.r);
          TMP.compose(P, Q, S);
          wm.setMatrixAt(w, TMP);
          wm.setColorAt(w, C.set(look.color));
          types.push(type);
          w++;
          for (const [lx, ly, lz, lr] of look.lobes) {
            const off = new Vector3(lx, ly, lz).applyQuaternion(Q);
            TMP.compose(P.clone().add(off), Q, S.setScalar(lr));
            nm.setMatrixAt(n++, TMP);
          }
          if (look.granules) {
            const rr = rng(Math.floor(f.granSeed * 1e6));
            for (let q = 0; q < look.granules; q++) {
              const d = new Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize().multiplyScalar(look.r * (0.35 + 0.5 * rr())).applyQuaternion(Q);
              TMP.compose(P.clone().add(d), Q, S.setScalar(0.028));
              gm.setMatrixAt(g, TMP);
              gm.setColorAt(g, C.set(look.granuleColor!));
              g++;
            }
          }
        }
      });
      wbcTypes.current = types;
      wm.count = w;
      nm.count = n;
      gm.count = g;
      wm.instanceMatrix.needsUpdate = true;
      nm.instanceMatrix.needsUpdate = true;
      gm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
    }

    // Trombositler
    const pm = pltRef.current;
    if (pm) {
      pm.count = nPlt;
      for (let i = 0; i < nPlt; i++) {
        const f = pltF[i]!;
        drift(f, t * 1.1, P);
        Q.setFromAxisAngle(f.axis, f.phase + t * 0.6);
        TMP.compose(P, Q, S.setScalar(0.07));
        pm.setMatrixAt(i, TMP);
      }
      pm.instanceMatrix.needsUpdate = true;
    }

    // Bakteriler (yalnızca son aşamada)
    const bm = bacRef.current;
    if (bm) {
      for (let i = 0; i < bacteria.length; i++) {
        if (stage !== 4) {
          bm.setMatrixAt(i, HIDE);
          continue;
        }
        const b = bacteria[i]!;
        Q.setFromAxisAngle(new Vector3(0.3, 1, 0.2).normalize(), i + t * 0.8);
        TMP.compose(P.copy(b).addScalar(Math.sin(t * 2 + i) * 0.01), Q, S.setScalar(1));
        bm.setMatrixAt(i, TMP);
      }
      bm.instanceMatrix.needsUpdate = true;
    }
  });

  const pick = (key: string) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    onSelect(key);
  };
  const pickWbc = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    onSelect(e.instanceId !== undefined ? (wbcTypes.current[e.instanceId] ?? 'wbc') : 'wbc');
  };

  const totalWbc = TYPES.length * WBC_MAX;
  return (
    <group>
      <ambientLight intensity={0.4} color="#ffd6d6" />
      <directionalLight position={[3, 5, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={14} />
      <instancedMesh ref={rbcRef} args={[rbcGeo, rbcMat, RBC_MAX]} onClick={pick('rbc')} frustumCulled={false} />
      <instancedMesh ref={nucRef} args={[nucGeo, nucMat, totalWbc * 4]} raycast={() => null} frustumCulled={false} />
      <instancedMesh ref={granRef} args={[granGeo, granMat, totalWbc * 18]} raycast={() => null} frustumCulled={false} />
      <instancedMesh ref={wbcRef} args={[cellGeo, wbcMat, totalWbc]} onClick={pickWbc} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={pltRef} args={[pltGeo, pltMat, PLT_MAX]} onClick={pick('platelet')} frustumCulled={false} />
      <instancedMesh ref={bacRef} args={[bacGeo, bacMat, 26]} onClick={pick('bacteria')} frustumCulled={false} />
    </group>
  );
}
