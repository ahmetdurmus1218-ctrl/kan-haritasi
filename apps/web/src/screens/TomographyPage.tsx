/**
 * Tomografi görünümü (#/tomografi[/organ]): GERÇEK bir BT taramasının hacim görüntülemesi — kalp tomografisi
 * gibi. Önayarlar (sinematik anjiyo, organlar, kemik, akciğer, MIP, klasik gri), organ seçip yalıtma (diğer
 * dokular soluk), kesme düzlemleri (üstten / önden / yandan açma), 2B kesit ve dokunarak organ tanıma.
 * Seçilen organdan İçine gir, organ sayfası ve "sonucuma göre" geçişleri.
 *
 * Kaynak açıkça yazılır: anonim, gerçek bir yetişkin taraması (CC BY 4.0); kullanıcının vücudu değildir.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GRAPH, effectsAtInterior, interiorFor } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type Route, go, hrefFor } from '../state/router';
import { readAppAsset } from '../lib/appAssets';
import { useHealthModel } from '../lib/analysisBridge';
import { labStyle } from '../lib/tone';
import { SpinnerIcon } from '../components/icons';
import {
  type Atlas,
  type AtlasFamily,
  type PresetId,
  GROUP_TR,
  PRESETS,
  families,
  labelBounds,
  labelLut,
  loadAtlas,
  pick,
  presetById,
  transferLut,
  u8ToHu,
} from '../tomography/atlas';
import { type VolumeLook, VolumeView, rayInVolume } from '../tomography/VolumeView';

const SIZE = 2;
const keyToUrl = (k: string) => k.replace(/_/g, '-');
/** Seçimi adres çubuğuna yazar (geçmişe yeni giriş eklemeden; sayfa yeniden kurulmaz). */
const replaceRoute = (r: Route) => history.replaceState(null, '', hrefFor(r));
const urlToKey = (k: string) => k.replace(/-/g, '_');

