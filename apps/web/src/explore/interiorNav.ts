/**
 * "İçine gir" kademeli 3B gezinme: her iç dünya basamağı GERÇEK bir gezinme seviyesidir.
 *
 *   Vücut → Sistem → Organ ─(İçine gir: kamera organa girer)→ İç dünya (lümen / parankim / odacık / yol)
 *        → İlerle (kamera içeride ilerler) → … ─(Duvarı incele: kamera duvara yaklaşır)→ Duvar
 *        → Daha derine in → Doku → Hücre → Molekül
 *
 * Her seviye; gezinme durumu (rota), 3B sahne anahtarı, kamera odağı, anatomik seviye, breadcrumb ve
 * YALNIZCA o seviyeye ait eylemleri taşır. Sahne anahtarı değişince Explorer kamerayı hareket ettirip sahne
 * geçişi yapar; aynı sahnede kalınırsa kamera yeni odağa animasyonla gider. Bütün ağaç hiçbir zaman aynı
 * anda listelenmez.
 *
 * Saf modül (React yok): birim testleri gezinme kurallarını doğrudan denetler.
 */
import { GRAPH, type InteriorStage, type OrganInteriorDefinition, type SceneFocus, interiorExperience, interiorTrail } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { INSIDE, type InsideId } from './inside/registry';
import { INSIDE_CONTENT } from './inside/content';
import { TISSUES, type TissueId } from './inside/tissues';

/** Anatomik seviye (ölçek merdiveni). */
export type NavLevel = 'body' | 'system' | 'organ' | 'interior' | 'region' | 'wall' | 'tissue' | 'cell' | 'molecule';

/** Seviyenin derinlik sırası: geri dönüşte kamera ters yönde hareket eder. */
export const LEVEL_DEPTH: Record<NavLevel, number> = { body: 0, system: 1, organ: 2, interior: 3, region: 4, wall: 5, tissue: 6, cell: 7, molecule: 8 };

export const LEVEL_TR: Record<NavLevel, string> = {
  body: 'Vücut',
  system: 'Sistem',
  organ: 'Organ',
  interior: 'Organın içi',
  region: 'Bölümler',
  wall: 'Duvar',
  tissue: 'Doku',
  cell: 'Hücre',
  molecule: 'Molekül / süreç',
};

/**
 * Seviyenin 3B sahnesi:
 *   interior  organın iç dünyası (InteriorWorld: lümen / damar / odacık / parankim / yol) — odak kamerayı yönetir
 *   wall      duvar kesiti (katmanlar lümenden dışa / yüzeyden derine); highlight: vurgulanan katman
 *   inside    var olan eğitsel doku/hücre sahnesi (villus, nefron, lobül, sarkomer…) ve o sahnenin aşaması
 */
export type LevelScene =
  | { kind: 'interior'; focus: SceneFocus; progress: number }
  | { kind: 'wall'; highlight?: number }
  | { kind: 'inside'; id: InsideId; stage: number; selected: string | null; depth: number };

export interface LevelView {
  def: OrganInteriorDefinition;
  idx: number;
  stage: InteriorStage;
  level: NavLevel;
  scene: LevelScene;
  /** Aynı anahtar = aynı 3B sahne (yalnızca kamera hareket eder); farklı anahtar = sahne geçişi. */
  sceneKey: string;
  /** Kaçıncı iç dünya basamağı (yalnızca 'interior' seviyesinde anlamlı). */
  insideCount: number;
}

export function levelOf(st: InteriorStage): NavLevel {
  if (st.kind === 'wall') return 'wall';
  switch (st.scale) {
    case 'interior':
      return 'interior';
    case 'region':
      return 'region';
    case 'tissue':
      return 'tissue';
    case 'cell':
      return 'cell';
    case 'molecule':
      return 'molecule';
  }
}

const isInside = (id: string | undefined): id is InsideId => !!id && id in INSIDE;
const stagesOf = (id: InsideId) => INSIDE_CONTENT[id]?.stages.length ?? 1;

/** Bilgi grafiği düğümünden sahne nesnesi (ör. "cell.enterocyte" → "enterocyte"), sahnede varsa. */
function objectFor(id: InsideId, node: string | undefined): string | null {
  if (!node) return null;
  const key = node.split('.').pop()!;
  return INSIDE_CONTENT[id]?.objects[key] ? key : null;
}

