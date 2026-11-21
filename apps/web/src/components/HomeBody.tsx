/**
 * Ana ekranın merkezindeki 3B insan: keşif ekranıyla aynı GERÇEK anatomik modeller (HRA, BodyParts3D,
 * kurulu anatomi paketleri) ve aynı vücut sahnesi (BodyScene). Bu bileşen yalnız genel görünümü yönetir:
 * görünüm modu (tam vücut, deri, kas, iskelet, organlar, damar, sinir, lenf), döndürme, yakınlaştırma,
 * 360° dönüş ve seçilen organa kameranın yaklaşması. Organın ayrıntılı incelemesi ve "İçine gir" keşif
 * ekranının (#/vucut, #/ic) mevcut geçişleriyle açılır; buradaki hiçbir şey onların yerini almaz.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, type CameraControlsImpl, Html } from '@react-three/drei';
import { AdditiveBlending, type Box3, CanvasTexture, DoubleSide, MathUtils, type PerspectiveCamera, Vector3 } from 'three';
import { structureById } from '@kh/catalog';
import { BodyScene, type PickInfo, type PointerInfo, type SkinMode } from '../anatomy/BodyScene';
import { type BodyModel, webglAvailable } from '../anatomy/models';
import type { StructureHighlight } from '../anatomy/highlight';
import { ORGANS } from '../anatomy/organs';
import { useLook } from '../anatomy/surface';
import { useResolvedTheme } from '../state/theme';
import { useModels, structureBoxes } from '../explore/useModels';
import { inBody, structuresOfSystem } from '../explore/systems';
import { applyShot, frameBox, overviewShot } from '../explore/camera';
import { Env } from '../explore/sceneEnv';
import { LayersIcon, RotateCcwIcon, RotateCwIcon, TargetIcon, ZoomInIcon, ZoomOutIcon } from './icons';

/** Görünüm modları (adları ve renkleri ana ekranda: HomePage MODES). */
export type ViewMode = 'full' | 'skin' | 'muscles' | 'skeleton' | 'organs' | 'vessels' | 'nerves' | 'lymph';

const CARDIO = new Set(['heart', 'coronary-arteries', 'aorta', 'carotid-arteries', 'pulmonary-vessels', 'veins', 'renal-vessels', 'abdominal-vessels', 'eye-vessels', 'limb-vessels']);
const NERVOUS = new Set(['brain', 'spinal-cord', 'eyes', 'nerves', 'ear', 'hypothalamus', 'pineal']);
const FRAME = new Set(['bones', 'joints', 'skeletal-muscle', 'nerves', 'spinal-cord']);

function modeAllows(mode: ViewMode, sid: string, lymph: Set<string>): boolean {
  switch (mode) {
    case 'full':
      // Holografik tam vücut: organlar, damarlar, sinirler; iskelet ve kaslar kendi modlarında (organları örtmesin).
      return sid !== 'skeletal-muscle' && sid !== 'bones' && sid !== 'joints';
    case 'skin':
      return false;
    case 'muscles':
      return sid === 'skeletal-muscle' || sid === 'bones';
    case 'skeleton':
      return sid === 'bones' || sid === 'joints';
    case 'organs':
      return !FRAME.has(sid) && (!CARDIO.has(sid) || sid === 'heart');
    case 'vessels':
      return CARDIO.has(sid);
    case 'nerves':
      return NERVOUS.has(sid);
    case 'lymph':
      return lymph.has(sid);
  }
}

const SKIN: Record<ViewMode, SkinMode> = { full: 'xray', skin: 'solid', muscles: 'hidden', skeleton: 'xray', organs: 'xray', vessels: 'xray', nerves: 'xray', lymph: 'xray' };

/** Ayakların altındaki holografik platform: ışıyan halkalar (eklemeli karışım, çok ucuz). */
function Platform({ color }: { color: string }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(120,220,255,0.55)');
    grd.addColorStop(0.45, 'rgba(40,150,255,0.18)');
    grd.addColorStop(1, 'rgba(0,60,160,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, -0.885, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh raycast={() => null} renderOrder={-1}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {[
        [0.3, 0.315, 0.9],
        [0.42, 0.428, 0.55],
        [0.56, 0.565, 0.35],
      ].map(([a, b, o]) => (
        <mesh key={a} raycast={() => null} renderOrder={-1}>
          <ringGeometry args={[a!, b!, 96]} />
          <meshBasicMaterial color={color} transparent opacity={o} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** 360°: boştayken yavaş tur (yalnız açıkken kare çizilir). */
function Spin({ on, controls }: { on: boolean; controls: CameraControlsImpl | null }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    if (!on || !controls) return;
    controls.azimuthAngle += dt * MathUtils.degToRad(24);
    invalidate();
  });
  return null;
}

/** Tuval boyutu değişince (pencere, döndürme) genel kadraj yeniden hesaplanır. */
function Reframe({ onResize }: { onResize: () => void }) {
  const size = useThree((s) => s.size);
  const cb = useRef(onResize);
  cb.current = onResize;
  useEffect(() => {
    cb.current();
  }, [size.width, size.height]);
  return null;
}

/** Seçili organın 3B etiketi (organın yanında, çizgiyle bağlı). */
function Callout({ at, title, status, tone }: { at: Vector3; title: string; status?: string; tone?: string }) {
  return (
    <Html position={at.toArray()} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`kh-callout ${tone ? `is-${tone}` : ''}`} data-testid="home-callout">
        <i className="kh-callout-dot" />
        <i className="kh-callout-line" />
        <div className="kh-callout-card">
          <b>{title}</b>
          {status && <span>{status}</span>}
        </div>
      </div>
    </Html>
  );
}

