/**
 * Ana Ekran (görsel kimlik referansı): merkezde GERÇEK 3B insan anatomisi; solda tahlil analizi, etkilenen
 * organlar ve dosya yükleme; sağda sonuç durumu, analiz özeti ve sistemlere hızlı erişim. Telefonda ayrı
 * düzen: 3B vücut üstte ve büyük, altında dosya durumu, yatay kayan organ kartları ve özet.
 *
 * Organ yolculuğu: organ kartına (ya da 3B'de organa) dokununca organ vurgulanır ve kamera ona yaklaşır;
 * "İncele" keşif ekranında organı açar (organ paneli, kesit, İçine gir), "İçine gir" doğrudan iç dünyaya
 * dalar — mevcut geçişler ve efektler aynen kullanılır.
 *
 * Dürüstlük: hiçbir sağlık puanı, risk ya da yaşam süresi üretilmez. "Sonuç durumu" yalnızca son tahlil
 * sonuçlarının kaçının raporun referans aralığında olduğunu sayar. Veri yoksa örnek veri gösterilmez.
 */
import { type ReactNode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SystemId, structureById, systemById } from '@kh/catalog';
import type { FileInfo } from '@kh/vault';
import { type Route, go, hrefFor } from '../state/router';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { useSetting } from '../state/settings';
import { useHealthModel } from '../lib/analysisBridge';
import { useReports } from '../lib/useReports';
import { bodySummary, headlineOf } from '../lib/summary';
import { groupDocuments } from '../lib/documents';
import { KIND_LABEL } from '../lib/format';
import { TONE } from '../lib/tone';
import { brainFindings } from '../lib/brainReport';
import { interiorForStructure } from '../lib/anatomyNav';
import { type AffectedOrgan, ORGAN_STATUS, type ResultStats, affectedOrgans, organOfStructure, resultStats, useBodyHighlights, useSex } from '../lib/homeData';
import { MENU_SYSTEMS } from '../explore/systems';
import type { BodyModel } from '../anatomy/models';
import { Uploader } from '../components/Uploader';
import { OrganGlyph } from '../components/OrganGlyph';
import type { ViewMode } from '../components/HomeBody';
import { BodyIcon, BrainIcon, CheckIcon, ChevronRightIcon, FileTextIcon, ListIcon, SpinnerIcon, UploadIcon, XIcon, SparkIcon, NetworkIcon, InfoIcon, HeartPulseIcon } from '../components/icons';

const HomeBody = lazy(() => import('../components/HomeBody'));

/** Görünüm modları (3B sahne HomeBody'de; o tembel yüklendiği için adlar burada). */
const MODES: { key: ViewMode; label: string; long: string; color: string }[] = [
  { key: 'full', label: 'Tam Vücut', long: 'Tam Vücut', color: '#4fc3ff' },
  { key: 'skin', label: 'Deri', long: 'Deri', color: '#7fb4e8' },
  { key: 'muscles', label: 'Kas', long: 'Kas Sistemi', color: '#e0606b' },
  { key: 'skeleton', label: 'İskelet', long: 'İskelet Sistemi', color: '#d9d4c7' },
  { key: 'organs', label: 'Organlar', long: 'Organlar', color: '#ef8a7a' },
  { key: 'vessels', label: 'Damar', long: 'Damar Sistemi', color: '#e5606b' },
  { key: 'nerves', label: 'Sinir', long: 'Sinir Sistemi', color: '#e8d25b' },
  { key: 'lymph', label: 'Lenf', long: 'Lenf Sistemi', color: '#6fd3a8' },
];

/** Sistem kısayollarının simgesi. */
const SYSTEM_GLYPH: Partial<Record<SystemId, string>> = {
  digestive: 'stomach',
  cardiovascular: 'heart',
  respiratory: 'lungs',
  urinary: 'kidneys',
  nervous: 'brain',
  endocrine: 'thyroid',
  reproductive: 'blood',
  musculoskeletal: 'bones',
  immune: 'spleen',
};
const SYSTEM_SHORT: Partial<Record<SystemId, string>> = {
  cardiovascular: 'Dolaşım',
  respiratory: 'Solunum',
  digestive: 'Sindirim',
  urinary: 'Üriner',
  endocrine: 'Endokrin',
  nervous: 'Sinir',
  musculoskeletal: 'Kas-iskelet',
  immune: 'Bağışıklık',
  reproductive: 'Üreme',
};

const TONE_CLASS: Record<AffectedOrgan['tone'], string> = { urgent: 'is-urgent', attention: 'is-attention', follow: 'is-follow', uncertain: 'is-uncertain' };