/** Duvar katmanlarında bu düğüme karşılık gelen katman (doku basamağında kesit vurgusu). */
function layerFor(def: OrganInteriorDefinition, node: string | undefined): number | undefined {
  if (!node || !def.wallLayers) return undefined;
  const i = def.wallLayers.findIndex((l) => l.node === node);
  return i >= 0 ? i : undefined;
}

/**
 * Her basamağın sahnesi tek geçişte çözülür. Aynı eğitsel sahneyi paylaşan ardışık basamaklar o sahnenin
 * bir sonraki aşamasına (yakın plan kamera çekimine) ilerler; sahnesi olmayan hücre/molekül basamağı bir
 * önceki sahnenin devamını kullanır, o da yoksa genel hücre sahnesine iner. Böylece her basamakta kamera
 * gerçekten hareket eder ve ölçek değişir.
 */
export function resolveScenes(def: OrganInteriorDefinition): LevelScene[] {
  const insideCount = interiorExperience(def).inside.length;
  const used = new Map<InsideId, number>();
  const hasLayers = (def.wallLayers?.length ?? 0) > 0;
  let prev: { id: InsideId; stage: number; depth: number } | null = null;
  // Doku atlası: ilk basamak bütün katmanlar; sonrakiler epitel/mukoza katmanına giderek yaklaşır
  // (süreç anlatımının odağı kas katmanına kayabilir; hücre seviyesinde kas gösterilmez).
  const atlas = (id: InsideId, depth: number): LevelScene => {
    const layer = TISSUES[id as TissueId].layers.find((l) => l.kind !== 'lumen')?.key ?? null;
    prev = { id, stage: 0, depth };
    return { kind: 'inside', id, stage: 0, selected: depth > 0 ? layer : null, depth: Math.max(0, depth - 1) };
  };
  const take = (id: InsideId, st: InteriorStage): LevelScene => {
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    if (INSIDE[id].kind === 'atlas') return atlas(id, n);
    const stage = Math.min(n, stagesOf(id) - 1);
    prev = { id, stage, depth: 0 };
    return { kind: 'inside', id, stage, selected: objectFor(id, st.node), depth: 0 };
  };
  return def.stages.map((st, i): LevelScene => {
    const level = levelOf(st);
    if (level === 'interior' || level === 'region') {
      prev = null;
      // Bölge basamakları (>1): kamera iç dünyanın etrafında döner, her bölgede farklı açı.
      const progress = level === 'region' ? 1 + 0.25 * (i - insideCount + 1) : insideCount > 1 ? Math.min(i, insideCount - 1) / (insideCount - 1) : 0;
      return { kind: 'interior', focus: st.focus ?? (level === 'region' ? 'overview' : 'lumen'), progress };
    }
    if (level === 'wall') {
      prev = null;
      if (hasLayers) return { kind: 'wall' };
      if (isInside(st.scene)) return take(st.scene, st);
      return { kind: 'interior', focus: 'wall', progress: 1 };
    }
    if (isInside(st.scene)) return take(st.scene, st);
    if (level === 'tissue') {
      if (hasLayers) return { kind: 'wall', highlight: layerFor(def, st.node) ?? Math.min(2, def.wallLayers!.length - 1) };
      return { kind: 'interior', focus: 'wall', progress: 1 };
    }
    // Hücre / molekül: önceki sahnenin bir sonraki aşaması, yoksa genel hücre sahnesi.
    const p = prev as { id: InsideId; stage: number; depth: number } | null;
    if (p && INSIDE[p.id].kind === 'atlas') return atlas(p.id, p.depth + 1);
    if (p) {
      const stage = Math.min(p.stage + 1, stagesOf(p.id) - 1);
      prev = { id: p.id, stage, depth: 0 };
      return { kind: 'inside', id: p.id, stage, selected: objectFor(p.id, st.node), depth: 0 };
    }
    const cellStage = level === 'molecule' ? stagesOf('hucre') - 2 : 0;
    prev = { id: 'hucre', stage: cellStage, depth: 0 };
    return { kind: 'inside', id: 'hucre', stage: cellStage, selected: null, depth: 0 };
  });
}

