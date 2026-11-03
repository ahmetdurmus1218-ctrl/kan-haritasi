import { useMemo, useState } from 'react';
import {
  CONDITION_KIND_TR,
  type CauseRank,
  type Dir,
  type HealthModel,
  type LabObservation,
  type Site,
  conditionById,
  differential,
  dirOf,
  directionEffect,
  interiorById,
  labEffect,
  notMeaningful,
  rankCauses,
} from '@kh/analysis';
import { testByKey } from '@kh/catalog';
import { type Route, go } from '../state/router';
import { labStyle } from '../lib/tone';

/** Bir vücut noktasına giriş: iç dünya + (varsa) basamak numarası (1'den). */
export function siteRoute(site: Site): Route {
  const def = interiorById(site.interior);
  const i = site.stage && def ? def.stages.findIndex((s) => s.id === site.stage) : -1;
  return { name: 'interior', id: site.interior, ...(i >= 0 ? { stage: i + 1 } : {}) };
}

export function siteName(site: Site): string {
  const def = interiorById(site.interior);
  const st = site.stage ? def?.stages.find((s) => s.id === site.stage) : undefined;
  return `${def?.name ?? site.interior}${st ? ` › ${st.title}` : ''}`;
}

const DIR_WORD: Record<Dir, string> = { high: 'yüksek', low: 'düşük' };

function SiteStep({ site, n, tone, testid }: { site: Site; n: number; tone: 'normal' | 'changed'; testid: string }) {
  return (
    <li className="relative pl-7" data-testid={testid}>
      <span className={`absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${tone === 'changed' ? 'bg-caution/20 text-caution-fg' : 'bg-accent/15 text-accent'}`} aria-hidden="true">
        {n}
      </span>
      <p className="text-[13px] font-medium text-fg">{siteName(site)}</p>
      <p className="text-[12.5px] leading-relaxed text-fg-muted">{site.text}</p>
      <button type="button" className="mt-0.5 text-[12px] text-accent hover:underline" onClick={() => go(siteRoute(site))} data-testid="journey-enter">
        İçine gir ›
      </button>
    </li>
  );
}

function ClueLine({ mark, text, cls }: { mark: string; text: string; cls: string }) {
  return (
    <li className={`text-[12px] ${cls}`}>
      <span aria-hidden="true">{mark}</span> {text}
    </li>
  );
}

