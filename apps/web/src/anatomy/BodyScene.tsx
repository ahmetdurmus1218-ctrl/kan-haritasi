import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Color, FrontSide, Mesh, MeshStandardMaterial, ShaderMaterial } from 'three';
import type { ModelPart } from './models';
import { TRANSLUCENT, colorFor, highlightColor } from './palette';
import type { StructureHighlight } from './highlight';
import { SCHEMATIC_PARTS, type SchematicPart } from './schematic';

/**
 * Vücut sahnesi: HRA modellerinden gelen yapılar + şematik bezler.
 * Görsel durum (saydamlık, parlama, nabız) tek bir animatörde yumuşakça hedefe akar;
 * böylece odak değişince organlar kesilmeden söner/belirir.
 */

export type SkinMode = 'xray' | 'solid' | 'hidden';

export interface PickInfo {
  structure: string;
  label: string | null;
  partId: string;
}

export interface PointerInfo extends PickInfo {
  x: number;
  y: number;
}

export type AnyPart = ModelPart | SchematicPart;

export interface BodySceneProps {
  parts: ModelPart[];
  visible: boolean;
  isVisible: (structure: string) => boolean;
  /** Yapı başına vurgu (tahlil sonucu). */
  highlights: Map<string, StructureHighlight>;
  /** Odak: bu yapılar tam görünür, diğerleri soluklaşır. null: hepsi görünür. */
  focus: Set<string> | null;
  /** Alt parça (damar) odaktaysa o parçaların kimlikleri. */
  focusParts: Set<string> | null;
  skinMode: SkinMode;
  accent: string;
  reducedMotion: boolean;
  onPick: (p: PickInfo) => void;
  onHover: (p: PointerInfo | null) => void;
}

const noRaycast = () => null;
const DIM = 0.055;

interface Visual {
  mat: MeshStandardMaterial;
  opacity: number;
  targetOpacity: number;
  emissive: number;
  targetEmissive: number;
  /** 0: nabız yok; 1–3: sapma derecesi (hız ve derinlik artar). */
  pulse: number;
}

function Animator({ visuals, skin, skinTarget, reducedMotion }: { visuals: RefObject<Map<string, Visual>>; skin: RefObject<ShaderMaterial | null>; skinTarget: number; reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(({ clock }, dt) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 7);
    const t = clock.getElapsedTime();
    let busy = false;
    for (const v of visuals.current.values()) {
      if (Math.abs(v.opacity - v.targetOpacity) > 0.002) {
        v.opacity += (v.targetOpacity - v.opacity) * k;
        busy = true;
      } else v.opacity = v.targetOpacity;
      const transparent = v.opacity < 0.995;
      if (v.mat.transparent !== transparent) {
        v.mat.transparent = transparent;
        v.mat.depthWrite = !transparent;
        v.mat.needsUpdate = true;
      }
      v.mat.opacity = v.opacity;
      if (v.pulse > 0 && !reducedMotion) {
        const depth = 0.22 + 0.13 * v.pulse;
        v.mat.emissiveIntensity = v.targetEmissive * (1 - depth + depth * (0.5 + 0.5 * Math.sin(t * (1.6 + 0.9 * v.pulse))));
        busy = true;
      } else if (Math.abs(v.emissive - v.targetEmissive) > 0.003) {
        v.emissive += (v.targetEmissive - v.emissive) * k;
        v.mat.emissiveIntensity = v.emissive;
        busy = true;
      } else {
        v.emissive = v.targetEmissive;
        v.mat.emissiveIntensity = v.emissive;
      }
      // Tamamen sönük parçaları çizme (performans)
      v.mat.visible = v.opacity > 0.01;
    }
    const s = skin.current;
    if (s) {
      const u = s.uniforms.uOpacity!;
      if (Math.abs(u.value - skinTarget) > 0.002) {
        u.value += (skinTarget - u.value) * k;
        busy = true;
      }
    }
    if (busy) invalidate();
  });
  useEffect(() => invalidate());
  return null;
}

interface PartViewProps {
  part: AnyPart;
  visible: boolean;
  color: string;
  targetOpacity: number;
  emissiveColor: string | null;
  emissive: number;
  pulse: number;
  pickable: boolean;
  visuals: RefObject<Map<string, Visual>>;
  onPick: BodySceneProps['onPick'];
  onHover: BodySceneProps['onHover'];
}

