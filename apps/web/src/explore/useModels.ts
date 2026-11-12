import { useEffect, useMemo, useState } from 'react';
import { Box3 } from 'three';
import { type BodyModel, type LoadableAsset, LOAD_ORDER, OPTIONAL_ASSETS, type ModelPart, assetBytes, loadAsset, loadPackParts } from '../anatomy/models';
import { type SchematicPart, schematicParts } from '../anatomy/schematic';
import { type InstalledPack, activePacks, packGlb, usePacks } from '../anatomy/packs';

export interface PackLoad {
  key: string;
  title: string;
  status: 'loading' | 'ready' | 'failed';
  parts: number;
}

export interface ModelsState {
  body: BodyModel;
  parts: ModelPart[];
  /** Kaynaklarda modeli olmayan yapıların şematik çizimleri (tiroid, kulak). */
  schematic: SchematicPart[];
  loaded: Set<LoadableAsset>;
  failed: LoadableAsset[];
  /** Etkin anatomi paketleri ve yüklenme durumları. */
  packs: PackLoad[];
  /** 0..1 */
  progress: number;
  done: boolean;
}

/**
 * Seçili vücudun (erkek/kadın) anatomi modellerini ister (paralel indirilir), her dosya geldikçe
 * sahneye eklenir. Önbellek oturum boyunca kalır; vücut değiştirip geri dönünce anında gelir.
 */
export function useModels(body: BodyModel, withOptional = false): ModelsState {
  const [state, setState] = useState<Omit<ModelsState, 'schematic' | 'packs'>>({ body, parts: [], loaded: new Set(), failed: [], progress: 0, done: false });
  const packState = usePacks();
  const active = useMemo(() => activePacks(packState, body), [packState, body]);
  const activeKey = active.map((p) => p.key).join(',');
  const [packParts, setPackParts] = useState<Map<string, ModelPart[] | 'failed'>>(new Map());

  useEffect(() => {
    let cancelled = false;
    for (const p of active) {
      loadPackParts(body, p.key, () => packGlb(p.key)).then(
        (parts) => !cancelled && setPackParts((m) => new Map(m).set(p.key, parts)),
        () => !cancelled && setPackParts((m) => new Map(m).set(p.key, 'failed')),
      );
    }
    return () => {
      cancelled = true;
    };
    // activeKey: aynı paket listesinde yeniden yükleme yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, activeKey]);

  useEffect(() => {
    let cancelled = false;
    const order: LoadableAsset[] = withOptional ? [...LOAD_ORDER, ...OPTIONAL_ASSETS] : LOAD_ORDER;
    const total = order.reduce((n, a) => n + assetBytes(body, a), 0);
    const bytes = new Map<LoadableAsset, number>();
    const results = new Map<LoadableAsset, ModelPart[]>();
    const failed: LoadableAsset[] = [];
    let raf = 0;
    const publish = () => {
      raf = 0;
      if (cancelled) return;
      const loadedBytes = [...bytes.values()].reduce((a, b) => a + b, 0);
      const parts = order.flatMap((a) => results.get(a) ?? []);
      const settled = results.size + failed.length;
      setState({
        body,
        parts,
        loaded: new Set(results.keys()),
        failed: [...failed],
        progress: Math.min(1, loadedBytes / total),
        done: settled === order.length,
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(publish);
    };
    // Vücut değişince eski parçalar hemen kalkar (yanlış vücut bir an bile görünmesin).
    setState((s) => (s.body === body ? s : { body, parts: [], loaded: new Set(), failed: [], progress: 0, done: false }));
    for (const asset of order) {
      loadAsset(body, asset, (n) => {
        bytes.set(asset, n);
        schedule();
      }).then(
        (parts) => {
          results.set(asset, parts);
          schedule();
        },
        () => {
          failed.push(asset);
          schedule();
        },
      );
    }
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [body, withOptional]);

  const current = state.body === body ? state : { body, parts: [], loaded: new Set<LoadableAsset>(), failed: [], progress: 0, done: false };
  const merged = useMemo(() => mergePacks(current.parts, active, packParts), [current.parts, active, packParts]);
  const schematic = useMemo(() => {
    const replaced = new Set(merged.ready.flatMap((p) => p.manifest.schematicReplaced));
    return schematicParts(current.parts).filter((s) => !replaced.has(s.structure) && !replaced.has(`${s.structure}:${s.label ?? ''}`));
  }, [current.parts, merged.ready]);
  return { ...current, parts: merged.parts, schematic, packs: merged.packs };
}

/**
 * Temel model + etkin paketler: paketin yerini aldığı temel yapılar (ör. bölgesel kaslar, şematik
 * sinirler) çıkarılır, paket parçaları eklenir. Paket henüz yüklenmediyse temel model görünür kalır.
 */
export function mergePacks(base: ModelPart[], active: InstalledPack[], loaded: Map<string, ModelPart[] | 'failed'>): { parts: ModelPart[]; packs: PackLoad[]; ready: InstalledPack[] } {
  const ready = active.filter((p) => Array.isArray(loaded.get(p.key)));
  const replaced = new Set(ready.flatMap((p) => p.manifest.replaces));
  const parts = [...base.filter((p) => !replaced.has(p.structure)), ...ready.flatMap((p) => loaded.get(p.key) as ModelPart[])];
  const packs = active.map((p) => {
    const l = loaded.get(p.key);
    return { key: p.key, title: p.manifest.title, status: l === 'failed' ? ('failed' as const) : l ? ('ready' as const) : ('loading' as const), parts: Array.isArray(l) ? l.length : 0 };
  });
  return { parts, packs, ready };
}

/** Yapı başına sınır kutuları (kamera çerçeveleme için). */
export function structureBoxes(parts: Array<ModelPart | SchematicPart>): Map<string, Box3> {
  const map = new Map<string, Box3>();
  for (const p of parts) {
    const b = map.get(p.structure) ?? new Box3();
    b.union(p.box);
    map.set(p.structure, b);
  }
  return map;
}
