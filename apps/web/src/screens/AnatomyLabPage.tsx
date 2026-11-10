/**
 * Anatomi laboratuvarı (#/laboratuvar): vücudu dıştan içe inceleme merdiveninin tek giriş ekranı.
 * Dış görünüm → sistem katmanı → organ ve bölümleri → kesit → organın içi → duvar/doku → hücre → süreç → molekül.
 * Buradaki her şey EĞİTİMSEL normal anatomidir; kişinin kendi görüntüsünden gelen 3B ayrı etiketlenir.
 */
import { useMemo, useState } from 'react';
import { EDUCATIONAL_LABEL, INTERIORS, INTERIOR_ACCEPTANCE, INTERIOR_TYPE_TR, type OrganInteriorDefinition, interiorArchetype, interiorProvenance, ARCHETYPE_TR } from '@kh/analysis';
import { normalizeText, systemById } from '@kh/catalog';
import { hrefFor } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { MENU_SYSTEMS, SYSTEM_TEXT, structuresOfSystem } from '../explore/systems';
import { INSIDE, type InsideId } from '../explore/inside/registry';
import { BodyIcon, ChevronRightIcon, InfoIcon, LayersIcon, SearchIcon } from '../components/icons';
import { Section } from './organ/common';

const GROUP_TR: Record<string, string> = {
  sindirim: 'Sindirim',
  dolasim: 'Dolaşım',
  solunum: 'Solunum',
  uriner: 'Üriner',
  sinir: 'Sinir',
  beyin: 'Beyin bölgeleri',
  endokrin: 'Endokrin',
  ureme: 'Üreme',
  duyu: 'Duyu',
  kasIskelet: 'Kas-iskelet',
  deri: 'Deri',
  bagisiklik: 'Lenf ve bağışıklık',
  diger: 'Diğer',
};

/** İnceleme merdiveni: her seviyenin uygulamadaki karşılığı. */
const LADDER: Array<{ n: number; title: string; what: string; where: string }> = [
  { n: 1, title: 'Dış görünüm', what: 'Organın vücuttaki yeri, komşuları, şekli', where: '3B vücut · döndür, yakınlaştır, izole et' },
  { n: 2, title: 'Anatomik bölümler', what: 'Lob, segment, odacık, kapak, bölge', where: '3B vücut › organ › bölüm (300+ ayrı parça)' },
  { n: 3, title: 'Kesit', what: 'Organın içinden geçen düzlem', where: '3B vücut › kesit aracı; kendi BT/MR serinde MPR' },
  { n: 4, title: 'İç yapı', what: 'Lümen, odacıklar, parankim; içerik ve akış', where: 'İçine gir · organın iç dünyası' },
  { n: 5, title: 'Doku', what: 'Duvar katmanları, lobül, nefron, villus', where: 'Daha derine in · duvar ve doku sahneleri' },
  { n: 6, title: 'Hücre', what: 'Hepatosit, nöron, kardiyomiyosit, enterosit…', where: 'Hücre sahneleri' },
  { n: 7, title: 'Biyolojik süreç', what: 'Süzme, emilim, kasılma, sinyal iletimi', where: 'Canlı sahneler ve simülasyon laboratuvarı' },
  { n: 8, title: 'Molekül', what: 'Taşıyıcılar, kanallar, hormonlar, enzimler', where: 'Moleküler basamak · bilgi grafiği' },
];

function InteriorLink({ d, personal }: { d: OrganInteriorDefinition; personal: boolean }) {
  return (
    <a href={hrefFor({ name: 'interior', id: d.organId })} className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl border border-ink-600/60 px-3 py-2 transition hover:border-accent/60 hover:bg-ink-800" data-testid="lab-interior" data-id={d.organId}>
      <span>
        <span className="block text-[14px] font-medium text-fg">{d.name}</span>
        <span className="block text-[11.5px] text-fg-faint">
          {INTERIOR_TYPE_TR[d.type]} · {ARCHETYPE_TR[interiorArchetype(d)]} · {d.stages.length} basamak{personal ? ' · senin görüntünden 3B var' : ''}
        </span>
      </span>
      <ChevronRightIcon size={14} />
    </a>
  );
}

