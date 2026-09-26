import { formatNumber, testByKey } from '@kh/catalog';
import { go } from '../../state/router';
import { StatusPill } from '../../components/results';
import type { SeriesMap } from '../BodyPanels';
import { Caps } from '../ui';
import { systemColor } from '../systems';
import { INSIDE_CONTENT } from './content';
import { INSIDE } from './registry';
import { type InsideActions, type InsideState, SPEEDS, STAGE_SECONDS } from './state';

/** Her zaman görünen etiket: bu sahneler kişinin kendi dokusunu göstermez. */
export function SimulationBadge() {
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-full border border-amber-300/40 bg-ink-950/80 px-3 py-1.5 backdrop-blur" role="note">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" aria-hidden="true" />
      <Caps className="text-amber-200">Eğitimsel biyolojik simülasyon</Caps>
    </div>
  );
}

export function InsidePanel({ state, actions, series }: { state: InsideState; actions: InsideActions; series: SeriesMap }) {
  const scene = INSIDE[state.scene];
  const content = INSIDE_CONTENT[state.scene];
  const accent = systemColor(scene.system);
  const stage = content.stages[state.stage]!;
  const obj = state.selected ? content.objects[state.selected] : null;
  const duration = STAGE_SECONDS / state.speed;
  const level = obj ? 'Seviye 6 · Hücre' : state.stage > 0 ? 'Seviye 7 · Süreç' : 'Seviye 5 · Doku';

  return (
    <div>
      <header className="mb-5">
        <Caps className="text-fg-faint">
          <span style={{ color: accent }}>●</span> {level}
        </Caps>
        <h2 className="mt-2 text-[32px] font-light leading-[1.02] tracking-[-0.02em] lg:text-[44px]">{scene.title}</h2>
        <p className="mt-2 text-sm text-fg-muted">{scene.summary}</p>
      </header>

      {obj && (
        <section className="mb-6 border-l-2 pl-4" style={{ borderColor: accent }} aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-light text-fg">{obj.name}</p>
            <button type="button" className="text-xs text-fg-faint hover:text-fg" onClick={() => actions.select(null)}>
              Kapat
            </button>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{obj.text}</p>
          {obj.size && <p className="mt-1.5 text-xs text-fg-faint">Gerçek boyut: {obj.size}</p>}
        </section>
      )}

      <section className="mb-6">
        <div className="flex items-baseline justify-between">
          <Caps className="text-fg-faint">
            Aşama {state.stage + 1}/{content.stages.length}
          </Caps>
          <Caps className="text-fg-faint">{scene.process}</Caps>
        </div>
        <p className="mt-2 text-xl font-light text-fg">{stage.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{stage.text}</p>

        <div className="mt-4 flex gap-1" role="list" aria-label="Aşamalar">
          {content.stages.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="listitem"
              onClick={() => actions.setStage(i)}
              className="group relative h-6 flex-1"
              aria-label={`Aşama ${i + 1}: ${s.title}`}
              aria-current={i === state.stage ? 'step' : undefined}
            >
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-ink-600 group-hover:bg-ink-500">
                {i < state.stage && <span className="absolute inset-0" style={{ background: accent }} />}
                {i === state.stage && (
                  <span
                    key={`${state.stage}-${state.speed}-${state.auto}`}
                    className={`absolute inset-0 origin-left ${state.auto ? 'kh-stage-bar' : ''}`}
                    style={{
                      background: accent,
                      animationDuration: `${duration}s`,
                      animationPlayState: state.playing ? 'running' : 'paused',
                    }}
                    onAnimationEnd={() => state.auto && actions.next()}
                  />
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="icon-btn h-9 w-9 rounded-full border border-ink-600" onClick={actions.prev} aria-label="Önceki aşama" disabled={state.stage === 0}>
            ‹
          </button>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition hover:bg-white/5"
            style={{ borderColor: `${accent}88` }}
            onClick={actions.togglePlay}
            aria-pressed={state.playing}
          >
            {state.playing ? '❚❚ Duraklat' : '▶ Oynat'}
          </button>
          <button
            type="button"
            className="icon-btn h-9 w-9 rounded-full border border-ink-600"
            onClick={actions.next}
            aria-label="Sonraki aşama"
            disabled={state.stage >= content.stages.length - 1}
          >
            ›
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
            Hız
            <select
              className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-fg"
              value={state.speed}
              onChange={(e) => actions.setSpeed(Number(e.target.value))}
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {String(s).replace('.', ',')}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-accent)]" checked={state.auto} onChange={actions.toggleAuto} />
          Aşamaları kendiliğinden ilerlet
        </label>
      </section>

      <section className="mb-6">
        <Caps className="text-fg-faint">Sahnedekiler</Caps>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(content.objects).map(([key, o]) => (
            <button
              key={key}
              type="button"
              onClick={() => actions.select(key)}
              aria-pressed={state.selected === key}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${state.selected === key ? 'text-fg' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
              style={state.selected === key ? { borderColor: accent } : undefined}
            >
              {o.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-fg-faint">Sahnede bir nesneye dokunarak da seçebilirsin. Ölçekler anlaşılır olsun diye değiştirilmiştir.</p>
      </section>

      {content.tests.some((k) => series.has(k)) && (
        <section className="mb-6">
          <Caps className="text-fg-faint">İlgili sonuçların</Caps>
          <ul className="mt-2">
            {content.tests
              .filter((k) => series.has(k))
              .map((k) => {
                const s = series.get(k)!;
                const r = s.latest.result;
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => go({ name: 'result', key: k })}
                      className="flex w-full items-center gap-3 border-b border-ink-700/70 py-2 text-left transition hover:bg-white/[0.03]"
                    >
                      <span className="flex-1 text-sm">{testByKey.get(k)?.nameTr}</span>
                      <span className="text-xs tabular-nums text-fg-muted">
                        {formatNumber(r.canonicalValue ?? r.value, s.test.decimals)} {r.canonicalValue !== null ? s.test.unit : r.unit}
                      </span>
                      <StatusPill status={r.status} />
                    </button>
                  </li>
                );
              })}
          </ul>
          <p className="mt-2 text-[11px] text-fg-faint">Senin verin (tahlil) ile genel biyoloji (bu sahne) ayrıdır: sahne değerine göre değişmez.</p>
        </section>
      )}

      <p className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100/90">
        {content.caution ?? 'Bu sahne EĞİTİMSEL ve temsilidir; senin vücudunun görüntüsü değildir.'}
      </p>
    </div>
  );
}
