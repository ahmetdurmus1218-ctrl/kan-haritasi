import { type ComponentType, type LazyExoticComponent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, type CameraControlsImpl } from '@react-three/drei';
import { Box3, type PerspectiveCamera, Plane, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { type Sex, type SystemId, structureById, systemById, testByKey } from '@kh/catalog';
import { useUnlockedVault } from '../state/VaultContext';
import { type Route, type SimulationMode, go } from '../state/router';
import { useSetting } from '../state/settings';
import { useResolvedTheme } from '../state/theme';
import { buildSeries, useReports } from '../lib/useReports';
import { loadSex } from '../lib/reports';
import { severityWeights, useInterpretation } from '../lib/interpretation';
import { studiesForStructure, useImagingStudies } from '../lib/imagingStudies';
import { CATEGORY_SHORT } from '../lib/imaging';
import { formatDate } from '../lib/format';
import { highlightsFrom } from '../anatomy/highlight';
import { BodyScene, type PickInfo, type PointerInfo } from '../anatomy/BodyScene';
import { ORGANS, insidesOf } from '../anatomy/organs';
import { partLabel, partLatin } from '../anatomy/names';
import { type BodyModel, webglAvailable } from '../anatomy/models';
import { highlightColor } from '../anatomy/palette';
import { Banner } from '../components/ui';
import { LayersIcon } from '../components/icons';
import { useModels, structureBoxes } from './useModels';
import { INTRO_START, OVERVIEW, PRESETS, type Shot, applyShot, direction, frameBox, overviewShot, panelOffset, shotDistance } from './camera';
import { SceneDirector } from './SceneDirector';
import { BodyIntroPanel, OrganPanel, type OrganTab, SystemPanel, TestPanel, vesselParts } from './BodyPanels';
import { MENU_SYSTEMS, inBody, isSystemId, structuresOfSystem, systemColor } from './systems';
import { type CloudData, CloudAnchor, OrganCloud, useCloudRefs } from './OrganCloud';
import { SearchOverlay } from './SearchOverlay';
import { CLIP_OFF, type ClipState, ClipPanel, HelpOverlay, ToolBar } from './Tools';
import { Breadcrumb, Caps, ContextSheet, type Crumb, DEFAULT_LAYERS, type Layers, LayersMenu, LoadingLine, Tooltip, type ViewName, ViewControls } from './ui';
import { INSIDE, type InsideId, resolveInside } from './inside/registry';
import { INSIDE_CONTENT } from './inside/content';
import { useInside } from './inside/state';
import { InsidePanel, SimulationBadge } from './inside/InsidePanel';
import { personalFor } from './inside/personal';
import { type InsideSceneProps, SceneThemeContext } from './inside/kit';

type ExploreRoute = Extract<Route, { name: 'body' }> | Extract<Route, { name: 'simulation' }>;

const SCENES: Partial<Record<InsideId, LazyExoticComponent<ComponentType<InsideSceneProps>>>> = {
  damar: lazy(() => import('./inside/scenes/VesselScene')),
  alveol: lazy(() => import('./inside/scenes/AlveolusScene')),
  nefron: lazy(() => import('./inside/scenes/NephronScene')),
  lobul: lazy(() => import('./inside/scenes/LobuleScene')),
  adacik: lazy(() => import('./inside/scenes/IsletScene')),
  folikul: lazy(() => import('./inside/scenes/FollicleScene')),
  ilik: lazy(() => import('./inside/scenes/MarrowScene')),
  kan: lazy(() => import('./inside/scenes/BloodScene')),
  noron: lazy(() => import('./inside/scenes/NeuronScene')),
  retina: lazy(() => import('./inside/scenes/RetinaScene')),
  koklea: lazy(() => import('./inside/scenes/CochleaScene')),
  kalpkasi: lazy(() => import('./inside/scenes/HeartMuscleScene')),
  sarkomer: lazy(() => import('./inside/scenes/SarcomereScene')),
  osteon: lazy(() => import('./inside/scenes/BoneScene')),
  mide: lazy(() => import('./inside/scenes/StomachScene')),
  villus: lazy(() => import('./inside/scenes/VillusScene')),
  deri: lazy(() => import('./inside/scenes/SkinScene')),
  hucre: lazy(() => import('./inside/scenes/CellScene')),
  hormon: lazy(() => import('./inside/scenes/HormoneScene')),
  lenf: lazy(() => import('./inside/scenes/LymphScene')),
  ovaryum: lazy(() => import('./inside/scenes/OvaryScene')),
  testis: lazy(() => import('./inside/scenes/TestisScene')),
};

const SCORE_WORD = ['', 'hafif', 'orta', 'belirgin'];

/** Açılış yalnızca oturumda bir kez oynar. */
let introPlayed = false;

const CARDIO_LAYER = new Set(['heart', 'coronary-arteries', 'aorta', 'carotid-arteries', 'pulmonary-vessels', 'veins', 'renal-vessels', 'abdominal-vessels', 'eye-vessels', 'limb-vessels']);

function layerAllows(layers: Layers, structure: string): boolean {
  if (structure === 'bones') return layers.skeleton;
  if (structure === 'skeletal-muscle') return layers.muscles;
  if (CARDIO_LAYER.has(structure)) return layers.cardio;
  if (structure === 'lungs' || structure === 'airways') return layers.respiratory;
  if (structure === 'brain' || structure === 'spinal-cord' || structure === 'eyes' || structure === 'nerves' || structure === 'ear' || structure === 'hypothalamus' || structure === 'pineal') return layers.nervous;
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
  const { reports } = useReports();
  const reducedMotion = useReducedMotion();
  const theme = useResolvedTheme();
  const [sex, setSex] = useState<Sex>('unspecified');
  const [bodyPref, setBodyPref] = useSetting('bodyModel');
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [webgl] = useState(webglAvailable);
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);
  // Araçlar
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [isolate, setIsolate] = useState(false);
  const [innerView, setInnerView] = useState(false);
  const [clip, setClip] = useState<ClipState>(CLIP_OFF);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** Sonuçla ilişkili organlar belirgin, diğerleri soluk (yalnızca sonuç varken). */
  const [resultFocus, setResultFocus] = useState(true);
  // Bilgi bulutu ve panel
  const [cloud, setCloud] = useState<{ structure: string; partId: string | null; point: [number, number, number] } | null>(null);
  const cloudRefs = useCloudRefs();
  const [sheetExpand, setSheetExpand] = useState(0);
  const [panelTab, setPanelTab] = useState<{ tab: OrganTab; n: number } | null>(null);

  useEffect(() => {
    loadSex(vault).then(setSex, () => undefined);
  }, [vault]);

  const body: BodyModel = bodyPref === 'auto' ? (sex === 'female' ? 'female' : 'male') : bodyPref;
  const switchBody = useCallback((b: BodyModel) => setBodyPref(b), [setBodyPref]);

  /* ---------------------------------------------------------- rota → seviye */
  const inside = route.name === 'simulation' ? resolveInside(route.id) : null;
  const mode: SimulationMode | undefined = route.name === 'simulation' ? route.mode : undefined;
  const fromStructure = route.name === 'simulation' && route.from && structureById.has(route.from) ? route.from : undefined;
  // İçeri girilirken (geçiş sürerken) vücut sahnesi girilen organa odaklı kalır.
  const structure = route.name === 'body' ? (route.structure && structureById.has(route.structure) ? route.structure : undefined) : fromStructure;
  const routePart = route.name === 'body' ? route.part : undefined;
  const system: SystemId | undefined = route.name === 'body' && isSystemId(route.system) ? route.system : undefined;
  const focusTest = route.name === 'body' && route.focus && testByKey.has(route.focus) ? route.focus : undefined;
  const sceneKey = inside ? `inside:${inside.scene}` : 'body';
  const [shownKey, setShownKey] = useState(sceneKey);
  const shownInside = shownKey.startsWith('inside:') ? (shownKey.slice(7) as InsideId) : null;
  const [partKey, setPartKey] = useState<string | null>(null);
  useEffect(() => {
    setPartKey(null);
    setIsolate(false);
    setInnerView(false);
  }, [structure]);
  useEffect(() => {
    // Seviye değişince bulut yalnızca aynı yapıya aitse kalır.
    setCloud((c) => (c && c.structure === structure && !inside ? c : null));
  }, [structure, system, focusTest, inside]);
  // Kaslar isteğe bağlı (+4 MB): katman açılınca ya da odaktaki yapı/sistem/test kaslarla ilgiliyse yüklenir (ör. CK).
  const focusTestMuscles = focusTest ? (testByKey.get(focusTest)?.structures.includes('skeletal-muscle') ?? false) : false;
  const wantMuscles = layers.muscles || structure === 'skeletal-muscle' || system === 'musculoskeletal' || focusTestMuscles;
  const [musclesRequested, setMusclesRequested] = useState(false);
  useEffect(() => {
    if (wantMuscles) setMusclesRequested(true);
  }, [wantMuscles]);
  const models = useModels(body, musclesRequested);

  const [insideState, insideActions] = useInside(shownInside, !!inside?.startSimulation && shownInside === inside.scene, shownInside === inside?.scene ? mode : undefined);

  /* ---------------------------------------------------------- veri */
  const series = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);
  const seriesMap = useMemo(() => new Map(series.map((s) => [s.test.key, s])), [series]);
  const interp = useInterpretation(series, sex);
  const studies = useImagingStudies();
  const weights = useMemo(() => severityWeights(interp), [interp]);
  const highlights = useMemo(() => highlightsFrom(series, focusTest, weights), [series, focusTest, weights]);
  const allParts = useMemo(() => [...models.parts, ...models.schematic], [models.parts, models.schematic]);
  const boxes = useMemo(() => structureBoxes(allParts), [allParts]);
  const vessels = useMemo(() => (structure ? vesselParts(allParts, structure) : []), [allParts, structure]);
  const part = vessels.find((v) => v.id === partKey) ?? null;

  // Rotadaki bölüm (#/vucut/yapi/kalp/sol-karincik): parçalar yüklenince seçilir.
  useEffect(() => {
    if (!routePart) return;
    const v = vessels.find((x) => x.def?.key === routePart);
    if (v) setPartKey(v.id);
  }, [routePart, vessels]);

  const focus = useMemo<Set<string> | null>(() => {
    if (structure) return new Set([structure]);
    if (system) return new Set(structuresOfSystem(system, body));
    if (focusTest) return new Set(highlights.keys());
    return null;
  }, [structure, system, focusTest, highlights, body]);
  const focusParts = useMemo(() => (part ? new Set(part.ids) : null), [part]);

  // Sonuçla ilişkili organlar belirgin; diğerleri soluk (genel görünüm ve sistem seviyesinde).
  const resultMode = resultFocus && highlights.size > 0 && !structure && !focusTest;
  const muted = useMemo<Set<string> | null>(() => {
    if (!resultMode) return null;
    return new Set([...boxes.keys()].filter((sid) => !highlights.has(sid)));
  }, [resultMode, boxes, highlights]);

  const isVisible = useCallback(
    (sid: string) => {
      if (!inBody(sid, body)) return false;
      // Odaktaki yapılar katmanı kapalı olsa da görünür (ör. CK → iskelet kasları).
      if (focus?.has(sid)) return true;
      return layerAllows(layers, sid);
    },
    [layers, body, focus],
  );

  const accent = shownInside
    ? INSIDE[shownInside].generic && fromStructure
      ? systemColor(structureById.get(fromStructure)?.systems[0])
      : systemColor(INSIDE[shownInside].system)
    : structure
      ? systemColor(structureById.get(structure)?.systems[0])
      : system
        ? systemColor(system)
        : focusTest
          ? systemColor(testByKey.get(focusTest)?.systems[0])
          : theme === 'light'
            ? '#0b8577'
            : '#37d6c4';

  /* ---------------------------------------------------------- kesit */
  const clipPlane = useMemo<Plane | null>(() => {
    if (!clip.on) return null;
    const b = new Box3();
    for (const id of focus ?? boxes.keys()) {
      const bb = boxes.get(id);
      if (bb) b.union(bb);
    }
    if (b.isEmpty()) return null;
    const lo = b.min[clip.axis];
    const hi = b.max[clip.axis];
    const at = lo + (hi - lo) * (clip.axis === 'y' ? clip.at : 1 - clip.at);
    // Düzlemin önündeki (kameraya bakan) kısım kesilir: önden → z, yandan → x (kişinin solu), üstten → y
    const n = clip.axis === 'x' ? new Vector3(-1, 0, 0) : clip.axis === 'y' ? new Vector3(0, -1, 0) : new Vector3(0, 0, -1);
    return new Plane(n, at);
  }, [clip, focus, boxes]);

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
      for (const p of allParts) if (part.ids.includes(p.id)) b.union(p.box);
      const pos = c.getPosition(new Vector3());
      const tgt = c.getTarget(new Vector3());
      const d = pos.sub(tgt).normalize();
      return frameBox(b, [(Math.atan2(d.x, d.z) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI], cam, 2.4, 0.02);
    }
    // Tüm vücuda yayılan yapılar (iskelet, kaslar, kol-bacak damarları): baştan ayağa kadraj
    const wholeBody = (b: Box3 | null) => !!b && b.max.y - b.min.y > 1.2;
    if (structure) {
      const b = unionBox([structure]);
      if (wholeBody(b)) return overviewShot(cam);
      return b ? frameBox(b, ORGANS[structure]?.view ?? [0, 5], cam, 1.45) : OVERVIEW;
    }
    if (system) {
      const b = unionBox(structuresOfSystem(system, body));
      if (wholeBody(b)) return overviewShot(cam);
      return b ? frameBox(b, [0, 6], cam, 1.05) : OVERVIEW;
    }
    if (focusTest) {
      const b = unionBox(highlights.keys());
      if (wholeBody(b)) return overviewShot(cam);
      return b ? frameBox(b, [0, 6], cam, 1.15) : overviewShot(cam);
    }
    return overviewShot(cam);
  }, [part, structure, system, focusTest, highlights, unionBox, allParts, body]);

  // Odaktaki yapıların modeli yüklendi mi? (yüklenince bir kez yeniden kadrajla)
  const focusReady = useMemo(() => {
    const ids = structure ? [structure] : system ? structuresOfSystem(system, body) : focusTest ? [...highlights.keys()] : [];
    return ids.map((id) => (boxes.has(id) ? 1 : 0)).join('');
  }, [structure, system, focusTest, highlights, boxes, body]);

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
  }, [shownKey, structure, system, focusTest, partKey, focusReady, intro, reducedMotion, controlsReady, body]);

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
      // Odaktaki organda bölüm adı, diğerlerinde organ adı
      const name = p.label && p.structure === structure ? (partLabel(p.structure, p.label) ?? p.label) : (s?.nameTr ?? p.structure);
      const h = highlights.get(p.structure);
      el.textContent = h ? `${name} · ${h.tests.map((t) => testByKey.get(t.key)?.nameTr.split(' (')[0]).join(', ')} ${h.status === 'high' ? '▲' : h.status === 'low' ? '▼' : ''}` : name;
      const r = root.getBoundingClientRect();
      const x = Math.min(p.x - r.left + 14, r.width - 200);
      const y = Math.max(8, p.y - r.top + 16);
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.display = 'block';
    },
    [highlights, structure],
  );

  const onPick = useCallback(
    (p: PickInfo) => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      if (intro) endIntro();
      const point = p.point ?? [0, 0, 0];
      if (structure && p.structure === structure && p.label) {
        const group = vessels.find((v) => v.ids.includes(p.partId));
        setPartKey(group?.id ?? null);
        setCloud({ structure, partId: group?.id ?? null, point });
        return;
      }
      setCloud({ structure: p.structure, partId: null, point });
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

  const enter = (scene: string, from?: string, m?: SimulationMode) => {
    setCloud(null);
    setOrigin(projectToNdc(from ?? structure));
    go({ name: 'simulation', id: scene, from: from ?? structure, mode: m });
  };

  const goUp = useCallback(() => {
    if (cloud) return setCloud(null);
    if (shownInside || inside) return go(fromStructure ? { name: 'body', structure: fromStructure } : { name: 'body' });
    if (partKey) return setPartKey(null);
    if (structure) {
      const sys = structureById.get(structure)?.systems[0];
      return go(sys && sys !== 'integumentary' && sys !== 'hematologic' ? { name: 'body', system: sys } : { name: 'body' });
    }
    if (system || focusTest) return go({ name: 'body' });
  }, [cloud, shownInside, inside, fromStructure, partKey, structure, system, focusTest]);

  const hideCurrent = useCallback(() => {
    if (!structure) return;
    setHidden((h) => new Set(h).add(structure));
    setCloud(null);
    go({ name: 'body' });
  }, [structure]);

  const hasInner = !!structure && vessels.some((v) => v.def?.inner);

  /* ---------------------------------------------------------- klavye */
  const keyState = useRef({ goUp, hideCurrent, onReset, onView, onZoom, structure, hasInner, shownKey, body, switchBody });
  keyState.current = { goUp, hideCurrent, onReset, onView, onZoom, structure, hasInner, shownKey, body, switchBody };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return;
      const k = keyState.current;
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (helpOpen) return setHelpOpen(false);
        if (searchOpen) return;
        if (layersOpen) setLayersOpen(false);
        else k.goUp();
        return;
      }
      if (searchOpen || helpOpen) return;
      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === '?') return setHelpOpen(true);
      if (k.shownKey !== 'body') return;
      switch (e.key) {
        case 'i':
        case 'I':
          if (k.structure) setIsolate((v) => !v);
          break;
        case 'h':
          k.hideCurrent();
          break;
        case 'H':
          setHidden(new Set());
          break;
        case 'x':
        case 'X':
          setClip((c) => ({ ...c, on: !c.on }));
          break;
        case '[':
          setClip((c) => ({ ...c, on: true, at: Math.max(0, c.at - 0.04) }));
          break;
        case ']':
          setClip((c) => ({ ...c, on: true, at: Math.min(1, c.at + 0.04) }));
          break;
        case 't':
        case 'T':
          if (k.hasInner) setInnerView((v) => !v);
          break;
        case 'l':
        case 'L':
          setLayersOpen((v) => !v);
          break;
        case 'r':
        case 'R':
          k.onReset();
          break;
        case 'g':
        case 'G':
          k.switchBody(k.body === 'male' ? 'female' : 'male');
          break;
        case '1':
          k.onView('front');
          break;
        case '2':
          k.onView('back');
          break;
        case '3':
          k.onView('left');
          break;
        case '4':
          k.onView('right');
          break;
        case '+':
        case '=':
          k.onZoom(1);
          break;
        case '-':
          k.onZoom(-1);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layersOpen, searchOpen, helpOpen]);

  /* ---------------------------------------------------------- gezinme yolu */
  const crumbs: Crumb[] = [{ label: body === 'female' ? 'İnsan · Kadın' : 'İnsan · Erkek', onClick: () => go({ name: 'body' }) }];
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
  const personal = useMemo(
    () => (shownInside ? personalFor(shownInside, interp, INSIDE_CONTENT[shownInside].tests, fromStructure) : null),
    [shownInside, interp, fromStructure],
  );
  const sceneParams = personal ? (insideState?.view === 'typical' ? personal.typical : personal.params) : {};
  const ready = shownInside ? INSIDE[shownInside].ready && !!SceneComp : true;

  /* ---------------------------------------------------------- bilgi bulutu */
  const cloudData = useMemo<CloudData | null>(() => {
    if (!cloud) return null;
    const s = structureById.get(cloud.structure);
    if (!s) return null;
    const cloudPart = cloud.partId ? vessels.find((v) => v.id === cloud.partId) : null;
    const h = highlights.get(cloud.structure);
    const findings = interp.findings.filter((f) => f.structures.includes(cloud.structure));
    const abnormal = findings.filter((f) => f.status === 'high' || f.status === 'low');
    const insides = insidesOf(cloud.structure);
    const scene = insides[0];
    const imaging = studies ? studiesForStructure(cloud.structure, studies) : [];
    const openPanel = (tab: OrganTab) => {
      setCloud(null);
      setPanelTab((p) => ({ tab, n: (p?.n ?? 0) + 1 }));
      setSheetExpand((n) => n + 1);
    };
    const status = h
      ? {
          color: highlightColor(h.status, h.score),
          text: `${h.tests
            .slice(0, 3)
            .map((t) => `${testByKey.get(t.key)?.nameTr.split(' (')[0] ?? t.key} ${t.status === 'high' ? '▲' : t.status === 'low' ? '▼' : ''}`)
            .join(', ')} · ${SCORE_WORD[Math.min(3, Math.round(h.score))]} sapma`,
        }
      : findings.length
        ? { color: '#5eead4', text: `${findings.length} ilişkili sonucun aralıkta` }
        : { color: '#667085', text: 'Sonuçlarınla ilişkisi yok' };
    if (cloudPart) {
      return {
        caps: `Bölüm · ${s.nameTr}`,
        title: cloudPart.label,
        latin: cloudPart.latin ?? partLatin(cloud.structure, cloudPart.raw),
        note: cloudPart.def?.info,
        actions: [
          ...(scene ? [{ key: 'temel', label: 'Nasıl çalışır', sub: 'temel süreç', primary: true, onClick: () => enter(scene, cloud.structure, 'temel') }] : []),
          { key: 'detay', label: 'Ayrıntılar', sub: 'bölüm paneli', onClick: () => openPanel('anatomy') },
        ],
        more: { label: `← ${s.nameTr}`, onClick: () => { setPartKey(null); setCloud(null); } },
      };
    }
    return {
      caps: systemById.get(s.systems[0]!)?.nameTr ?? 'Yapı',
      title: s.nameTr.replace(/ \(şematik\)$/i, ''),
      latin: s.latin,
      status,
      note: h ? undefined : s.blurb,
      actions: [
        { key: 'mine', label: 'Sonucum', sub: abnormal.length ? `${abnormal.length} aralık dışı` : findings.length ? `${findings.length} sonuç` : 'sonuç yok', primary: !!h, disabled: !findings.length, onClick: () => openPanel('mine') },
        // Bu bölgenin görüntülemesi (MR, BT, röntgen…) varsa en yenisine tek dokunuşla gidilir.
        ...imaging.slice(0, 1).map((st) => ({
          key: 'goruntuleme',
          label: imaging.length > 1 ? `Görüntülemem (${imaging.length})` : 'Görüntülemem',
          sub: `${CATEGORY_SHORT[st.category]} · ${formatDate(st.date)}`,
          onClick: () => go({ name: 'document', id: st.head.id }),
        })),
        ...(scene
          ? [
              { key: 'temel', label: 'Temelde nasıl çalışır', sub: INSIDE[scene].process, primary: !h, onClick: () => enter(scene, cloud.structure, 'temel') },
              { key: 'benim', label: 'Sonucuma göre', sub: findings.length ? 'senin değerlerinle' : 'ilişkili sonuç yok', disabled: !findings.length, onClick: () => enter(scene, cloud.structure, 'benim') },
              { key: 'enter', label: 'İçeri gir', sub: INSIDE[scene].title, onClick: () => enter(scene, cloud.structure) },
            ]
          : []),
      ],
      more: { label: 'Tüm ayrıntılar', onClick: () => openPanel('anatomy') },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, vessels, highlights, interp, studies]);

  if (!webgl) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Banner tone="warn">
          Bu cihazda 3D grafik (WebGL) kullanılamıyor. Sonuçlarını ve açıklamaları Sonuçlar ekranında görebilirsin.
        </Banner>
      </div>
    );
  }

  const light = theme === 'light';

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
          gl.localClippingEnabled = true;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          gl.domElement.setAttribute('aria-label', '3D anatomi sahnesi. Yapıları yandaki panelden ya da aramadan da seçebilirsin.');
          gl.domElement.setAttribute('role', 'img');
        }}
        onPointerMissed={() => {
          onHover(null);
          setCloud(null);
        }}
      >
        <SceneThemeContext value={theme}>
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
                  schematic={models.schematic}
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
                  hidden={hidden}
                  isolate={isolate && !!structure}
                  innerView={innerView}
                  clip={shown === 'body' ? clipPlane : null}
                  theme={theme}
                  partLevel={structure ?? null}
                  muted={muted}
                />
                {shown !== 'body' && SceneComp && insideState && (
                  <Suspense fallback={null}>
                    <SceneComp state={insideState} onSelect={insideActions.select} reducedMotion={reducedMotion} params={sceneParams} origin={fromStructure} theme={theme} />
                  </Suspense>
                )}
              </>
            )}
          </SceneDirector>
          <CloudAnchor point={cloud && shownKey === 'body' ? cloud.point : null} refs={cloudRefs} cover={coverRef} />
        </SceneThemeContext>
        <ambientLight intensity={light ? 0.5 : 0.22} />
        <directionalLight position={[1.2, 2, 2.5]} intensity={light ? 1.25 : 1.05} />
        <directionalLight position={[-1.5, 0.5, -2]} intensity={light ? 0.55 : 0.35} />
        <Env intensity={light ? 0.95 : 0.75} />
        <CameraControls ref={setControls} makeDefault minDistance={0.05} maxDistance={6} smoothTime={0.55} draggingSmoothTime={0.1} dollySpeed={0.6} />
      </Canvas>

      {/* Üst çubuk: gezinme yolu + vücut seçimi + katmanlar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-4 pt-4 md:gap-3 md:px-6 md:pt-5">
        <div className="min-w-0 flex-1">
          <Breadcrumb items={crumbs} accent={accent} />
        </div>
        {shownKey === 'body' && (
          <>
            <div className="pointer-events-auto flex rounded-full border border-ink-600/70 bg-ink-950/70 p-0.5 backdrop-blur" role="radiogroup" aria-label="Vücut modeli">
              {(
                [
                  ['male', 'Erkek'],
                  ['female', 'Kadın'],
                ] as const
              ).map(([b, label]) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={body === b}
                  onClick={() => switchBody(b)}
                  className={`rounded-full px-2.5 py-1 transition md:px-3 ${body === b ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:text-fg'}`}
                >
                  <Caps>{label}</Caps>
                </button>
              ))}
            </div>
            <div className="pointer-events-auto relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-950/70 px-3 py-1.5 text-fg-muted backdrop-blur transition hover:text-fg"
                onClick={() => setLayersOpen((v) => !v)}
                aria-expanded={layersOpen}
                aria-label="Katmanlar"
              >
                <LayersIcon size={15} />
                <span className="hidden md:inline">
                  <Caps>Katmanlar</Caps>
                </span>
              </button>
              {layersOpen && (
                <div className="absolute right-0 top-11">
                  <LayersMenu layers={layers} onChange={setLayers} onClose={() => setLayersOpen(false)} />
                </div>
              )}
            </div>
          </>
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

      {/* Araç çubuğu ve kesit */}
      {shownKey === 'body' && !intro && (
        <div className={`pointer-events-none absolute left-4 z-20 flex flex-col items-start gap-2 md:left-6 ${!structure && !focusTest ? 'top-[5.75rem]' : 'top-[6.25rem]'} md:top-auto md:bottom-20`}>
          <ToolBar
            canFocusTools={!!structure}
            hasInner={hasInner}
            isolate={isolate && !!structure}
            inner={innerView}
            clip={clip.on}
            hiddenCount={hidden.size}
            onSearch={() => setSearchOpen(true)}
            onIsolate={() => setIsolate((v) => !v)}
            onHide={hideCurrent}
            onRestore={() => setHidden(new Set())}
            onClip={() => setClip((c) => ({ ...c, on: !c.on }))}
            onInner={() => setInnerView((v) => !v)}
            onHelp={() => setHelpOpen(true)}
          />
          {clip.on && <ClipPanel clip={clip} onChange={setClip} />}
          {highlights.size > 0 && !structure && !focusTest && (
            <button
              type="button"
              onClick={() => setResultFocus((v) => !v)}
              aria-pressed={resultFocus}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-ink-600/60 bg-ink-950/70 px-3 py-1.5 text-xs text-fg-muted backdrop-blur transition hover:text-fg"
            >
              <span className={`h-2 w-2 rounded-full ${resultFocus ? 'bg-[var(--kh-accent)] shadow-[0_0_8px_var(--kh-accent)]' : 'border border-ink-500'}`} />
              Sonucumla ilişkili organlar belirgin
            </button>
          )}
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
      <div className="pointer-events-none absolute bottom-[40%] left-4 z-10 hidden md:bottom-6 md:left-6 md:block">
        <ViewControls onView={onView} onZoom={onZoom} onReset={onReset} />
      </div>

      {/* Bağlam paneli */}
      {!intro && shownKey === 'body' && (
        <ContextSheet
          onSize={onCover}
          label="Bilgi paneli"
          onClose={structure || system || focusTest ? goUp : undefined}
          peek={!!cloudData}
          expandNonce={sheetExpand}
        >
          <div key={`${structure}-${system}-${focusTest}-${partKey}-${panelTab?.n ?? 0}`} className="kh-fade-in">
            {structure ? (
              <OrganPanel
                structure={structure}
                body={body}
                onSwitchBody={switchBody}
                highlights={highlights}
                series={seriesMap}
                vessels={vessels}
                selectedPart={partKey}
                onSelectPart={setPartKey}
                onEnter={(scene, m) => enter(scene, structure, m)}
                onEnterScene={(scene, from) => enter(scene, from)}
                interp={interp}
                initialTab={panelTab?.tab}
              />
            ) : system ? (
              <SystemPanel system={system} body={body} highlights={highlights} series={seriesMap} interp={interp} onEnter={(scene, from) => enter(scene, from)} />
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

      {cloudData && shownKey === 'body' && <OrganCloud data={cloudData} refs={cloudRefs} accent={accent} onClose={() => setCloud(null)} />}

      <Tooltip ref={tooltipRef} />

      {!models.done && shownKey === 'body' && <LoadingLine progress={models.progress} label={`${body === 'female' ? 'Kadın' : 'Erkek'} anatomi modelleri yükleniyor`} />}
      {models.failed.length > 0 && (
        <div className="absolute bottom-4 left-4 z-30 max-w-sm">
          <Banner tone="error">Bazı modeller yüklenemedi: {models.failed.join(', ')}.</Banner>
        </div>
      )}

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onBody={switchBody} />}
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}

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
function Env({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    room.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = intensity;
    invalidate();
  }, [scene, intensity, invalidate]);
  return null;
}
