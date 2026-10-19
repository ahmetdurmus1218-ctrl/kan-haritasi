/**
 * KİŞİSEL ORGAN (#/kisisel/<iç dünya>[/ic]) — gerçek görüntüden kişisel anatomi → İçine gir:
 *
 *   DICOM → hacim → yerel bölütleme modeli → organ maskesi → yüzey (maskeye sadık yumuşatma)
 *     → [GERÇEK VERİ] organ 3B (döndür / yakınlaştır / kesit, komşu yapılar, patoloji maskeleri)
 *     → İçine gir: kamera gerçek mesh'in içine dalar (maskenin en derin noktası; varsa maskenin kapattığı boşluk)
 *     → [ANATOMİK EĞİTİM] organın iç dünyası (lümen / parankim …) → duvar → doku → hücre → molekül
 *
 * Gerçek maske yoksa kişisel 3B varmış gibi gösterilmez: eğitimsel normal anatomiye yönlendirilir.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { GRAPH, interiorArchetype, interiorById, interiorExperience, interiorFor, interiorPersonal, personalInteriorNote, REAL_DATA_TAG, EDUCATIONAL_TAG, spacingLabel } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { SourceBadge } from '../components/SourceBadge';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { listImagingNotes, type StoredVolume } from '../lib/imagingRecords';
import { type PersonalOrganScene, type PersonalPart, buildPersonalOrgan, planFor } from '../lib/personalOrgan';
import { useHealthModel } from '../lib/analysisBridge';
import { colorFor } from '../anatomy/palette';
import { go } from '../state/router';
import { Breadcrumb, LabRow, Section } from './organ/common';
import { ChevronLeftIcon, ChevronRightIcon, LayersIcon, SpinnerIcon } from '../components/icons';

const PersonalOrganDive = lazy(() => import('../components/PersonalOrganDive'));

function useReducedMotion(): boolean {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

export function Tag({ kind }: { kind: 'real' | 'edu' }) {
  return kind === 'real' ? (
    <span className="inline-flex shrink-0 items-center rounded-md border border-[#8b5cf6]/60 bg-[#8b5cf6]/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-fg" data-tag="real">
      ◆ {REAL_DATA_TAG}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-md border border-ink-500 bg-ink-800 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-fg-muted" data-tag="educational">
      {EDUCATIONAL_TAG}
    </span>
  );
}

export function PersonalOrganPage({ id, inside }: { id: string; inside: boolean }) {
  const def = interiorById(id) ?? interiorFor(id);
  const vault = useUnlockedVault();
  const { revision } = useVault();
  const { model } = useHealthModel();
  const reduced = useReducedMotion();
  const [vols, setVols] = useState<{ anatomy: StoredVolume[]; pathology: StoredVolume[] } | null>(null);
  const [scene, setScene] = useState<PersonalOrganScene | null | 'none'>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 1]);
  const [picked, setPicked] = useState<PersonalPart | null>(null);
  const [cut, setCut] = useState(false);
  // Kamera dalışının ilerlemesi (0 = organın dışı, 1 = içi): erişilebilirlik ve uçtan uca testler için DOM'da.
  const [dive, setDive] = useState(0);

  useEffect(() => {
    let alive = true;
    listImagingNotes(vault).then(
      (notes) => alive && setVols({ anatomy: notes.flatMap((n) => (n.volume ? [n.volume] : [])), pathology: notes.flatMap((n) => n.pathology ?? []) }),
      () => alive && setVols({ anatomy: [], pathology: [] }),
    );
    return () => {
      alive = false;
    };
  }, [vault, revision]);

  const found = useMemo(() => (def && vols ? planFor(def, vols.anatomy) : null), [def, vols]);
  useEffect(() => {
    if (!vols || !def) return;
    if (!found) {
      setScene('none');
      return;
    }
    const signal = { cancelled: false };
    setScene(null);
    // Aynı serinin basamaklı patoloji sonuçları (aynı anatomi sonucuna dayanan)
    const path = vols.pathology.filter((p) => p.cascadeFrom?.model === found.volume.model.id && p.cascadeFrom.at === found.volume.at);
    void buildPersonalOrgan(found.volume, found.plan, path, (d, t) => setProgress([d, t]), signal).then((s) => !signal.cancelled && setScene(s ?? 'none'));
    return () => {
      signal.cancelled = true;
    };
  }, [found, vols, def]);

  if (!def)
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-fg-muted">Bu yapı için bir iç dünya tanımı yok.</p>
      </div>
    );

  const anchor = def.anchor && GRAPH.node(def.anchor) ? def.anchor : def.organId;
  const exp = interiorExperience(def);
  const archetype = interiorArchetype(def);
  const ready = scene && scene !== 'none' ? scene : null;
  const note = ready ? personalInteriorNote(archetype, def.name.toLocaleLowerCase('tr-TR'), ready.cavityMl) : null;
  const organColor = def.structure && structureById.has(def.structure) ? colorFor(def.structure, null) : def.interiorScene.color;
  const labs = interiorPersonal(def, model).slice(0, 4);
  const v = ready?.volume;
  const firstStage = exp.inside[0];
  const organParts = ready?.parts.filter((p) => p.role === 'organ') ?? [];
  const findings = ready?.parts.filter((p) => p.role === 'finding') ?? [];
  const docId = v ? v.fileIds[v.structures.find((s) => s.labelId === ready?.plan.target[0])?.centroidSlice ?? 0] : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 md:px-8 md:py-8" data-testid="personal-organ" data-inside={inside ? 'true' : 'false'} data-state={scene === null ? 'loading' : scene === 'none' ? 'none' : 'ready'} data-lumen={note?.lumen ?? ''} data-dive={dive >= 1 ? 'inside' : dive <= 0 ? 'outside' : 'moving'}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => (history.length > 1 ? history.back() : go({ name: 'organ', id: anchor }))} data-testid="personal-organ-back">
          <ChevronLeftIcon size={14} /> Geri
        </button>
        <Breadcrumb
          organId={anchor}
          tail={[
            { label: 'Senin 3B organın', route: inside ? { name: 'personalOrgan', id: def.organId } : undefined },
            ...(inside ? [{ label: 'İçerisi' }] : []),
          ]}
        />
      </div>

      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {def.name}
          <span className="text-fg-muted"> · {inside ? 'içerisi' : 'senin görüntünden'}</span>
        </h1>
      </header>

      {scene === 'none' && (
        <Section title="Kişisel 3B yok">
          <p className="text-sm text-fg" data-testid="personal-organ-none">
            Bu organ için yüklediğin görüntülerde gerçek bir bölütleme maskesi yok. Kişisel 3B organ gösterilmez; senin organın gibi bir model uydurulmaz.
          </p>
          <p className="text-sm text-fg-muted">Bir BT/MR DICOM serisi yükleyip seri analizini (yerel bölütleme modeli) çalıştırırsan organın gerçek 3B yüzeyi burada oluşur.</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Tag kind="edu" />
            <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'interior', id: def.organId })} data-testid="personal-organ-educational">
              <LayersIcon size={15} /> Eğitimsel normal anatomiyle içine gir
            </button>
          </div>
        </Section>
      )}

      {scene === null && (
        <p className="flex items-center gap-2 text-sm text-fg-muted" data-testid="personal-organ-loading">
          <SpinnerIcon size={14} /> Organ yüzeyi senin seri maskenden çıkarılıyor… {progress[0]}/{progress[1]}
        </p>
      )}

      {ready && v && note && (
        <>
          <div className="relative h-[42vh] min-h-[250px] max-h-[460px] overflow-hidden rounded-xl border border-ink-600/60" data-testid="personal-organ-3d">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
                  <SpinnerIcon size={14} /> 3B hazırlanıyor…
                </div>
              }
            >
              <PersonalOrganDive scene={ready} inside={inside} organColor={organColor} structure={def.structure && structureById.has(def.structure) ? def.structure : undefined} reducedMotion={reduced} cut={cut} onPick={setPicked} picked={picked?.key ?? null} onDive={setDive} />
            </Suspense>
            <span className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1 text-[10.5px]">
              <SourceBadge kind="real" label={`${REAL_DATA_TAG} · GERÇEK BT/MR`} detail={inside ? (ready.inside.in === 'cavity' ? 'iç boşluk senin maskenden' : 'iç yüzey senin maskenden') : 'senin görüntünden segmentasyon'} />
              {inside && <SourceBadge kind="educational" label={`Bundan sonrası: ${EDUCATIONAL_TAG.toLocaleLowerCase('tr-TR')}`} />}
            </span>
          </div>
          <p className="text-[11px] text-fg-faint">
            Sürükle: döndür · iki parmak/tekerlek: yakınlaştır · yapıya dokun: seç.{' '}
            {inside ? 'Kamera organın içinde: duvarlar maskenin iç yüzeyi.' : `Gri: komşu bölütlenmiş yapılar (${ready.plan.neighbors.length}).`}
            {findings.length > 0 && ` Kırmızı: patoloji modelinin bulgu maskesi (${findings.length}).`}
          </p>

          {picked && (
            <p className="rounded-lg border border-ink-600/60 px-3 py-2 text-sm" data-testid="personal-organ-picked">
              <span className="font-medium text-fg">{picked.role === 'finding' ? '◆ ' : ''}{picked.name}</span>{' '}
              <span className="text-xs text-fg-muted">
                {picked.volumeMl.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL · {picked.role === 'organ' ? 'bu organ' : picked.role === 'neighbor' ? 'komşu yapı' : picked.role === 'cavity' ? 'maskenin kapattığı boşluk' : 'model bulgusu (tanı değildir)'}
              </span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {!inside ? (
              <>
                <button type="button" className="btn-primary min-h-[48px] flex-1 justify-between px-4 text-[15px]" onClick={() => go({ name: 'personalOrgan', id: def.organId, inside: true })} data-testid="personal-organ-enter">
                  <span className="flex items-center gap-2">
                    <LayersIcon size={16} /> İçine gir
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
                <button type="button" className="btn-ghost min-h-[48px] px-3 text-sm" aria-pressed={cut} onClick={() => setCut((c) => !c)} data-testid="personal-organ-cut">
                  {cut ? 'Kesiti kapat' : 'Kesit aç'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-primary min-h-[48px] flex-1 justify-between px-4 text-left text-[15px]" onClick={() => go({ name: 'interior', id: def.organId })} data-testid="personal-organ-continue">
                  <span className="flex flex-col">
                    <span>Daha içeri: {firstStage?.title ?? 'iç dünya'}</span>
                    <span className="text-[11px] font-normal opacity-80">Eğitimsel normal anatomi — kişisel görüntü değildir</span>
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
                <button type="button" className="btn-ghost min-h-[48px] px-3 text-sm" onClick={() => go({ name: 'personalOrgan', id: def.organId })} data-testid="personal-organ-out">
                  Organa dön
                </button>
              </>
            )}
          </div>

          <div className="space-y-1.5" data-testid="personal-organ-source">
            <p className="flex items-start gap-2 text-sm text-fg">
              <Tag kind="real" />
              <span>{note.real}</span>
            </p>
            {inside && (
              <p className="flex items-start gap-2 text-sm text-fg-muted" data-testid="personal-organ-edu-note">
                <Tag kind="edu" />
                <span>{note.educational}</span>
              </p>
            )}
          </div>

          {inside && (
            <Section title="Buradan sonra: iç dünya (eğitimsel)">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-muted" data-testid="personal-organ-ladder">
                {[...exp.inside, ...exp.deeper].slice(0, 10).map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-fg-faint">→</span>}
                    <button type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-accent hover:text-accent" onClick={() => go({ name: 'interior', id: def.organId, stage: def.stages.indexOf(s) + 1 })}>
                      {s.title}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-fg-faint">Organ geometrisi senin görüntünden; bu basamakların hiçbiri BT/MR’dan görüntülenmez (hücre, doku, molekül görüntüden çıkarılamaz).</p>
            </Section>
          )}

          <Section title="Model ve kaynak">
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[13px]" data-testid="personal-organ-provenance">
              <dt className="text-fg-muted">Model</dt>
              <dd className="text-fg">
                {v.model.name} · {v.model.version}
              </dd>
              <dt className="text-fg-muted">Modalite</dt>
              <dd className="text-fg">{v.modality}</dd>
              <dt className="text-fg-muted">Girdi</dt>
              <dd className="text-fg">Gerçek görüntü · DICOM seri, {v.geometry.slices} kesit</dd>
              <dt className="text-fg-muted">Çıktı</dt>
              <dd className="text-fg">Segmentasyon (voksel maskesi) · {organParts.map((p) => `${p.name} ${p.volumeMl.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL`).join(' · ')}</dd>
              <dt className="text-fg-muted">Güven</dt>
              <dd className="text-fg">Model yapı başına olasılık vermez; maske modelin bölütlemesidir (tanı değildir)</dd>
              <dt className="text-fg-muted">Kaynak</dt>
              <dd className="text-fg">Gerçek görüntü analizi · cihazda (yerel model)</dd>
              <dt className="text-fg-muted">Geometri</dt>
              <dd className="text-fg">
                Izgara {spacingLabel(v.grid.spacing)} (voksel aralığı korunur) · yumuşatma ≤ yarım voksel · {ready.stats.vertices.toLocaleString('tr-TR')} köşe, {ready.stats.triangles.toLocaleString('tr-TR')} üçgen · {ready.stats.ms.toLocaleString('tr-TR')} ms
              </dd>
              <dt className="text-fg-muted">İç nokta</dt>
              <dd className="text-fg">{ready.inside.in === 'cavity' ? `maskenin kapattığı boşluğun en derin noktası (${ready.cavityMl.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL)` : `maskenin en derin noktası (sınıra ${Math.round(ready.inside.depthMm)} mm)`}</dd>
              <dt className="text-fg-muted">Lisans</dt>
              <dd className="text-fg">{v.model.license}</dd>
            </dl>
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {docId && (
                <button type="button" className="text-accent underline" onClick={() => go({ name: 'document', id: docId })} data-testid="personal-organ-slice">
                  Gerçek kesitte göster (2B)
                </button>
              )}
              {def.structure && (
                <button type="button" className="text-accent underline" onClick={() => go({ name: 'body', structure: def.structure })}>
                  Vücut haritasında göster (eğitimsel atlas)
                </button>
              )}
              <button type="button" className="text-accent underline" onClick={() => go({ name: 'organ', id: anchor })}>
                Organ sayfası
              </button>
            </div>
          </Section>

          {labs.length > 0 && (
            <Section title="Benim durumum · bu organla ilişkili sonuçlar" hint="Laboratuvar sonuçları organın genel işleviyle ilişkilidir; 3B yüzeyde bir yere işaret etmez.">
              <ul className="space-y-1.5">
                {labs.map((l) => (
                  <LabRow key={l.testKey} l={l} compact />
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