function useAtlas() {
  const [state, setState] = useState<{ atlas?: Atlas; error?: string; progress: number }>({ progress: 0 });
  useEffect(() => {
    let alive = true;
    loadAtlas(readAppAsset, (d, t) => alive && setState((s) => ({ ...s, progress: d / t }))).then(
      (atlas) => alive && setState({ atlas, progress: 1 }),
      (e: unknown) => alive && setState({ error: e instanceof Error ? e.message : 'Atlas yüklenemedi.', progress: 0 }),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

function webgl2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/** Kamerayı seçili organın merkezine yönelt. */
function FocusCamera({ target, radius }: { target: [number, number, number] | null; radius: number }) {
  const controls = useThree((s) => s.controls) as unknown as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!controls) return;
    const [x, y, z] = target ?? [0, 0, 0];
    controls.target.set(x, y, z);
    const dist = target ? Math.max(0.6, radius * 3.4) : 4.4;
    camera.position.set(x, y + dist * 0.15, z + dist);
    controls.update();
    invalidate();
  }, [controls, camera, target, radius, invalidate]);
  return null;
}

export function TomographyPage({ organ }: { organ?: string | undefined }) {
  const { atlas, error, progress } = useAtlas();
  const [preset, setPreset] = useState<PresetId>('cinematic');
  const [selected, setSelected] = useState<AtlasFamily | null>(null);
  const [cut, setCut] = useState({ top: 1, front: 1, side: 1 });
  const [moving, setMoving] = useState(false);
  const [slice, setSlice] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const { model } = useHealthModel();
  const supported = useMemo(webgl2, []);
  const fams = useMemo(() => (atlas ? families(atlas.manifest.labels) : []), [atlas]);
  const byId = useMemo(() => new Map(atlas?.manifest.labels.map((l) => [l.id, l]) ?? []), [atlas]);

  // Adres çubuğundaki organ (ör. #/tomografi/heart) açılışta seçilir
  useEffect(() => {
    if (!atlas || !organ) return;
    const key = urlToKey(organ);
    const f = fams.find((x) => x.ids.some((id) => byId.get(id)?.key === key)) ?? fams.find((x) => x.structure === organ || x.node === organ);
    if (f) setSelected(f);
  }, [atlas, organ, fams, byId]);

  const p = presetById(preset);
  // Önayarın gizlediği bir gruptan organ seçilirse (ör. "Kemikler"de kalp), organ görünsün diye sinematiğe geçilir.
  useEffect(() => {
    if (selected && presetById(preset).hide?.includes(selected.group)) setPreset('cinematic');
  }, [selected, preset]);
  const sel = useMemo(() => (selected ? new Set(selected.ids) : undefined), [selected]);
  const look = useMemo<VolumeLook | null>(() => {
    if (!atlas) return null;
    const map = atlas.manifest.huMap;
    const toU8 = (hu: number) => {
      for (let v = 0; v < 256; v++) if (u8ToHu(v, map) >= hu) return v / 255;
      return 1;
    };
    return {
      tf: transferLut(p, map),
      lab: labelLut(atlas.manifest.labels, p, sel),
      labelMix: sel ? Math.max(p.labelMix, 0.35) : p.labelMix,
      mode: p.mode,
      mip: p.mip ? [toU8(p.mip[0]), toU8(p.mip[1])] : [0, 1],
      // Kesim: üstten (S), önden (A), yandan (R; hastanın solundan)
      clipMin: [0, 0, 0],
      clipMax: [cut.side, cut.front, cut.top],
      ghost: sel ? 0.035 : 0.05,
      step: moving ? 1.6 : 0.8,
    };
  }, [atlas, p, sel, cut, moving]);

  const focus = useMemo(() => {
    if (!atlas || !sel) return { target: null as [number, number, number] | null, radius: 1 };
    const b = labelBounds(atlas, sel);
    if (!b) return { target: null, radius: 1 };
    const max = Math.max(...atlas.manifest.shape);
    const [W, H, D] = atlas.manifest.shape;
    // doku → sahne (VolumeView ile aynı eşleme)
    const target: [number, number, number] = [-(b.center[0] - 0.5) * (W / max) * SIZE, (b.center[2] - 0.5) * (D / max) * SIZE, (b.center[1] - 0.5) * (H / max) * SIZE];
    return { target, radius: b.radius * SIZE };
  }, [atlas, sel]);

  const onPick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!atlas || !look || p.mode === 'mip') return;
      e.stopPropagation();
      const r = rayInVolume([e.pointer.x, e.pointer.y], e.camera as never, atlas.manifest.shape, SIZE);
      const hit = pick(atlas, look.tf, look.lab, r.origin, r.dir, { min: look.clipMin, max: look.clipMax }, look.ghost);
      const l = hit && hit.label ? byId.get(hit.label) : undefined;
      if (!l) {
        setHover(hit ? `Etiketsiz doku · ${hit.hu} HU` : null);
        return;
      }
      const f = fams.find((x) => x.ids.includes(l.id));
      if (f) {
        setSelected(f);
        replaceRoute({ name: 'tomography', organ: keyToUrl(l.key) });
      }
      setHover(`${l.finding} · ${hit!.hu} HU`);
    },
    [atlas, look, p.mode, byId, fams],
  );

  if (!supported)
    return (
      <div className="p-6 text-sm text-fg-muted" data-testid="tomography" data-state="no-webgl2">
        Tomografi görünümü için WebGL2 gerekir; bu cihaz desteklemiyor. 3B vücut keşfi yine kullanılabilir.
      </div>
    );

  const interior = selected ? interiorFor(selected.structure ?? selected.node ?? '') : undefined;
  const organNode = selected?.node && GRAPH.node(selected.node) ? selected.node : selected?.structure && GRAPH.node(selected.structure) ? selected.structure : undefined;
  const fx = interior && model ? effectsAtInterior(interior.organId, undefined, model.latestLabs) : [];
  const grouped = new Map<string, AtlasFamily[]>();
  for (const f of fams) grouped.set(GROUP_TR[f.group], [...(grouped.get(GROUP_TR[f.group]) ?? []), f]);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#05070a] lg:flex-row" data-testid="tomography" data-state={atlas ? 'ready' : error ? 'error' : 'loading'} data-preset={preset} data-selected={selected?.name ?? ''}>
      <div className="relative min-h-[46vh] flex-1">
        {atlas && look ? (
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [0, 0.4, 4.4], fov: 35, near: 0.01, far: 50 }}
            gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => gl.setClearColor('#05070a')}
            data-testid="tomography-canvas"
          >
            <group onClick={onPick}>
              <VolumeView atlas={atlas} look={look} size={SIZE} />
            </group>
            <OrbitControls makeDefault enableDamping={false} onStart={() => setMoving(true)} onEnd={() => setMoving(false)} minDistance={0.3} maxDistance={8} />
            <FocusCamera target={focus.target} radius={focus.radius} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted" role="status">
            {error ? (
              <span className="text-danger">{error}</span>
            ) : (
              <>
                <SpinnerIcon size={16} /> Gerçek BT hacmi açılıyor… %{Math.round(progress * 100)}
              </>
            )}
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-xl bg-black/55 px-3 py-2 text-[11px] leading-snug text-white/85 backdrop-blur">
          <span className="font-semibold text-white">Gerçek BT · 3B hacim</span> — anonim bir yetişkin taraması (CC BY 4.0). Senin vücudun değildir; tanı amaçlı değildir.
          {hover && <span className="mt-1 block text-accent" data-testid="tomography-hover">{hover}</span>}
        </div>
        {atlas && slice && <SlicePanel atlas={atlas} z={Math.round(cut.top * (atlas.manifest.shape[2] - 1))} sel={sel} onPick={(id) => {
          const f = fams.find((x) => x.ids.includes(id));
          if (f) setSelected(f);
        }} />}
      </div>

      <aside className="max-h-[54vh] overflow-y-auto border-t border-ink-700 bg-ink-950/95 p-4 text-sm lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0" aria-label="Tomografi denetimleri">
        <h1 className="text-lg font-semibold text-fg">Tomografi görünümü</h1>
        <p className="mt-1 text-[12.5px] text-fg-muted">Gerçek BT yoğunluklarından hacim görüntüleme. Döndür, yakınlaştır, organa dokun; kesme kaydırıcılarıyla vücudu aç.</p>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Görünüm önayarı">
          {PRESETS.map((x) => (
            <button key={x.id} type="button" aria-pressed={preset === x.id} data-testid="tomo-preset" data-preset={x.id} onClick={() => setPreset(x.id)} className={`min-h-[36px] rounded-full border px-3 text-[12px] ${preset === x.id ? 'border-accent bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted'}`}>
              {x.name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-fg-faint">{p.text}</p>

        <div className="mt-4 space-y-2">
          {(
            [
              ['top', 'Üstten aç (eksenel kesit)'],
              ['front', 'Önden aç (koronal kesit)'],
              ['side', 'Yandan aç (sagital kesit)'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block text-[12px] text-fg-muted">
              {label}
              <input type="range" min={0.05} max={1} step={0.01} value={cut[k]} onChange={(e) => setCut((c) => ({ ...c, [k]: Number(e.target.value) }))} className="mt-1 w-full accent-[var(--color-accent)]" data-testid={`tomo-cut-${k}`} />
            </label>
          ))}
          <button type="button" className="text-[12px] text-accent" onClick={() => setSlice((x) => !x)} aria-pressed={slice} data-testid="tomo-slice-toggle">
            {slice ? '2B kesiti gizle' : '2B kesiti göster (üst kesim düzeyinde)'}
          </button>
        </div>

        {selected && (
          <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/[0.05] p-3" data-testid="tomo-selected">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-caps">{GROUP_TR[selected.group]}</p>
                <p className="text-[15px] font-semibold text-fg">{selected.name}</p>
                <p className="text-[11.5px] text-fg-faint">Bu taramada ~{selected.ml.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} mL (bölütleme modelinden; normal değer değildir)</p>
              </div>
              <button type="button" className="text-[12px] text-fg-muted" onClick={() => (setSelected(null), replaceRoute({ name: 'tomography' }))}>
                Tüm vücut
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {interior && (
                <button type="button" className="btn-primary min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'interior', id: interior.organId })} data-testid="tomo-enter">
                  İçine gir
                </button>
              )}
              {organNode && (
                <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'organ', id: organNode })}>
                  Organ sayfası
                </button>
              )}
              {selected.structure && structureById.has(selected.structure) && (
                <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'body', structure: selected.structure! })}>
                  3B atlasta
                </button>
              )}
            </div>
            {fx.length > 0 && (
              <div className="mt-2 space-y-1" data-testid="tomo-results">
                <p className="text-[11px] font-medium text-fg-muted">SENİN SONUÇLARIN · bu organla olası ilişki (tanı değildir)</p>
                {fx.slice(0, 3).map((e) => (
                  <button key={e.lab.testKey} type="button" className="block text-left text-[12px] hover:underline" onClick={() => go({ name: 'result', key: e.lab.testKey })}>
                    <span className={labStyle(e.lab).text}>
                      {e.lab.name} {e.dir === 'high' ? '▲' : '▼'}
                    </span>{' '}
                    <span className="text-fg-muted">{e.site.text}</span>
                  </button>
                ))}
                {interior && (
                  <button type="button" className="text-[12px] text-accent" onClick={() => go({ name: 'interior', id: interior.organId })}>
                    İçeride "Sonucuma göre" gör ›
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <details className="mt-4" open={!selected}>
          <summary className="cursor-pointer text-[12.5px] font-medium text-fg">Organ seç ve yalıt ({fams.length})</summary>
          <div className="mt-2 space-y-2">
            {[...grouped.entries()].map(([g, list]) => (
              <div key={g}>
                <p className="label-caps">{g}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {list.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      data-testid="tomo-organ"
                      aria-pressed={selected?.name === f.name}
                      onClick={() => {
                        setSelected(f);
                        const k = byId.get(f.ids[0]!)?.key;
                        if (k) replaceRoute({ name: 'tomography', organ: keyToUrl(k) });
                      }}
                      className={`min-h-[32px] rounded-full border px-2.5 text-[11.5px] ${selected?.name === f.name ? 'border-accent text-accent' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>

        {atlas && (
          <details className="mt-4 text-[11.5px] text-fg-faint">
            <summary className="cursor-pointer">Kaynak ve sınırlar</summary>
            <p className="mt-1">{atlas.manifest.source}. Lisans: {atlas.manifest.license}. {atlas.manifest.attribution} DOI: {atlas.manifest.doi}</p>
            <p className="mt-1">Organ etiketleri: {atlas.manifest.segmentation}.</p>
            <ul className="mt-1 list-disc pl-4">
              {atlas.manifest.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="mt-1">
              Izgara {atlas.manifest.shape.join(' × ')} voksel, {atlas.manifest.spacing} mm. Kendi BT/MR serini yüklediysen, "Görüntüler" altındaki seriden kişisel 3B organlarına ("Senin görüntünden") geçebilirsin; o görünüm bu atlastan ayrıdır.
            </p>
          </details>
        )}
      </aside>
    </div>
  );
}

/** Üst kesim düzeyindeki eksenel BT kesiti (yumuşak doku penceresi) ve seçili organın sınırı; dokunarak organ seç. */
function SlicePanel({ atlas, z, sel, onPick }: { atlas: Atlas; z: number; sel?: ReadonlySet<number> | undefined; onPick: (label: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [W, H] = atlas.manifest.shape;
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const img = ctx.createImageData(W, H);
    const map = atlas.manifest.huMap;
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(Math.max(0, Math.min(1, (u8ToHu(v, map) + 160) / 400)) * 255);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        // Radyolojik görünüm: hastanın sağı solda (x ters), ön yukarıda (y ters)
        const src = W - 1 - x + W * (H - 1 - y + H * z);
        const g = lut[atlas.volume[src]!]!;
        const l = atlas.labels[src]!;
        const k = (y * W + x) * 4;
        const on = sel?.has(l);
        img.data[k] = on ? Math.min(255, g * 0.6 + 100) : g;
        img.data[k + 1] = on ? Math.min(255, g * 0.6 + 40) : g;
        img.data[k + 2] = on ? g * 0.6 : g;
        img.data[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }, [atlas, z, sel, W, H]);
  return (
    <div className="absolute bottom-3 right-3 w-[38%] max-w-[260px] overflow-hidden rounded-xl border border-white/15 bg-black" data-testid="tomo-slice">
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="block h-auto w-full cursor-crosshair"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.floor(((e.clientX - r.left) / r.width) * W);
          const y = Math.floor(((e.clientY - r.top) / r.height) * H);
          const l = atlas.labels[W - 1 - x + W * (H - 1 - y + H * z)]!;
          if (l) onPick(l);
        }}
      />
      <p className="px-2 py-1 text-[10px] text-white/70">Eksenel kesit · {z + 1}. dilim (radyolojik: sağ solda)</p>
    </div>
  );
}
