import { SEVERITY_WEIGHT, formatNumber, testByKey } from '@kh/catalog';
import { go } from '../../state/router';
import { PatternList, SeverityChip } from '../../components/interpretation';
import { Caps } from '../ui';
import { systemColor } from '../systems';
import { INSIDE_CONTENT } from './content';
import { INSIDE, type InsideId } from './registry';
import { FIT_LABEL, insideFit, insideLinks } from '../../anatomy/organs';
import { structureById } from '@kh/catalog';
import type { ScenePersonal } from './personal';
import { type InsideActions, type InsideState, SPEEDS, STAGE_SECONDS } from './state';

/** Her zaman görünen etiket: bu sahneler kişinin kendi dokusunu göstermez. */
export function SimulationBadge({ scene }: { scene?: InsideId }) {
  const atlas = scene && INSIDE[scene].kind === 'atlas';
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-full border border-caution/40 bg-ink-950/80 px-3 py-1.5 backdrop-blur" role="note">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-caution" aria-hidden="true" />
      <Caps className="text-caution-fg">{atlas ? 'Doku atlası · şematik' : 'Eğitimsel biyolojik simülasyon'}</Caps>
    </div>
  );
}

export function InsidePanel({ state, actions, personal, origin }: { state: InsideState; actions: InsideActions; personal: ScenePersonal; origin?: string }) {
  const scene = INSIDE[state.scene];
  const atlas = scene.kind === 'atlas';
  const fit = insideFit(origin, state.scene);
  const originName = origin ? structureById.get(origin)?.nameTr : undefined;
  const own = origin ? insideLinks(origin).find((l) => l.fit === 'exact' && l.id !== state.scene) : undefined;
  const content = INSIDE_CONTENT[state.scene];
  const accent = systemColor(scene.system);
  const stage = content.stages[state.stage]!;
  const obj = state.selected ? content.objects[state.selected] : null;
  const duration = STAGE_SECONDS / state.speed;
  const level = obj ? 'Seviye 6 · Hücre' : state.process && state.stage > 0 ? 'Seviye 7 · Süreç' : 'Seviye 5 · Doku';
  const lines = [...personal.lines].sort(
    (a, b) => Number(b.finding.critical) - Number(a.finding.critical) || SEVERITY_WEIGHT[b.finding.severity] - SEVERITY_WEIGHT[a.finding.severity],
  );
  const knobs = lines.filter((l) => l.param);
  const mine = state.view === 'mine';

  return (
    <div>
      <header className="mb-5">
        <Caps className="text-fg-faint">
          <span style={{ color: accent }}>●</span> {level}
        </Caps>
        <h2 className="mt-2 text-[32px] font-light leading-[1.02] tracking-[-0.02em] lg:text-[44px]">{scene.title}</h2>
        <p className="mt-2 text-sm text-fg-muted">{scene.summary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-fg-muted">
            {atlas ? 'Doku atlası · katmanlar şematik, süreçler basit animasyon + metin' : 'Simülasyon · süreçler canlandırılır'}
          </span>
          {fit && originName && (
            <span className={`rounded-full border px-2 py-0.5 ${fit === 'related' ? 'border-caution/40 text-caution-fg' : 'border-ink-600 text-fg-muted'}`}>
              {originName}: {FIT_LABEL[fit]}
            </span>
          )}
        </div>
        {fit === 'related' && originName && (
          <p className="mt-2 rounded-xl border border-caution/25 bg-caution/[0.06] p-2.5 text-xs leading-relaxed text-caution-fg">
            Bu sahne {originName.toLocaleLowerCase('tr')} dokusunun kendisi değil; işlevce bağlantılı bir dokudur.
            {own && (
              <>
                {' '}
                Kendi dokusu için:{' '}
                <button type="button" className="underline underline-offset-2" onClick={() => go({ name: 'simulation', id: own.id, from: origin })}>
                  {INSIDE[own.id].title}
                </button>
              </>
            )}
          </p>
        )}
      </header>

      {/* İki ana soru: organ temelde nasıl çalışır / benim sonucuma göre nasıl çalışır */}
      <div className="mb-6 grid grid-cols-2 gap-2" role="group" aria-label="Nasıl çalıştığını göster">
        {(
          [
            ['typical', 'Temelde nasıl çalışır', 'tipik değerlerle'],
            ['mine', 'Sonucuma göre', lines.length ? `${lines.length} sonucunla` : 'sonucun yok · tipik'],
          ] as const
        ).map(([v, label, sub]) => {
          const on = state.process && state.view === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => {
                actions.setView(v);
                if (!state.process) actions.startProcess();
              }}
              className={`kh-holo-btn rounded-2xl border px-3 py-2.5 text-left transition ${on ? 'text-fg' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
              style={on ? { borderColor: accent, background: `${accent}2e`, boxShadow: `0 0 18px -6px ${accent}` } : undefined}
            >
              <span className="block text-sm">
                {v === 'typical' ? '◎ ' : '◉ '}
                {label}
                {on && <span className="sr-only"> (açık)</span>}
              </span>
              <span className="mt-0.5 block text-[11px] text-fg-faint">{sub}</span>
            </button>
          );
        })}
      </div>

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

      <section className="mb-7" aria-labelledby="senin-durumun">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Caps className="text-fg-faint">
            <span id="senin-durumun">Senin durumun</span>
          </Caps>
        </div>
        {lines.length > 0 ? (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
              {knobs.length === 0
                ? 'Bu sahneyle ilişkili sonuçların aşağıda; sahne bu değerlere göre değişmiyor.'
                : mine
                  ? 'Sahne şu an senin son sonuçlarına göre çiziliyor:'
                  : 'Sahne şu an tipik (referans aralığının ortası) değerlerle çiziliyor. Farkı görmek için “Sonucuma göre”ye geç.'}
            </p>
            <ul className="mt-2 divide-y divide-ink-700/70">
              {lines.map((l) => (
                <li key={l.finding.testKey} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:underline" onClick={() => go({ name: 'result', key: l.finding.testKey })}>
                      {l.finding.name}
                    </button>
                    <span className="text-xs tabular-nums text-fg-muted">
                      {formatNumber(l.finding.value, 2).replace(/,00$/, '')} {l.finding.unit}
                    </span>
                    <SeverityChip finding={l.finding} />
                  </div>
                  {l.effect && (
                    <p className={`mt-1 text-xs leading-relaxed ${mine ? 'text-fg-muted' : 'text-fg-faint'}`}>
                      <span style={{ color: mine ? accent : undefined }}>{mine ? 'Sahnede · ' : 'Senin değerinle · '}</span>
                      {l.effect}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {personal.patterns.length > 0 && (
              <div className="mt-4">
                <PatternList patterns={personal.patterns} compact hideScene={state.scene} />
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-fg-muted">
            <p>Bu sahneyle ilişkili onaylı sonucun yok; sahne tipik değerlerle gösteriliyor.</p>
            {personal.missing.length > 0 && (
              <p className="text-xs text-fg-faint">
                Sonucun olursa sahneye yansıyacak testler: {personal.missing.map((k) => INSIDE_TEST_NAME(k)).join(', ')}.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <Caps className="text-fg-faint">Nasıl çalışır? · genel biyoloji</Caps>
          {state.process && (
            <button type="button" className="text-xs text-fg-faint hover:text-fg" onClick={actions.closeProcess}>
              Süreci kapat
            </button>
          )}
        </div>
        {!state.process ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{content.stages[0]!.text}</p>
            <button
              type="button"
              onClick={actions.startProcess}
              className="mt-3 flex w-full items-center justify-between rounded-full border px-4 py-2.5 text-left text-sm transition hover:bg-white/5"
              style={{ borderColor: `${accent}66` }}
            >
              <span>
                Süreci adım adım izle <span className="text-fg-faint">· {scene.process}</span>
              </span>
              <span style={{ color: accent }}>▶</span>
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
              Süreç, genel biyolojiyi {content.stages.length - 1} adımda anlatır; senin vücudunda bu sürecin olduğunu göstermez.
            </p>
          </>
        ) : (
          <>
            <div className="mt-2 flex items-baseline justify-between">
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
          </>
        )}
      </section>

      <section className="mb-6">
        <Caps className="text-fg-faint">{atlas ? 'Katmanlar · içten dışa' : 'Sahnedekiler'}</Caps>
        <div className={atlas ? 'mt-2 flex flex-col items-start gap-1' : 'mt-2 flex flex-wrap gap-1.5'}>
          {Object.entries(content.objects).map(([key, o]) => (
            <button
              key={key}
              type="button"
              onClick={() => actions.select(key)}
              aria-pressed={state.selected === key}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${state.selected === key ? 'text-fg' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
              style={state.selected === key ? { borderColor: accent } : undefined}
            >
              {atlas && <span className="mr-1.5 tabular-nums text-fg-faint">{Object.keys(content.objects).indexOf(key) + 1}.</span>}
              {o.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-fg-faint">Sahnede bir nesneye dokunarak da seçebilirsin. Ölçekler anlaşılır olsun diye değiştirilmiştir.</p>
      </section>

      <p className="rounded-xl border border-caution/25 bg-caution/[0.06] p-3 text-xs leading-relaxed text-caution-fg">
        {content.caution ?? 'Bu sahne EĞİTİMSEL ve temsilidir; senin vücudunun görüntüsü değildir.'}{' '}
        {knobs.length > 0
          ? 'Sahnedeki yoğunluklar senin değerlerinden türetilen temsili oranlardır; gerçek hücre sayısı ya da doku görüntüsü değildir.'
          : 'Bu sahne sonuçlarına göre değişmez; ilişkili sonuçların yalnızca listelenir.'}
      </p>
    </div>
  );
}

function INSIDE_TEST_NAME(key: string): string {
  return testByKey.get(key)?.nameTr.split(' (')[0] ?? key;
}
