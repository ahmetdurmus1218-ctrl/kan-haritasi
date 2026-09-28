import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Color, DoubleSide, FrontSide, Mesh, MeshStandardMaterial, type Plane, ShaderMaterial, SphereGeometry, ConeGeometry, TorusGeometry, CylinderGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry } from 'three';
import { partDef } from '@kh/catalog';
import type { ModelPart } from './models';
import { PART_OPACITY, TRANSLUCENT, colorFor, highlightColor } from './palette';
import type { StructureHighlight } from './highlight';
import type { SchematicPart, SchematicShape } from './schematic';

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
  /** Tıklanan noktanın dünya koordinatı (bilgi bulutunun bağlandığı yer). */
  point?: [number, number, number];
}

export interface PointerInfo extends PickInfo {
  x: number;
  y: number;
}

export type AnyPart = ModelPart | SchematicPart;

export interface BodySceneProps {
  parts: ModelPart[];
  /** Kaynaklarda modeli olmayan yapıların şematik çizimleri. */
  schematic: SchematicPart[];
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
  /** Kullanıcının gizlediği yapılar. */
  hidden: Set<string>;
  /** İzole: odak dışındaki yapılar hiç çizilmez (soluk değil). */
  isolate: boolean;
  /** İç anatomi: odaktaki organın dış bölümleri saydamlaşır, iç bölümleri öne çıkar. */
  innerView: boolean;
  /** Kesit düzlemi (null: kapalı). */
  clip: Plane | null;
  theme: 'light' | 'dark';
  /** Bölüm düzeyinde seçimin açık olduğu yapı (odaktaki organ); diğerleri bütün olarak vurgulanır. */
  partLevel: string | null;
  /**
   * Sonuçla ilişkisi olmayan yapılar: soluk ve gri çizilir (yine tıklanabilir). Böylece sonuçla ilişkili
   * organlar öne çıkar. null: kimse soluklaşmaz.
   */
  muted: Set<string> | null;
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

const SHAPES: Record<SchematicShape, () => BufferGeometry> = {
  sphere: () => new SphereGeometry(1, 24, 16),
  cone: () => new ConeGeometry(1, 1.4, 4),
  torus: () => new TorusGeometry(1, 0.12, 8, 32),
  cylinder: () => new CylinderGeometry(1, 1, 1, 16, 1, true),
  disc: () => new CylinderGeometry(1, 1, 1, 24),
  spiral: () => {
    // Koklea: 2,5 tur daralan sarmal
    const pts: Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * Math.PI * 5;
      const r = 1 - 0.7 * t;
      pts.push(new Vector3(Math.cos(a) * r, t * 0.9 - 0.45, Math.sin(a) * r));
    }
    return new TubeGeometry(new CatmullRomCurve3(pts), 90, 0.18, 8, false);
  },
};
const shapeCache = new Map<SchematicShape, BufferGeometry>();
const shapeGeometry = (s: SchematicShape) => {
  let g = shapeCache.get(s);
  if (!g) {
    g = SHAPES[s]();
    shapeCache.set(s, g);
  }
  return g;
};

interface PartViewProps {
  part: AnyPart;
  clip: Plane | null;
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

function PartView({ part, clip, visible, color, targetOpacity, emissiveColor, emissive, pulse, pickable, visuals, onPick, onHover }: PartViewProps) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.46, metalness: 0.02, envMapIntensity: 1 }), []);

  useEffect(() => {
    // Kesit: düzlemin önü kesilir; iç yüzler de çizilir ki organın içi görünsün.
    material.clippingPlanes = clip ? [clip] : null;
    material.side = clip ? DoubleSide : FrontSide;
    material.needsUpdate = true;
    invalidate();
  }, [material, clip, invalidate]);

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
      onPick({ ...info, point: [e.point.x, e.point.y, e.point.z] });
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
  return <mesh {...common} geometry={shapeGeometry(part.shape)} position={part.position} scale={part.scale} rotation={part.rotation ?? [0, 0, 0]} />;
}