export function AnatomyLabPage() {
  const { model } = useHealthModel();
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(INTERIORS.map((d) => [d.organId, d])), []);
  // Gerçek bölütleme maskesi olan organlar (yalnızca kişinin kendi BT/MR serisinden).
  const personalIds = useMemo(() => new Set(model ? INTERIORS.filter((d) => interiorProvenance(d, model).personal3D).map((d) => d.organId) : []), [model]);
  const groups = useMemo(() => {
    const needle = normalizeText(q);
    const seen = new Set<string>();
    const out: Array<{ key: string; items: OrganInteriorDefinition[] }> = [];
    for (const [key, ids] of Object.entries(INTERIOR_ACCEPTANCE)) {
      const items = ids.map((id) => byId.get(id)).filter((d): d is OrganInteriorDefinition => !!d && !seen.has(d.organId) && (!needle || normalizeText(d.name).includes(needle)));
      items.forEach((d) => seen.add(d.organId));
      if (items.length) out.push({ key, items });
    }
    const rest = INTERIORS.filter((d) => !seen.has(d.organId) && (!needle || normalizeText(d.name).includes(needle)));
    if (rest.length) out.push({ key: 'diger', items: rest });
    return out;
  }, [byId, q]);
  const scenes = useMemo(() => Object.values(INSIDE).filter((s) => s.ready), []);
  const total = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 md:px-8 md:py-10" data-testid="anatomylab">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Anatomi laboratuvarı</h1>
        <p className="max-w-2xl text-[15px] text-fg-muted">İnsan vücudunu dışarıdan başlayarak organ, doku, hücre ve molekül düzeyine kadar incele. Erkek ve kadın referans vücutları, sistem katmanları ve her organın iç dünyası buradan açılır.</p>
        <p className="flex items-start gap-2 rounded-xl border border-caution/40 bg-caution/10 px-3 py-2 text-[12.5px] text-caution-fg" data-testid="lab-edu-label">
          <InfoIcon size={15} className="mt-0.5 shrink-0" /> {EDUCATIONAL_LABEL} Kendi BT/MR serinden çıkarılan 3B organlar ayrı ekranda ve “Senin görüntünden” etiketiyle gösterilir.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn-primary" href={hrefFor({ name: 'body' })} data-testid="lab-open-3d">
            <BodyIcon size={16} /> 3B vücudu aç
          </a>
          <a className="btn-ghost" href={hrefFor({ name: 'brain' })}>
            Beyin haritası
          </a>
          <a className="btn-ghost" href={hrefFor({ name: 'coverage' })}>
            Kapsam raporu
          </a>
        </div>
      </header>

      <Section title="Sistem katmanları" hint="Bir sisteme dokun: 3B vücutta yalnızca o sistemin yapıları öne çıkar. Sistem sayfası organları ve akışları listeler.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MENU_SYSTEMS.map((id) => {
            const s = systemById.get(id);
            if (!s) return null;
            return (
              <div key={id} className="rounded-xl border border-ink-600/60 p-3" data-testid="lab-system" data-id={id}>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-[14.5px] font-medium text-fg">{s.nameTr}</span>
                  <span className="ml-auto text-[11px] text-fg-faint">{structuresOfSystem(id).length} yapı</span>
                </div>
                <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-fg-muted">{SYSTEM_TEXT[id]}</p>
                <div className="mt-2 flex gap-2">
                  <a className="btn-ghost min-h-[40px] flex-1 px-3 text-[12.5px]" href={hrefFor({ name: 'body', system: id })}>
                    <LayersIcon size={14} /> 3B katman
                  </a>
                  <a className="btn-ghost min-h-[40px] flex-1 px-3 text-[12.5px]" href={hrefFor({ name: 'system', id })}>
                    Organlar
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="İnceleme merdiveni · dıştan moleküle">
        <ol className="grid gap-2 sm:grid-cols-2">
          {LADDER.map((l) => (
            <li key={l.n} className="flex gap-3 rounded-xl border border-ink-600/60 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[12.5px] font-semibold text-accent">{l.n}</span>
              <span>
                <span className="block text-[14px] font-medium text-fg">{l.title}</span>
                <span className="block text-[12px] text-fg-muted">{l.what}</span>
                <span className="block text-[11px] text-fg-faint">{l.where}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={`Organın içine gir · ${INTERIORS.length} iç dünya`} hint="İçine gir = organın fiziksel ve işlevsel iç dünyası (lümen, odacık, parankim). Duvar → doku → hücre → molekül ancak bundan sonra açılır.">
        <label className="relative block">
          <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input className="field pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Organ ara: kalp, nefron, koklea…" aria-label="İç dünyalarda ara" data-testid="lab-search" />
        </label>
        {total === 0 && <p className="text-sm text-fg-muted">“{q}” için iç dünya bulunamadı.</p>}
        {groups.map((g) => (
          <details key={g.key} open={!!q || g.key === 'sindirim' || g.key === 'dolasim'} className="group" data-testid="lab-group" data-group={g.key}>
            <summary className="flex min-h-[44px] cursor-pointer select-none items-center justify-between py-2 text-[14px] font-medium text-fg">
              {GROUP_TR[g.key] ?? g.key} <span className="text-[12px] font-normal text-fg-faint">{g.items.length}</span>
            </summary>
            <div className="grid gap-1.5 pb-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((d) => (
                <InteriorLink key={d.organId} d={d} personal={personalIds.has(d.organId)} />
              ))}
            </div>
          </details>
        ))}
      </Section>

      <Section title={`Mikroanatomi · ${scenes.length} doku ve hücre sahnesi`} hint="Prosedürel, temsili ölçekli 3B sahnelerdir (mikroskopi görüntüsü değildir). “Simülasyon” sahnelerinde süreç canlandırılır; “doku atlası” sahneleri şematik katmanlardır.">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((s) => (
            <a key={s.id} href={hrefFor({ name: 'simulation', id: s.id as InsideId })} className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl border border-ink-600/60 px-3 py-2 transition hover:border-accent/60 hover:bg-ink-800" data-testid="lab-scene" data-id={s.id}>
              <span>
                <span className="block text-[14px] font-medium text-fg">{s.title}</span>
                <span className="block text-[11.5px] text-fg-faint">
                  {s.kind === 'simulation' ? 'Simülasyon' : 'Doku atlası · şematik'} · {s.cell}
                </span>
              </span>
              <ChevronRightIcon size={14} />
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}
