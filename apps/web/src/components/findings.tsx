import { useState } from 'react';
import { structureById } from '@kh/catalog';
import { go } from '../state/router';
import { ORGANS, insidesOf } from '../anatomy/organs';
import { INSIDE } from '../explore/inside/registry';
import { type FindingStatus, type ImagingFinding, normalInfo } from '../lib/imagingFindings';
import { BodyIcon } from './icons';

export const FINDING_TONE: Record<FindingStatus, { label: string; cls: string }> = {
  abnormal: { label: 'Dikkat', cls: 'border-high/40 bg-high/10 text-high' },
  uncertain: {
    label: 'Belirsiz',
    cls: 'border-caution/40 bg-caution/10 text-caution-fg',
  },
  normal: { label: 'Olağan', cls: 'border-accent/30 bg-accent/5 text-accent' },
};

const SECTION_LABEL: Partial<Record<ImagingFinding['section'], string>> = { bulgular: 'Bulgular bölümü', sonuc: 'Sonuç bölümü', diger: 'rapor gövdesi' };

const ORDER: Record<FindingStatus, number> = {
  abnormal: 0,
  uncertain: 1,
  normal: 2,
};

/** Bulgunun gideceği 3B yer: yapı ve (modelde varsa) bölüm. */
export function openFinding(f: ImagingFinding) {
  if (!f.structure) return;
  go(f.part ? { name: 'body', structure: f.structure, part: f.part } : { name: 'body', structure: f.structure });
}

function FindingItem({ f }: { f: ImagingFinding }) {
  const [open, setOpen] = useState(false);
  const tone = FINDING_TONE[f.status];
  const s = f.structure ? structureById.get(f.structure) : undefined;
  const normal = f.structure ? (normalInfo(f.structure, f.part) ?? ORGANS[f.structure]?.function) : undefined;
  const inside = f.structure ? insidesOf(f.structure)[0] : undefined;
  const meaning = f.terms.filter((t) => t.key !== 'klinik-korelasyon');
  return (
    <li className="rounded-xl border border-ink-600/60 bg-ink-850/60 p-3">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.cls}`}>{tone.label}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{f.label}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">“{f.text}”</p>
          <p className="mt-1 text-[11px] leading-relaxed text-fg-faint">
            Kaynak: rapor metni · {SECTION_LABEL[f.section] ?? 'rapor'}
            {f.size ? ` · Ölçü: ${f.size}` : ''}
            {f.structure ? (f.located === 'text' ? ' · Konum raporda yazıyor' : ` · Konum yaklaşık: cümlede yer adı yok, belgenin bölgesi (${s?.nameTr ?? ''}) kullanıldı`) : ' · Konum belirlenemedi'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-[3.25rem]">
        {s && (
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => openFinding(f)}>
            <BodyIcon size={13} /> {f.located === 'text' ? 'Vücutta göster' : 'Vücutta göster (yaklaşık)'}
          </button>
        )}
        {inside && f.structure && (
          <button
            type="button"
            className="btn-ghost px-2.5 py-1 text-xs"
            onClick={() =>
              go({
                name: 'simulation',
                id: inside,
                from: f.structure,
                mode: 'temel',
              })
            }
          >
            ↘ İçeri gir · {INSIDE[inside].title}
          </button>
        )}
        {(normal || meaning.length > 0) && (
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Karşılaştırmayı kapat' : 'Normal ile karşılaştır'}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-accent/25 bg-accent/5 p-2.5">
            <p className="label-caps text-accent">Normalde</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{normal ?? 'Bu yapı için kısa açıklama yok.'}</p>
          </div>
          <div className={`rounded-lg border p-2.5 ${f.status === 'normal' ? 'border-accent/25 bg-accent/5' : 'border-caution/30 bg-caution/5'}`}>
            <p className="label-caps">Raporunda</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{f.text}</p>
          </div>
          {meaning.map((t) => (
            <div key={t.key} className="rounded-lg border border-ink-600/60 p-2.5 sm:col-span-2">
              <p className="label-caps">{t.term} · genel anlamı</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{t.meaning}</p>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-fg-faint sm:col-span-2">
            3B model ve iç sahneler normal anatomiyi gösterir; raporundaki bulgunun görüntüsü değildir. Bulgunun sana özel anlamını raporu yazan ve seni takip eden hekim
            değerlendirir.
          </p>
        </div>
      )}
    </li>
  );
}

/** Rapordan çıkarılan bulgular: dikkat ve belirsiz olanlar önce; olağan ifadeler katlanır. */
export function FindingList({ findings }: { findings: ImagingFinding[] }) {
  const [showNormal, setShowNormal] = useState(false);
  const sorted = [...findings].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const flagged = sorted.filter((f) => f.status !== 'normal');
  const normal = sorted.filter((f) => f.status === 'normal');
  return (
    <div className="space-y-2">
      {flagged.length === 0 && (
        <p className="rounded-xl border border-accent/25 bg-accent/5 p-3 text-sm text-fg-muted">Raporda dikkat çeken bir bulgu cümlesi bulunmadı; yazılanlar olağan ifadeler.</p>
      )}
      <ul className="space-y-2">
        {flagged.map((f, i) => (
          <FindingItem key={`${f.text}-${i}`} f={f} />
        ))}
      </ul>
      {normal.length > 0 && (
        <>
          <button type="button" className="text-xs text-accent underline-offset-4 hover:underline" onClick={() => setShowNormal((v) => !v)} aria-expanded={showNormal}>
            {showNormal ? 'Olağan ifadeleri gizle' : `${normal.length} olağan ifadeyi göster`}
          </button>
          {showNormal && (
            <ul className="space-y-2">
              {normal.map((f, i) => (
                <FindingItem key={`${f.text}-${i}`} f={f} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
