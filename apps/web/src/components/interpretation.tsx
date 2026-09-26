import { useState } from 'react';
import { CRITICAL_ADVICE, type Finding, type Interpretation, type Pattern, type Severity, SEVERITY_LABEL, structureById, systemById, testByKey } from '@kh/catalog';
import { go } from '../state/router';
import { ORGANS } from '../anatomy/organs';
import { INSIDE } from '../explore/inside/registry';
import { LEVEL_COLOR, LEVEL_LABEL, SEVERITY_COLOR, severityPhrase, sortPatterns } from '../lib/interpretation';
import { AlertIcon, BodyIcon, ChevronRightIcon } from './icons';

/** Kritik düzeydeki sonuçlar: her ekranda en üstte ve açıkça. */
export function CriticalBanner({ critical }: { critical: Finding[] }) {
  if (!critical.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-[#ff5d5d]/50 bg-[#ff5d5d]/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertIcon size={20} className="mt-0.5 shrink-0 text-[#ff7a7a]" />
        <div className="min-w-0">
          <p className="font-semibold text-fg">Acil değerlendirme gerektirebilecek sonuç{critical.length > 1 ? 'lar' : ''}</p>
          <ul className="mt-1.5 space-y-1 text-fg-muted">
            {critical.map((f) => (
              <li key={f.testKey}>{f.headline}</li>
            ))}
          </ul>
          <p className="mt-2 text-fg">{CRITICAL_ADVICE}</p>
          <p className="mt-1.5 text-xs text-fg-faint">Değer okuma hatasıyla yanlış kaydedildiyse (ör. ondalık ayırıcı), önce belgedeki değerle karşılaştır.</p>
        </div>
      </div>
    </div>
  );
}

const ORDER: Severity[] = ['normal', 'borderline', 'mild', 'moderate', 'marked', 'unknown'];

/** Tüm sonuçların derecelere göre dağılımı. */
export function SeverityBar({ interp }: { interp: Interpretation }) {
  const { bySeverity, total } = interp.overall;
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden="true">
        {ORDER.map((s) =>
          bySeverity[s] ? <span key={s} style={{ width: `${(bySeverity[s] / total) * 100}%`, background: SEVERITY_COLOR[s] }} className="h-full" /> : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
        {ORDER.map((s) =>
          bySeverity[s] ? (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
              {SEVERITY_LABEL[s]} <span className="tabular-nums text-fg">{bySeverity[s]}</span>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

export function LevelChip({ level }: { level: Pattern['level'] }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ color: LEVEL_COLOR[level], borderColor: `${LEVEL_COLOR[level]}55`, background: `${LEVEL_COLOR[level]}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function SeverityChip({ finding }: { finding: Pick<Finding, 'severity' | 'status'> }) {
  const c = SEVERITY_COLOR[finding.severity];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ color: c, background: `${c}18` }}>
      {severityPhrase(finding)}
    </span>
  );
}

function sceneTarget(p: Pattern): { scene: NonNullable<Pattern['scene']>; from: string } | null {
  if (!p.scene) return null;
  const from = p.structures.find((s) => ORGANS[s]?.inside === p.scene) ?? p.structures[0];
  return from ? { scene: p.scene, from } : null;
}

/** Birlikte anlam taşıyan sonuçlar için kart. */
export function PatternCard({
  pattern: p,
  compact = false,
  onEnter,
  hideScene,
}: {
  pattern: Pattern;
  compact?: boolean;
  onEnter?: (scene: string, from: string) => void;
  /** İçinde bulunulan sahne: ona tekrar "içeri gir" gösterilmez. */
  hideScene?: string;
}) {
  const [open, setOpen] = useState(false);
  const target = p.scene === hideScene ? null : sceneTarget(p);
  const body = p.structures.find((s) => structureById.get(s)?.asset || structureById.get(s)?.schematic) ?? p.structures[0];
  return (
    <article className="rounded-2xl border bg-ink-850/60 p-4" style={{ borderColor: `${LEVEL_COLOR[p.level]}40` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-fg">{p.title}</h3>
        <LevelChip level={p.level} />
      </div>
      <p className={`mt-2 text-sm leading-relaxed text-fg-muted ${compact && !open ? 'line-clamp-3' : ''}`}>{p.text}</p>
      {p.tests.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.tests.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => go({ name: 'result', key: k })}
              className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg-muted transition hover:border-ink-500 hover:text-fg"
            >
              {testByKey.get(k)?.nameTr.split(' (')[0] ?? k}
            </button>
          ))}
        </div>
      )}
      {(open || !compact) && p.ask && p.ask.length > 0 && (
        <div className="mt-3 rounded-xl bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-fg">Hekimine sorabileceklerin</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-fg-muted">
            {p.ask.map((q) => (
              <li key={q}>— {q}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {body && (
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => go({ name: 'body', structure: body })}>
            <BodyIcon size={14} /> {structureById.get(body)?.nameTr ?? 'Vücutta göster'}
          </button>
        )}
        {target && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => (onEnter ? onEnter(target.scene, target.from) : go({ name: 'simulation', id: target.scene, from: target.from }))}
          >
            İçeri gir · {INSIDE[target.scene].title} <ChevronRightIcon size={14} />
          </button>
        )}
        {compact && (p.text.length > 160 || p.ask?.length) ? (
          <button type="button" className="ml-auto text-xs text-fg-faint hover:text-fg" onClick={() => setOpen((v) => !v)}>
            {open ? 'Daha az' : 'Devamı'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function PatternList({
  patterns,
  compact,
  onEnter,
  empty,
  hideScene,
}: {
  patterns: Pattern[];
  compact?: boolean;
  onEnter?: (scene: string, from: string) => void;
  empty?: string;
  hideScene?: string;
}) {
  if (!patterns.length) return empty ? <p className="text-sm text-fg-faint">{empty}</p> : null;
  return (
    <div className="space-y-3">
      {sortPatterns(patterns).map((p) => (
        <PatternCard key={p.id} pattern={p} compact={compact} onEnter={onEnter} hideScene={hideScene} />
      ))}
    </div>
  );
}

const SYSTEM_STATUS: Record<'ok' | 'attention' | 'urgent', { label: string; color: string }> = {
  ok: { label: 'Aralıkta', color: '#37d6c4' },
  attention: { label: 'Dikkat', color: '#f5b14c' },
  urgent: { label: 'Hızlı değerlendirme', color: '#ff5d5d' },
};

/** Sistem özet kartları (her sistem için ilişkili testler ve durum). */
export function SystemGrid({ interp }: { interp: Interpretation }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {interp.systems.map((s) => {
        const st = SYSTEM_STATUS[s.status === 'none' ? 'ok' : s.status];
        const color = systemById.get(s.system)?.color ?? '#37d6c4';
        return (
          <button
            key={s.system}
            type="button"
            onClick={() => go({ name: 'body', system: s.system })}
            className="rounded-2xl border border-ink-600/60 bg-ink-850/60 p-3.5 text-left transition hover:border-ink-500 hover:bg-ink-800/60"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="flex-1 text-sm font-medium text-fg">{s.name}</span>
              <span className="text-[11px] font-medium" style={{ color: st.color }}>
                {st.label}
              </span>
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-fg-muted">{s.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Tek bir sonucun kişisel yorumu. */
export function FindingBlock({ finding: f, showName = false }: { finding: Finding; showName?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-850/50 p-3.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {showName && (
          <button type="button" className="font-medium text-fg hover:underline" onClick={() => go({ name: 'result', key: f.testKey })}>
            {f.name}
          </button>
        )}
        <SeverityChip finding={f} />
        {f.critical && <span className="rounded-full bg-[#ff5d5d]/15 px-2 py-0.5 text-[11px] font-medium text-[#ff7a7a]">Kritik düzey</span>}
      </div>
      <p className="mt-2 leading-relaxed text-fg">{f.headline}</p>
      {f.detail && <p className="mt-1.5 leading-relaxed text-fg-muted">{f.detail}</p>}
    </div>
  );
}