export interface HomeBodyProps {
  body: BodyModel;
  mode: ViewMode;
  highlights: Map<string, StructureHighlight>;
  /** Seçili 3B yapı (organ kartından ya da modelden). */
  selected: string | null;
  /** Seçili yapının etiketi: durum ve ton (etkilenen organsa). */
  selectedStatus?: { text: string; tone: string } | undefined;
  onSelect: (structure: string | null) => void;
  /** compact: telefon (daha düşük çözünürlük, daha küçük düğmeler). */
  compact?: boolean;
}

export default function HomeBody({ body, mode, highlights, selected, selectedStatus, onSelect, compact = false }: HomeBodyProps) {
  const theme = useResolvedTheme();
  const { look } = useLook();
  const real = look === 'real';
  const light = theme === 'light';
  const [webgl] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const [spin, setSpin] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  // Kaslar isteğe bağlı (+4 MB): yalnız Kas modunda yüklenir.
  const [wantMuscles, setWantMuscles] = useState(false);
  useEffect(() => {
    if (mode === 'muscles' || selected === 'skeletal-muscle') setWantMuscles(true);
  }, [mode, selected]);
  const models = useModels(body, wantMuscles);
  const allParts = useMemo(() => [...models.parts, ...models.schematic], [models.parts, models.schematic]);
  const boxes = useMemo(() => structureBoxes(allParts), [allParts]);
  const lymph = useMemo(() => new Set(structuresOfSystem('immune', body)), [body]);

  const focus = useMemo(() => (selected ? new Set([selected]) : null), [selected]);
  const isVisible = useCallback((sid: string) => inBody(sid, body) && (focus?.has(sid) || modeAllows(mode, sid, lymph)), [body, focus, mode, lymph]);
  const accent = light ? '#0a7d95' : '#37d6c4';

  // Kamera: seçili organa yaklaş; seçim kalkınca tüm vücut.
  const frame = useCallback(
    (animate: boolean) => {
      const cam = cameraRef.current;
      if (!controls || !cam) return;
      const b: Box3 | undefined = selected ? boxes.get(selected) : undefined;
      void applyShot(controls, b ? frameBox(b, ORGANS[selected!]?.view ?? [0, 5], cam, compact ? 1.9 : 1.6, 0.05) : overviewShot(cam), animate && !reduced);
    },
    [controls, selected, boxes, compact, reduced],
  );
  const hasSelectedBox = !!selected && boxes.has(selected);
  useEffect(() => {
    if (selected) setSpin(false);
    frame(true);
    // Yalnız seçim değişince ve seçilen organın modeli gelince
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, selected, hasSelectedBox]);

  const onPick = useCallback((p: PickInfo) => onSelect(p.structure === selected ? null : p.structure), [onSelect, selected]);
  const onHover = useCallback((p: PointerInfo | null) => setHover(p ? p.structure : null), []);

  const callout = useMemo(() => {
    if (!selected) return null;
    const b = boxes.get(selected);
    if (!b) return null;
    const c = b.getCenter(new Vector3());
    return c;
  }, [selected, boxes]);

  const rotate = (deg: number) => {
    setSpin(false);
    void controls?.rotate(MathUtils.degToRad(deg), 0, !reduced);
  };
  const zoom = (k: number) => void controls?.dolly(k * (controls.distance ?? 2), !reduced);

  if (!webgl || lost)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-fg-muted" data-testid="home-body-fallback">
        {lost ? 'Grafik bağlamı kesildi.' : 'Bu cihazda 3B görüntüleme (WebGL) kullanılamıyor.'}
        {lost && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setLost(false);
              setCanvasKey((k) => k + 1);
            }}
          >
            Yeniden dene
          </button>
        )}
      </div>
    );

  const hoverName = hover && hover !== selected ? (structureById.get(hover)?.nameTr ?? null) : null;

  return (
    <div className="kh-stage relative h-full w-full" data-testid="home-body" data-mode={mode} data-selected={selected ?? ''} data-loaded={models.done ? 'true' : 'false'} data-body={body}>
      <Canvas
        key={canvasKey}
        className="!absolute inset-0 touch-none"
        frameloop={spin ? 'always' : 'demand'}
        dpr={Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 1.75)}
        gl={{ antialias: !compact, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 32, near: 0.01, far: 40, position: [0, 0.1, 3.6] }}
        onCreated={({ gl, camera }) => {
          cameraRef.current = camera as PerspectiveCamera;
          gl.localClippingEnabled = true;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setLost(true);
          });
          gl.domElement.setAttribute('role', 'img');
          gl.domElement.setAttribute('aria-label', '3B insan anatomisi. Organlara dokununca kamera yaklaşır; organlar soldaki listeden de seçilebilir.');
        }}
        onPointerMissed={() => setHover(null)}
      >
        <BodyScene
          parts={models.parts}
          schematic={models.schematic}
          visible
          isVisible={isVisible}
          highlights={highlights}
          focus={focus}
          focusParts={null}
          skinMode={SKIN[mode]}
          accent={accent}
          reducedMotion={reduced}
          onPick={onPick}
          onHover={onHover}
          hidden={EMPTY}
          isolate={false}
          innerView={false}
          clip={null}
          theme={theme}
          partLevel={null}
          muted={null}
        />
        {!light && <Platform color="#2fd8ff" />}
        {callout && <Callout at={callout} title={structureById.get(selected!)?.nameTr ?? selected!} status={selectedStatus?.text} tone={selectedStatus?.tone} />}
        <ambientLight intensity={real ? (light ? 0.22 : 0.1) : light ? 0.5 : 0.24} />
        <directionalLight position={[1.2, 2, 2.5]} intensity={real ? (light ? 0.7 : 0.5) : light ? 1.25 : 1.05} />
        <directionalLight position={[-1.5, 0.5, -2]} intensity={real ? 0.15 : light ? 0.55 : 0.35} />
        <Env intensity={real ? (light ? 0.55 : 0.35) : light ? 0.95 : 0.75} />
        <CameraControls ref={setControls} makeDefault minDistance={0.15} maxDistance={7} smoothTime={0.5} draggingSmoothTime={0.1} dollySpeed={0.6} />
        <Spin on={spin} controls={controls} />
        <Reframe onResize={() => !selected && frame(false)} />
      </Canvas>

      {!models.done && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center" data-testid="home-body-loading">
          <span className="rounded-full border border-accent/30 bg-ink-950/70 px-3 py-1 text-xs text-fg-muted backdrop-blur">3B anatomi yükleniyor… %{Math.round(models.progress * 100)}</span>
        </div>
      )}
      {hoverName && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-accent/30 bg-ink-950/80 px-3 py-1 text-xs text-fg backdrop-blur" aria-hidden="true">
          {hoverName}
        </div>
      )}

      {/* Sağ kontroller: döndür, yakınlaştır, uzaklaştır, ortala */}
      <div className="kh-rail absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1.5 md:right-3" role="toolbar" aria-label="3B görünüm kontrolleri">
        <button type="button" className="kh-rail-btn" onClick={() => setSpin((s) => !s)} aria-pressed={spin} aria-label="360° döndür" title="360° döndür">
          <span className="text-[11px] font-semibold">360°</span>
        </button>
        <button type="button" className="kh-rail-btn" onClick={() => zoom(-0.25)} aria-label="Yakınlaştır" title="Yakınlaştır">
          <ZoomInIcon size={compact ? 17 : 19} />
        </button>
        <button type="button" className="kh-rail-btn" onClick={() => zoom(0.3)} aria-label="Uzaklaştır" title="Uzaklaştır">
          <ZoomOutIcon size={compact ? 17 : 19} />
        </button>
        <button type="button" className="kh-rail-btn" onClick={() => (selected ? onSelect(null) : frame(true))} aria-label="Tüm vücuda dön" title="Tüm vücuda dön">
          <TargetIcon size={compact ? 17 : 19} />
        </button>
        <a href="#/vucut" className="kh-rail-btn" aria-label="Tam ekran 3B keşif: katmanlar, kesit, arama" title="Tam ekran 3B keşif">
          <LayersIcon size={compact ? 17 : 19} />
        </a>
      </div>

      {/* Alt: 360° döndürme şeridi */}
      <div className="kh-orbit absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
        <button type="button" className="kh-orbit-btn" onClick={() => rotate(-45)} aria-label="Sola döndür">
          <RotateCcwIcon size={16} />
        </button>
        <span className="px-2 text-sm font-semibold tracking-wide text-accent-strong">360°</span>
        <button type="button" className="kh-orbit-btn" onClick={() => rotate(45)} aria-label="Sağa döndür">
          <RotateCwIcon size={16} />
        </button>
      </div>
    </div>
  );
}

const EMPTY = new Set<string>();
