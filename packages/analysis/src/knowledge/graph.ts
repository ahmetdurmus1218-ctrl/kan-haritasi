/**
 * Tıbbi bilgi grafiği: anatomi ve fizyoloji statik metin değil, düğüm ve ilişkilerden oluşur.
 *
 *   Organ → Bölge → Doku → Hücre → Süreç → Molekül
 *   Süreç → (ölçülür) → Biyobelirteç (laboratuvar testi / EKG ölçümü)
 *   Süreç → (yol açar) → Süreç   ("Vücudumda neyi ne etkiliyor?")
 *
 * İçerik genel eğitim bilgisidir (KNOWLEDGE); kişiye özel değildir.
 */

export type NodeKind = 'system' | 'organ' | 'region' | 'tissue' | 'cell' | 'process' | 'molecule' | 'function' | 'biomarker';

/** Detay seviyesi: kullanıcı "Detaylandır" ile bir sonraki seviyeye iner. */
export const LEVEL: Record<NodeKind, number> = {
  system: 0,
  organ: 1,
  region: 2,
  tissue: 3,
  cell: 4,
  process: 5,
  function: 5,
  molecule: 6,
  biomarker: 6,
};

export const LEVEL_LABEL: Record<NodeKind, string> = {
  system: 'Sistem',
  organ: 'Organ',
  region: 'Bölge',
  tissue: 'Doku',
  cell: 'Hücre',
  process: 'Biyolojik süreç',
  function: 'İşlev',
  molecule: 'Molekül',
  biomarker: 'Ölçüm / test',
};

export interface KNode {
  id: string;
  kind: NodeKind;
  nameTr: string;
  summary: string;
  /** 3B modeldeki yapı ve bölüm (catalog STRUCTURES / PARTS). */
  structure?: string;
  part?: string;
  /** Biyobelirteç: katalogdaki test anahtarı ya da EKG ölçümü. */
  testKey?: string;
  ecgMeasure?: 'heart-rate' | 'rr' | 'pr' | 'qrs' | 'qt' | 'axis' | 'rhythm';
  /** Bu düğüm kataloğa bağlı değilse (ör. C-peptid henüz katalogda yok). */
  note?: string;
}

export type Relation =
  /** A, B'nin parçasıdır. */
  | 'part_of'
  /** A (organ/bölge/doku), B (doku/hücre) içerir. */
  | 'made_of'
  /** A, B işlevini/sürecini yürütür. */
  | 'performs'
  /** A (hücre), B (molekül) üretir. */
  | 'produces'
  /** A (süreç/molekül), B (biyobelirteç) ile ölçülür / izlenir. */
  | 'measured_by'
  /** A, B'ye yol açar / B'yi besler (nedensel zincir). */
  | 'leads_to'
  /** A, B'yi düzenler. */
  | 'regulates'
  /** A, B'yi etkileyebilir (dolaylı, olasılıksal). */
  | 'affects'
  /** A organı B sistemine aittir. */
  | 'belongs_to';

export const RELATION_LABEL: Record<Relation, string> = {
  part_of: 'parçasıdır',
  made_of: 'içerir',
  performs: 'yürütür',
  produces: 'üretir',
  measured_by: 'ölçülür',
  leads_to: 'yol açar',
  regulates: 'düzenler',
  affects: 'etkileyebilir',
  belongs_to: 'sistemine aittir',
};

export interface KEdge {
  from: string;
  to: string;
  rel: Relation;
  /** İlişkinin kısa açıklaması (ör. "İnsülin hücrelerin glukozu almasını sağlar"). */
  note?: string;
}

export class KnowledgeGraph {
  readonly nodes = new Map<string, KNode>();
  private readonly out = new Map<string, KEdge[]>();
  private readonly inc = new Map<string, KEdge[]>();

  constructor(nodes: readonly KNode[], edges: readonly KEdge[]) {
    for (const n of nodes) {
      if (this.nodes.has(n.id)) throw new Error(`duplicate node ${n.id}`);
      this.nodes.set(n.id, n);
    }
    for (const e of edges) {
      if (!this.nodes.has(e.from)) throw new Error(`unknown node ${e.from}`);
      if (!this.nodes.has(e.to)) throw new Error(`unknown node ${e.to}`);
      (this.out.get(e.from) ?? this.out.set(e.from, []).get(e.from)!).push(e);
      (this.inc.get(e.to) ?? this.inc.set(e.to, []).get(e.to)!).push(e);
    }
  }

