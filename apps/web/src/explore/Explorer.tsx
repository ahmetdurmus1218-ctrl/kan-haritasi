import { type ComponentType, type LazyExoticComponent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, type CameraControlsImpl } from '@react-three/drei';
import { Box3, type PerspectiveCamera, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { type Sex, type SystemId, structureById, systemById, testByKey } from '@kh/catalog';
import { useUnlockedVault } from '../state/VaultContext';
import { type Route, go } from '../state/router';
import { buildSeries, useReports } from '../lib/useReports';
import { loadSex } from '../lib/reports';
import { severityWeights, useInterpretation } from '../lib/interpretation';
import { highlightsFrom } from '../anatomy/highlight';
import { BodyScene, type PickInfo, type PointerInfo } from '../anatomy/BodyScene';
import { ORGANS } from '../anatomy/organs';
import { vesselLabel } from '../anatomy/names';
import { webglAvailable } from '../anatomy/models';
import { Banner } from '../components/ui';
import { LayersIcon } from '../components/icons';
import { useModels, structureBoxes } from './useModels';
import { INTRO_START, OVERVIEW, PRESETS, type Shot, applyShot, direction, frameBox, overviewShot, panelOffset, shotDistance } from './camera';
import { SceneDirector } from './SceneDirector';
import { BodyIntroPanel, OrganPanel, SystemPanel, TestPanel, vesselParts } from './BodyPanels';
import { MENU_SYSTEMS, isSystemId, structuresOfSystem, systemColor } from './systems';
import { Breadcrumb, Caps, ContextSheet, type Crumb, DEFAULT_LAYERS, type Layers, LayersMenu, LoadingLine, Tooltip, type ViewName, ViewControls } from './ui';
import { INSIDE, type InsideId, resolveInside } from './inside/registry';
import { INSIDE_CONTENT } from './inside/content';
import { useInside } from './inside/state';
import { InsidePanel, SimulationBadge } from './inside/InsidePanel';
import { personalFor } from './inside/personal';
import type { InsideSceneProps } from './inside/kit';

type ExploreRoute = Extract<Route, { name: 'body' }> | Extract<Route, { name: 'simulation' }>;

const SCENES: Partial<Record<InsideId, LazyExoticComponent<ComponentType<InsideSceneProps>>>> = {
  damar: lazy(() => import('./inside/scenes/VesselScene')),
  alveol: lazy(() => import('./inside/scenes/AlveolusScene')),
  nefron: lazy(() => import('./inside/scenes/NephronScene')),
  lobul: lazy(() => import('./inside/scenes/LobuleScene')),
  adacik: lazy(() => import('./inside/scenes/IsletScene')),
  folikul: lazy(() => import('./inside/scenes/FollicleScene')),
  ilik: lazy(() => import('./inside/scenes/MarrowScene')),
};

/** Açılış yalnızca oturumda bir kez oynar. */
let introPlayed = false;

const CARDIO_LAYER = new Set(['heart', 'coronary-arteries', 'aorta', 'carotid-arteries', 'pulmonary-vessels', 'veins', 'renal-vessels', 'abdominal-vessels', 'eye-vessels']);

function layerAllows(layers: Layers, structure: string): boolean {
  if (structure === 'bones') return layers.skeleton;
  if (CARDIO_LAYER.has(structure)) return layers.cardio;
  if (structure === 'lungs' || structure === 'airways') return layers.respiratory;
  if (structure === 'brain' || structure === 'spinal-cord') return layers.nervous;
  return layers.organs;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function Explorer({ route }: { route: ExploreRoute }) {
  const vault = useUnlockedVault();
  const models = useModels();
  const { reports } = useReports();
  const reducedMotion = useReducedMotion();
  const [sex, setSex] = useState<Sex>('unspecified');
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [webgl] = useState(webglAvailable);
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    loadSex(vault).then(setSex, () => undefined);
  }, [vault]);

  /* ---------------------------------------------------------- rota → seviye */
  const inside = route.name === 'simulation' ? resolveInside(route.id) : null;
  const fromStructure = route.name === 'simulation' && route.from && structureById.has(route.from) ? route.from : undefined;
  // İçeri girilirken (geçiş sürerken) vücut sahnesi girilen organa odaklı kalır.
  const structure = route.name === 'body' ? (route.structure && structureById.has(route.structure) ? route.structure : undefined) : fromStructure;
  const system: SystemId | undefined = route.name === 'body' && isSystemId(route.system) ? route.system : undefined;
  const focusTest = route.name === 'body' && route.focus && testByKey.has(route.focus) ? route.focus : undefined;
  const sceneKey = inside ? `inside:${inside.scene}` : 'body';
  const [shownKey, setShownKey] = useState(sceneKey);
  const shownInside = shownKey.startsWith('inside:') ? (shownKey.slice(7) as InsideId) : null;
  const [partKey, setPartKey] = useState<string | null>(null);
  useEffect(() => setPartKey(null), [structure]);

  const [insideState, insideActions] = useInside(shownInside, !!inside?.startSimulation && shownInside === inside.scene);

  /* ---------------------------------------------------------- veri */
  const series = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);
  const seriesMap = useMemo(() => new Map(series.map((s) => [s.test.key, s])), [series]);
  const interp = useInterpretation(series, sex);
  const weights = useMemo(() => severityWeights(interp), [interp]);
  const highlights = useMemo(() => highlightsFrom(series, focusTest, weights), [series, focusTest, weights]);
  const boxes = useMemo(() => structureBoxes(models.parts), [models.parts]);
  const vessels = useMemo(() => (structure ? vesselParts(models.parts, structure) : []), [models.parts, structure]);
  const part = vessels.find((v) => v.id === partKey) ?? null;

  const focus = useMemo<Set<string> | null>(() => {
    if (structure) return new Set([structure]);
    if (system) return new Set(structuresOfSystem(system));
    if (focusTest) return new Set(highlights.keys());
    return null;
  }, [structure, system, focusTest, highlights]);
  const focusParts = useMemo(() => (part ? new Set(part.ids) : null), [part]);

  const isVisible = useCallback(
    (sid: string) => {
      if (sid === 'prostate' && sex === 'female') return false;
      return layerAllows(layers, sid);
    },
    [layers, sex],
  );

  const accent = shownInside
    ? systemColor(INSIDE[shownInside].system)
    : structure
      ? systemColor(structureById.get(structure)?.systems[0])
      : system
        ? systemColor(system)
        : focusTest
          ? systemColor(testByKey.get(focusTest)?.systems[0])
          : '#37d6c4';

  /* ---------------------------------------------------------- kamera */
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef({ right: 0, bottom: 0 });
  // Kamera denetimi sahne ağacında hazır olunca (Canvas içi ayrı çizilir) kamera işleri başlar.
  const [controlsReady, setControlsReady] = useState(false);
  const setControls = useCallback((c: CameraControlsImpl | null) => {
    controlsRef.current = c;
    setControlsReady(!!c);
  }, []);
  const [intro, setIntro] = useState(() => !introPlayed && route.name === 'body' && !route.structure && !route.system && !route.focus);

  const viewport = () => ({ width: rootRef.current?.clientWidth ?? 0, height: rootRef.current?.clientHeight ?? 0 });

  const unionBox = useCallback(
    (ids: Iterable<string>) => {
      const b = new Box3();
      for (const id of ids) {
        const bb = boxes.get(id);
        if (bb) b.union(bb);
      }
      return b.isEmpty() ? null : b;
    },
    [boxes],
  );

  const shotForLevel = useCallback((): Shot => {
    const cam = cameraRef.current;
    const c = controlsRef.current;
    if (!cam || !c) return OVERVIEW;
    if (part) {
      const b = new Box3();
      for (const p of models.parts) if (part.ids.includes(p.id)) b.union(p.box);
      const pos = c.getPosition(new Vector3());
      const tgt = c.getTarget(new Vector3());
      const d = pos.sub(tgt).normalize();
      return frameBox(b, [(Math.atan2(d.x, d.z) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI], cam, 2.4, 0.02);
    }
    if (structure) {
      const b = unionBox([structure]);
      return b ? frameBox(b, ORGANS[structure]?.view ?? [0, 5], cam, 1.45) : OVERVIEW;
    }
    if (system) {
      const b = unionBox(structuresOfSystem(system));
      return b ? frameBox(b, [0, 6], cam, 1.05) : OVERVIEW;
    }
    if (focusTest) {
      const b = unionBox(highlights.keys());
      return b ? frameBox(b, [0, 6], cam, 1.15) : overviewShot(cam);
    }
    return overviewShot(cam);
  }, [part, structure, system, focusTest, highlights, unionBox, models.parts]);

  // Odaktaki yapıların modeli yüklendi mi? (yüklenince bir kez yeniden kadrajla)
  const focusReady = useMemo(() => {
    const ids = structure ? [structure] : system ? structuresOfSystem(system) : focusTest ? [...highlights.keys()] : [];
    return ids.map((id) => (boxes.has(id) ? 1 : 0)).join('');
  }, [structure, system, focusTest, highlights, boxes]);

  const frame = useCallback(
    (animate: boolean) => {
      const c = controlsRef.current;
      const cam = cameraRef.current;
      if (!c || !cam) return;
      const shot = shotForLevel();
      c.minDistance = 0.05;
      c.maxDistance = 6;
      void applyShot(c, shot, animate);
      void panelOffset(c, cam, viewport(), coverRef.current, animate, shotDistance(shot));
    },
    [shotForLevel],
  );

  useEffect(() => {
    if (shownKey !== 'body' || intro || !controlsReady) return;
    frame(!reducedMotion);
    // focusReady: model geldiğinde tekrar kadrajla; frame her render'da yeni olduğundan bağımlılıkta yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, structure, system, focusTest, partKey, focusReady, intro, reducedMotion, controlsReady]);

  // Açılış: uzaktan yavaşça yaklaş (atlanabilir)
  const bodyLoaded = models.loaded.has('body');
  useEffect(() => {
    if (!intro || !bodyLoaded || !controlsReady) return;
    const c = controlsRef.current;
    if (!c) return;
    introPlayed = true;
    void applyShot(c, INTRO_START, false);
    c.smoothTime = reducedMotion ? 0.3 : 1.5;
    const t1 = window.setTimeout(() => void applyShot(c, cameraRef.current ? overviewShot(cameraRef.current) : OVERVIEW, true), 120);
    const t2 = window.setTimeout(() => endIntro(), reducedMotion ? 400 : 3200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro, bodyLoaded, controlsReady]);

  const endIntro = () => {
    const c = controlsRef.current;
    if (c) c.smoothTime = 0.55;
    introPlayed = true;
    setIntro(false);
  };

  const shownKeyRef = useRef(shownKey);
  shownKeyRef.current = shownKey;
  const onCover = useCallback((cover: { right: number; bottom: number }) => {
    coverRef.current = cover;
    const c = controlsRef.current;
    const cam = cameraRef.current;
    // İçeri-gir sahnelerinde kamera damarın/dokunun içinde; yana kaydırmak onu dışarı taşır.
    if (c && cam && shownKeyRef.current === 'body') void panelOffset(c, cam, viewport(), cover, true);
  }, []);

  const onView = (v: ViewName) => {
    const c = controlsRef.current;
    if (!c) return;
    const [az, el] = PRESETS[v];
    const dir = direction(az, el);
    void c.rotateTo(Math.atan2(dir.x, dir.z), Math.acos(dir.y), true);
  };
  const onZoom = (d: 1 | -1) => void controlsRef.current?.dolly(controlsRef.current.distance * 0.28 * d, true);
  const onReset = () => (shownKey === 'body' ? frame(true) : controlsRef.current?.reset(true));

  /* ---------------------------------------------------------- etkileşim */
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onHover = useCallback(
    (p: PointerInfo | null) => {
      const el = tooltipRef.current;
      const root = rootRef.current;
      if (!el || !root) return;
      if (!p) {
        el.style.display = 'none';
        root.style.cursor = '';
        return;
      }
      root.style.cursor = 'pointer';
      const s = structureById.get(p.structure);
      const name = p.label ? vesselLabel(p.label) : (s?.nameTr ?? p.structure);
      const h = highlights.get(p.structure);
      el.textContent = h ? `${name} · ${h.tests.map((t) => testByKey.get(t.key)?.nameTr.split(' (')[0]).join(', ')} ${h.status === 'high' ? '▲' : h.status === 'low' ? '▼' : ''}` : name;
      const r = root.getBoundingClientRect();
      const x = Math.min(p.x - r.left + 14, r.width - 200);
      const y = Math.max(8, p.y - r.top + 16);
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.display = 'block';
    },
    [highlights],
  );

  const onPick = useCallback(
    (p: PickInfo) => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      if (intro) endIntro();
      if (structure && p.structure === structure && p.label) {
        const group = vessels.find((v) => v.ids.includes(p.partId));
        setPartKey(group?.id ?? null);
        return;
      }
      if (p.structure !== structure) go({ name: 'body', structure: p.structure });
    },
    [structure, vessels, intro],
  );

  const projectToNdc = (sid: string | undefined): [number, number] => {
    const cam = cameraRef.current;
    const b = sid ? boxes.get(sid) : null;
    if (!cam || !b) return [0, 0];
    const v = b.getCenter(new Vector3()).project(cam);
    return [Math.max(-1, Math.min(1, v.x)), Math.max(-1, Math.min(1, v.y))];
  };

  const enter = (scene: string, from?: string) => {
    setOrigin(projectToNdc(from ?? structure));
    go({ name: 'simulation', id: scene, from: from ?? structure });
  };

  const goUp = useCallback(() => {
    if (shownInside || inside) return go(fromStructure ? { name: 'body', structure: fromStructure } : { name: 'body' });
    if (partKey) return setPartKey(null);
    if (structure) {
      const sys = structureById.get(structure)?.systems[0];
      return go(sys && sys !== 'integumentary' && sys !== 'hematologic' ? { name: 'body', system: sys } : { name: 'body' });
    }
    if (system || focusTest) return go({ name: 'body' });
  }, [shownInside, inside, fromStructure, partKey, structure, system, focusTest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
        if (layersOpen) setLayersOpen(false);
        else goUp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goUp, layersOpen]);

  /* ---------------------------------------------------------- gezinme yolu */
  const crumbs: Crumb[] = [{ label: 'Vücut', onClick: () => go({ name: 'body' }) }];
  if (shownInside) {
    const sc = INSIDE[shownInside];
    const from = fromStructure;
    const sys = from ? structureById.get(from)?.systems[0] : sc.system;
    if (sys && systemById.get(sys)) crumbs.push({ label: systemById.get(sys)!.nameTr, onClick: () => go({ name: 'body', system: sys }) });
    if (from) crumbs.push({ label: structureById.get(from)!.nameTr, onClick: () => go({ name: 'body', structure: from }) });
    crumbs.push({ label: sc.tissue, onClick: () => insideActions.select(null) });
    if (insideState?.selected) crumbs.push({ label: INSIDE_CONTENT[shownInside].objects[insideState.selected]?.name ?? sc.cell });
    else if (insideState && insideState.stage > 0) crumbs.push({ label: INSIDE_CONTENT[shownInside].stages[insideState.stage]!.title });
  } else if (focusTest) {
    crumbs.push({ label: `Tahlil · ${testByKey.get(focusTest)!.nameTr}` });
  } else if (system) {
    crumbs.push({ label: systemById.get(system)!.nameTr });
  } else if (structure) {
    const sys = structureById.get(structure)?.systems[0];
    if (sys) crumbs.push({ label: systemById.get(sys)!.nameTr, onClick: () => go({ name: 'body', system: sys }) });
    crumbs.push({ label: structureById.get(structure)!.nameTr, onClick: () => setPartKey(null) });
    if (part) crumbs.push({ label: part.label });
  }

  const SceneComp = shownInside ? SCENES[shownInside] : undefined;
  const personal = useMemo(() => (shownInside ? personalFor(shownInside, interp, INSIDE_CONTENT[shownInside].tests) : null), [shownInside, interp]);
  const sceneParams = personal ? (insideState?.view === 'typical' ? personal.typical : personal.params) : {};
  const ready = shownInside ? INSIDE[shownInside].ready && !!SceneComp : true;

  if (!webgl) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Banner tone="warn">
          Bu cihazda 3D grafik (WebGL) kullanılamıyor. Sonuçlarını ve açıklamaları Sonuçlar ekranında görebilirsin.
        </Banner>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="explore-bg relative h-full w-full select-none overflow-hidden" style={{ ['--kh-accent' as string]: accent }}>
      <Canvas
        key={canvasKey}
        className="!absolute inset-0 touch-none"
        frameloop="demand"
        dpr={Math.min(window.devicePixelRatio || 1, 1.75)}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 35, near: 0.01, far: 40, position: [...(intro ? INTRO_START.position : OVERVIEW.position)] }}
        onCreated={({ gl, camera }) => {
          cameraRef.current = camera as PerspectiveCamera;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          gl.domElement.setAttribute('aria-label', '3D anatomi sahnesi. Yapıları yandaki panelden de seçebilirsin.');
          gl.domElement.setAttribute('role', 'img');
        }}
        onPointerMissed={() => onHover(null)}
      >
        <SceneDirector
          target={sceneKey}
          color={accent}
          origin={origin}
          reducedMotion={reducedMotion}
          onSwap={(key) => {
            setShownKey(key);
            if (key === 'body') {
              // İçeriden dönerken organın çevresinden başla
              const c = controlsRef.current;
              if (c) c.smoothTime = 0.55;
            }
          }}
        >
          {(shown) => (
            <>
              <BodyScene
                parts={models.parts}
                visible={shown === 'body'}
                isVisible={isVisible}
                highlights={highlights}
                focus={focus}
                focusParts={focusParts}
                skinMode={layers.skin}
                accent={accent}
                reducedMotion={reducedMotion}
                onPick={onPick}
                onHover={onHover}
              />
              {shown !== 'body' && SceneComp && insideState && (
                <Suspense fallback={null}>
                  <SceneComp state={insideState} onSelect={insideActions.select} reducedMotion={reducedMotion} params={sceneParams} />
                </Suspense>
              )}
            </>
          )}
        </SceneDirector>
        <ambientLight intensity={0.22} />
        <directionalLight position={[1.2, 2, 2.5]} intensity={1.05} />
        <directionalLight position={[-1.5, 0.5, -2]} intensity={0.35} />
        <Env />
        <CameraControls ref={setControls} makeDefault minDistance={0.05} maxDistance={6} smoothTime={0.55} draggingSmoothTime={0.1} dollySpeed={0.6} />
      </Canvas>

      {/* Üst çubuk: gezinme yolu + katmanlar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 px-4 pt-4 md:px-6 md:pt-5">
        <div className="min-w-0 flex-1">
          <Breadcrumb items={crumbs} accent={accent} />
        </div>
        {shownKey === 'body' && (
          <div className="pointer-events-auto relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-950/70 px-3 py-1.5 text-fg-muted backdrop-blur transition hover:text-fg"
              onClick={() => setLayersOpen((v) => !v)}
              aria-expanded={layersOpen}
            >
              <LayersIcon size={15} />
              <Caps>Katmanlar</Caps>
            </button>
            {layersOpen && (
              <div className="absolute right-0 top-11">
                <LayersMenu layers={layers} onChange={setLayers} onClose={() => setLayersOpen(false)} />
              </div>
            )}
          </div>
        )}
        {shownInside && (
          <div className="hidden md:block">
            <SimulationBadge />
          </div>
        )}
      </div>

      {shownInside && (
        <div className="pointer-events-none absolute left-4 top-[4.25rem] z-20 md:hidden">
          <SimulationBadge />
        </div>
      )}

      {/* Sistem menüsü */}
      {shownKey === 'body' && !structure && !focusTest && (
        <nav
          aria-label="Vücut sistemleri"
          className="pointer-events-auto absolute inset-x-0 top-12 z-10 flex gap-1.5 overflow-x-auto px-4 pb-2 md:inset-x-auto md:left-6 md:top-24 md:w-48 md:flex-col md:gap-0 md:overflow-visible md:px-0"
        >
          <span className="hidden pb-2 md:block">
            <Caps className="text-fg-faint">Sistemler</Caps>
          </span>
          {MENU_SYSTEMS.map((id) => {
            const s = systemById.get(id)!;
            const active = system === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(active ? { name: 'body' } : { name: 'body', system: id })}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-2.5 rounded-full border px-3 py-1.5 text-left text-xs transition md:rounded-none md:border-0 md:border-l md:py-2 md:pl-3 md:text-[13px] ${
                  active ? 'bg-white/[0.04] text-fg' : 'border-ink-600/70 bg-ink-950/60 text-fg-muted hover:text-fg md:bg-transparent'
                }`}
                style={{ borderColor: active ? s.color : undefined }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                {s.nameTr}
              </button>
            );
          })}
        </nav>
      )}

      {/* Kamera denetimleri */}
      <div className="pointer-events-none absolute bottom-[40%] left-4 z-10 hidden md:bottom-6 md:left-6 md:block lg:right-[436px]">
        <ViewControls onView={onView} onZoom={onZoom} onReset={onReset} />
      </div>

      {/* Bağlam paneli */}
      {!intro && shownKey === 'body' && (
        <ContextSheet onSize={onCover} label="Bilgi paneli" onClose={structure || system || focusTest ? goUp : undefined}>
          <div key={`${structure}-${system}-${focusTest}-${partKey}`} className="kh-fade-in">
            {structure ? (
              <OrganPanel
                structure={structure}
                highlights={highlights}
                series={seriesMap}
                vessels={vessels}
                selectedPart={partKey}
                onSelectPart={setPartKey}
                onEnter={(scene) => enter(scene, structure)}
                onEnterScene={(scene, from) => enter(scene, from)}
                interp={interp}
              />
            ) : system ? (
              <SystemPanel system={system} highlights={highlights} series={seriesMap} interp={interp} onEnter={(scene, from) => enter(scene, from)} />
            ) : focusTest ? (
              <TestPanel testKey={focusTest} series={seriesMap} interp={interp} onEnter={(scene, from) => enter(scene, from)} />
            ) : (
              <BodyIntroPanel highlights={highlights} series={seriesMap} hasReports={!!reports?.length} interp={interp} onEnter={(scene, from) => enter(scene, from)} />
            )}
          </div>
        </ContextSheet>
      )}
      {shownInside && insideState && (
        <ContextSheet onSize={onCover} label="Simülasyon paneli" onClose={goUp}>
          {ready ? (
            personal && <InsidePanel state={insideState} actions={insideActions} personal={personal} />
          ) : (
            <p className="text-sm text-fg-muted">Bu sahne henüz hazır değil (HAZIR DEĞİL).</p>
          )}
        </ContextSheet>
      )}

      <Tooltip ref={tooltipRef} />

      {!models.done && shownKey === 'body' && <LoadingLine progress={models.progress} label="Anatomi modelleri yükleniyor" />}
      {models.failed.length > 0 && (
        <div className="absolute bottom-4 left-4 z-30 max-w-sm">
          <Banner tone="error">Bazı modeller yüklenemedi: {models.failed.join(', ')}.</Banner>
        </div>
      )}

      {/* Açılış */}
      {intro && (
        <button
          type="button"
          className="kh-fade-in absolute inset-0 z-40 flex flex-col items-center justify-end bg-gradient-to-b from-transparent via-transparent to-ink-950/80 pb-16 text-center"
          onClick={endIntro}
          aria-label="Açılışı atla"
        >
          <Caps className="text-fg-faint">Kan Haritası · Keşfet</Caps>
          <span className="mt-3 text-4xl font-extralight tracking-[-0.03em] text-fg md:text-6xl">İnsan vücudu</span>
          <span className="mt-4 text-sm text-fg-muted">
            {bodyLoaded ? 'Dokun ya da sürükle' : 'Model hazırlanıyor…'} · <span className="underline underline-offset-4">Atla</span>
          </span>
        </button>
      )}

      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-6">
          <div className="max-w-sm text-center">
            <p className="text-sm text-fg-muted">Grafik bağlamı kayboldu (cihaz belleği ya da arka plana alma).</p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => {
                setContextLost(false);
                setCanvasKey((k) => k + 1);
              }}
            >
              Sahneyi yeniden başlat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Oda ışığı ortamı (ağ isteği yok; sahne içinde üretilir). */
function Env() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.75;
    room.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}
