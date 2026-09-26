import { useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';

/**
 * Damar içi ve LDL–ateroskleroz EĞİTİMSEL SİMÜLASYONU.
 * Damar ekseni Z; akış -Z yönünde. Yarıçap 1 birim (ölçek temsili).
 * Hız profili Poiseuille: v(r) = vmax (1 - r²/R²), nabızla hafifçe değişir.
 */

const R = 1;
const HALF = 9;
const LESION_THETA = -0.65;
const LESION_Z = -1.6;
const FOG: [string, number, number] = ['#16030a', 2.2, 11];

const lesionDir = new Vector3(Math.cos(LESION_THETA), Math.sin(LESION_THETA), 0);

/* ------------------------------------------------------------ damar duvarı gölgelendiricisi */

const WALL_VERT = /* glsl */ `
  uniform float uPlaque;
  uniform float uTime;
  uniform float uPulse;
  uniform float uLesionTheta;
  uniform float uLesionZ;
  varying vec3 vPos;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vBump;
  varying vec2 vCell;
  void main() {
    vec3 p = position;
    float th = atan(p.y, p.x);
    float dth = atan(sin(th - uLesionTheta), cos(th - uLesionTheta));
    float dz = p.z - uLesionZ;
    float bump = exp(-(dth * dth) / 0.34 - (dz * dz) / 2.2);
    vBump = bump;
    float beat = 1.0 + uPulse * 0.012 * pow(max(0.0, sin(uTime * 6.9)), 3.0);
    float r = (1.0 - 0.5 * uPlaque * bump) * beat;
    p.xy = normalize(p.xy) * r;
    vPos = p;
    vCell = vec2(th * 7.5, p.z * 2.4);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    // İç yüzeyin normali eksene doğru
    vec3 n = -normalize(vec3(p.xy, -0.9 * uPlaque * bump * dz));
    vNormalV = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
  }`;

const WALL_FRAG = /* glsl */ `
  precision highp float;
  uniform float uLipid;
  uniform float uInflam;
  uniform float uActivate;
  uniform float uWindow;
  uniform float uPlaque;
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uSelected;
  varying vec3 vPos;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vBump;
  varying vec2 vCell;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  // Hücresel desen: x = en yakın merkeze uzaklık, y = sınıra yakınlık
  vec3 cells(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 center = vec2(0.0);
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g + o * 0.8 + 0.1 - f;
      r.y *= 0.55; // akış yönünde uzamış hücreler
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; center = r; }
      else if (d < d2) { d2 = d; }
    }
    return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), length(center));
  }

  void main() {
    vec3 c = cells(vCell);
    float border = 1.0 - smoothstep(0.02, 0.09, c.y);
    float nucleus = 1.0 - smoothstep(0.1, 0.17, c.x);
    vec3 base = vec3(0.62, 0.17, 0.22);
    vec3 col = base * (0.85 + 0.15 * sin(vCell.x * 0.7));
    col = mix(col, vec3(0.36, 0.06, 0.12), border * 0.75);
    col = mix(col, vec3(0.42, 0.16, 0.36), nucleus * 0.6);

    // Lipid birikimi (sarımsı), plak örtüsü (açık, lifli)
    float lesion = smoothstep(0.15, 0.85, vBump);
    col = mix(col, vec3(0.86, 0.66, 0.32), uLipid * lesion * 0.75);
    float cap = uPlaque * smoothstep(0.35, 0.95, vBump);
    col = mix(col, vec3(0.93, 0.84, 0.78), cap * 0.55 * (0.7 + 0.3 * border));

    // İnflamasyon: yapışma molekülleri (soluk mavi-mor noktalar)
    float dots = step(0.86, fract(sin(dot(floor(vCell * 3.0), vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.35, 0.4, 1.0) * dots * uInflam * lesion * (0.6 + 0.4 * sin(uTime * 3.0));
    // Kişisel: CRP yüksekse tüm iç yüzeyde hafif inflamasyon işaretleri
    col += vec3(0.35, 0.4, 1.0) * dots * uActivate * 0.5 * (0.6 + 0.4 * sin(uTime * 3.0 + vCell.x));

    // Işık: kameradan (endoskop) + kenar
    vec3 N = normalize(vNormalV);
    vec3 V = normalize(-vViewPos);
    float diff = clamp(dot(N, V), 0.0, 1.0);
    float rim = pow(1.0 - diff, 2.5);
    vec3 lit = col * (0.28 + 0.95 * diff) + vec3(1.0, 0.55, 0.55) * rim * 0.18;
    lit += vec3(1.0, 0.9, 0.85) * pow(diff, 28.0) * 0.25;
    lit += vec3(0.25, 0.9, 0.85) * uSelected * 0.18 * (1.0 - border);

    float depth = length(vViewPos);
    float fog = smoothstep(uFogNear, uFogFar, depth);
    lit = mix(lit, uFogColor, fog);

    float alpha = 1.0 - uWindow * lesion * (1.0 - cap);
    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }`;

/* ------------------------------------------------------------ parçacık durumu */

interface Flow {
  r: Float32Array;
  th: Float32Array;
  z: Float32Array;
  spin: Float32Array;
  axis: Vector3[];
}

function makeFlow(count: number, seed: number, maxR: number): Flow {
  const rand = rng(seed);
  const f: Flow = { r: new Float32Array(count), th: new Float32Array(count), z: new Float32Array(count), spin: new Float32Array(count), axis: [] };
  for (let i = 0; i < count; i++) {
    f.r[i] = Math.sqrt(rand()) * maxR;
    f.th[i] = rand() * Math.PI * 2;
    f.z[i] = -HALF + rand() * HALF * 2;
    f.spin[i] = rand() * Math.PI * 2;
    f.axis.push(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
  }
  return f;
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3();

function plaqueRadius(th: number, z: number, plaque: number): number {
  const dth = Math.atan2(Math.sin(th - LESION_THETA), Math.cos(th - LESION_THETA));
  const dz = z - LESION_Z;
  const bump = Math.exp(-(dth * dth) / 0.34 - (dz * dz) / 2.2);
  return R * (1 - 0.5 * plaque * bump);
}

/* ------------------------------------------------------------ sahne */

const STAGE_SHOTS = [
  { position: [0.18, 0.22, 5.4], target: [0, -0.04, 0] },
  { position: [0.25, 0.1, 3.8], target: [0.2, -0.15, 0] },
  { position: [-0.32 * lesionDir.x, -0.32 * lesionDir.y, LESION_Z + 2.6], target: [0.8 * lesionDir.x, 0.8 * lesionDir.y, LESION_Z] },
] as const;

function shotFor(stage: number) {
  const s = stage <= 0 ? STAGE_SHOTS[0] : stage === 1 ? STAGE_SHOTS[1] : STAGE_SHOTS[2];
  const pull = stage >= 7 ? 1.2 : 0;
  return {
    position: [s.position[0] - pull * 0.1 * lesionDir.x, s.position[1] - pull * 0.1 * lesionDir.y, s.position[2] + pull] as [number, number, number],
    target: [...s.target] as [number, number, number],
  };
}

/** Tipik sayılar ve kişisel değere göre ayrılan üst sınırlar. */
const RBC_N = 240;
const RBC_MAX = 330;
const LDL_N = 110;
const LDL_MAX = 290;
const HDL_N = 80;
const HDL_MAX = 160;
const PLT_N = 26;
const PLT_MAX = 80;
const TRL_MAX = 90;
const RETAIN = 14;
const MONO_N = 5;

export default function VesselScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  useAtmosphere('#0d0206', FOG, 0.3);
  useStageCamera(shotFor(state.stage), { min: 0.05, max: 3 }, { position: [0, 0.1, 8.2], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const stage = state.stage;

  const plaque = useEased(stage >= 7 ? 1 : stage >= 5 ? 0.16 : stage >= 3 ? 0.08 : 0, 0.35);
  const lipid = useEased(stage >= 3 ? (stage >= 6 ? 1 : 0.55) : stage === 2 ? 0.2 : 0, 0.8);
  const inflam = useEased(stage >= 4 && stage <= 6 ? 1 : 0, 1.2);
  const windowA = useEased(stage >= 2 ? 0.62 : 0, 1.2);
  // Kişisel: trigliserid yüksekse plazma bulanıklaşır; CRP yüksekse iç yüzeyde inflamasyon işaretleri
  const milk = useEased(Math.max(0, Math.min(1, ((params.tg ?? 1) - 1.5) / 3.5)), 1.5);
  const activate = useEased(Math.max(0, Math.min(1, ((params.inflam ?? 0.5) - 1) / 4)), 1.5);
  const nRbc = scaled(RBC_N, params.rbc, RBC_MAX);
  const nLdl = scaled(LDL_N, params.ldl, LDL_MAX);
  const nHdl = scaled(HDL_N, params.hdl, HDL_MAX);
  const nPlt = scaled(PLT_N, params.plt, PLT_MAX);
  const nTrl = Math.min(TRL_MAX, Math.round(Math.max(0, (params.tg ?? 1) - 1.1) * 16));
  const rbcSize = 0.13 * (params.rbcSize ?? 1);

  const wallGeo = useDisposable(() => {
    const g = new CylinderGeometry(R, R, HALF * 2, 160, 180, true);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const wallMat = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader: WALL_VERT,
        fragmentShader: WALL_FRAG,
        side: BackSide,
        transparent: true,
        uniforms: {
          uPlaque: { value: 0 },
          uLipid: { value: 0 },
          uInflam: { value: 0 },
          uActivate: { value: 0 },
          uWindow: { value: 0 },
          uTime: { value: 0 },
          uPulse: { value: 1 },
          uLesionTheta: { value: LESION_THETA },
          uLesionZ: { value: LESION_Z },
          uFogColor: { value: new Color(FOG[0]) },
          uFogNear: { value: FOG[1] },
          uFogFar: { value: FOG[2] },
          uSelected: { value: 0 },
        },
      }),
  );

  const rbcGeo = useDisposable(() => rbcGeometry());
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.42, metalness: 0, emissive: '#3a0508', emissiveIntensity: 0.6 }));
  const ldlGeo = useDisposable(() => new SphereGeometry(1, 18, 12));
  const ldlMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0b13c', roughness: 0.35, emissive: '#5a3200', emissiveIntensity: 0.5 }));
  const hdlMat = useDisposable(() => new MeshStandardMaterial({ color: '#7fe3d8', roughness: 0.3, emissive: '#0c3a36', emissiveIntensity: 0.6 }));
  const retMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0b13c', roughness: 0.5, emissive: '#3a2000', emissiveIntensity: 0.5 }));
  const pltGeo = useDisposable(() => {
    const g = new SphereGeometry(1, 14, 8);
    g.scale(1, 0.32, 1);
    return g;
  });
  const pltMat = useDisposable(() => new MeshStandardMaterial({ color: '#e7c6dc', roughness: 0.5 }));
  const monoGeo = useDisposable(() => bumpySphere(3, 0.07, 3));
  const monoMat = useDisposable(() => new MeshStandardMaterial({ color: '#9aa6ff', roughness: 0.6, emissive: '#10163a', emissiveIntensity: 0.6 }));
  const dropGeo = useDisposable(() => new SphereGeometry(1, 10, 8));
  const dropMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe08a', roughness: 0.25, emissive: '#6a4a00', emissiveIntensity: 0.5 }));
  const markerMat = useDisposable(() => new MeshStandardMaterial({ color: '#5eead4', emissive: '#5eead4', emissiveIntensity: 1.5, wireframe: true, transparent: true, opacity: 0.7 }));
  const markerGeo = useDisposable(() => new SphereGeometry(1, 16, 10));
  const trlMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff4dc', roughness: 0.3, emissive: '#5a4a30', emissiveIntensity: 0.45, transparent: true, opacity: 0.9 }));

  // Plazma: çok küçük ışık benekleri (ölçek ve akış hissi)
  const plasma = useMemo(() => {
    const n = reducedMotion ? 400 : 1000;
    const rand = rng(99);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rand()) * 0.96;
      const th = rand() * Math.PI * 2;
      pos[i * 3] = Math.cos(th) * r;
      pos[i * 3 + 1] = Math.sin(th) * r;
      pos[i * 3 + 2] = -HALF + rand() * HALF * 4;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return g;
  }, [reducedMotion]);
  const plasmaMat = useDisposable(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color('#ffcdbf') }, uMilk: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uMilk;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (26.0 + 30.0 * uMilk) / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uMilk;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (0.22 + 0.4 * uMilk);
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
  );

  const flows = useMemo(
    () => ({
      rbc: makeFlow(RBC_MAX, 1, 0.84),
      ldl: makeFlow(LDL_MAX, 2, 0.93),
      hdl: makeFlow(HDL_MAX, 3, 0.95),
      plt: makeFlow(PLT_MAX, 4, 0.9),
      trl: makeFlow(TRL_MAX, 5, 0.9),
    }),
    [],
  );
  // Duvarda tutulan LDL'lerin hedefleri
  const retained = useMemo(() => {
    const rand = rng(7);
    return Array.from({ length: RETAIN }, () => ({
      th: LESION_THETA + (rand() - 0.5) * 0.7,
      z: LESION_Z + (rand() - 0.5) * 1.6,
      r: 1.035 + rand() * 0.07,
    }));
  }, []);
  const monos = useMemo(() => {
    const rand = rng(11);
    return Array.from({ length: MONO_N }, (_, i) => ({
      th: LESION_THETA + (i / (MONO_N - 1) - 0.5) * 0.75,
      z: LESION_Z + (rand() - 0.5) * 1.1,
      delay: rand() * 2.5,
    }));
  }, []);

  const rbcRef = useRef<InstancedMesh>(null);
  const ldlRef = useRef<InstancedMesh>(null);
  const hdlRef = useRef<InstancedMesh>(null);
  const pltRef = useRef<InstancedMesh>(null);
  const trlRef = useRef<InstancedMesh>(null);
  const retRef = useRef<InstancedMesh>(null);
  const monoRef = useRef<InstancedMesh>(null);
  const dropRef = useRef<InstancedMesh>(null);
  const plasmaRef = useRef<import('three').Points>(null);
  const markerRef = useRef<Mesh>(null);
  const selectedInstance = useRef<{ kind: string; id: number } | null>(null);
  const stageStart = useRef({ stage, t: 0 });
  if (stageStart.current.stage !== stage) stageStart.current = { stage, t: time.current };

  const retColor = useMemo(() => new Color(), []);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { getTarget: (v: Vector3) => Vector3 } | null;
  const seg = useMemo(() => ({ a: new Vector3(), b: new Vector3(), ab: new Vector3(), ap: new Vector3() }), []);
  /** Noktanın kamera→hedef doğru parçasına uzaklığı. */
  const clearance = (p: Vector3) => {
    const { a, b, ab, ap } = seg;
    ab.subVectors(b, a);
    ap.subVectors(p, a);
    const k = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-6, ab.lengthSq())));
    return ap.addScaledVector(ab, -k).length();
  };

  useFrame((_, delta) => {
    const t = time.current;
    seg.a.copy(camera.position);
    if (controls) controls.getTarget(seg.b);
    else seg.b.set(0, 0, 0);
    // Hedefin biraz önünde bitir: hedefteki nesneler (plak, köpük hücreleri) görünür kalsın
    seg.b.lerp(seg.a, 0.25);
    const u = wallMat.uniforms;
    u.uPlaque!.value = plaque.current;
    u.uLipid!.value = lipid.current;
    u.uInflam!.value = inflam.current;
    u.uActivate!.value = activate.current;
    plasmaMat.uniforms.uMilk!.value = milk.current;
    u.uWindow!.value = windowA.current;
    u.uTime!.value = t;
    u.uSelected!.value = state.selected === 'endothelium' || state.selected === 'wall' || state.selected === 'plaque' ? 1 : 0;

    const pulse = 0.72 + 0.45 * Math.pow(Math.max(0, Math.sin(t * 6.9)), 2);
    const vmax = 2.1 * pulse;
    const dt = Math.min(delta, 0.05);
    const pl = plaque.current;
    const advance = (f: Flow, i: number, size: number) => {
      const lim = plaqueRadius(f.th[i]!, f.z[i]!, pl) - size;
      const rr = Math.min(f.r[i]!, Math.max(0, lim));
      const v = vmax * (1 - (rr * rr) / (R * R)) + 0.05;
      f.z[i] = f.z[i]! - v * dt * (state.playing ? state.speed : 0) * (reducedMotion ? 0.35 : 1);
      if (f.z[i]! < -HALF) f.z[i] = f.z[i]! + HALF * 2;
      return rr;
    };

    const place = (mesh: InstancedMesh | null, f: Flow, n: number, size: number, flat: boolean, spinRate: number, skip?: (i: number) => boolean) => {
      if (!mesh) return;
      mesh.count = n;
      for (let i = 0; i < n; i++) {
        if (skip?.(i)) {
          tmpM.makeScale(0, 0, 0);
          mesh.setMatrixAt(i, tmpM);
          continue;
        }
        const rr = advance(f, i, size);
        tmpP.set(Math.cos(f.th[i]!) * rr, Math.sin(f.th[i]!) * rr, f.z[i]!);
        // Kamera ile baktığı nokta arasındaki hücreler görüşü kapatmasın (net görüş koridoru)
        if (clearance(tmpP) < 0.3 + size) {
          tmpM.makeScale(0, 0, 0);
          mesh.setMatrixAt(i, tmpM);
          continue;
        }
        tmpQ.setFromAxisAngle(f.axis[i]!, f.spin[i]! + t * spinRate * (1 + (i % 5) * 0.2));
        if (flat) tmpS.set(size * 2, size * 2, size * 2);
        else tmpS.setScalar(size);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(i, tmpM);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    place(rbcRef.current, flows.rbc, nRbc, rbcSize, true, 0.8);
    const retaining = stage >= 2;
    place(ldlRef.current, flows.ldl, nLdl, 0.045, false, 0.5, (i) => retaining && i < RETAIN);
    place(hdlRef.current, flows.hdl, nHdl, 0.028, false, 0.5);
    place(pltRef.current, flows.plt, nPlt, 0.05, false, 1.2);
    place(trlRef.current, flows.trl, nTrl, 0.075, false, 0.3);

    // Tutulan LDL: akıştan duvara süzülür, sonra değişir (oksidasyon)
    const ret = retRef.current;
    if (ret) {
      const sinceStage = t - stageStart.current.t;
      for (let i = 0; i < RETAIN; i++) {
        const target = retained[i]!;
        if (!retaining) {
          tmpM.makeScale(0, 0, 0);
        } else {
          const k = stage > 2 ? 1 : Math.min(1, Math.max(0, (sinceStage - i * 0.25) / 3.2));
          const e = k * k * (3 - 2 * k);
          const r0 = 0.9;
          const rr = r0 + (target.r - r0) * e;
          const z = target.z + 0.9 * (1 - e);
          tmpP.set(Math.cos(target.th) * rr, Math.sin(target.th) * rr, z);
          // Köpük hücrelerine yutulunca küçülür
          const eaten = stage >= 6 ? Math.max(0, 1 - (stage > 6 ? 1 : Math.min(1, (sinceStage - i * 0.3) / 4))) : 1;
          tmpS.setScalar(0.045 * (0.25 + 0.75 * eaten));
          tmpQ.identity();
          tmpM.compose(tmpP, tmpQ, tmpS);
        }
        ret.setMatrixAt(i, tmpM);
        const ox = stage >= 3 ? 1 : 0;
        retColor.set(ox ? '#8f7a36' : '#f0b13c');
        ret.setColorAt(i, retColor);
      }
      ret.instanceMatrix.needsUpdate = true;
      if (ret.instanceColor) ret.instanceColor.needsUpdate = true;
    }

    // Monositler: yuvarlanır → yapışır → duvara geçer → makrofaj → köpük hücresi
    const mono = monoRef.current;
    const drops = dropRef.current;
    if (mono) {
      const sinceStage = t - stageStart.current.t;
      let d = 0;
      for (let i = 0; i < MONO_N; i++) {
        const m = monos[i]!;
        if (stage < 4) {
          tmpM.makeScale(0, 0, 0);
          mono.setMatrixAt(i, tmpM);
          continue;
        }
        let rr = 0.86;
        let z = m.z;
        let scale = 0.11;
        if (stage === 4) {
          const k = Math.min(1, Math.max(0, (sinceStage - m.delay) / 5));
          z = m.z + 3.2 * (1 - k); // yukarı akıştan yavaşça gelir
        } else {
          const k = stage === 5 ? Math.min(1, Math.max(0, (sinceStage - m.delay * 0.5) / 4)) : 1;
          rr = 0.86 + (1.1 - 0.86) * k;
          scale = 0.11 + 0.05 * k + (stage >= 6 ? 0.03 : 0);
        }
        tmpP.set(Math.cos(m.th) * rr, Math.sin(m.th) * rr, z);
        tmpQ.setFromAxisAngle(tmpS.set(0, 0, 1), t * 0.2 + i);
        tmpS.setScalar(scale);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mono.setMatrixAt(i, tmpM);
        const c = stage >= 6 ? '#f2d7a0' : stage >= 5 ? '#c7a2ff' : '#9aa6ff';
        mono.setColorAt(i, retColor.set(c));
        // Köpük hücresinin içindeki lipid damlacıkları
        if (drops && stage >= 6) {
          for (let j = 0; j < 7; j++) {
            const a = j * 2.39996 + i;
            const off = 0.55 * scale;
            tmpP.set(
              Math.cos(m.th) * rr + Math.cos(a) * off * 0.8,
              Math.sin(m.th) * rr + Math.sin(a) * off * 0.8,
              z + Math.sin(a * 1.7) * off,
            );
            tmpS.setScalar(scale * 0.32);
            tmpQ.identity();
            tmpM.compose(tmpP, tmpQ, tmpS);
            drops.setMatrixAt(d++, tmpM);
          }
        }
      }
      mono.instanceMatrix.needsUpdate = true;
      if (mono.instanceColor) mono.instanceColor.needsUpdate = true;
      if (drops) {
        drops.count = d;
        drops.instanceMatrix.needsUpdate = true;
      }
    }

    // Plazma benekleri
    const pts = plasmaRef.current;
    if (pts) pts.position.z = -((t * 1.4) % (HALF * 2));

    // Seçim işaretçisi
    const marker = markerRef.current;
    const sel = selectedInstance.current;
    if (marker) {
      let visible = false;
      if (sel && state.selected) {
        const mesh = { rbc: rbcRef.current, ldl: ldlRef.current, hdl: hdlRef.current, platelet: pltRef.current, vldl: trlRef.current, oxldl: retRef.current, monocyte: monoRef.current }[sel.kind];
        if (mesh) {
          mesh.getMatrixAt(sel.id, tmpM);
          tmpM.decompose(tmpP, tmpQ, tmpS);
          if (tmpS.x > 0) {
            marker.position.copy(tmpP);
            marker.scale.setScalar(Math.max(tmpS.x, tmpS.y) * 1.9 + 0.02);
            marker.rotation.set(t, t * 0.7, 0);
            visible = true;
          }
        }
      }
      marker.visible = visible;
    }
  });

  const pick = (kind: string) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    let key = kind;
    if (kind === 'oxldl' && stage < 3) key = 'ldl';
    if (kind === 'monocyte') key = stage >= 6 ? 'foam' : stage >= 5 ? 'macrophage' : 'monocyte';
    selectedInstance.current = e.instanceId !== undefined ? { kind, id: e.instanceId } : null;
    onSelect(key);
  };

  const pickWall = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    selectedInstance.current = null;
    const p = e.point;
    const th = Math.atan2(p.y, p.x);
    const dth = Math.atan2(Math.sin(th - LESION_THETA), Math.cos(th - LESION_THETA));
    const near = Math.abs(dth) < 0.6 && Math.abs(p.z - LESION_Z) < 1.3;
    onSelect(near && stage >= 7 ? 'plaque' : near && stage >= 2 ? 'wall' : 'endothelium');
  };

  return (
    <group>
      <ambientLight intensity={0.35} color="#ffb3a8" />
      <hemisphereLight args={['#ffd0c8', '#200006', 0.5]} />
      <Headlight intensity={6} color="#ffe6de" distance={10} />
      <mesh geometry={wallGeo} material={wallMat} onClick={pickWall} renderOrder={1} />
      <instancedMesh ref={rbcRef} args={[rbcGeo, rbcMat, RBC_MAX]} onClick={pick('rbc')} frustumCulled={false} />
      <instancedMesh ref={ldlRef} args={[ldlGeo, ldlMat, LDL_MAX]} onClick={pick('ldl')} frustumCulled={false} />
      <instancedMesh ref={hdlRef} args={[ldlGeo, hdlMat, HDL_MAX]} onClick={pick('hdl')} frustumCulled={false} />
      <instancedMesh ref={pltRef} args={[pltGeo, pltMat, PLT_MAX]} onClick={pick('platelet')} frustumCulled={false} />
      <instancedMesh ref={trlRef} args={[ldlGeo, trlMat, TRL_MAX]} onClick={pick('vldl')} frustumCulled={false} />
      <instancedMesh ref={retRef} args={[ldlGeo, retMat, RETAIN]} onClick={pick('oxldl')} frustumCulled={false} />
      <instancedMesh ref={monoRef} args={[monoGeo, monoMat, MONO_N]} onClick={pick('monocyte')} frustumCulled={false} />
      <instancedMesh ref={dropRef} args={[dropGeo, dropMat, MONO_N * 7]} raycast={() => null} frustumCulled={false} />
      <points ref={plasmaRef} geometry={plasma} material={plasmaMat} frustumCulled={false} raycast={() => null} />
      <mesh ref={markerRef} geometry={markerGeo} material={markerMat} visible={false} raycast={() => null} />
    </group>
  );
}