  node(id: string): KNode | undefined {
    return this.nodes.get(id);
  }

  edgesFrom(id: string, rel?: Relation): KEdge[] {
    return (this.out.get(id) ?? []).filter((e) => !rel || e.rel === rel);
  }

  edgesTo(id: string, rel?: Relation): KEdge[] {
    return (this.inc.get(id) ?? []).filter((e) => !rel || e.rel === rel);
  }

  /** Doğrudan alt parçalar (part_of ile bağlı). */
  children(id: string): KNode[] {
    return this.edgesTo(id, 'part_of').map((e) => this.nodes.get(e.from)!);
  }

  /**
   * Genelden özele yol: ör. Beyin → Sağ yarıküre → Alın lobu. `via` verilirse, birden çok üst düğümü
   * olan düğümde (lob iki yarıkürenin de parçası) o üst düğüm tercih edilir.
   */
  pathTo(id: string, via?: string): KNode[] {
    const path: KNode[] = [];
    const seen = new Set<string>();
    let cur: string | undefined = id;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const n = this.nodes.get(cur);
      if (!n) break;
      path.unshift(n);
      const ups: KEdge[] = this.edgesFrom(cur, 'part_of');
      cur = (ups.find((e) => e.to === via) ?? ups[0])?.to;
    }
    return path;
  }

  /** Bir sonraki detay seviyesi: alt parçalar, içerdiği doku/hücreler, yürüttüğü süreçler, ürettiği moleküller. */
  drill(id: string): Array<{ node: KNode; rel: Relation; note?: string }> {
    const items = [
      ...this.edgesTo(id, 'part_of').map((e) => ({ node: this.nodes.get(e.from)!, rel: 'part_of' as Relation, note: e.note })),
      ...this.edgesFrom(id)
        .filter((e) => e.rel === 'made_of' || e.rel === 'performs' || e.rel === 'produces')
        .map((e) => ({ node: this.nodes.get(e.to)!, rel: e.rel, note: e.note })),
    ];
    return items.sort((a, b) => LEVEL[a.node.kind] - LEVEL[b.node.kind]);
  }

  /**
   * "Organın içine gir" yolu: organdan başlayıp her adımda bir seviye içeri (önce içerdiği doku —
   * made_of —, sonra bölüm), en derine inen dal seçilerek. `maxLevel`e (varsayılan: hücre) kadar;
   * süreç ve molekül "Daha derine in"e bırakılır. Ör. İnce bağırsak → Duvar → Mukoza → Villus → Enterosit.
   */
  insidePath(id: string, maxLevel: number = LEVEL.cell): KNode[] {
    const depth = (n: string, seen: ReadonlySet<string>): number => {
      if (seen.has(n)) return 0;
      const next = new Set(seen).add(n);
      const kids = this.drill(n);
      return kids.length ? 1 + Math.max(...kids.map((k) => depth(k.node.id, next))) : 0;
    };
    const path: KNode[] = [];
    const seen = new Set<string>([id]);
    let cur = id;
    for (let guard = 0; guard < 8; guard++) {
      const kids = this.drill(cur).filter((k) => LEVEL[k.node.kind] <= maxLevel && k.node.kind !== 'function' && !seen.has(k.node.id));
      if (!kids.length) break;
      const best = kids
        .map((k, i) => ({ k, i, inner: k.rel === 'made_of' ? 1 : 0, d: depth(k.node.id, seen) }))
        .sort((a, b) => b.inner - a.inner || b.d - a.d || a.i - b.i)[0]!;
      path.push(best.k.node);
      seen.add(best.k.node.id);
      cur = best.k.node.id;
    }
    return path;
  }

  /** Düğümün (ve alt parçalarının) yürüttüğü süreç/işlevler. */
  functionsOf(id: string, depth = 2): KNode[] {
    const out = new Map<string, KNode>();
    const visit = (n: string, d: number) => {
      for (const e of this.edgesFrom(n, 'performs')) out.set(e.to, this.nodes.get(e.to)!);
      for (const e of this.edgesFrom(n, 'made_of')) if (d > 0) visit(e.to, d - 1);
      if (d > 0) for (const c of this.children(n)) visit(c.id, d - 1);
    };
    visit(id, depth);
    return [...out.values()];
  }

  /**
   * "Bu neyi etkiler?": düğümden başlayan nedensel zincirler (performs/produces/regulates/leads_to/
   * affects). Her zincir düğüm dizisidir; döngüler ve `maxDepth` sınırlanır.
   */
  chains(id: string, maxDepth = 5, limit = 12): KNode[][] {
    const REL: ReadonlySet<Relation> = new Set(['performs', 'produces', 'regulates', 'leads_to', 'affects', 'made_of']);
    const out: KNode[][] = [];
    const walk = (path: string[]) => {
      if (out.length >= limit) return;
      const last = path[path.length - 1]!;
      // Alt parçalara da inilir (Pankreas → Endokrin bölüm → Beta hücresi …).
      const next = [...this.edgesTo(last, 'part_of').map((e) => ({ ...e, to: e.from })), ...this.edgesFrom(last).filter((e) => REL.has(e.rel))].filter((e) => !path.includes(e.to));
      if (!next.length || path.length > maxDepth) {
        if (path.length > 1) out.push(path.map((p) => this.nodes.get(p)!));
        return;
      }
      for (const e of next) walk([...path, e.to]);
    };
    walk([id]);
    return out;
  }

  /** Bir yapı/süreçle ilişkili biyobelirteçler (alt düğümler ve süreç zincirleri üzerinden). */
  biomarkersFor(id: string, depth = 4): KNode[] {
    const out = new Map<string, KNode>();
    const seen = new Set<string>();
    const visit = (n: string, d: number) => {
      if (seen.has(n) || d < 0) return;
      seen.add(n);
      for (const e of this.edgesFrom(n, 'measured_by')) out.set(e.to, this.nodes.get(e.to)!);
      for (const e of this.edgesFrom(n)) if (e.rel === 'performs' || e.rel === 'produces' || e.rel === 'made_of' || e.rel === 'regulates' || e.rel === 'leads_to') visit(e.to, d - 1);
      for (const c of this.children(n)) visit(c.id, d - 1);
    };
    visit(id, depth);
    return [...out.values()];
  }

  /** Test anahtarından ilişkili organlara: biyobelirteç → süreç/molekül → … → organ. */
  organsForTest(testKey: string): KNode[] {
    const marker = [...this.nodes.values()].find((n) => n.testKey === testKey);
    if (!marker) return [];
    const out = new Map<string, KNode>();
    const seen = new Set<string>();
    const up = (id: string, d: number) => {
      if (seen.has(id) || d > 6) return;
      seen.add(id);
      const n = this.nodes.get(id)!;
      if (n.kind === 'organ') {
        out.set(id, n);
        return;
      }
      for (const e of this.edgesTo(id)) {
        const from = this.nodes.get(e.from)!;
        // "affects" yalnızca yapısal bir kaynaktan (hücre → hasar süreci) yukarı izlenir; aksi hâlde her şey her şeye bağlanır.
        const structural = from.kind === 'cell' || from.kind === 'tissue' || from.kind === 'region';
        if (e.rel === 'measured_by' || e.rel === 'performs' || e.rel === 'produces' || e.rel === 'made_of' || (e.rel === 'affects' && structural)) up(e.from, d + 1);
      }
      for (const e of this.edgesFrom(id, 'part_of')) up(e.to, d + 1);
    };
    up(marker.id, 0);
    return [...out.values()];
  }

  /** 3B yapı (ve bölüm) → grafik düğümü (en özel olan). */
  nodeForStructure(structure: string, part?: string): KNode | undefined {
    const all = [...this.nodes.values()];
    return (part ? all.find((n) => n.structure === structure && n.part === part) : undefined) ?? all.find((n) => n.structure === structure && !n.part);
  }

  /** Organın ait olduğu sistemler. */
  systemsOf(id: string): KNode[] {
    const root = this.pathTo(id)[0];
    return root ? this.edgesFrom(root.id, 'belongs_to').map((e) => this.nodes.get(e.to)!) : [];
  }
}
