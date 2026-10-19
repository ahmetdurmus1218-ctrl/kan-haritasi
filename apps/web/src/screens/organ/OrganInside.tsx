/**
 * "Daha derine in · duvar ve doku" (#/organ/<id>/doku): organdan hücreye, her adım kontrollü — kullanıcı hücreye bir tıkla atlamaz.
 * Bu "İçine gir" DEĞİLDİR: İçine gir organın iç dünyasını (lümen, içerik, akış / parankim) açar (InteriorPage).
 
 *   1. Organın tamamı → 2. iç yapı / duvar → 3. yüzey → 4. villus … → hücre
 * Her adımda: seviye ("Seviye 3 / Doku"), kısa açıklama, aynı seviyedeki diğer yapılar, varsa eğitsel
 * iç sahne (VillusScene, AlveolusScene…) ve kişinin bu yapıyla ilişkili verisi (yaklaşık gösterim).
 * Son adımdan sonra "Daha derine in" süreç ve molekül seviyesine geçer.
 */
import { useState } from 'react';
import { GRAPH, type HealthModel, type KNode, type OrganView, interiorFor } from '@kh/analysis';
import { go } from '../../state/router';
import { insideLinks } from '../../anatomy/organs';
import { INSIDE } from '../../explore/inside/registry';
import { ChevronLeftIcon, ChevronRightIcon, LayersIcon } from '../../components/icons';
import { Breadcrumb, LabRow, LevelBadge, deeperLabel, sceneFor } from './common';

function personalHere(node: KNode, v: OrganView, model: HealthModel | null) {
  const markers = new Set(GRAPH.biomarkersFor(node.id, 3).map((b) => b.testKey).filter(Boolean) as string[]);
  const labs = (model?.latestLabs ?? []).filter((l) => markers.has(l.testKey));
  const obs = [...v.personal.imageObservations.filter((o) => o.location?.path.includes(node.id)), ...v.personal.reportFindings.filter((f) => !f.negated && f.location?.path.includes(node.id))];
  return { labs, obs: obs.length };
}

export function OrganInside({ v, model }: { v: OrganView; model: HealthModel | null }) {
  const path = GRAPH.insidePath(v.node.id);
  const steps: KNode[] = [v.node, ...path];
  const [i, setI] = useState(path.length ? 1 : 0);
  const node = steps[i]!;
  const parent = i > 0 ? steps[i - 1]! : undefined;
  const siblings = parent ? GRAPH.drill(parent.id).filter((d) => d.node.id !== node.id && d.node.kind !== 'function' && d.node.kind !== 'process' && d.node.kind !== 'molecule' && d.node.kind !== 'biomarker') : [];
  const scene = sceneFor(node.id, v.node.structure);
  const scenes = i === 0 && v.node.structure ? insideLinks(v.node.structure).filter((l) => l.id !== 'hucre') : [];
  const mine = personalHere(node, v, model);
  const last = i === steps.length - 1;
  const interior = interiorFor(v.node.id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => go({ name: 'organ', id: v.node.id })}>
          <ChevronLeftIcon size={14} /> {v.node.nameTr}
        </button>
        <Breadcrumb organId={v.node.id} current="Daha derine in · duvar ve doku" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{v.node.nameTr} · duvar ve doku</h1>
        <p className="mt-1 text-sm text-fg-muted">Daha derine in: duvar → doku → hücre, adım adım. Eğitimsel · Temsili anatomi; kişinin kendi dokusunun görüntüsü değildir.</p>
        {interior && (
          <button type="button" className="mt-2 text-sm text-accent hover:underline" onClick={() => go({ name: 'interior', id: interior.organId })} data-testid="doku-back-interior">
            ← Organın iç dünyasına dön (İçine gir · {interior.name})
          </button>
        )}
      </div>

      {/* Adımların haritası: nerede olduğunu her an görürsün */}
      <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="İç yapı adımları">
        {steps.map((s, k) => (
          <li key={s.id} className="flex items-center gap-1">
            {k > 0 && <span className="text-fg-faint">→</span>}
            <button
              type="button"
              aria-current={k === i ? 'step' : undefined}
              className={`min-h-[32px] rounded-full border px-2.5 ${k === i ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
              onClick={() => setI(k)}
            >
              {k === 0 ? 'Organın tamamı' : s.nameTr}
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-3 card p-4" aria-label="Bu adım">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LevelBadge node={node} />
          <span className="text-xs text-fg-faint">
            {i + 1} / {steps.length}
          </span>
        </div>
        <h2 className="text-xl font-semibold">{i === 0 ? `${node.nameTr} (organın tamamı)` : node.nameTr}</h2>
        <p className="text-[15px] leading-relaxed text-fg">{node.summary}</p>
        {siblings.length > 0 && (
          <p className="text-[13px] text-fg-muted">
            Bu seviyede ayrıca:{' '}
            {siblings.map((s, k) => (
              <span key={s.node.id}>
                {k > 0 && ', '}
                <button type="button" className="underline decoration-ink-500 underline-offset-2 hover:text-accent" onClick={() => go({ name: 'organ', id: v.node.id, view: 'derin', trail: [...steps.slice(1, i).map((x) => x.id), s.node.id] })}>
                  {s.node.nameTr}
                </button>
              </span>
            ))}
          </p>
        )}
        {(mine.labs.length > 0 || mine.obs > 0) && (
          <div className="space-y-1.5 rounded-xl border border-ink-600/60 p-3">
            <p className="text-xs font-medium text-fg-muted">Senin verin bu yapıyla ilişkili olabilir (anatomik olarak yaklaşık gösterim):</p>
            {mine.labs.length > 0 && (
              <ul className="space-y-1">
                {mine.labs.slice(0, 3).map((l) => (
                  <LabRow key={l.testKey} l={l} compact />
                ))}
              </ul>
            )}
            {mine.obs > 0 && <p className="text-xs text-fg-muted">{mine.obs} görüntü/rapor gözlemi bu bölgeyle yaklaşık eşleşiyor; kesin konum değildir.</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {scene && (
            <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'simulation', id: scene, from: v.node.structure, mode: 'temel' })}>
              <LayersIcon size={15} /> Doku sahnesi · {INSIDE[scene].title}
            </button>
          )}
          {scenes.map((l) => (
            <button key={l.id} type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'simulation', id: l.id, from: v.node.structure, mode: 'temel' })}>
              Doku sahnesi · {INSIDE[l.id].title}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>
          <ChevronLeftIcon size={15} /> Önceki
        </button>
        {!last ? (
          <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => setI((x) => x + 1)}>
            Bir seviye daha · {deeperLabel(steps[i + 1]!)} <ChevronRightIcon size={15} />
          </button>
        ) : (
          <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'organ', id: v.node.id, view: 'derin', trail: path.map((n) => n.id) })}>
            Daha derine in (süreç ve molekül) <ChevronRightIcon size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
