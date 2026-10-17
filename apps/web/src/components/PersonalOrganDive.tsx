/**
 * Kişisel organ sahnesi: yüklenen BT/MR serisinin GERÇEK bölütleme maskesinden çıkarılmış organ yüzeyi
 * (hasta RAS, mm), komşu bölütlenmiş yapılar ve varsa patoloji modelinin bulgu maskeleri. "İçine gir"de
 * kamera gerçek mesh'in içine — maskenin en derin noktasına — dalar: komşular söner, çevre kararır,
 * organın iç yüzeyi kameraya bağlı ışıkla (endoskopik) görünür. Şablon/genel model kullanılmaz.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PersonalOrganScene, PersonalPart } from '../lib/personalOrgan';
import { TONE_HEX } from '../lib/tone';

const NEIGHBOR = '#94a3b8';
const CAVITY = '#5eead4';

interface Built {
  part: PersonalPart;
  geometry: THREE.BufferGeometry;
}

/** OrbitControls'un burada kullanılan kısmı. */
interface OrbitControlsImpl {
  target: THREE.Vector3;
  enabled: boolean;
  minDistance: number;
  maxDistance: number;
  update(): void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function Rig({ center, radius, inside, depth, insidePoint, reducedMotion, onProgress }: { center: THREE.Vector3; radius: number; inside: boolean; depth: number; insidePoint: THREE.Vector3; reducedMotion: boolean; onProgress: (p: number) => void }) {
  const { camera, invalidate, controls } = useThree();
  const dir = useMemo(() => new THREE.Vector3(0.18, 1, 0.32).normalize(), []);
  const goal = useMemo(() => {
    const outEye = center.clone().addScaledVector(dir, radius * 2.7);
    // İçeride: maskenin sınırına uzaklığın yarısı kadar geride → kamera her zaman maskenin içinde kalır.
    const inEye = insidePoint.clone().addScaledVector(dir, Math.max(1, depth * 0.5));
    return inside ? { eye: inEye, target: insidePoint.clone() } : { eye: outEye, target: center.clone() };
  }, [inside, center, radius, depth, insidePoint, dir]);
  const anim = useRef<{ fromEye: THREE.Vector3; fromT: THREE.Vector3; t: number; dur: number; p0: number; p1: number } | null>(null);
  const progress = useRef(inside ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    const c = controls as unknown as OrbitControlsImpl | null;
    if (first.current) {
      // İlk açılış: dışarıdan başla; "İçine gir" adresiyle açıldıysa dalış animasyonu oynar.
      first.current = false;
      camera.position.copy(center.clone().addScaledVector(dir, radius * 2.7));
      if (c) c.target.copy(center);
      progress.current = 0;
      if (!inside) {
        c?.update();
        invalidate();
        return;
      }
    }
    anim.current = { fromEye: camera.position.clone(), fromT: c ? c.target.clone() : center.clone(), t: 0, dur: reducedMotion ? 0.15 : inside ? 2.2 : 1.4, p0: progress.current, p1: inside ? 1 : 0 };
    if (c) c.enabled = false;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, controls]);
  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls as unknown as OrbitControlsImpl | null;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const k = ease(a.t);
    camera.position.lerpVectors(a.fromEye, goal.eye, k);
    if (c) {
      c.target.lerpVectors(a.fromT, goal.target, k);
      c.update();
    } else camera.lookAt(goal.target);
    progress.current = a.p0 + (a.p1 - a.p0) * k;
    onProgress(progress.current);
    if (a.t >= 1) {
      anim.current = null;
      if (c) {
        c.enabled = true;
        c.minDistance = inside ? 0.5 : radius * 0.4;
        c.maxDistance = inside ? Math.max(2, depth * 0.9) : radius * 8;
      }
    }
    invalidate();
  });
  return null;
}