function sceneKeyOf(def: OrganInteriorDefinition, scene: LevelScene): string {
  switch (scene.kind) {
    case 'interior':
      return `ic:${def.organId}`;
    case 'wall':
      return `ic:${def.organId}:duvar`;
    case 'inside':
      return `in:${scene.id}`;
  }
}

export function clampStage(def: OrganInteriorDefinition, stage: number | undefined): number {
  return Math.min(def.stages.length, Math.max(1, stage ?? 1)) - 1;
}

export function levelView(def: OrganInteriorDefinition, idx: number): LevelView {
  const i = Math.max(0, Math.min(def.stages.length - 1, idx));
  const scene = resolveScenes(def)[i]!;
  const stage = def.stages[i]!;
  return { def, idx: i, stage, level: levelOf(stage), scene, sceneKey: sceneKeyOf(def, scene), insideCount: interiorExperience(def).inside.length };
}

/**
 * Kendi 3B yapısı tanımlanmamış iç dünyaların vücuttaki karşılığı (gerçek modelde kesitle açılabilsin):
 * ağız, dil ve yutak baş-boyun paketindeki ağız yapısında; burun ve gırtlak hava yollarında; genel
 * atardamar aortta; paratiroid tiroidin arkasında.
 */
const STRUCTURE_OF: Record<string, string> = {
  'ic.mouth': 'mouth',
  'ic.tongue': 'mouth',
  'ic.pharynx': 'mouth',
  'ic.nose': 'airways',
  'ic.nasal-cavity': 'airways',
  'ic.larynx': 'airways',
  'ic.artery': 'aorta',
  'ic.parathyroid': 'thyroid',
};

/** İç dünyanın 3B vücuttaki organı: kendisi ya da üst iç dünyalarından biri (girişte kamera ona dalar). */
export function structureOfInterior(def: OrganInteriorDefinition): string | undefined {
  for (const d of [...interiorTrail(def)].reverse()) {
    if (d.structure && structureById.has(d.structure)) return d.structure;
    const s = STRUCTURE_OF[d.organId];
    if (s && structureById.has(s)) return s;
  }
  return undefined;
}

/* ------------------------------------------------------------------ eylemler */

export type ActionTarget = { stage: number } | { interior: string } | { body: string } | { bodyRoot: true } | { graph: string };

export interface LevelAction {
  id: 'forward' | 'content' | 'how' | 'goto' | 'wall' | 'deeper' | 'info' | 'graph' | 'organ' | 'back';
  label: string;
  sub?: string;
  primary?: boolean;
  to?: ActionTarget;
}

/** Kısa başlık: "Hareket: segmental ve peristaltik" → "Hareket". */
export function shortTitle(st: InteriorStage): string {
  if (st.kind === 'wall') return 'Duvar';
  const t = st.title.split(/:\s|\s·\s/)[0]!.trim();
  return t.length > 34 ? `${t.slice(0, 32)}…` : t;
}

const DYNAMIC = new Set<InteriorStage['kind']>(['motion', 'process', 'flow']);

