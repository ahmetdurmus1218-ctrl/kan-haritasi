/**
 * Organ ekranlarının ortak parçaları: bölüm kutusu, renkli tahlil satırı (ad + değer + birim + ▲/▼
 * aynı tonda), konum yolu (breadcrumb), derinlik seviyesi ve bilgi grafiği düğümü → iç sahne eşleşmesi.
 */
import type { ReactNode } from 'react';
import { GRAPH, type KNode, LEVEL, LEVEL_LABEL, type LabObservation, type OrganView, REF_TR } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type Route, go } from '../../state/router';
import { labStyle } from '../../lib/tone';
import { formatDate } from '../../lib/format';
import { insidesOf } from '../../anatomy/organs';
import { INSIDE, type InsideId } from '../../explore/inside/registry';

export function Section({ title, children, hint, id }: { title: string; children: ReactNode; hint?: string; id?: string }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-2 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label={title}>
      <h2 className="label-caps">{title}</h2>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-fg-faint">{hint}</p>}
    </section>
  );
}

/**
 * Tahlil satırı: anormal sonuçta test adı, değer, birim ve "▲ Yüksek / ▼ Düşük" aynı semantik tonu
 * taşır (yalnızca küçük bir rozet değil). Referans metni sakin kalır. Normal sonuç nötr.
 */