function makeSkinXray(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color('#9cc8ff') }, uOpacity: { value: 0.5 } },
    // Kesit düzlemi deriyi de kessin diye three.js kırpma parçaları eklenir.
    clipping: true,
    vertexShader: /* glsl */ `
      #include <clipping_planes_pars_vertex>
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        f = pow(f, 2.3);
        gl_FragColor = vec4(uColor, f * uOpacity + 0.018 * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
}

function SkinView({ part, mode, xrayRef, clip, theme }: { part: ModelPart; mode: SkinMode; xrayRef: RefObject<ShaderMaterial | null>; clip: Plane | null; theme: 'light' | 'dark' }) {
  const invalidate = useThree((s) => s.invalidate);
  const xray = useMemo(makeSkinXray, []);
  const solid = useMemo(() => new MeshStandardMaterial({ color: colorFor('skin', null), roughness: 0.72, metalness: 0 }), []);
  useEffect(() => {
    // Açık temada röntgen derisi koyu mavi çizgi, koyu temada açık mavi parıltı
    xray.uniforms.uColor!.value.set(theme === 'light' ? '#2f5f9e' : '#9cc8ff');
    for (const m of [xray, solid]) {
      m.clippingPlanes = clip ? [clip] : null;
      m.needsUpdate = true;
    }
    solid.side = clip ? DoubleSide : FrontSide;
    invalidate();
  }, [xray, solid, clip, theme, invalidate]);
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

const muteCache = new Map<string, string>();
/** Soluk yapılar: rengin doygunluğu alınır, arka plana doğru çekilir. */
function mutedColor(hex: string, theme: 'light' | 'dark'): string {
  const k = `${hex}|${theme}`;
  let out = muteCache.get(k);
  if (!out) {
    const c = new Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s * 0.18, theme === 'light' ? Math.min(0.78, hsl.l + 0.2) : hsl.l * 0.8);
    out = `#${c.getHexString()}`;
    muteCache.set(k, out);
  }
  return out;
}

export function BodyScene(props: BodySceneProps) {
  const { parts, schematic, visible, isVisible, highlights, focus, focusParts, skinMode, accent, reducedMotion, onPick, onHover, hidden, isolate, innerView, clip, theme, partLevel, muted } = props;
  const visuals = useRef(new Map<string, Visual>());
  const skinRef = useRef<ShaderMaterial | null>(null);
  const [hovered, setHovered] = useState<{ partId: string; structure: string; whole: boolean } | null>(null);
  const all: AnyPart[] = useMemo(() => [...parts.filter((p) => p.structure !== 'skin'), ...schematic], [parts, schematic]);
  const skin = parts.find((p) => p.structure === 'skin');
  // Yakın çekimde deri çizgileri organı örtmesin diye daha saydam
  const skinTarget = focus ? (theme === 'light' ? 0.16 : 0.12) : theme === 'light' ? 0.75 : 0.5;

  return (
    <group visible={visible} dispose={null}>
      {all.map((p) => {
        const h = highlights.get(p.structure);
        const inFocus = !focus || focus.has(p.structure);
        const partFocused = focusParts ? focusParts.has(p.id) : true;
        const key = `${p.structure}|${p.label ?? ''}`;
        const base = PART_OPACITY[key] ?? TRANSLUCENT[p.structure] ?? 1;
        const inner = p.label ? (partDef(p.structure, p.label)?.inner ?? false) : false;
        // İç anatomi: odaktaki organın dış bölümleri saydamlaşır
        const innerDim = innerView && inFocus && focus && !inner && !focusParts ? Math.min(base, 0.14) : base;
        const isMuted = !!muted && muted.has(p.structure) && !h;
        const focused = !inFocus ? (isolate ? 0 : DIM) : focusParts && !partFocused ? Math.min(base, 0.18) : innerDim;
        const isHovered = !!hovered && (hovered.whole ? hovered.structure === p.structure : hovered.partId === p.id);
        // Soluk yapı üzerine gelinince biraz belirginleşir (tıklanabileceği anlaşılsın)
        const targetOpacity = isMuted ? Math.min(focused, isHovered ? 0.55 : focus ? 0.4 : theme === 'light' ? 0.2 : 0.13) : focused;
        const emissiveColor = h ? highlightColor(h.status, h.score) : (focusParts?.has(p.id) ?? false) || isHovered ? accent : null;
        const shown = !hidden.has(p.structure) && (isVisible(p.structure) || (!!focus && focus.has(p.structure))) && !(isolate && !inFocus);
        return (
          <PartView
            key={p.id}
            part={p}
            clip={clip}
            visible={shown}
            color={isMuted && !isHovered ? mutedColor(colorFor(p.structure, p.label), theme) : colorFor(p.structure, p.label)}
            targetOpacity={targetOpacity}
            emissiveColor={emissiveColor}
            emissive={h ? (isHovered ? 1.25 : 0.45 + 0.22 * h.score) : isHovered ? 0.28 : 0.35}
            pulse={h && inFocus ? h.score : 0}
            pickable={inFocus && visible && targetOpacity > 0.1}
            visuals={visuals}
            onPick={onPick}
            onHover={(info) => {
              const id = info?.partId ?? null;
              if ((hovered?.partId ?? null) !== id) setHovered(info ? { partId: info.partId, structure: info.structure, whole: !info.label || info.structure !== partLevel } : null);
              onHover(info);
            }}
          />
        );
      })}
      {skin && !hidden.has('skin') && !(isolate && focus) && <SkinView part={skin} mode={skinMode} xrayRef={skinRef} clip={clip} theme={theme} />}
      <Animator visuals={visuals} skin={skinRef} skinTarget={skinTarget} reducedMotion={reducedMotion} />
    </group>
  );
}
