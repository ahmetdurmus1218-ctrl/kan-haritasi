/**
 * Bir rapor cümlesinin adım adım anlatımı (her organda aynı): Raporda ne yazıyor → Sade dille → Vücutta
 * nerede → Bu yapı normalde ne yapar → İçine gir → Daha derine in → Hekimine sor. Telefonda tek adım
 * görünür; numaralı düğmelerle ya da Önceki / Sonraki ile gezilir.
 */
import { type ReactNode, useState } from 'react';
import { GRAPH, interiorById } from '@kh/analysis';
import { go } from '../state/router';
import { type SentenceRef, deeperTrail, doctorQuestions, interiorStep, plainReading } from '../lib/reportSteps';
import { doctorNote, shareOrCopy } from '../lib/share';
import { formatDate } from '../lib/format';
import { BodyIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

const SECTION: Record<string, string> = { bulgular: 'Bulgular', sonuc: 'Sonuç', diger: 'Rapor' };
const pathName = (id: string) => GRAPH.node(id)?.nameTr ?? id;

export function ReportSteps({ s, region }: { s: SentenceRef; region?: string }) {
  const [step, setStep] = useState(0);
  const [shared, setShared] = useState<string | null>(null);
  const f = s.finding;
  const plain = plainReading(f);
  const target = s.node ? GRAPH.node(s.node) : undefined;
  const fns = s.node ? GRAPH.functionsOf(s.node).slice(0, 4) : [];
  const at = region ?? s.node;
  const inside = at ? interiorStep(at, s) : null;
  const insideDef = inside ? interiorById(inside.interior) : undefined;
  const insideStage = insideDef?.stages[inside!.stage - 1];
  const deeperStage = inside?.deeperStage ? insideDef?.stages[inside.deeperStage - 1] : undefined;
  const deeper = deeperTrail(s);
  const questions = doctorQuestions(f);
  const brain = s.path.includes('brain');
  const steps: Array<{ title: string; body: ReactNode }> = [
    {
      title: 'Raporda ne yazıyor?',
      body: (
        <>
          <blockquote className="border-l-2 border-ink-500 pl-3 text-[15px] italic text-fg">{f.text}</blockquote>
          <p className="text-xs text-fg-faint">
            {SECTION[f.section] ?? 'Rapor'} bölümü · {s.docName}
            {s.dateKnown ? ` · ${formatDate(s.date)}` : ''} · Kaynak: RAPOR (radyoloğun yazdığı metin)
          </p>
          {s.ocr && (
            <p className="rounded-lg border border-caution/40 bg-caution/[0.06] px-3 py-2 text-sm text-caution-fg" data-testid="ocr-notice">
              Bu cümle kâğıdın fotoğrafından okundu (OCR): bir harf ya da sayı yanlış okunmuş olabilir. Kâğıttaki metinle karşılaştır; özellikle ölçü ve taraf (sağ/sol).
            </p>
          )}
        </>
      ),
    },
    {
      title: 'Sade dille',
      body: (
        <>
          <p className="text-[15px] text-fg">{plain.headline}</p>
          {plain.lines.length > 0 && (
            <ul className="space-y-1.5 text-sm text-fg-muted">
              {plain.lines.map((l, i) => (
                <li key={i}>• {l}</li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      title: brain ? 'Beyinde nerede?' : 'Vücutta nerede?',
      body: (
        <>
          <p className="text-[15px] text-fg">{s.path.length ? s.path.map(pathName).join(' › ') : 'Cümlede bir yer adı yok; konum belirlenemedi.'}</p>
          <ul className="space-y-1 text-sm text-fg-muted">
            {plain.side && <li>• Taraf: {plain.side}</li>}
            {plain.depth && <li>• Katman: {plain.depth.text}</li>}
            {f.level && <li>• Seviye: {f.level}</li>}
            {f.located === 'region' && <li>• Cümlede yer adı yok: belgenin bölgesi kullanıldı (yaklaşık).</li>}
            {s.path.length > 0 && <li>• Konum rapor metninden okundu (yaklaşık); görüntü üzerinde ölçülmedi.</li>}
          </ul>
          {f.structure && (
            <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go(f.part ? { name: 'body', structure: f.structure!, part: f.part } : { name: 'body', structure: f.structure! })}>
              <BodyIcon size={15} /> 3B'de göster
            </button>
          )}
        </>
      ),
    },
    {
      title: brain ? 'Bu bölge normalde ne yapar?' : 'Bu yapı normalde ne yapar?',
      body: target ? (
        <>
          <p className="text-[15px] text-fg">{target.summary}</p>
          {fns.length > 0 && (
            <ul className="space-y-1 text-sm text-fg-muted">
              {fns.map((x) => (
                <li key={x.id}>• {x.nameTr}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fg-faint">Genel anatomi bilgisidir; bu cümlenin bu işlevleri etkileyip etkilemediğini hekimin değerlendirir.</p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Konum belirlenemediği için bu adım boş.</p>
      ),
    },
    {
      title: 'İçine gir',
      body: insideDef ? (
        <>
          <p className="text-[15px] text-fg">
            {insideDef.name} iç dünyasında bu cümle “{insideStage?.title}” basamağında “Benim verim” olarak görünür.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-[44px] px-4 text-sm" data-testid="finding-enter" onClick={() => go({ name: 'interior', id: insideDef.organId, stage: inside!.stage })}>
              İçine gir
            </button>
            {deeperStage && (
              <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'interior', id: insideDef.organId, stage: inside!.deeperStage })}>
                {deeperStage.title}
              </button>
            )}
          </div>
          <p className="text-xs text-fg-faint">İç dünya eğitimsel normal anatomidir; senin görüntün değildir.</p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Bu yapı için iç dünya yok.</p>
      ),
    },
    {
      title: 'Daha derine in',
      body: deeper ? (
        <>
          <p className="text-[15px] text-fg">{deeper.label}</p>
          <p className="text-sm text-fg-muted">Dokusuna, hücresine ve molekülüne seviye seviye in.</p>
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'organ', id: deeper.organ, view: 'derin', trail: deeper.trail })}>
            Derinlemesine incele
          </button>
          <p className="text-xs text-fg-faint">Genel anatomi; “bu hücrede şu var” denmez.</p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Konum belirlenemediği için bu adım boş.</p>
      ),
    },
    {
      title: 'Hekimine sor',
      body: (
        <>
          <ul className="space-y-1.5 text-[15px] text-fg">
            {questions.map((q) => (
              <li key={q}>• {q}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost min-h-[44px] px-3.5 text-sm"
            data-testid="share-sentence"
            onClick={() => void shareOrCopy('Hekimime soracaklarım', doctorNote([s])).then(setShared)}
          >
            Hekime götür: paylaş / kopyala
          </button>
          {shared && <p className="text-xs text-fg-muted" role="status">{shared}</p>}
        </>
      ),
    },
  ];
  const cur = steps[step]!;
  return (
    <div className="space-y-3 border-t border-ink-700 p-4" data-testid="finding-steps" data-step={step + 1}>
      <ol className="flex flex-wrap gap-1.5" aria-label="Adımlar">
        {steps.map((x, i) => (
          <li key={x.title}>
            <button
              type="button"
              aria-current={i === step ? 'step' : undefined}
              aria-label={`${i + 1}. ${x.title}`}
              className={`flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs ${i === step ? 'border-accent bg-accent/10 text-accent' : i < step ? 'border-ink-500 text-fg-muted' : 'border-ink-600 text-fg-faint'}`}
              onClick={() => setStep(i)}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <h3 className="text-[15px] font-semibold text-fg">
        {step + 1}. {cur.title}
      </h3>
      <div className="space-y-2">{cur.body}</div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={step === 0} onClick={() => setStep((x) => x - 1)}>
          <ChevronLeftIcon size={15} /> Önceki
        </button>
        <span className="text-xs text-fg-faint">
          {step + 1} / {steps.length}
        </span>
        <button type="button" className="btn-primary min-h-[44px] px-3 text-sm" disabled={step === steps.length - 1} onClick={() => setStep((x) => x + 1)}>
          Sonraki <ChevronRightIcon size={15} />
        </button>
      </div>
    </div>
  );
}