function useWide(): boolean {
  const q = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function Panel({ title, icon, children, className = '', action, id }: { title: string; icon: ReactNode; children: ReactNode; className?: string; action?: ReactNode; id?: string }) {
  return (
    <section className={`kh-panel p-4 ${className}`} aria-labelledby={id}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={id} className="kh-panel-title">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Belge durumu: tahlil okunduysa sonuç sayısı; görüntü/rapor incelendiyse not. Yalnız kasadaki gerçek kayıtlar. */
function useLatestFiles(): { files: FileInfo[] | null } {
  const vault = useUnlockedVault();
  const { revision } = useVault();
  const [files, setFiles] = useState<FileInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    vault.listFiles().then(
      ({ files: list }) => !cancelled && setFiles(list),
      () => !cancelled && setFiles([]),
    );
    return () => {
      cancelled = true;
    };
  }, [vault, revision]);
  return { files };
}

function FileRows({ files, limit }: { files: FileInfo[]; limit: number }) {
  const { reports } = useReports();
  const { studies } = useHealthModel();
  const groups = useMemo(() => groupDocuments([...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).slice(0, limit), [files, limit]);
  return (
    <ul className="space-y-2" data-testid="home-files">
      {groups.map((g) => {
        const rep = reports?.find((r) => r.fileId === g.head.id);
        const study = studies?.find((s) => s.head.id === g.head.id || s.files.some((f) => f.id === g.head.id));
        const seen = !!study && (!!study.note || study.findings.length > 0 || study.sections.length > 0);
        const done = !!rep || seen;
        const status = rep ? `Analiz tamamlandı · ${rep.results.length} sonuç` : seen ? 'Rapor/görüntü incelendi' : 'Henüz okunmadı';
        return (
          <li key={g.key}>
            <a href={hrefFor({ name: 'document', id: g.head.id })} className="kh-inset flex items-center gap-3 px-3 py-2.5 transition hover:border-accent/50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/40 text-accent">
                <FileTextIcon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{g.head.displayName}</span>
                <span className={`flex items-center gap-1 text-xs ${done ? 'text-emerald-400' : 'text-fg-muted'}`}>
                  {done && <CheckIcon size={13} />}
                  {status}
                  {g.files.length > 1 ? ` · ${g.files.length} kesit` : ''}
                  <span className="text-fg-faint"> · {KIND_LABEL[g.head.kind as keyof typeof KIND_LABEL] ?? g.head.kind}</span>
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function OrganCard({ o, active, onClick, compact }: { o: AffectedOrgan; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`kh-organ ${TONE_CLASS[o.tone]} ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`} data-organ={o.organ} data-structure={o.structure ?? ''}>
      <OrganGlyph id={o.organ} size={compact ? 38 : 44} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-semibold text-fg">{o.name}</span>
        <span className="kh-organ-status">
          <i aria-hidden="true" />
          {ORGAN_STATUS[o.tone]}
        </span>
        {!compact && <span className="block truncate text-[11.5px] text-fg-faint">{o.reasons.slice(0, 2).join(' · ')}</span>}
      </span>
      {!compact && <ChevronRightIcon size={18} />}
    </button>
  );
}

/** Referans aralığı göstergesi (yay). Sağlık puanı değildir. */
function RangeGauge({ stats, size = 150 }: { stats: ResultStats; size?: number }) {
  const pct = Math.round((stats.inRange / stats.total) * 100);
  const r = 42;
  const len = Math.PI * r * (240 / 180);
  const dash = (len * pct) / 100;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.86 }} data-testid="range-gauge" data-in-range={stats.inRange} data-total={stats.total}>
      <svg viewBox="0 0 100 86" width={size} height={size * 0.86} aria-hidden="true">
        <defs>
          <linearGradient id="kh-gauge" x1="0" x2="1">
            <stop offset="0" stopColor="#2dd4bf" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path d="M 13.6 71 A 42 42 0 1 1 86.4 71" fill="none" stroke="rgb(90 180 255 / .16)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 13.6 71 A 42 42 0 1 1 86.4 71" fill="none" stroke="url(#kh-gauge)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${len}`} style={{ filter: 'drop-shadow(0 0 4px rgb(34 211 238 / .7))' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="text-[28px] font-bold leading-none tracking-tight text-fg">%{pct}</span>
        <span className="mt-1 text-[11px] text-fg-muted">aralıkta</span>
        <span className="mt-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent-strong">
          {stats.inRange}/{stats.total} sonuç
        </span>
      </div>
    </div>
  );
}

function StatusPanel({ stats, compact }: { stats: ResultStats | null; compact?: boolean }) {
  return (
    <Panel title={compact ? 'Sonuç Durumu' : 'Sonuçların Referans Durumu'} icon={<SparkIcon size={20} />} id="sonuc-durumu">
      {stats ? (
        <div className={compact ? '' : 'grid grid-cols-[150px_1fr] items-center gap-4'}>
          <RangeGauge stats={stats} size={compact ? 130 : 150} />
          {!compact && (
            <ul className="space-y-1.5" data-testid="system-stats">
              {stats.systems.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[13px]">
                  <span className="kh-tile-dot" style={{ ['--kh-accent' as string]: s.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-fg-muted">{s.name}</span>
                  <span className={`font-semibold tabular-nums ${s.inRange === s.total ? 'text-emerald-400' : 'text-high'}`}>
                    {s.inRange}/{s.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">Henüz okunmuş tahlil sonucu yok. Bir tahlil yükleyince sonuçlarının kaçının referans aralığında olduğu burada görünür.</p>
      )}
      <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-fg-faint">
        <InfoIcon size={13} className="mt-px shrink-0" />
        {compact ? 'Sağlık puanı değildir; referans aralığı karşılaştırması.' : 'Sağlık puanı değildir: yalnızca son sonuçlarının raporun referans aralığıyla karşılaştırmasıdır. Tanı, risk ya da yaşam süresi tahmini yapılmaz.'}
      </p>
    </Panel>
  );
}

function SummaryPanel({ items, headline }: { items: Array<{ text: string; tone: keyof typeof TONE; route: Route }>; headline: string }) {
  return (
    <Panel title="Analiz Sonuç Özeti" icon={<ListIcon size={20} />} id="analiz-ozeti">
      <p className="sr-only">Son durum</p>
      {items.length ? (
        <ul className="space-y-2" data-testid="home-summary">
          {items.slice(0, 5).map((it) => (
            <li key={it.text}>
              <button type="button" onClick={() => go(it.route)} className="flex w-full items-start gap-2.5 text-left text-[14px] leading-snug text-fg hover:text-accent-strong">
                <span className={`kh-bullet mt-0.5 ${TONE[it.tone].text}`} aria-hidden="true" />
                <span>{it.text}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">{headline}</p>
      )}
      <a href={hrefFor({ name: 'results' })} className="kh-cta mt-4">
        <FileTextIcon size={17} /> Detaylı Rapor
      </a>
    </Panel>
  );
}

function SystemsPanel({ compact }: { compact?: boolean }) {
  return (
    <Panel title="Hızlı Erişim – Sistemler" icon={<NetworkIcon size={20} />} id="sistemler">
      <ul className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 xl:grid-cols-5'}`}>
        {MENU_SYSTEMS.map((id) => (
          <li key={id}>
            <a href={hrefFor({ name: 'body', system: id })} className="kh-sys" style={{ ['--kh-accent' as string]: systemById.get(id)?.color }} data-system={id}>
              <OrganGlyph id={SYSTEM_GLYPH[id] ?? 'blood'} size={32} />
              <span>{SYSTEM_SHORT[id] ?? systemById.get(id)?.nameTr}</span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Seçili organın eylem çubuğu: İncele (keşif ekranında organ), İçine gir, organ sayfası. */
function OrganActions({ structure, organ, onClose }: { structure: string; organ: AffectedOrgan | undefined; onClose: () => void }) {
  const name = organ?.name ?? structureById.get(structure)?.nameTr ?? structure;
  const inside = interiorForStructure(structure);
  const organId = organ?.organ ?? organOfStructure(structure);
  return (
    <div className="kh-actionbar" data-testid="organ-actions" role="region" aria-label={`${name}: seçili organ`}>
      <OrganGlyph id={organId} size={36} />
      <div className="min-w-0 flex-1 basis-[55%]">
        <p className="truncate text-[15px] font-semibold text-fg">
          {name}
          {organ && <span className={`kh-chip ml-2 ${TONE_CLASS[organ.tone]}`}>{ORGAN_STATUS[organ.tone]}</span>}
        </p>
        <p className="truncate text-xs text-fg-muted">{organ ? organ.reasons.slice(0, 3).join(' · ') : 'Bu organla ilişkili dikkat çeken bir sonucun yok.'}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
        <button type="button" className="btn-primary px-3.5 py-2" onClick={() => go({ name: 'body', structure })} data-action="inspect">
          İncele
        </button>
        {inside && (
          <button type="button" className="btn-ghost px-3.5 py-2" onClick={() => go({ name: 'interior', id: inside.organId })} data-action="enter">
            İçine gir
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Seçimi kaldır, tüm vücuda dön">
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
}

function ModeList({ mode, onMode, vertical }: { mode: ViewMode; onMode: (m: ViewMode) => void; vertical?: boolean }) {
  return (
    <div className={vertical ? 'kh-modes' : 'kh-modes-m'} role="radiogroup" aria-label="Görünüm modları">
      {MODES.map((m) => (
        <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} className={`kh-mode ${mode === m.key ? 'is-active' : ''}`} onClick={() => onMode(m.key)} style={{ ['--kh-accent' as string]: m.color }} data-mode={m.key}>
          <BodyIcon size={vertical ? 20 : 18} />
          <span>{vertical ? m.long : m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function HomePage({ navigate }: { navigate: (r: Route) => void }) {
  const { model, studies } = useHealthModel();
  const { files } = useLatestFiles();
  const sex = useSex();
  const [bodyPref] = useSetting('bodyModel');
  const body: BodyModel = bodyPref === 'auto' ? (sex === 'female' ? 'female' : 'male') : bodyPref;
  const highlights = useBodyHighlights(sex);
  const wide = useWide();
  const [mode, setModeRaw] = useState<ViewMode>('full');
  // Mod değişince seçim kalkar: yeni katman tüm vücutta görünsün.
  const setMode = useCallback((m: ViewMode) => {
    setModeRaw(m);
    setSelected(null);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  // Ana sayfa boş açıldıysa yükleme alanı bu ziyaret boyunca kalır ("Aç ve oku" satırı kaybolmasın).
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);

  const summary = useMemo(() => (model ? bodySummary(model) : null), [model]);
  const affected = useMemo(() => (model && summary ? affectedOrgans(summary, model) : []), [model, summary]);
  const stats = useMemo(() => (model ? resultStats(model) : null), [model]);
  const brain = useMemo(() => (studies ? brainFindings(studies) : []), [studies]);

  // Kasadaki dosya listesi esas alınır (analiz modeli bir an boş görünebilir).
  if (files && startedEmpty === null) setStartedEmpty(files.length === 0);

  const selectedOrgan = selected ? affected.find((o) => o.structure === selected) : undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const pickOrgan = useCallback(
    (o: AffectedOrgan) => {
      if (!o.structure) {
        go({ name: 'organ', id: o.organ, view: 'benim' });
        return;
      }
      setSelected((s) => (s === o.structure ? null : o.structure!));
      // Telefonda kartlar vücudun altında: kameranın organa yaklaşması görünsün diye sahneye kaydırılır.
      if (!wide) stageRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    },
    [wide],
  );

  if (!model || !summary)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Hazırlanıyor…
      </div>
    );

  const hasAny = summary.hasData || (studies?.length ?? 0) > 0 || (files?.length ?? 0) > 0;
  const showUploader = !hasAny || !!startedEmpty;
  const headline = hasAny ? headlineOf(summary) : 'Henüz sağlık verisi eklemedin. İlk verini ekleyerek başlayabilirsin: tahlil, rapor ya da MR, EKG gibi bir görüntü.';

  // Özet maddeleri: kritik sonuçlar, organlar (ilk neden), beyin raporu, takip.
  const items: Array<{ text: string; tone: keyof typeof TONE; route: Route }> = [];
  for (const u of summary.urgent) items.push({ text: `${u.label} (${u.detail ?? ''}) — acil değerlendirme gerektirebilir.`, tone: 'urgent', route: u.route });
  for (const o of affected) items.push({ text: `${o.name}: ${o.reasons.slice(0, 2).join(', ')}.`, tone: o.tone, route: { name: 'organ', id: o.organ, view: 'benim' } });
  const brainFlagged = brain.filter((b) => b.finding.status === 'abnormal' || b.finding.status === 'uncertain');
  if (brainFlagged.length) items.push({ text: `Beyin raporunda ${brainFlagged.length} dikkat çeken cümle — beyin haritasında adım adım.`, tone: 'attention', route: { name: 'brain' } });
  if (!items.length && stats) items.push({ text: `Son ${stats.total} tahlil sonucunun ${stats.inRange} tanesi referans aralığında; dikkat çeken bir organ yok.`, tone: 'normal', route: { name: 'results' } });

  const statusOf = selectedOrgan ? { text: ORGAN_STATUS[selectedOrgan.tone], tone: selectedOrgan.tone } : undefined;
  const bodyView = (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={16} /> 3B anatomi hazırlanıyor…
        </div>
      }
    >
      <HomeBody body={body} mode={mode} highlights={highlights} selected={selected} selectedStatus={statusOf} onSelect={setSelected} compact={!wide} />
    </Suspense>
  );

  const organsPanel = (
    <Panel title={`Etkilenen Organlar (${affected.length})`} icon={<HeartPulseIcon size={20} />} id="etkilenen-organlar">
      {affected.length ? (
        wide ? (
          <ul className="space-y-2" data-testid="affected-organs">
            {affected.slice(0, 8).map((o) => (
              <li key={o.organ}>
                <OrganCard o={o} active={!!o.structure && o.structure === selected} onClick={() => pickOrgan(o)} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1" data-testid="affected-organs">
            {affected.slice(0, 10).map((o) => (
              <li key={o.organ} className="w-[56%] min-w-[168px] max-w-[260px] shrink-0 snap-start">
                <OrganCard o={o} compact active={!!o.structure && o.structure === selected} onClick={() => pickOrgan(o)} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-sm text-fg-muted">{hasAny ? 'Sonuçlarında belirli bir organla ilişkilendirilen dikkat çeken bir bulgu yok.' : 'Bir tahlil ya da rapor yüklediğinde, analizin bir organla ilişkilendirdiği bulgular burada listelenir.'}</p>
      )}
    </Panel>
  );

  const filesPanel = (
    <Panel title="Tahlil Analizi" icon={<UploadIcon size={20} />} id="tahlil-analizi">
      {showUploader ? (
        <Uploader navigate={navigate} />
      ) : files && files.length ? (
        <FileRows files={files} limit={wide ? 3 : 1} />
      ) : (
        <p className="text-sm text-fg-muted">Henüz dosya yok.</p>
      )}
    </Panel>
  );

  const uploadCta = (
    <div>
      <a href={hrefFor({ name: 'add' })} className="kh-cta w-full py-3 text-[16px]">
        <UploadIcon size={19} /> Yeni Dosya Yükle
      </a>
      <p className="mt-2 text-center text-xs text-fg-faint">Desteklenen: PDF, JPG, PNG, DICOM</p>
    </div>
  );

  const actions = selected && <OrganActions structure={selected} organ={selectedOrgan} onClose={() => setSelected(null)} />;

  if (wide)
    return (
      <div className="kh-home grid h-full min-h-[640px] grid-cols-[minmax(290px,340px)_minmax(0,1fr)_minmax(320px,400px)] gap-4 p-4 xl:gap-5 xl:p-5" data-testid="home" data-layout="desktop">
        <h1 className="sr-only">Vücudum nasıl?</h1>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {filesPanel}
          {organsPanel}
          {!showUploader && uploadCta}
        </div>
        <div className="relative flex min-h-0 gap-3">
          <div className="kh-panel hidden shrink-0 self-start p-2 lg:block">
            <p className="px-2 pb-2 pt-1 text-[13px] font-semibold text-fg-muted">Görünüm Modları</p>
            <ModeList mode={mode} onMode={setMode} vertical />
          </div>
          <div className="relative min-h-0 flex-1">
            {bodyView}
            {actions && <div className="absolute inset-x-3 bottom-16 z-10">{actions}</div>}
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pl-1">
          <StatusPanel stats={stats} />
          <SummaryPanel items={items} headline={headline} />
          <SystemsPanel />
        </div>
      </div>
    );

  return (
    <div className="kh-home space-y-3 px-3 pb-6 pt-1" data-testid="home" data-layout="mobile">
      <h1 className="sr-only">Vücudum nasıl?</h1>
      <div ref={stageRef} className="relative h-[62vh] min-h-[400px] max-h-[640px] scroll-mt-2">
        <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2">
          <ModeList mode={mode} onMode={setMode} />
        </div>
        {bodyView}
      </div>
      {actions}
      {showUploader ? (
        filesPanel
      ) : (
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3">
          <Panel title="Tahlil Analizi" icon={<UploadIcon size={18} />} id="tahlil-analizi">
            {files && files.length ? <FileRows files={files} limit={1} /> : <p className="text-sm text-fg-muted">Henüz dosya yok.</p>}
          </Panel>
          <StatusPanel stats={stats} compact />
        </div>
      )}
      {organsPanel}
      <SummaryPanel items={items} headline={headline} />
      <SystemsPanel compact />
      {!showUploader && uploadCta}
      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-fg-faint">
        <BrainIcon size={13} /> Veriler yalnızca bu cihazda, şifreli durur. Kan Haritası tanı koymaz.
      </p>
    </div>
  );
}
