import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, type Mesh, PlaneGeometry, ShaderMaterial } from 'three';

/**
 * Sahne yönetmeni: vücut ↔ organın içi gibi büyük seviye geçişlerini yapar.
 *
 * Geçiş, tıklanan noktadan yayılan prosedürel gürültülü bir halkadır (Codrops "radial noise"
 * deneyinden esinlenen, bu projede sıfırdan yazılmış bir gölgelendirici): halka ekranı örter,
 * sahne perde arkasında değişir, sonra ortadan açılarak yeni sahneyi gösterir. Rengi sistemin
 * vurgu rengidir. "Hareketi azalt" açıksa kısa bir kararma kullanılır.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uProgress;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uOrigin;
  uniform vec3 uColor;
  uniform float uSimple;
  varying vec2 vUv;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 base = vec3(0.012, 0.016, 0.028);
    if (uSimple > 0.5) {
      float a = uProgress <= 1.0 ? uProgress : 2.0 - uProgress;
      gl_FragColor = vec4(base, clamp(a, 0.0, 1.0));
      #include <colorspace_fragment>
      return;
    }
    vec2 p = (vUv * 2.0 - 1.0 - uOrigin) * vec2(uAspect, 1.0);
    float d = length(p);
    vec2 far = (abs(uOrigin) + 1.0) * vec2(uAspect, 1.0);
    float maxD = length(far) + 0.7;
    float n = fbm(vec3(p * 2.6, uTime * 0.4));
    float edge = d + (n - 0.5) * 0.6;

    float front;
    float covered;
    if (uProgress <= 1.0) {
      front = uProgress * maxD;
      covered = smoothstep(front, front - 0.06, edge);
    } else {
      front = (uProgress - 1.0) * maxD;
      covered = smoothstep(front - 0.06, front, edge);
    }
    float band = exp(-pow((edge - front) / 0.085, 2.0));
    // Halkadaki hücresel noktalar (dokuyu andıran taneler)
    float cells = smoothstep(0.58, 0.72, vnoise(vec3(p * 42.0, uTime * 1.6)));
    float grain = fract(sin(dot(vUv * 512.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;

    vec3 col = base + uColor * 0.12 * n * covered;
    col += uColor * band * (0.55 + 1.1 * cells);
    col += grain * 0.035;
    float alpha = clamp(max(covered, band * 0.95), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }`;

interface Props {
  /** Gösterilmesi istenen sahne anahtarı. */
  target: string;
  color: string;
  /** Geçişin başladığı nokta (NDC, -1..1). */
  origin: [number, number];
  reducedMotion: boolean;
  /** Perde tamamen kapandığında (sahne değişirken) çağrılır. */
  onSwap: (key: string) => void;
  children: (shown: string) => ReactNode;
}

type Phase = 'idle' | 'cover' | 'hold' | 'reveal';

export function SceneDirector({ target, color, origin, reducedMotion, onSwap, children }: Props) {
  const [shown, setShown] = useState(target);
  const phase = useRef<Phase>('idle');
  const progress = useRef(0);
  const hold = useRef(0);
  const meshRef = useRef<Mesh>(null);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const targetRef = useRef(target);
  targetRef.current = target;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uOrigin: { value: [0, 0] },
          uColor: { value: new Color(color) },
          uSimple: { value: 0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useEffect(() => {
    if (target !== shownRef.current) invalidate();
  }, [target, invalidate]);

  const phaseStart = useRef(0);
  const fromProgress = useRef(0);

  // İlerleme duvar saatine göre hesaplanır: yavaş cihazda kare hızı düşse de geçiş süresi aynı kalır.
  useFrame(({ clock }) => {
    const u = material.uniforms;
    const now = performance.now() / 1000;
    const coverTime = reducedMotion ? 0.22 : 0.85;
    const revealTime = reducedMotion ? 0.3 : 1.0;
    const wanted = targetRef.current;
    const begin = (p: Phase, from: number) => {
      phase.current = p;
      phaseStart.current = now;
      fromProgress.current = from;
    };

    if (phase.current === 'idle') {
      if (wanted === shownRef.current) return;
      begin('cover', 0);
      u.uColor!.value.set(color);
      u.uOrigin!.value = origin;
    }
    if (phase.current === 'reveal' && wanted !== shownRef.current) {
      // Açılırken yeni bir hedef geldi: bulunduğu yerden tekrar kapan.
      begin('cover', Math.max(0, 2 - progress.current));
    }
    const elapsed = now - phaseStart.current;
    if (phase.current === 'cover') {
      progress.current = Math.min(1, fromProgress.current + elapsed / coverTime);
      if (progress.current >= 1) {
        begin('hold', 1);
        hold.current = 0;
        if (wanted !== shownRef.current) {
          setShown(wanted);
          onSwap(wanted);
        }
      }
    } else if (phase.current === 'hold') {
      // Yeni sahnenin yüklenip derlenmesi için birkaç kare bekle.
      hold.current += 1;
      if (hold.current > 2 && elapsed > 0.12) begin('reveal', 1);
    } else if (phase.current === 'reveal') {
      progress.current = Math.min(2, 1 + elapsed / revealTime);
      if (progress.current >= 2) phase.current = 'idle';
    }

    const active = phase.current !== 'idle';
    if (meshRef.current) meshRef.current.visible = active;
    u.uProgress!.value = easeInOut(progress.current);
    u.uTime!.value = clock.getElapsedTime();
    u.uAspect!.value = size.width / Math.max(1, size.height);
    u.uSimple!.value = reducedMotion ? 1 : 0;
    if (active) invalidate();
  });

  return (
    <>
      {children(shown)}
      <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={1e6} visible={false} raycast={() => null} />
    </>
  );
}

/** 0..1 ve 1..2 aralıklarını ayrı ayrı yumuşatır. */
function easeInOut(p: number): number {
  const half = p <= 1 ? p : p - 1;
  const e = half < 0.5 ? 4 * half * half * half : 1 - Math.pow(-2 * half + 2, 3) / 2;
  return p <= 1 ? e : 1 + e;
}
