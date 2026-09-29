import { PROCESSES, STRUCTURES, TESTS, partsOf, systemById } from '@kh/catalog';
import { MODEL_COVERAGE } from '../anatomy/coverage.generated';
import { FIT_LABEL, insideLinks } from '../anatomy/organs';
import { INSIDE } from '../explore/inside/registry';
import { INSIDE_CONTENT } from '../explore/inside/content';
import { go } from '../state/router';

/**
 * Dürüst kapsam raporu: her yapı için iki vücut modelinde neyin gerçekten bulunduğu. Dış görünüm ve
 * bölüm sayıları üretilmiş model dosyalarından (düğüm adları) gelir; sahne ve süreç bilgisi uygulama
 * verisinden. Hiçbir satır elle "tamam" işaretlenmez.
 */

type Cell = { text: string; tone: 'ok' | 'partial' | 'none' };

function external(id: string, body: 'male' | 'female', schematic?: boolean, approximate?: boolean, sex?: string): Cell {
  if (sex && sex !== body) return { text: '—', tone: 'none' };
  if (schematic) return { text: 'Şematik', tone: 'partial' };
  if (!MODEL_COVERAGE[body][id]) return { text: 'Yok', tone: 'none' };
  if (approximate) return { text: 'Yaklaşık', tone: 'partial' };
  return { text: '3D', tone: 'ok' };
}

const TONE = { ok: 'text-accent', partial: 'text-high', none: 'text-fg-faint' } as const;