export function LabRow({ l, compact = false, children }: { l: LabObservation; compact?: boolean; children?: ReactNode }) {
  const st = labStyle(l);
  const off = st.direction !== undefined;
  return (
    <li className={`rounded-xl border px-3 py-2.5 ${off ? `${st.border} ${st.bg}` : 'border-ink-600/60'}`} data-tone={st.tone} data-testid={`lab-${l.testKey}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <button type="button" className={`text-left text-[15px] font-medium hover:underline ${off ? st.text : 'text-fg'}`} onClick={() => go({ name: 'result', key: l.testKey })} data-part="name">
          {l.name}
        </button>
        <span className={`tabular-nums text-[15px] ${off ? st.text : 'text-fg'}`} data-part="value">
          {l.value.toLocaleString('tr-TR')} <span data-part="unit">{l.unit}</span>
        </span>
        <span className={`text-xs ${off ? `${st.text} font-medium` : 'text-fg-muted'}`} data-part="status">
          {st.statusLabel}
          {st.tone === 'urgent' ? ' · acil değerlendirme' : st.tone === 'attention' ? ' · belirgin' : st.tone === 'follow' ? ' · hafif (takip)' : ''}
        </span>
      </div>
      {!compact && (
        <p className={`mt-0.5 text-[11px] ${st.refText}`} data-part="ref">
          {l.refMin !== undefined || l.refMax !== undefined ? `Referans ${l.refMin ?? '…'}–${l.refMax ?? '…'}${l.refSource ? ` (${REF_TR[l.refSource]})` : ''} · ` : ''}
          {formatDate(l.date)}
        </p>
      )}
      {children}
    </li>
  );
}

/** Seviye etiketi: "Seviye 4 / Hücre". */
export function LevelBadge({ node }: { node: KNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-ink-600 px-1.5 py-0.5 text-[11px] text-fg-muted">
      Seviye {LEVEL[node.kind]} / {LEVEL_LABEL[node.kind]}
    </span>
  );
}

/** Organın ilk sistemi (bilgi grafiği ya da katalog). */
export function systemOf(organId: string): { id: string; name: string } | undefined {
  const g = GRAPH.systemsOf(organId)[0];
  if (g) return { id: g.id.replace('system:', ''), name: g.nameTr };
  const sys = structureById.get(organId)?.systems[0];
  return sys ? { id: sys, name: SYSTEM_TR[sys] ?? sys } : undefined;
}

const SYSTEM_TR: Record<string, string> = {
  cardiovascular: 'Kalp ve damar sistemi',
  respiratory: 'Solunum sistemi',
  digestive: 'Sindirim sistemi',
  urinary: 'Boşaltım sistemi',
  endocrine: 'Endokrin (hormon) sistemi',
  nervous: 'Sinir sistemi',
  musculoskeletal: 'Kemik ve kas sistemi',
  immune: 'Bağışıklık sistemi',
  hematologic: 'Kan ve kemik iliği',
  integumentary: 'Deri',
  reproductive: 'Üreme sistemi',
};

export const systemName = (id: string) => GRAPH.node(`system:${id}`)?.nameTr ?? SYSTEM_TR[id] ?? id;

/**
 * "Şu anda neredeyim?": Vücut › Sistem › Organ › (iç yol). Her öğe tıklanabilir; geri dönüşte kullanıcı
 * kaldığı seviyeye değil, seçtiği seviyeye döner.
 */
export function Breadcrumb({ organId, trail = [], current }: { organId: string; trail?: string[]; current?: string }) {
  const sys = systemOf(organId);
  const organ = GRAPH.node(organId)?.nameTr ?? structureById.get(organId)?.nameTr ?? organId;
  // Bölge sayfasında (ör. Beyaz cevher) üstteki organ da görünür: Vücut › Sinir sistemi › Beyin › Beyaz cevher.
  const ancestors = GRAPH.pathTo(organId).slice(0, -1).filter((a) => a.kind !== 'body' && a.kind !== 'body-region');
  const region = GRAPH.node(organId)?.kind === 'body-region' ? undefined : GRAPH.regionsOf(organId)[0];
  const items: Array<{ label: string; route?: Route }> = [
    { label: 'Vücut', route: { name: 'mybody' } },
    ...(region ? [{ label: region.nameTr, route: { name: 'organ', id: region.id, view: 'derin', trail: [] } as Route }] : []),
    ...(sys ? [{ label: sys.name, route: { name: 'system', id: sys.id } as Route }] : []),
    ...ancestors.map((a) => ({ label: a.nameTr, route: { name: 'organ', id: a.id } as Route })),
    { label: organ, route: trail.length || current ? { name: 'organ', id: organId } : undefined },
    ...trail.map((t, i) => ({ label: GRAPH.node(t)?.nameTr ?? t, route: i < trail.length - 1 ? ({ name: 'organ', id: organId, view: 'derin', trail: trail.slice(0, i + 1) } as Route) : undefined })),
    ...(current ? [{ label: current }] : []),
  ];
  return (
    <nav aria-label="Şu anda neredeyim?" className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-fg-faint">›</span>}
          {it.route ? (
            <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go(it.route!)}>
              {it.label}
            </button>
          ) : (
            <span className="text-fg" aria-current="location">
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Bilgi grafiği düğümü → var olan eğitsel iç sahne (VillusScene, AlveolusScene…). */
const NODE_SCENE: Record<string, InsideId> = {
  'tissue.intestinal-mucosa': 'villus',
  'tissue.villus': 'villus',
  'cell.enterocyte': 'villus',
  'tissue.villus-capillary': 'villus',
  'tissue.lacteal': 'villus',
  'tissue.gastric-mucosa': 'mide',
  'cell.parietal': 'mide',
  'tissue.colon-mucosa': 'kalin-bagirsak',
  'tissue.alveolus': 'alveol',
  'tissue.nephron': 'nefron',
  'cell.podocyte': 'nefron',
  'kidneys.cortex': 'nefron',
  'tissue.liver-lobule': 'lobul',
  'cell.hepatocyte': 'lobul',
  'pancreas.endocrine': 'adacik',
  'cell.beta': 'adacik',
  'cell.alpha': 'adacik',
  'pancreas.exocrine': 'pankreas-asinus',
  'cell.acinar': 'pankreas-asinus',
  'tissue.thyroid-follicle': 'folikul',
  'tissue.myocardium': 'kalpkasi',
  'cell.cardiomyocyte': 'kalpkasi',
  'tissue.gray-matter': 'noron',
  'cell.neuron': 'noron',
  'cell.myelinated-axon': 'noron',
  'proc.erythropoiesis': 'ilik',
};

/** Düğüm için iç sahne: önce düğümün kendi eşleşmesi, sonra organın "kendi dokusu" sahnesi. */
export function sceneFor(nodeId: string, organStructure?: string): InsideId | undefined {
  const direct = NODE_SCENE[nodeId];
  if (direct && direct in INSIDE) return direct;
  const n = GRAPH.node(nodeId);
  if (n && (n.kind === 'organ' || n.kind === 'region') && organStructure) {
    const s = insidesOf(organStructure).find((x) => x !== 'hucre');
    if (s) return s;
  }
  return undefined;
}

/** Sonraki seviyeye geçiş düğmesinin metni (doc: "İçini gör", "Hücreleri gör", "Moleküler mekanizmayı gör"). */
export function deeperLabel(n: KNode): string {
  switch (n.kind) {
    case 'region':
      return 'Bölgeyi gör';
    case 'tissue':
      return 'Dokuyu gör';
    case 'cell':
      return 'Hücreyi gör';
    case 'process':
    case 'function':
      return 'Süreci gör';
    case 'molecule':
      return 'Moleküler mekanizmayı gör';
    default:
      return 'Bir seviye daha';
  }
}

/** Organ durumu: "normal" diye kesinleştirilmez (doc: Veri yok / Veri mevcut / İlişkili anormallik var / Takipte / Belirsiz). */
export function organStatus(v: OrganView): { label: string; sentence: string; tone: 'normal' | 'follow' | 'attention' | 'urgent' | 'uncertain' | 'not-assessed' } {
  const labs = v.personal.labs;
  const off = labs.filter((l) => l.status === 'high' || l.status === 'low');
  const strong = off.filter((l) => l.critical || l.severity === 'moderate' || l.severity === 'marked');
  const reportAbn = v.personal.reportFindings.filter((f) => !f.negated && f.status === 'abnormal').length;
  const uncertain = v.personal.imageObservations.filter((o) => o.kind === 'asymmetry').length + v.personal.reportFindings.filter((f) => !f.negated && f.status === 'uncertain').length;
  if (!v.personal.hasData) return { label: 'Veri yok', sentence: 'Bu organla ilişkili verin yok.', tone: 'not-assessed' };
  const offText = off.length ? `Bu organla ilişkili ${off.length} sonuç referans dışında.` : '';
  if (off.some((l) => l.critical)) return { label: 'İlişkili anormallik var', sentence: `${offText} Biri kritik düzeyde; doktor değerlendirmesi gerekir.`, tone: 'urgent' };
  const modelN = v.personal.modelFindings.length;
  if (strong.length || reportAbn || modelN)
    return {
      label: strong.length || reportAbn ? 'İlişkili anormallik var' : 'Model bulgusu var',
      sentence: [offText, reportAbn ? `Raporda ${reportAbn} dikkat çeken bulgu yazıyor.` : '', modelN ? `Yerel tıbbi AI modeli ${modelN} bulgu bildirdi (tanı değildir; hekim değerlendirmesi gerekir).` : ''].filter(Boolean).join(' '),
      tone: 'attention',
    };
  if (off.length) return { label: 'Takipte', sentence: `${offText} Sapma hafif (takip).`, tone: 'follow' };
  if (uncertain) return { label: 'Belirsiz', sentence: `${uncertain} görüntü/rapor gözlemi var; bir bulgu ya da anormallik olduğu doğrulanmadı.`, tone: 'uncertain' };
  return { label: 'Veri mevcut', sentence: 'Bu verilerde bu organla ilişkili belirgin bir anormallik saptanmadı.', tone: 'normal' };
}
