/**
 * Bilgi grafiğinde herhangi bir düğüme gitmek: düğümün organı bulunur, iç yol "derin" görünümünün izine
 * (trail) yazılır. Organı olmayan düğümler (vücut bölgesi, damar, hücre) kendi derin görünümünde açılır.
 */
import { GRAPH, type HealthModel, type OrganInteriorDefinition, interiorFor, type KNode, type MedicalFinding, type ModelStructure, type OrganView, type ReportFinding } from '@kh/analysis';
import type { Route } from '../state/router';

export function routeForNode(id: string): Route {
  const path = GRAPH.pathTo(id);
  const organIdx = path.findIndex((n) => n.kind === 'organ');
  if (organIdx >= 0) {
    const organ = path[organIdx]!;
    const trail = path.slice(organIdx + 1).map((n) => n.id).slice(-8);
    return trail.length ? { name: 'organ', id: organ.id, view: 'derin', trail } : { name: 'organ', id: organ.id };
  }
  return { name: 'organ', id, view: 'derin', trail: [] };
}

/**
 * "İçine gir": organın fiziksel/işlevsel İÇ DÜNYASI (lümen, içerik, akış; dolu organda parankim ve süreç).
 * Duvar, doku, hücre ve molekül "Daha derine in"dir; buradan oraya atlanmaz. İç dünyası olmayan bir düğüm
 * (yalnızca embriyonik/soyut yapılar) kalmadığı için derin görünüm yalnızca son çaredir.
 */
export function insideRoute(id: string): Route {
  const def = interiorFor(id);
  return def ? { name: 'interior', id: def.organId } : deepRoute(id);
}

/** "Anatomide konumu": düğümün derin anatomi görünümü (organ düğümünde de organ özeti yerine derin görünüm). */
export function deepRoute(id: string): Route {
  const r = routeForNode(id);
  return r.name === 'organ' && !r.view ? { name: 'organ', id: r.id, view: 'derin', trail: [] } : r;
}

/** 3B yapı (ve varsa bölümü: odacık, kapak, segment…) → iç dünya. Bölümün kendi iç dünyası yoksa yapınınki. */
export function interiorForStructure(structure: string, partKey?: string): OrganInteriorDefinition | undefined {
  const node = partKey ? GRAPH.nodeForStructure(structure, partKey) : undefined;
  return (node && interiorFor(node.id)) || interiorFor(structure);
}

/** Düğüm ya da onun altındaki bir düğüm mü (bulgunun anatomik yolu bu düğümden geçiyor mu)? */
function touches(loc: { path?: string[]; structure?: string; part?: string } | undefined, node: KNode, organ: KNode): boolean {
  if (!loc) return false;
  if (loc.path?.includes(node.id)) return true;
  if (node.id === organ.id) return Boolean(organ.structure && loc.structure === organ.structure);
  return Boolean(node.structure && node.part && loc.structure === node.structure && loc.part === node.part);
}

export interface PersonalHere {
  labs: HealthModel['latestLabs'];
  modelFindings: MedicalFinding[];
  modelStructures: ModelStructure[];
  reportFindings: ReportFinding[];
}

/** "Bende bununla ilgili ne görülmüş?": yalnızca gerçek veri; bu düğüme ya da altına bağlı olanlar. */
export function personalHere(node: KNode, v: OrganView, model: HealthModel | null): PersonalHere {
  const markers = new Set(GRAPH.biomarkersFor(node.id, 3).map((b) => b.testKey).filter(Boolean) as string[]);
  return {
    labs: (model?.latestLabs ?? []).filter((l) => markers.has(l.testKey)),
    modelFindings: v.personal.modelFindings.filter((f) => touches(f.anatomicalStructure, node, v.node)),
    modelStructures: v.personal.modelStructures.filter((s) => touches(s.anatomicalStructure, node, v.node)),
    reportFindings: v.personal.reportFindings.filter((f) => !f.negated && touches(f.location, node, v.node)),
  };
}
