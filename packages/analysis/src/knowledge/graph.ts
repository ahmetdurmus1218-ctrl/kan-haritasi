/**
 * Tıbbi bilgi grafiği: anatomi ve fizyoloji statik metin değil, düğüm ve ilişkilerden oluşur.
 *
 *   Organ → Bölge → Doku → Hücre → Süreç → Molekül
 *   Süreç → (ölçülür) → Biyobelirteç (laboratuvar testi / EKG ölçümü)
 *   Süreç → (yol açar) → Süreç   ("Vücudumda neyi ne etkiliyor?")
 *
 *   Vücut → Vücut bölgesi (baş, boyun, göğüs, karın, pelvis) ← organlar orada bulunur (located_in)
 *   Organ ↔ Organ: komşuluk (adjacent_to), bağlantı (connected_to), kanlanma (supplied_by / drained_by),
 *   sinirlenme (innervated_by), birlikte çalışma (functions_with), gelişim kökeni (develops_from).
 *
 * Hiyerarşi yalnızca part_of / made_of ile kurulur; komşuluk ASLA "içinde" sayılmaz (yumurtalık bağırsağın
 * parçası değildir, pelviste ona komşudur).
 *
 * İçerik genel eğitim bilgisidir (KNOWLEDGE); kişiye özel değildir.
 */

export type NodeKind = 'body' | 'body-region' | 'system' | 'organ' | 'region' | 'tissue' | 'cell' | 'subcellular' | 'process' | 'molecule' | 'function' | 'biomarker';

/** Detay seviyesi: kullanıcı "Detaylandır" ile bir sonraki seviyeye iner. */
export const LEVEL: Record<NodeKind, number> = {
  body: 0,
  'body-region': 0,
  system: 0,
  organ: 1,
  region: 2,
  tissue: 3,
  cell: 4,
  subcellular: 4,
  process: 5,
  function: 5,
  molecule: 6,
  biomarker: 6,
};