export function CoveragePage() {
  const rows = STRUCTURES.filter((s) => s.asset).map((s) => {
    const m = external(s.id, 'male', s.schematic, s.approximate, s.sex);
    const f = external(s.id, 'female', s.schematic, s.approximate, s.sex);
    const partsM = MODEL_COVERAGE.male[s.id]?.length ?? 0;
    const partsF = MODEL_COVERAGE.female[s.id]?.length ?? 0;
    const named = partsOf(s.id).length;
    const links = insideLinks(s.id).filter((x) => x.id !== 'hucre');
    const scenes = links.map((l) => l.id);
    const stages = scenes.reduce((n, x) => n + INSIDE_CONTENT[x].stages.length - 1, 0);
    const own = links.find((l) => l.fit !== 'related');
    // Kendi dokusu: süreç simülasyonu (en iyi), doku atlası (şematik katmanlar), yalnızca ilişkili doku (kısıtlı).
    const depth: Cell = !own
      ? { text: 'Kısıtlı · yalnızca ilişkili doku', tone: 'none' }
      : INSIDE[own.id].kind === 'simulation'
        ? { text: own.fit === 'exact' ? 'Simülasyon' : 'Simülasyon (ortak doku)', tone: 'ok' }
        : { text: own.fit === 'exact' ? 'Doku atlası (şematik)' : 'Doku atlası (ortak)', tone: 'partial' };
    const procs = [...new Set([...(s.processes ?? []), ...TESTS.filter((t) => t.structures.includes(s.id)).flatMap((t) => t.processes)])];
    const tests = TESTS.filter((t) => t.structures.includes(s.id)).length;
    return { s, m, f, partsM, partsF, named, links, scenes, stages, procs, tests, depth };
  });
  const bySystem = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.s.systems[0]!;
    bySystem.set(k, [...(bySystem.get(k) ?? []), r]);
  }
  const total = {
    both: rows.filter((r) => r.m.tone === 'ok' && r.f.tone === 'ok').length,
    schematic: rows.filter((r) => r.m.tone === 'partial' || r.f.tone === 'partial').length,
    withScene: rows.filter((r) => r.depth.tone === 'ok').length,
    atlas: rows.filter((r) => r.depth.tone === 'partial').length,
    limited: rows.filter((r) => r.depth.tone === 'none').length,
    parts: rows.reduce((n, r) => n + Math.max(r.partsM, r.partsF), 0),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-faint">Keşfet · Kapsam raporu</p>
      <h1 className="mt-2 text-3xl font-light tracking-tight">Neyi, ne kadar gösterebiliyoruz?</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
        Her yapı için erkek ve kadın referans vücudunda dış görünüm, modeldeki ayrı bölüm sayısı, içine girilebilen doku/hücre sahneleri ve anlatılan
        süreçler. Dış görünüm ve bölüm sayıları doğrudan model dosyalarından okunur. Doku, hücre ve süreç sahneleri prosedürel ve{' '}
        <strong className="text-fg">temsilidir</strong>: gerçek mikroskopi ya da senin dokunun görüntüsü değildir.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {(
          [
            [total.both, 'yapı iki vücutta da 3D'],
            [total.schematic, 'yapı şematik ya da yaklaşık'],
            [total.parts, 'ayrı bölüm (en çok olan vücutta)'],
            [total.withScene, 'yapıda süreç simülasyonu'],
            [total.atlas, 'yapıda şematik doku atlası'],
            [total.limited, 'yapı yalnızca ilişkili dokuyla'],
          ] as const
        ).map(([n, label]) => (
          <div key={label} className="surface p-4">
            <p className="text-3xl font-light tabular-nums">{n}</p>
            <p className="mt-1 text-xs text-fg-muted">{label}</p>
          </div>
        ))}
      </div>

      {[...bySystem.entries()].map(([sys, list]) => (
        <section key={sys} className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full" style={{ background: systemById.get(sys as never)?.color }} />
            {systemById.get(sys as never)?.nameTr}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-ink-600/60">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-ink-850 text-[11px] uppercase tracking-wider text-fg-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Yapı</th>
                  <th className="px-3 py-2 font-medium">Erkek</th>
                  <th className="px-3 py-2 font-medium">Kadın</th>
                  <th className="px-3 py-2 font-medium">İç bölümler (E / K)</th>
                  <th className="px-3 py-2 font-medium">İç keşif derinliği</th>
                  <th className="px-3 py-2 font-medium">Doku · hücre sahnesi</th>
                  <th className="px-3 py-2 font-medium">Süreç</th>
                  <th className="px-3 py-2 font-medium">Tahlil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/60">
                {list.map((r) => (
                  <tr key={r.s.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <button type="button" className="text-left text-fg hover:underline" onClick={() => go({ name: 'body', structure: r.s.id })}>
                        {r.s.nameTr}
                      </button>
                      {r.s.latin && <span className="block font-mono text-[10.5px] italic text-fg-faint">{r.s.latin}</span>}
                    </td>
                    <td className={`px-3 py-2.5 ${TONE[r.m.tone]}`}>{r.m.text}</td>
                    <td className={`px-3 py-2.5 ${TONE[r.f.tone]}`}>{r.f.text}</td>
                    <td className="px-3 py-2.5 tabular-nums text-fg-muted">
                      {r.s.schematic ? `${r.named} (şematik)` : r.partsM || r.partsF ? `${r.s.sex === 'female' ? '—' : r.partsM} / ${r.s.sex === 'male' ? '—' : r.partsF}` : 'tek parça'}
                    </td>
                    <td className={`px-3 py-2.5 ${TONE[r.depth.tone]}`}>{r.depth.text}</td>
                    <td className="px-3 py-2.5 text-fg-muted">
                      {r.links.length ? (
                        r.links.map((l) => (
                          <span key={l.id} className="block">
                            {INSIDE[l.id].title} <span className="text-[11px] text-fg-faint">· {FIT_LABEL[l.fit]}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-fg-faint">yalnızca genel hücre</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-fg-muted">
                      {r.stages ? `${r.stages} adım` : '—'}
                      {r.procs.length > 0 && <span className="block text-[11px] text-fg-faint">{r.procs.slice(0, 3).map((p) => PROCESSES[p].nameTr).join(', ')}</span>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-fg-muted">{r.tests || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mt-10 space-y-2 text-xs leading-relaxed text-fg-faint">
        <p>
          <strong className="text-fg-muted">Eksikler, açıkça:</strong> tiroid ve kulak açık kaynaklarda modellenmediği için şematik çizilir; kol-bacak damarları ve
          periferik sinirler kemiklere göre yaklaşık yollarla gösterilir. Kadın vücudunda deri, omurga, pelvis ve organlar kadın referans modelinden gelir; iskeletin geri
          kalanı, kaslar, mide, yemek borusu, diyafram, damarlar ve sinirler erkek modelinden benzerlik dönüşümüyle (ortalama sapma ≈ 1,3 cm) uyarlanmıştır. Molekül düzeyi yalnızca sahnelerdeki temsili parçacıklarla
          (ör. LDL, hormon, iyon) anlatılır.
        </p>
        <p>
          <strong className="text-fg-muted">İç keşif derinliği:</strong> "Simülasyon" sahnelerinde süreçler canlandırılır ve bazıları tahlil değerlerine göre değişir.
          "Doku atlası" sahnelerinde katman sırası ve hücre tipleri ders kitabı düzeyinde şematiktir; süreçler basit animasyon ve metinle anlatılır, sonuçlarına göre
          değişmez. "İlişkili doku", yapının kendi dokusu değil işlevce bağlantılı bir dokudur. Diyafram, mide, yemek borusu, epifiz, hipofiz, timus, bademcik ve
          deri 3B modelde tek parçadır (iç bölümleri ayrı seçilemez); paratiroid bezleri modellenmedi.
        </p>
        <p>
          Model kaynakları: HuBMAP İnsan Referans Atlası 3D Nesne Kütüphanesi (CC BY 4.0) ve BodyParts3D (DBCLS, CC BY-SA 2.1 JP). Ayrıntılı atıf ve lisanslar
          Hakkında sayfasında ve <span className="font-mono">models/ATTRIBUTION.txt</span> dosyasında.
        </p>
      </section>
    </div>
  );
}