function PartView({ part, visible, color, targetOpacity, emissiveColor, emissive, pulse, pickable, visuals, onPick, onHover }: PartViewProps) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.46, metalness: 0.02, envMapIntensity: 1 }), []);

  useEffect(() => {
    const v: Visual = { mat: material, opacity: targetOpacity, targetOpacity, emissive: 0, targetEmissive: 0, pulse: 0 };
    const registry = visuals.current;
    registry.set(part.id, v);
    return () => {
      registry.delete(part.id);
      material.dispose();
    };
    // Yalnızca ilk kurulum; hedefler aşağıdaki efektte güncellenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material, part.id, visuals]);

  useEffect(() => {
    const v = visuals.current.get(part.id);
    material.color.set(color);
    material.emissive.set(emissiveColor ?? '#000000');
    if (v) {
      v.targetOpacity = targetOpacity;
      v.targetEmissive = emissiveColor ? emissive : 0;
      v.pulse = pulse;
    }
    invalidate();
  }, [material, color, emissiveColor, emissive, pulse, targetOpacity, part.id, visuals, invalidate]);

  const info: PickInfo = { structure: part.structure, label: part.label, partId: part.id };
  const common = {
    material,
    visible,
    raycast: pickable && visible ? Mesh.prototype.raycast : noRaycast,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 8) return; // sürükleme (döndürme) tıklama sayılmaz
      e.stopPropagation();
      onPick(info);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover({ ...info, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    },
    onPointerOut: () => onHover(null),
  };

  if ('geometry' in part) {
    return <mesh {...common} geometry={part.geometry} matrixAutoUpdate={false} matrix={part.matrix} />;
  }
  return (
    <mesh {...common} position={part.position} scale={part.scale} rotation={part.rotation ?? [0, 0, 0]}>
      {part.shape === 'cone' ? <coneGeometry args={[1, 1.4, 4]} /> : <sphereGeometry args={[1, 24, 16]} />}
    </mesh>
  );
}

function makeSkinXray(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color('#9cc8ff') }, uOpacity: { value: 0.5 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        f = pow(f, 2.3);
        gl_FragColor = vec4(uColor, f * uOpacity + 0.018 * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
}

function SkinView({ part, mode, xrayRef }: { part: ModelPart; mode: SkinMode; xrayRef: RefObject<ShaderMaterial | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  const xray = useMemo(makeSkinXray, []);
  const solid = useMemo(() => new MeshStandardMaterial({ color: colorFor('skin', null), roughness: 0.72, metalness: 0 }), []);
  useEffect(() => {
    xrayRef.current = xray;
    return () => {
      xrayRef.current = null;
      xray.dispose();
      solid.dispose();
    };
  }, [xray, solid, xrayRef]);
  useEffect(() => invalidate(), [mode, invalidate]);
  return (
    <mesh
      geometry={part.geometry}
      matrixAutoUpdate={false}
      matrix={part.matrix}
      material={mode === 'solid' ? solid : xray}
      visible={mode !== 'hidden'}
      renderOrder={mode === 'xray' ? 10 : 0}
      raycast={noRaycast}
    />
  );
}

export function BodyScene(props: BodySceneProps) {
  const { parts, visible, isVisible, highlights, focus, focusParts, skinMode, accent, reducedMotion, onPick, onHover } = props;
  const visuals = useRef(new Map<string, Visual>());
  const skinRef = useRef<ShaderMaterial | null>(null);
  const [hovered, setHovered] = useState<{ partId: string; structure: string; whole: boolean } | null>(null);
  const all: AnyPart[] = useMemo(() => [...parts.filter((p) => p.structure !== 'skin'), ...SCHEMATIC_PARTS], [parts]);
  const skin = parts.find((p) => p.structure === 'skin');
  const skinTarget = focus ? 0.16 : 0.5;

  return (
    <group visible={visible} dispose={null}>
      {all.map((p) => {
        const h = highlights.get(p.structure);
        const inFocus = !focus || focus.has(p.structure);
        const partFocused = focusParts ? focusParts.has(p.id) : true;
        const base = TRANSLUCENT[p.structure] ?? 1;
        const targetOpacity = !inFocus ? DIM : focusParts && !partFocused ? Math.min(base, 0.22) : base;
        const isHovered = !!hovered && (hovered.whole ? hovered.structure === p.structure : hovered.partId === p.id);
        const emissiveColor = h ? highlightColor(h.status, h.score) : (focusParts?.has(p.id) ?? false) || isHovered ? accent : null;
        return (
          <PartView
            key={p.id}
            part={p}
            visible={isVisible(p.structure) || (!!focus && focus.has(p.structure))}
            color={colorFor(p.structure, p.label)}
            targetOpacity={targetOpacity}
            emissiveColor={emissiveColor}
            emissive={h ? (isHovered ? 1.25 : 0.45 + 0.22 * h.score) : isHovered ? 0.28 : 0.35}
            pulse={h && inFocus ? h.score : 0}
            pickable={inFocus && visible}
            visuals={visuals}
            onPick={onPick}
            onHover={(info) => {
              const id = info?.partId ?? null;
              if ((hovered?.partId ?? null) !== id) setHovered(info ? { partId: info.partId, structure: info.structure, whole: !info.label } : null);
              onHover(info);
            }}
          />
        );
      })}
      {skin && <SkinView part={skin} mode={skinMode} xrayRef={skinRef} />}
      <Animator visuals={visuals} skin={skinRef} skinTarget={skinTarget} reducedMotion={reducedMotion} />
    </group>
  );
}