/** Olası nedenler: kişinin diğer sonuçlarına göre sıralı (uyum çubuğu + ✓ destekleyen / ✗ uymayan / ? eksik). */
export function CauseList({ ranks, limit = 6, testid = 'cause-list' }: { ranks: CauseRank[]; limit?: number; testid?: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? ranks : ranks.slice(0, limit);
  return (
    <div data-testid={testid}>
      <ol className="space-y-2">
        {shown.map((r) => (
          <li key={r.condition.id} className="rounded-xl border border-ink-600/60 p-3" data-testid="cause" data-cause={r.condition.id}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13.5px] font-medium text-fg">{r.condition.name}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10.5px] ${r.condition.kind === 'sample' ? 'border-accent/40 text-accent' : 'border-ink-600 text-fg-faint'}`}>{CONDITION_KIND_TR[r.condition.kind]}</span>
              {r.condition.urgent && <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[10.5px] text-danger">düşünülüyorsa hızlı değerlendirme</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2" aria-label={`Sonuçlarınla uyum ${Math.round(r.fit * 100)}%`}>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.round(r.fit * 100))}%` }} />
              </div>
              <span className="text-[11px] text-fg-faint">sonuçlarınla uyum · {r.summary}</span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{r.condition.text}</p>
            <ul className="mt-1 space-y-0.5">
              {r.supporting.slice(0, 4).map((c, i) => (
                <ClueLine key={`s${i}`} mark="✓" text={c.label} cls="text-fg" />
              ))}
              {r.contradicting.slice(0, 3).map((c, i) => (
                <ClueLine key={`c${i}`} mark="✗" text={c.label} cls="text-caution-fg" />
              ))}
              {r.missing.slice(0, 3).map((c, i) => (
                <ClueLine key={`m${i}`} mark="?" text={`Eksik: ${c.label}`} cls="text-fg-faint" />
              ))}
            </ul>
            {r.condition.workup?.length ? <p className="mt-1 text-[11.5px] text-fg-faint">Netleştirebilecek incelemeler: {r.condition.workup.join(' · ')}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-3">
              {r.condition.organs.slice(0, 3).map((o) => (
                <button key={o} type="button" className="text-[12px] text-accent hover:underline" onClick={() => go({ name: 'interior', id: o })}>
                  {interiorById(o)?.name ?? o} içine gir ›
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {ranks.length > limit && (
        <button type="button" className="mt-2 text-[12.5px] text-accent" onClick={() => setAll((x) => !x)} aria-expanded={all}>
          {all ? 'Daha az göster' : `Tüm olasılıkları göster (${ranks.length})`}
        </button>
      )}
      <p className="mt-2 text-[11px] text-fg-faint">
        Bu bir olasılık listesidir, tanı değildir. Uyum çubuğu yalnızca ölçülmüş sonuçlarının bu durumun tipik tahlil tablosuna ne kadar benzediğini gösterir; hastalık olasılığı değildir. Değerlendirme hekime aittir.
      </p>
    </div>
  );
}

/**
 * Sonuç ayrıntısı · "Vücudundaki yolculuk": bu değer normalde hangi organlardan geçer, senin sonucunla
 * nerede ne değişir (her nokta İçine gir), olası nedenler senin diğer sonuçlarına göre sıralı, belirtiler,
 * ne zaman acil ve hangi testler netleştirir.
 */
export function ResultJourney({ testKey, model, sex }: { testKey: string; model: HealthModel | null; sex?: 'female' | 'male' }) {
  const eff = labEffect(testKey);
  const labs = useMemo(() => model?.latestLabs ?? [], [model]);
  const mine = labs.find((l) => l.testKey === testKey);
  const dir = mine ? dirOf(mine) : null;
  const effect = dir ? directionEffect(testKey, dir) : null;
  const ranks = useMemo(() => (dir && effect ? rankCauses(testKey, dir, labs, sex ? { sex } : {}) : []), [dir, effect, testKey, labs, sex]);
  const [peek, setPeek] = useState<Dir | null>(null);
  if (!eff) return null;
  const name = testByKey.get(testKey)?.nameTr ?? testKey;
  const peekEffect = peek ? directionEffect(testKey, peek) : null;
  const st = mine ? labStyle(mine) : null;
  const labOf = (k: string): LabObservation | undefined => labs.find((l) => l.testKey === k);
  return (
    <section className="card space-y-4 p-4 text-sm" aria-label="Vücudundaki yolculuk" data-testid="result-journey" data-dir={dir ?? 'none'}>
      <div>
        <h2 className="font-semibold text-fg">Vücudundaki yolculuk: normalde nasıl, senin sonucunla nasıl?</h2>
        <p className="mt-1 text-[12.5px] text-fg-muted">{eff.normal.summary}</p>
      </div>

      <div>
        <h3 className="label-caps">Normalde: adım adım (her noktanın içine girilebilir)</h3>
        <ol className="mt-2 space-y-3" data-testid="journey-normal">
          {eff.normal.path.map((s, i) => (
            <SiteStep key={`${s.interior}-${i}`} site={s} n={i + 1} tone="normal" testid="journey-normal-step" />
          ))}
        </ol>
      </div>

      {dir && effect && mine && st && (
        <div className="space-y-3 rounded-2xl border border-caution/30 bg-caution/[0.04] p-3" data-testid="journey-mine">
          <h3 className="label-caps">
            Senin sonucun: <span className={st.text}>{mine.value.toLocaleString('tr-TR')} {mine.unit} · {DIR_WORD[dir]} {dir === 'high' ? '▲' : '▼'}</span>
          </h3>
          <p className="text-[13.5px] font-medium text-fg" data-testid="journey-summary">
            {effect.summary}
          </p>
          <div>
            <h4 className="text-[12px] font-medium text-fg-muted">Vücutta ne oluyor? (genel mekanizma)</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12.5px] text-fg-muted">
              {effect.mechanism.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="text-[12px] font-medium text-fg-muted">Nereyi etkiler? (her nokta "İçine gir" ile açılır, sahne "Sonucuma göre" görünür)</h4>
            <ol className="mt-2 space-y-3" data-testid="journey-sites">
              {effect.sites.map((s, i) => (
                <SiteStep key={`${s.interior}-${i}`} site={s} n={i + 1} tone="changed" testid="journey-site" />
              ))}
            </ol>
          </div>
          {effect.symptoms?.length ? (
            <div>
              <h4 className="text-[12px] font-medium text-fg-muted">Olabilecek belirtiler (olmayabilir de)</h4>
              <p className="text-[12.5px] text-fg-muted">{effect.symptoms.join(' · ')}</p>
            </div>
          ) : null}
          {effect.urgent && (
            <p className="rounded-xl border border-danger/40 bg-danger/[0.06] p-2.5 text-[12.5px] text-danger" role="note" data-testid="journey-urgent">
              Ne zaman acil? {effect.urgent}
            </p>
          )}
          <div>
            <h4 className="text-[12px] font-medium text-fg-muted">Olası nedenler — senin diğer sonuçlarına göre sıralı</h4>
            <div className="mt-2">
              <CauseList ranks={ranks} />
            </div>
          </div>
          {effect.next?.length ? (
            <div data-testid="journey-next">
              <h4 className="text-[12px] font-medium text-fg-muted">Tabloyu netleştiren testler</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {effect.next.map((k) => {
                  const l = labOf(k) ?? labOf(`${k}-abs`);
                  const t = testByKey.get(k) ?? testByKey.get(`${k}-abs`);
                  if (!t) return null;
                  const ls = l ? labStyle(l) : null;
                  return l ? (
                    <button key={k} type="button" className={`rounded-full border border-ink-600 px-2.5 py-1 text-xs hover:border-accent ${ls?.direction ? ls.text : 'text-fg'}`} onClick={() => go({ name: 'result', key: l.testKey })}>
                      {t.nameTr}: {l.value.toLocaleString('tr-TR')} {ls?.direction ? (l.status === 'high' ? '▲' : '▼') : '✓'}
                    </button>
                  ) : (
                    <span key={k} className="rounded-full border border-dashed border-ink-600 px-2.5 py-1 text-xs text-fg-faint">
                      {t.nameTr} · ölçülmemiş
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {dir && !effect && (
        <p className="rounded-xl border border-ink-600/60 p-3 text-[12.5px] text-fg-muted" data-testid="journey-not-meaningful">
          {notMeaningful(testKey, dir)}
        </p>
      )}

      {!dir && (
        <div data-testid="journey-what-if">
          <h3 className="label-caps">Yüksek ya da düşük olsaydı vücutta ne değişirdi?</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['high', 'low'] as const).map((d) => (
              <button key={d} type="button" aria-pressed={peek === d} className={`min-h-[36px] rounded-full border px-3 text-[12.5px] ${peek === d ? 'border-accent text-accent' : 'border-ink-600 text-fg-muted'}`} onClick={() => setPeek(peek === d ? null : d)}>
                {name} {DIR_WORD[d]} olsaydı
              </button>
            ))}
          </div>
          {peek && (peekEffect ? (
            <div className="mt-2 space-y-2">
              <p className="text-[13px] text-fg">{peekEffect.summary}</p>
              <ol className="space-y-3">
                {peekEffect.sites.map((s, i) => (
                  <SiteStep key={`${s.interior}-${i}`} site={s} n={i + 1} tone="changed" testid="journey-site" />
                ))}
              </ol>
              <p className="text-[12px] text-fg-faint">Olası nedenler: {peekEffect.causes.slice(0, 8).map((c) => CAUSE_NAME(c)).join(' · ')}</p>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-fg-muted">{notMeaningful(testKey, peek)}</p>
          ))}
          {mine && <p className="mt-2 text-[12px] text-fg-faint">Senin sonucun aralık içinde; bu bölüm yalnızca eğitim amaçlı "ya şöyle olsaydı" görünümüdür.</p>}
        </div>
      )}
      <p className="text-[11px] text-fg-faint">Genel tıbbi bilgidir; tek bir sonuç tek başına hastalık göstermez. Değerlendirme hekime aittir.</p>
    </section>
  );
}

const CAUSE_NAME = (id: string) => conditionById.get(id)?.name ?? id;

/**
 * Tüm sonuçlara birlikte bakış: en az iki referans dışı sonucun birlikte desteklediği durumlar. Tek tek
 * test sayfalarının göremediği "tablo"yu gösterir (ör. TSH↑ + fT4↓ + kolesterol↑ + CK↑).
 */
export function Differential({ labs, sex }: { labs: readonly LabObservation[]; sex?: 'female' | 'male' }) {
  const ranks = useMemo(() => differential(labs, sex ? { sex } : {}), [labs, sex]);
  const abnormal = labs.filter((l) => dirOf(l)).length;
  if (!abnormal) return null;
  return (
    <section className="card space-y-2 p-4" aria-label="Sonuçlarıma birlikte bak" data-testid="differential">
      <h2 className="font-semibold text-fg">Sonuçlarına birlikte bakınca: uyan olası durumlar</h2>
      <p className="text-[12.5px] text-fg-muted">{abnormal} referans dışı sonucun birlikte değerlendirildi. Her durumun tipik tahlil tablosuyla karşılaştırıldı; en az iki sonucun desteklediği durumlar listelenir.</p>
      {ranks.length ? <CauseList ranks={ranks} limit={4} testid="differential-list" /> : <p className="text-[12.5px] text-fg-muted">Birden çok sonucun birlikte desteklediği belirgin bir tablo bulunmadı. Her sonucun kendi sayfasında olası nedenler ayrı ayrı listelenir.</p>}
    </section>
  );
}
