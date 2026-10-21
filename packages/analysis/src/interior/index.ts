/**
 * "İÇİNE GİR" motoru — kayıt, arama, doğrulama, köken ve kişisel bağ.
 *
 * Dürüstlük kuralları (kod düzeyinde):
 *   - Solid organda lümen YOKTUR (sahte iç boşluk üretilmez); hollow/tubular/vascular'da lümen ve içerik zorunludur.
 *   - İçine gir ilk adımı her zaman organın İÇİDİR (ölçek 3); organdan doğrudan hücreye atlanmaz ve ölçek
 *     merdiveni geri gitmez (iç → bölge → doku → hücre → molekül).
 *   - Villus yalnızca ince bağırsakta vardır (kalın bağırsakta villus gösterilmez).
 *   - Kişisel görüntüden gelen gerçek 3B (bölütleme maskesi) yalnızca ORGAN düzeyindedir; içerideki her
 *     seviye "Eğitimsel normal anatomi/fizyoloji — kişisel görüntü değildir." olarak etiketlenir.
 *   - Eğitimsel simülasyon modları (boş / sindirim / emilim) kişinin verisinden türetilmez.
 */
import { structureById, testByKey } from '@kh/catalog';
import type { HealthModel } from '../fusion';
import { flowById } from '../flows';
import { GRAPH } from '../knowledge';
import { physioChain } from '../physiology';
import type { LabObservation, MedicalFinding, ModelStructure } from '../types';
import { isPositiveReport } from '../types';
import { CIRCULATORY, RESPIRATORY } from './data/circulatory';
import { BRAIN } from './data/brain';
import { DIGESTIVE } from './data/digestive';
import { EXTRA } from './data/extra';
import { MUSCULOSKELETAL, REPRODUCTIVE, SENSORY, SKIN } from './data/other';
import { ENDOCRINE, NERVOUS, URINARY } from './data/urinaryNervous';
import { type InteriorArchetype, type InteriorMode, type InteriorStage, type InteriorType, type OrganInteriorDefinition, SCALE_LEVEL } from './types';

export * from './types';
export { INTERIOR_ACCEPTANCE } from './acceptance';
export { BRAIN_REGIONS } from './data/brain';

export const INTERIORS: readonly OrganInteriorDefinition[] = [...DIGESTIVE, ...CIRCULATORY, ...RESPIRATORY, ...URINARY, ...NERVOUS, ...BRAIN, ...ENDOCRINE, ...REPRODUCTIVE, ...SENSORY, ...MUSCULOSKELETAL, ...SKIN, ...EXTRA];

const byId = new Map<string, OrganInteriorDefinition>();
for (const d of INTERIORS) {
  if (byId.has(d.organId)) throw new Error(`duplicate interior ${d.organId}`);
  byId.set(d.organId, d);
}
const byAlias = new Map<string, OrganInteriorDefinition>();
for (const d of INTERIORS) for (const a of [d.anchor, ...(d.aliases ?? [])]) if (a && !byId.has(a) && !byAlias.has(a)) byAlias.set(a, d);

export const INTERIOR_TYPE_TR: Record<InteriorType, string> = {
  hollow: 'İçi boş organ (lümenli)',
  tubular: 'Tüp biçimli organ (lümenli)',
  vascular: 'Damar (kan akışı)',
  solid: 'Dolu organ (parankim; lümen yok)',
  compound: 'Bileşik yapı (birden çok iç dünya)',
};

export const ARCHETYPE_TR: Record<InteriorArchetype, string> = {
  hollow: 'İçi boş organ: lümen → içerik → hareket → işlev',
  solid: 'Dolu organ: parankim → fonksiyonel bölgeler → süreç',
  vascular: 'Damar: lümen → kan akışı → kan hücreleri',
  chamber: 'Pompa / odacık: odacıklar → kan akışı → kapaklar',
  airway: 'Hava yolu: hava akışı → dallanma → gaz değişimi',
  sensory: 'Duyu yolu: uyaranın ilerleyişi → algılayıcı hücre → sinir',
};