export const LEVEL_LABEL: Record<NodeKind, string> = {
  body: 'Vücut',
  'body-region': 'Vücut bölgesi',
  system: 'Sistem',
  organ: 'Organ',
  region: 'Bölge',
  tissue: 'Doku',
  cell: 'Hücre',
  subcellular: 'Hücre içi yapı',
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
  | 'belongs_to'
  /** A, B vücut bölgesinde bulunur (ör. yumurtalık → pelvis). Hiyerarşi değildir. */
  | 'located_in'
  /** A ile B komşudur (simetrik). */
  | 'adjacent_to'
  /** A ile B arasında doğrudan bağlantı/geçiş vardır (kanal, boru, sinir yolu; simetrik). */
  | 'connected_to'
  /** A'yı B (atardamar) besler. */
  | 'supplied_by'
  /** A'nın kanını/lenfini B toplar. */
  | 'drained_by'
  /** A'yı B (sinir) yönetir. */
  | 'innervated_by'
  /** A ile B aynı işlevde birlikte çalışır (simetrik). */
  | 'functions_with'
  /** A, embriyoda B'den gelişir. */
  | 'develops_from';

/** Simetrik ilişkiler: iki yönde de gösterilir. */
export const SYMMETRIC: ReadonlySet<Relation> = new Set<Relation>(['adjacent_to', 'connected_to', 'functions_with']);

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
  located_in: 'bölgesinde bulunur',
  adjacent_to: 'komşusudur',
  connected_to: 'ile bağlantılıdır',
  supplied_by: 'tarafından beslenir',
  drained_by: 'tarafından boşaltılır',
  innervated_by: 'tarafından sinirlenir',
  functions_with: 'ile birlikte çalışır',
  develops_from: 'kökeninden gelişir',
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
    const exact = part ? all.find((n) => n.structure === structure && n.part === part) : undefined;
    if (exact) return exact;
    // Yapının organ düğümü; yoksa tek aday. Birden çok damar/sinir düğümü aynı 3B yapıyı paylaşıyorsa
    // (ör. "karın damarları") hiçbiri seçilmez: yanlış özgüllük üretilmez.
    const cands = all.filter((n) => n.structure === structure && !n.part);
    return cands.find((n) => n.kind === 'organ') ?? (cands.length === 1 ? cands[0] : undefined);
  }

  /**
   * Komşuluk ve bağlantılar (iki yönde): "Yanında ne var?" — hiyerarşiye karışmaz. Aynı vücut bölgesindeki
   * organlar ayrıca `regionMembers` ile listelenir.
   */
  neighbors(id: string): Array<{ node: KNode; rel: Relation; note?: string }> {
    const out = new Map<string, { node: KNode; rel: Relation; note?: string }>();
    for (const e of this.edgesFrom(id)) if (SYMMETRIC.has(e.rel)) out.set(`${e.rel}:${e.to}`, { node: this.nodes.get(e.to)!, rel: e.rel, note: e.note });
    for (const e of this.edgesTo(id)) if (SYMMETRIC.has(e.rel)) out.set(`${e.rel}:${e.from}`, { node: this.nodes.get(e.from)!, rel: e.rel, note: e.note });
    return [...out.values()];
  }

  /** Kanlanma, sinirlenme, gelişim kökeni (bu düğüm ya da üst yapısı için). */
  supply(id: string): Array<{ node: KNode; rel: Relation; note?: string; inherited?: string }> {
    const rels: Relation[] = ['supplied_by', 'drained_by', 'innervated_by', 'develops_from'];
    const out: Array<{ node: KNode; rel: Relation; note?: string; inherited?: string }> = [];
    for (const n of [...this.pathTo(id)].reverse()) {
      for (const e of this.edgesFrom(n.id)) if (rels.includes(e.rel) && !out.some((o) => o.rel === e.rel && o.node.id === e.to)) out.push({ node: this.nodes.get(e.to)!, rel: e.rel, note: e.note, ...(n.id !== id ? { inherited: n.nameTr } : {}) });
      if (out.length) break;
    }
    return out;
  }

  /** Bir vücut bölgesinde bulunan organlar (pelvis → mesane, rahim, yumurtalıklar, rektum …). */
  regionMembers(regionId: string): KNode[] {
    return this.edgesTo(regionId, 'located_in').map((e) => this.nodes.get(e.from)!);
  }

  /** Düğümün (ya da organının) bulunduğu vücut bölgeleri. */
  regionsOf(id: string): KNode[] {
    for (const n of [...this.pathTo(id)].reverse()) {
      const r = this.edgesFrom(n.id, 'located_in').map((e) => this.nodes.get(e.to)!);
      if (r.length) return r;
    }
    return [];
  }

  /** En derin iç yol uzunluğu (organ → … → hücre içi yapı / süreç). */
  depthOf(id: string, maxLevel: number = LEVEL.molecule): number {
    const memo = new Map<string, number>();
    const walk = (n: string): number => {
      const m = memo.get(n);
      if (m !== undefined) return m;
      memo.set(n, 0); // döngü koruması
      const kids = this.drill(n).filter((k) => LEVEL[k.node.kind] <= maxLevel && k.node.kind !== 'biomarker');
      const d = kids.length ? 1 + Math.max(...kids.map((k) => walk(k.node.id))) : 0;
      memo.set(n, d);
      return d;
    };
    return walk(id);
  }

  /** Grafik istatistikleri (rapor ve testler için). */
  stats(): { nodes: number; edges: number; byKind: Record<string, number>; byRelation: Record<string, number> } {
    const byKind: Record<string, number> = {};
    const byRelation: Record<string, number> = {};
    for (const n of this.nodes.values()) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
    let edges = 0;
    for (const list of this.out.values())
      for (const e of list) {
        edges++;
        byRelation[e.rel] = (byRelation[e.rel] ?? 0) + 1;
      }
    return { nodes: this.nodes.size, edges, byKind, byRelation };
  }

  /** Organın ait olduğu sistemler. */
  systemsOf(id: string): KNode[] {
    const root = this.pathTo(id)[0];
    return root ? this.edgesFrom(root.id, 'belongs_to').map((e) => this.nodes.get(e.to)!) : [];
  }
}