/** Bulunulan seviyenin mantıklı eylemleri (en fazla 5). Organdan duvara/hücreye atlayan eylem yoktur. */
export function levelActions(v: LevelView): LevelAction[] {
  const { def, idx, level, insideCount } = v;
  const st = def.stages;
  const out: LevelAction[] = [];
  const deeperIdx = st.findIndex((s) => s.scale === 'tissue' || s.scale === 'cell' || s.scale === 'molecule');
  const deeperLabel = deeperIdx >= 0 && st[deeperIdx]!.kind === 'wall' ? 'Duvarı incele' : 'Daha derine in';
  const structure = structureOfInterior(def);
  const back: LevelAction =
    idx > 0
      ? { id: 'back', label: 'Geri', sub: idx === 1 ? 'İçerisi' : shortTitle(st[idx - 1]!), to: { stage: idx - 1 } }
      : def.parent
        ? { id: 'back', label: 'Geri', sub: interiorTrail(def).at(-2)?.name, to: { interior: def.parent } }
        : structure
          ? { id: 'back', label: 'Geri', sub: `${structureById.get(structure)!.nameTr} · dışarı çık`, to: { body: structure } }
          : { id: 'back', label: 'Geri', sub: 'Vücut', to: { bodyRoot: true } };

  if (level === 'interior') {
    const next = idx + 1 < st.length && (st[idx + 1]!.scale === 'interior' || st[idx + 1]!.scale === 'region') ? idx + 1 : -1;
    // Öncelik: İlerle · Duvarı incele · (bu basamağın devamı) · Nasıl çalışıyor? · İçerik
    if (next >= 0) out.push({ id: 'forward', label: 'İlerle', sub: shortTitle(st[next]!), primary: true, to: { stage: next } });
    if (deeperIdx >= 0) out.push({ id: 'wall', label: deeperLabel, sub: shortTitle(st[deeperIdx]!), to: { stage: deeperIdx } });
    for (const n of (st[idx]!.next ?? []).slice(0, 2)) out.push({ id: 'goto', label: n.label, primary: next < 0 && !out.some((a) => a.primary), to: { interior: n.to } });
    const how = st.findIndex((s, k) => k < insideCount && DYNAMIC.has(s.kind));
    if (how >= 0 && how !== idx && how !== next) out.push({ id: 'how', label: 'Nasıl çalışıyor?', sub: shortTitle(st[how]!), to: { stage: how } });
    const content = st.findIndex((s, k) => k < insideCount && s.kind === 'content');
    if (content >= 0 && content !== idx && content !== next) out.push({ id: 'content', label: 'İçerik', sub: shortTitle(st[content]!), to: { stage: content } });
  } else if (level === 'region') {
    if (st[idx + 1]?.scale === 'region') out.push({ id: 'forward', label: 'İlerle', sub: shortTitle(st[idx + 1]!), primary: true, to: { stage: idx + 1 } });
    if (deeperIdx >= 0) out.push({ id: 'wall', label: deeperLabel, sub: shortTitle(st[deeperIdx]!), primary: !out.length, to: { stage: deeperIdx } });
  } else {
    const n = st[idx + 1];
    if (n) {
      const label = level === 'cell' && n.scale === 'molecule' ? 'Moleküler süreç' : n.scale === 'cell' && level !== 'cell' ? 'Hücreye in' : 'Daha derine in';
      out.push({ id: 'deeper', label, sub: shortTitle(n), primary: true, to: { stage: idx + 1 } });
    }
    if (level === 'cell') out.push({ id: 'info', label: 'Hücrenin işlevi' });
    if (!n && st[idx]!.node && GRAPH.node(st[idx]!.node!)) out.push({ id: 'graph', label: 'Bilgi grafiğinde incele', sub: GRAPH.node(st[idx]!.node!)!.nameTr, to: { graph: st[idx]!.node! } });
    if (!n && structure) out.push({ id: 'organ', label: 'Organa dön', sub: structureById.get(structure)!.nameTr, to: { body: structure } });
  }
  // "Geri" her seviyede vardır; diğerleri en fazla dört.
  return [...out.slice(0, 4), back];
}

/* ------------------------------------------------------------------ breadcrumb */

export interface LevelCrumb {
  label: string;
  to?: ActionTarget;
}

/**
 * İçerideyken: … › Organ › İçerisi › İçerik › Hareket (geçilen iç basamaklar).
 * Daha derindeyken: … › Organ › İçerisi › Duvar › Mukoza › Hücre (duvardan itibaren geçilenler).
 */
export function levelCrumbs(v: LevelView): LevelCrumb[] {
  const { def, idx } = v;
  const out: LevelCrumb[] = [];
  const chain = interiorTrail(def);
  for (const d of chain.slice(0, -1)) out.push({ label: d.name, to: { interior: d.organId } });
  const structure = structureOfInterior(def);
  out.push({ label: def.name, to: structure ? { body: structure } : undefined });
  out.push({ label: 'İçerisi', to: { stage: 0 } });
  const firstDeep = v.level === 'region' ? idx : def.stages.findIndex((s) => s.scale === 'tissue' || s.scale === 'cell' || s.scale === 'molecule');
  const from = firstDeep >= 0 && idx >= firstDeep ? firstDeep : 1;
  for (let k = from; k <= idx; k++) out.push({ label: shortTitle(def.stages[k]!), to: { stage: k } });
  return out;
}