/** Organın deneyim kalıbı: açıkça verilmişse o, yoksa tür ve sahneden türetilir. */
export function interiorArchetype(d: OrganInteriorDefinition): InteriorArchetype {
  if (d.archetype) return d.archetype;
  if (d.type === 'vascular') return 'vascular';
  const sc = d.interiorScene;
  if (sc.kind === 'chambers') return 'chamber';
  if (sc.kind === 'pathway') return sc.signal === 'air' ? 'airway' : 'sensory';
  if (sc.kind === 'lumen' && sc.content === 'air') return 'airway';
  if (d.type === 'solid' || sc.kind === 'parenchyma') return 'solid';
  return 'hollow';
}

/** "İçine gir" deneyimi: organın iç dünyası (ölçek 'interior') ile "Daha derine in" basamakları ayrı. */
export function interiorExperience(d: OrganInteriorDefinition): { inside: InteriorStage[]; deeper: InteriorStage[] } {
  const k = d.stages.findIndex((s) => s.scale !== 'interior');
  return k < 0 ? { inside: [...d.stages], deeper: [] } : { inside: d.stages.slice(0, k), deeper: d.stages.slice(k) };
}

/** İlk ekranda asla açılmaması gereken basamak türleri (duvar ve mikroanatomi). */
export const NOT_FIRST: ReadonlySet<InteriorStage['kind']> = new Set(['wall', 'tissue', 'cell', 'molecule']);

/** Etiketler: hiçbir zaman karıştırılmaz. */
export const EDUCATIONAL_LABEL = 'Eğitimsel normal anatomi/fizyoloji — kişisel görüntü değildir.';
export const PERSONAL_LABEL = 'Senin görüntünden oluşturuldu.';
export const SIMULATION_LABEL = 'Eğitimsel normal simülasyon — kişisel veri değildir.';

export function interiorById(id: string): OrganInteriorDefinition | undefined {
  return byId.get(id);
}

/**
 * Organ / bilgi grafiği düğümü / katalog yapısı → iç dünya. Doğrudan eşleşme yoksa grafikte yukarı
 * çıkılır (ör. "tissue.villus" → ince bağırsak); hiçbiri yoksa undefined.
 */
export function interiorFor(id: string): OrganInteriorDefinition | undefined {
  const direct = byId.get(id) ?? byAlias.get(id);
  if (direct) return direct;
  // Yukarı doğru genişlik öncelikli: parçası olduğu (part_of) ya da onu içeren (made_of) yapılar.
  const seen = new Set([id]);
  let frontier = [id];
  for (let depth = 0; depth < 8 && frontier.length; depth++) {
    const next: string[] = [];
    for (const cur of frontier)
      for (const up of [...GRAPH.edgesFrom(cur, 'part_of').map((e) => e.to), ...GRAPH.edgesTo(cur, 'made_of').map((e) => e.from)]) {
        if (seen.has(up)) continue;
        seen.add(up);
        const d = byId.get(up) ?? byAlias.get(up);
        if (d) return d;
        next.push(up);
      }
    frontier = next;
  }
  // Embriyonik yapı (ör. orta bağırsak, nöral tüp): yetişkinde kendi iç dünyası yoktur; ondan gelişen organınki açılır.
  if (id.startsWith('dev.'))
    for (const e of GRAPH.edgesTo(id, 'develops_from')) {
      const d = interiorFor(e.from);
      if (d) return d;
    }
  return undefined;
}

export function interiorModes(def: OrganInteriorDefinition): InteriorMode[] {
  return def.modes ?? (def.parent ? byId.get(def.parent)?.modes ?? [] : []);
}

