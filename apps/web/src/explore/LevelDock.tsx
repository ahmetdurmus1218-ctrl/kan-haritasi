import { useEffect, useRef, useState } from 'react';
import type { Dir, InteriorEffect, LabObservation, NormalHere, SceneShift, StagePersonal } from '@kh/analysis';
import { go } from '../state/router';
import { labStyle } from '../lib/tone';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { LabRow } from '../screens/organ/common';
import { SourceBadge } from '../components/evidence';
import { LEVEL_TR, type LevelAction, type LevelView } from './interiorNav';
import { Caps } from './ui';

/**
 * Bulunulan seviyenin paneli: başlık, kısa açıklama, etiket ve YALNIZCA bu seviyenin eylemleri
 * (İlerle · İçerik · Nasıl çalışıyor? · Duvarı incele · Daha derine in · Geri…). Anatomik ağacın tamamı
 * hiçbir zaman listelenmez. Telefonda altta (ekranın en fazla ~%40'ı), masaüstünde sağda durur; kapladığı
 * alan 3B kadraja bildirilir ki model panelin arkasında kalmasın.
 */
export function LevelDock({
  view,
  actions,
  onAction,
  accent,
  onSize,
  personal,
  label,
  busy,
  picked,
  personal3D,
  results,
}: {
  view: LevelView;
  actions: LevelAction[];
  onAction: (a: LevelAction) => void;
  accent: string;
  onSize: (cover: { right: number; bottom: number }) => void;
  personal: StagePersonal | null;
  /** "Eğitimsel · Temsili anatomi" ya da organ düzeyinde kişisel 3B etiketi. */
  label: string;
  /** Kamera/sahne geçişi sürüyor. */
  busy: boolean;
  picked?: { name: string; text: string } | null;
  /** Organ gerçek kişisel bölütlemeden geliyorsa: etiket, yapılar (hacimle) ve gerçek görüntüye dönüş. */
  personal3D?: { label: string; detail: string; onOpen?: () => void } | null;
  /** Kişinin sonuçlarının bu iç dünyadaki etkisi ve "Normal ↔ Sonucuma göre" sahne anahtarı. */
  results?: {
    effects: InteriorEffect[];
    normal: NormalHere[];
    shiftFrom: Array<{ lab: LabObservation; dir: Dir; keys: Array<keyof SceneShift> }>;
    view: boolean;
    onView: (mine: boolean) => void;
    anyAbnormal: boolean;
  };
}) {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  const { def, idx, stage, level } = view;
  useEffect(() => setMore(false), [def.organId, idx]);
  const onSizeRef = useRef(onSize);
  onSizeRef.current = onSize;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      const desktop = window.matchMedia('(min-width: 1024px)').matches;
      onSizeRef.current(desktop ? { right: r.width, bottom: 0 } : { right: 0, bottom: r.height });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
      onSizeRef.current({ right: 0, bottom: 0 });
    };
  }, []);

  return (
    <aside
      ref={ref}
      aria-label="Seviye paneli"
      data-testid="level-dock"
      data-level={level}
      data-stage={stage.id}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-[44%] flex-col overflow-hidden rounded-t-3xl border-t border-ink-600/60 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:inset-x-auto lg:right-0 lg:top-0 lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-t-0 lg:pt-20"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3 lg:px-7">
        <div className="flex items-center justify-between gap-2">
          <Caps className="text-[10px] text-fg-faint">
            <span style={{ color: accent }}>{LEVEL_TR[level]}</span> · {def.name}
          </Caps>
          <Caps className="text-[10px] text-fg-faint" aria-label={`Basamak ${idx + 1} / ${def.stages.length}`}>
            {idx + 1} / {def.stages.length}
          </Caps>
        </div>
        <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-fg lg:text-xl" data-testid="level-title">
          {stage.title}
        </h2>
        <p className={`mt-1 text-[13.5px] leading-relaxed text-fg-muted ${more ? '' : 'line-clamp-2 lg:line-clamp-none'}`} data-testid="level-text">
          {stage.text}
        </p>
        {!more && (
          <button type="button" className="mt-0.5 text-[12px] text-accent lg:hidden" onClick={() => setMore(true)}>
            Devamı
          </button>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-accent/40 bg-accent/[0.06] px-2 py-0.5 text-accent" data-testid="interior-label">
            {label}
          </span>
          {busy && (
            <span className="flex items-center gap-1.5 rounded-full border border-ink-600 px-2 py-0.5 text-fg-muted" role="status" aria-live="polite">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent }} aria-hidden="true" />
              Kamera ilerliyor…
            </span>
          )}
        </div>
        {personal3D && (level === 'interior' || level === 'region') && (
          <div className="mt-2 space-y-1 rounded-xl border border-[#a78bfa]/40 p-2.5" data-testid="interior-personal-3d">
            <div className="flex flex-wrap items-center gap-1.5">
              <SourceBadge source="IMAGE_MODEL" />
              <span className="text-[12.5px] font-medium text-fg">{personal3D.label}</span>
            </div>
            <p className="text-[12px] text-fg-muted">{personal3D.detail}</p>
            {personal3D.onOpen && (
              <button type="button" className="text-[12px] text-accent hover:underline" onClick={personal3D.onOpen}>
                Senin gerçek 3B organına dön (içine dalış)
              </button>
            )}
          </div>
        )}
        {picked && (
          <div className="mt-2 rounded-xl border border-ink-600/60 p-2.5 text-[12.5px]">
            <span className="font-medium text-fg">{picked.name}</span>
            <span className="block text-fg-muted">{picked.text}</span>
          </div>
        )}
        {personal?.hasData && (more || level !== 'interior') && (
          <div className="mt-2 space-y-1 rounded-xl border border-ink-600/60 p-2.5" data-testid="interior-stage-personal">
            <p className="text-[11px] font-medium text-fg-muted">KİŞİSEL VERİ · olası ilişki (tanı değildir):</p>
            {personal.labs.length > 0 && (
              <ul className="space-y-1">
                {personal.labs.map((l) => (
                  <LabRow key={l.testKey} l={l} compact />
                ))}
              </ul>
            )}
            {personal.findings.map((f, i) => (
              <p key={i} className="flex flex-wrap items-center gap-1.5 text-[12px] text-fg">
                <SourceBadge source={f.source} />
                {f.text}
              </p>
            ))}
          </div>
        )}
        {results && (results.effects.length > 0 || results.shiftFrom.length > 0 || results.normal.length > 0) && (
          <ResultEffects results={results} more={more} onMore={() => setMore(true)} />
        )}
        {personal?.hasData && !more && level === 'interior' && (
          <button type="button" className="mt-1.5 text-[12px] text-accent" onClick={() => setMore(true)} data-testid="interior-stage-personal-toggle">
            Benim verim · {personal.labs.length + personal.findings.length} olası ilişki
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-ink-700/70 px-4 py-2.5 lg:px-7" role="group" aria-label="Bu seviyede">
        {actions.map((a) => (
          <button
            key={`${a.id}-${a.label}`}
            type="button"
            data-testid="level-action"
            data-action={a.id}
            disabled={busy && a.id !== 'back'}
            onClick={() => (a.id === 'info' ? setMore((v) => !v) : onAction(a))}
            className={`flex min-h-[44px] min-w-0 flex-1 basis-[calc(50%-0.375rem)] items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-left text-[13px] transition disabled:opacity-50 sm:basis-auto ${
              a.primary ? 'kh-holo-btn text-fg' : 'border-ink-600 text-fg-muted hover:text-fg'
            } ${a.id === 'back' ? 'basis-auto' : ''}`}
            style={a.primary ? { borderColor: `${accent}aa` } : undefined}
          >
            {a.id === 'back' && <ChevronLeftIcon size={14} />}
            <span className="min-w-0">
              <span className="block truncate">{a.label}</span>
              {a.sub && <span className="block truncate text-[11px] text-fg-faint">{a.sub}</span>}
            </span>
            {a.id !== 'back' && a.id !== 'info' && <ChevronRightIcon size={14} className="ml-auto shrink-0" />}
          </button>
        ))}
      </div>
    </aside>
  );
}

const SHIFT_TR: Record<keyof SceneShift, string> = {
  rbc: 'alyuvar sayısı',
  pale: 'alyuvar rengi',
  rbcSize: 'alyuvar boyu',
  wbc: 'akyuvarlar',
  plt: 'trombositler',
  plaque: 'damar duvarı plağı',
  lipid: 'kanın yağ bulanıklığı',
  sugar: 'şeker parçacıkları',
  yellow: 'sarılık rengi',
  inflam: 'iltihap kızarıklığı',
  leak: 'hücreden sızan enzim',
  flow: 'akış hızı',
  crystals: 'kristaller',
  fluid: 'doku arası sıvı',
  acid: 'asit-baz tonu',
  oxygen: 'kanın oksijen yükü',
  signal: 'sinyal hızı',
  protein: 'süzgeçten kaçan protein',
};

/**
 * "Senin sonucunla burada": bu iç dünyayı (basamağı) etkileyen referans dışı sonuçlar, burada neyin
 * değiştiği ve olası nedenlere geçiş; "Normal ↔ Sonucuma göre" anahtarı 3B sahneyi değiştirir. Kişisel
 * görüntü değildir: değişiklikler tahlilden türetilen eğitimsel, temsili gösterimdir.
 */
function ResultEffects({ results, more, onMore }: { results: NonNullable<Parameters<typeof LevelDock>[0]['results']>; more: boolean; onMore: () => void }) {
  const { effects, normal, shiftFrom, view, onView } = results;
  const canShift = shiftFrom.length > 0;
  const shown = more ? effects : effects.slice(0, 2);
  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-caution/30 bg-caution/[0.04] p-2.5" data-testid="interior-result-effects">
      {canShift && (
        <div className="flex gap-1" role="group" aria-label="Sahne görünümü">
          {([false, true] as const).map((mine) => (
            <button
              key={String(mine)}
              type="button"
              aria-pressed={view === mine}
              data-testid={mine ? 'result-view-mine' : 'result-view-normal'}
              onClick={() => onView(mine)}
              className={`min-h-[36px] flex-1 rounded-full border px-2.5 text-[12px] ${view === mine ? 'border-accent bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted'}`}
            >
              {mine ? 'Sonucuma göre' : 'Normal (tipik)'}
            </button>
          ))}
        </div>
      )}
      {canShift && view && (
        <p className="text-[11px] text-fg-faint" data-testid="result-view-note">
          Sahnede değişen: {[...new Set(shiftFrom.flatMap((f) => f.keys))].map((k) => SHIFT_TR[k]).join(', ')} — {shiftFrom.map((f) => `${f.lab.name} ${f.dir === 'high' ? '▲' : '▼'}`).join(', ')}. Eğitimsel, temsili gösterim; senin dokunun görüntüsü değildir.
        </p>
      )}
      {effects.length > 0 ? (
        <>
          <p className="text-[11px] font-medium text-fg-muted">SENİN SONUCUNLA BURADA · olası etki (tanı değildir)</p>
          <ul className="space-y-1.5">
            {shown.map((e) => {
              const st = labStyle(e.lab);
              return (
                <li key={e.lab.testKey} className="text-[12.5px]" data-testid="interior-result-effect" data-test={e.lab.testKey}>
                  <span className={`font-medium ${st.text}`}>
                    {e.lab.name} {e.lab.value.toLocaleString('tr-TR')} {e.lab.unit} {e.dir === 'high' ? '▲' : '▼'}
                  </span>
                  <span className="block text-fg-muted">{e.site.text}</span>
                  {more && <span className="block text-[11.5px] text-fg-faint">{e.effect.summary}</span>}
                  <button type="button" className="text-[11.5px] text-accent hover:underline" onClick={() => go({ name: 'result', key: e.lab.testKey })}>
                    Normalde nasıl · olası nedenler ›
                  </button>
                </li>
              );
            })}
          </ul>
          {!more && effects.length > 2 && (
            <button type="button" className="text-[12px] text-accent" onClick={onMore}>
              +{effects.length - 2} sonuç daha
            </button>
          )}
        </>
      ) : (
        results.anyAbnormal && <p className="text-[11.5px] text-fg-faint">Referans dışı sonuçlarının bu basamağa bilinen doğrudan bir etkisi yok.</p>
      )}
      {more && normal.length > 0 && (
        <details className="text-[12px]" data-testid="interior-normal-here">
          <summary className="cursor-pointer text-fg-muted">Burada normalde ne olur? ({normal.length} değer buradan geçer)</summary>
          <ul className="mt-1 space-y-1">
            {normal.slice(0, 8).map((n) => (
              <li key={n.testKey} className="text-fg-muted">
                <button type="button" className="font-medium text-fg hover:underline" onClick={() => go({ name: 'result', key: n.testKey })}>
                  {n.name}
                </button>{' '}
                <span className="text-fg-faint">(yolun {n.step}/{n.steps}. adımı)</span>: {n.site.text}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!more && normal.length > 0 && effects.length === 0 && (
        <button type="button" className="text-[12px] text-accent" onClick={onMore}>
          Burada normalde ne olur? ({normal.length})
        </button>
      )}
    </div>
  );
}