/** Kameraya bağlı ışık: içeride endoskop ışığı gibi önü aydınlatır. */
function HeadLight({ intensity }: { intensity: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return <pointLight ref={ref} intensity={intensity} decay={0} />;
}

export default function PersonalOrganDive({ scene, inside, organColor, reducedMotion, cut, onPick, picked, onDive }: { scene: PersonalOrganScene; inside: boolean; organColor: string; reducedMotion: boolean; cut: boolean; onPick: (p: PersonalPart | null) => void; picked: string | null; onDive?: (p: number) => void }) {
  const built = useMemo<Built[]>(
    () =>
      scene.parts.map((part) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(part.mesh.positions, 3));
        g.setIndex(new THREE.BufferAttribute(part.mesh.indices, 1));
        g.computeVertexNormals();
        return { part, geometry: g };
      }),
    [scene],
  );
  useEffect(() => () => built.forEach((b) => b.geometry.dispose()), [built]);
  const { center, radius } = useMemo(() => {
    const box = new THREE.Box3();
    for (const b of built) if (b.part.role === 'organ') box.union(new THREE.Box3(new THREE.Vector3(...b.part.mesh.min), new THREE.Vector3(...b.part.mesh.max)));
    return { center: box.getCenter(new THREE.Vector3()), radius: Math.max(10, box.getSize(new THREE.Vector3()).length() / 2) };
  }, [built]);
  const insidePoint = useMemo(() => new THREE.Vector3(...scene.inside.point), [scene]);
  // 0 = dışarıda, 1 = içeride (dalış ilerlemesi): komşuların sönmesi ve arka planın kararması buna bağlı.
  const [p, setP] = useState(0);
  const pRef = useRef(p);
  const onProgress = (x: number) => {
    if (Math.abs(x - pRef.current) > 0.02 || x === 0 || x === 1) {
      pRef.current = x;
      setP(x);
      onDive?.(x);
    }
  };
  // Kesit: görüş yönüne dik düzlem organın önünü açar (maskenin dolu olduğu görülür).
  const clip = useMemo(() => (cut && !inside ? [new THREE.Plane(new THREE.Vector3(0.18, 1, 0.32).normalize().negate(), center.clone().dot(new THREE.Vector3(0.18, 1, 0.32).normalize()))] : []), [cut, inside, center]);
  const bg = `rgb(${Math.round(11 - 8 * p)}, ${Math.round(15 - 11 * p)}, ${Math.round(24 - 18 * p)})`;

  return (
    <Canvas
      frameloop="demand"
      dpr={Math.min(window.devicePixelRatio || 1, 1.75)}
      camera={{ position: [center.x, center.y + radius * 2.7, center.z], up: [0, 0, 1], near: 0.3, far: radius * 30, fov: 45 }}
      gl={{ antialias: true, localClippingEnabled: true } as THREE.WebGLRendererParameters}
      style={{ background: bg, transition: 'background 0.2s' }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.domElement.setAttribute('role', 'img');
        gl.domElement.setAttribute('aria-label', 'Kişisel 3B organ: yüklediğin görüntünün bölütleme maskesinden oluşturuldu.');
      }}
      onPointerMissed={() => onPick(null)}
      data-testid="personal-organ-canvas"
    >
      {p > 0.3 && <fog attach="fog" args={['#05070c', Math.max(1, scene.inside.depthMm * 0.2), Math.max(20, scene.inside.depthMm * 6)]} />}
      <hemisphereLight args={['#f1f5f9', '#1e293b', 0.55 * (1 - p) + 0.08]} />
      <directionalLight position={[center.x + radius, center.y + radius * 3, center.z + radius * 2]} intensity={1.15 * (1 - p)} />
      <directionalLight position={[center.x - radius * 2, center.y - radius, center.z - radius]} intensity={0.35 * (1 - p)} />
      <HeadLight intensity={0.25 + 1.6 * p} />
      {built.map(({ part, geometry }) => {
        const role = part.role;
        const sel = picked === part.key;
        const color = role === 'organ' ? organColor : role === 'finding' ? TONE_HEX.high : role === 'cavity' ? CAVITY : NEIGHBOR;
        const opacity = role === 'neighbor' ? 0.28 * (1 - p) : role === 'cavity' ? 0.35 + 0.4 * p : 1;
        if (role === 'neighbor' && opacity < 0.02) return null;
        return (
          <mesh
            key={part.key}
            geometry={geometry}
            renderOrder={role === 'finding' ? 3 : role === 'organ' ? 1 : 2}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPick(part);
            }}
            userData={{ role }}
          >
            <meshPhysicalMaterial
              color={color}
              roughness={role === 'organ' ? 0.48 : 0.7}
              clearcoat={role === 'organ' ? 0.35 : 0}
              clearcoatRoughness={0.4}
              sheen={role === 'organ' ? 0.4 : 0}
              sheenColor="#ffd6cc"
              transparent={opacity < 1}
              opacity={opacity}
              depthWrite={opacity >= 1}
              side={THREE.DoubleSide}
              clippingPlanes={role === 'organ' || role === 'neighbor' ? clip : []}
              emissive={sel ? '#ffffff' : '#000000'}
              emissiveIntensity={sel ? 0.18 : 0}
            />
          </mesh>
        );
      })}
      <OrbitControls makeDefault enableDamping={false} target={center} />
      <Rig center={center} radius={radius} inside={inside} depth={scene.inside.depthMm} insidePoint={insidePoint} reducedMotion={reducedMotion} onProgress={onProgress} />
    </Canvas>
  );
}