/** İç dünyanın üst zinciri (Vücut → Sistem → … → bu iç dünya) — breadcrumb için. */
export function interiorTrail(def: OrganInteriorDefinition): OrganInteriorDefinition[] {
  const out: OrganInteriorDefinition[] = [];
  const seen = new Set<string>();
  let cur: OrganInteriorDefinition | undefined = def;
  while (cur && !seen.has(cur.organId)) {
    seen.add(cur.organId);
    out.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return out;
}

/* ------------------------------------------------------------------ doğrulama */

const LUMEN_STAGES = new Set<InteriorStage['kind']>(['lumen', 'content']);
/** Yalnızca bu iç dünyalarda villus astarı / villus düğümü bulunabilir. */
const VILLUS_ALLOWED = (d: OrganInteriorDefinition) => d.organId === 'small-intestine' || d.organId.startsWith('small-intestine.');
const VILLUS_NODES = new Set(['tissue.villus', 'tissue.villus-capillary', 'tissue.lacteal', 'sub.microvilli']);

export interface InteriorIssue {
  organId: string;
  rule: string;
  detail: string;
}

/** Tek bir tanımın kuralları. `all` verilirse çapraz bağlantılar (next, bölge, rota) da denetlenir. */
export function validateInterior(d: OrganInteriorDefinition, all: ReadonlyMap<string, OrganInteriorDefinition> = byId): InteriorIssue[] {
  const out: InteriorIssue[] = [];
  const bad = (rule: string, detail: string) => out.push({ organId: d.organId, rule, detail });
  const lumenOn = Boolean(d.lumen?.enabled);
  if (d.type === 'solid') {
    if (lumenOn) bad('solid-no-lumen', 'Dolu organa lümen tanımlanamaz.');
    if (d.interiorScene.kind === 'lumen' || d.interiorScene.kind === 'vessel') bad('solid-no-lumen', 'Dolu organ lümen sahnesiyle çizilemez.');
    for (const s of d.stages) if (LUMEN_STAGES.has(s.kind)) bad('solid-no-lumen', `Dolu organda "${s.title}" lümen/içerik basamağı olamaz.`);
  }
  if ((d.type === 'hollow' || d.type === 'tubular' || d.type === 'vascular') && (!lumenOn || !d.lumen?.contents?.length)) bad('lumen-required', 'İçi boş / tüp / damar yapıda lümen ve içerik tanımlanmalı.');
  if (d.type === 'vascular') {
    if (d.interiorScene.kind !== 'vessel') bad('vascular-scene', 'Damar, damar sahnesiyle çizilmeli.');
    if (!d.lumen?.contents?.some((c) => c.includes('kan'))) bad('vascular-blood', 'Damar lümeninde kan olmalı.');
  }
  if (!d.stages.length) bad('stages', 'En az bir basamak gerekir.');
  else {
    if (d.stages[0]!.scale !== 'interior') bad('interior-first', 'İçine gir organın içinden başlamalı (doğrudan hücreye atlanmaz).');
    for (let i = 1; i < d.stages.length; i++)
      if (SCALE_LEVEL[d.stages[i]!.scale] < SCALE_LEVEL[d.stages[i - 1]!.scale]) bad('scale-order', `"${d.stages[i]!.title}" ölçek merdiveninde geri gidiyor.`);
    const ids = new Set<string>();
    for (const s of d.stages) {
      if (ids.has(s.id)) bad('stage-id', `Yinelenen basamak ${s.id}.`);
      ids.add(s.id);
    }
  }
  if (d.stages.length) {
    const { inside } = interiorExperience(d);
    const kinds = new Set(inside.map((s) => s.kind));
    const has = (...k: InteriorStage['kind'][]) => k.some((x) => kinds.has(x));
    const dynamic = has('motion', 'flow', 'process');
    if (NOT_FIRST.has(d.stages[0]!.kind)) bad('interior-first', 'İlk sahne duvar/doku/hücre/molekül olamaz.');
    if (inside.length < 2) bad('experience', 'İç dünya en az iki basamak olmalı (yalnızca giriş ekranı yetmez).');
    if (!dynamic) bad('experience', 'İç dünyada organın nasıl çalıştığı (hareket / akış / süreç) gösterilmeli.');
    switch (interiorArchetype(d)) {
      case 'hollow':
        if (!has('lumen') || !has('content')) bad('archetype-hollow', 'İçi boş organ: lümen ve içerik basamağı gerekli.');
        break;
      case 'solid':
        if (d.stages[0]!.kind !== 'parenchyma') bad('archetype-solid', 'Dolu organ parankimden başlar.');
        if (!d.stages.some((s) => s.kind === 'region') && !d.functionalRegions?.length) bad('archetype-solid', 'Dolu organda fonksiyonel bölgeler tanımlanmalı.');
        break;
      case 'vascular':
        if (!has('lumen') || !has('flow', 'content')) bad('archetype-vascular', 'Damar: lümen ve kan akışı gerekli.');
        break;
      case 'chamber':
        if (!has('flow')) bad('archetype-chamber', 'Odacıklı organ: kan akışı basamağı gerekli.');
        break;
      case 'airway':
        if (!has('content', 'lumen') || !has('flow', 'process')) bad('archetype-airway', 'Hava yolu: hava ve hava akışı gerekli.');
        break;
      case 'sensory':
        if (!has('flow', 'motion')) bad('archetype-sensory', 'Duyu yolu: uyaranın ilerleyişi gerekli.');
        break;
    }
  }
  if (!VILLUS_ALLOWED(d)) {
    if (d.interiorScene.kind === 'lumen' && d.interiorScene.lining === 'villi') bad('no-villus', 'Villus astarı yalnızca ince bağırsakta.');
    for (const s of d.stages) if (s.node && VILLUS_NODES.has(s.node)) bad('no-villus', `"${s.title}" villus düğümüne bağlanamaz.`);
    for (const s of d.stages) if (s.scene === 'villus') bad('no-villus', `"${s.title}" villus sahnesine bağlanamaz.`);
  }
  const nodes = [d.anchor, d.deepAnatomyEntry, ...d.stages.map((s) => s.node), ...(d.wallLayers ?? []).map((l) => l.node), ...(d.functionalRegions ?? []).map((r) => r.node)].filter((x): x is string => Boolean(x));
  for (const n of nodes) if (!GRAPH.node(n)) bad('graph-node', `Bilgi grafiğinde olmayan düğüm: ${n}.`);
  if (d.structure && !structureById.has(d.structure)) bad('structure', `Katalogda olmayan 3B yapı: ${d.structure}.`);
  for (const f of d.physiologyFlows ?? []) if (!flowById(f)) bad('flow', `Olmayan akış: ${f}.`);
  const chains = [...(d.physiologyChains ?? []), ...d.stages.map((s) => s.chain).filter((x): x is string => Boolean(x))];
  for (const c of chains) if (!physioChain(c)) bad('chain', `Olmayan fizyoloji zinciri: ${c}.`);
  const tests = [...(d.personalDataBindings ?? []), ...d.stages.flatMap((s) => s.biomarkers ?? [])];
  for (const t of tests) if (!testByKey.has(t)) bad('biomarker', `Katalogda olmayan test: ${t}.`);
  const targets = [...d.stages.flatMap((s) => (s.next ?? []).map((n) => n.to)), ...(d.functionalRegions ?? []).map((r) => r.interior), ...(d.routes ?? []).flatMap((r) => r.steps.map((x) => x.to)), d.parent].filter((x): x is string => Boolean(x));
  for (const t of targets) if (!all.has(t)) bad('target', `Olmayan iç dünyaya geçiş: ${t}.`);
  return out;
}

export function validateAllInteriors(): InteriorIssue[] {
  return INTERIORS.flatMap((d) => validateInterior(d));
}

/* ------------------------------------------------------------------ köken ve kişisel bağ */

export interface InteriorProvenance {
  /** Organ düzeyinde gerçek kişisel 3B (bölütleme maskesi) var mı? */
  personal3D: boolean;
  /** Gerçek maskeden gelen yapılar (yalnızca 'volume' konumlu model çıktıları). */
  structures: ModelStructure[];
  organLabel: string;
  /** İç basamakların etiketi — her zaman eğitimsel. */
  interiorLabel: string;
}

/**
 * Kişiye ait gerçek 3B veri ÖNCE: yerel bölütleme modeli bu organı bir DICOM serisinde gerçek voksel
 * maskesiyle bulduysa organ "Senin görüntünden oluşturuldu" olarak işaretlenir. Sınıflandırma skoru,
 * 2B kutu ya da rapor ifadesi kişisel 3B sayılmaz. İçerideki nefron/villus/lobül her zaman eğitimseldir.
 */
export function interiorProvenance(def: OrganInteriorDefinition, model: Pick<HealthModel, 'organs'> | null): InteriorProvenance {
  const structures = def.structure ? (model?.organs.get(def.structure)?.modelStructures ?? []).filter((s) => s.localization.kind === 'volume') : [];
  const personal3D = structures.length > 0;
  return {
    personal3D,
    structures,
    organLabel: personal3D ? `${PERSONAL_LABEL} (${def.name}: gerçek bölütleme maskesi)` : `${def.name}: normal anatominin eğitimsel 3B modeli.`,
    interiorLabel: EDUCATIONAL_LABEL,
  };
}

export interface StagePersonal {
  labs: LabObservation[];
  /** Bu basamağın düğümüne gerçekten konumlanan model bulguları (kutu/maske/voksel) ve rapor cümleleri. */
  findings: Array<{ text: string; source: 'IMAGE_MODEL' | 'RADIOLOGY_REPORT' | 'OCR'; localized: 'real-coordinate' | 'report-text' }>;
  hasData: boolean;
}

/**
 * Basamağa bağlanan kişisel veri: yalnızca basamağın biyobelirteçleri ve düğümüne konumu GERÇEKTEN
 * ulaşan bulgular. Sınıflandırma (konumsuz) bulgusu bir basamağa "burada" diye yerleştirilmez.
 */
export function stagePersonal(stage: InteriorStage, model: Pick<HealthModel, 'latestLabs'> & Partial<Pick<HealthModel, 'modelFindings' | 'reportFindings'>> | null): StagePersonal {
  const keys = new Set(stage.biomarkers ?? []);
  const labs = (model?.latestLabs ?? []).filter((l) => keys.has(l.testKey));
  const findings: StagePersonal['findings'] = [];
  if (stage.node) {
    for (const f of model?.modelFindings ?? []) if (localizedAt(f, stage.node)) findings.push({ text: `Yerel tıbbi AI modeli: ${f.finding} (tanı değildir)`, source: 'IMAGE_MODEL', localized: 'real-coordinate' });
    for (const f of model?.reportFindings ?? []) if (isPositiveReport(f) && f.location?.path.includes(stage.node)) findings.push({ text: `Rapor: “${f.text}”`, source: f.source === 'OCR' ? 'OCR' : 'RADIOLOGY_REPORT', localized: 'report-text' });
  }
  return { labs, findings, hasData: labs.length + findings.length > 0 };
}

/** Model bulgusu bu düğümde mi? Yalnızca gerçek konum (kutu/maske/nokta/voksel) varsa. */
export function localizedAt(f: MedicalFinding, node: string): boolean {
  const k = f.localization.kind;
  if (k !== 'pixel' && k !== 'point' && k !== 'volume') return false;
  return Boolean(f.anatomicalStructure?.path.includes(node));
}

/** Organın genel kişisel durumu (Benim durumum): bağlı testlerin son sonuçları. */
export function interiorPersonal(def: OrganInteriorDefinition, model: Pick<HealthModel, 'latestLabs'> | null): LabObservation[] {
  const keys = new Set([...(def.personalDataBindings ?? []), ...def.stages.flatMap((s) => s.biomarkers ?? [])]);
  return (model?.latestLabs ?? []).filter((l) => keys.has(l.testKey));
}
