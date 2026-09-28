import { useEffect, useMemo, useState } from 'react';
import { Box3 } from 'three';
import { type BodyModel, type LoadableAsset, LOAD_ORDER, OPTIONAL_ASSETS, type ModelPart, assetBytes, loadAsset } from '../anatomy/models';
import { type SchematicPart, schematicParts } from '../anatomy/schematic';

export interface ModelsState {
  body: BodyModel;
  parts: ModelPart[];
  /** Kaynaklarda modeli olmayan yapıların şematik çizimleri (tiroid, kulak). */
  schematic: SchematicPart[];
  loaded: Set<LoadableAsset>;
  failed: LoadableAsset[];
  /** 0..1 */
  progress: number;
  done: boolean;
}

/**
 * Seçili vücudun (erkek/kadın) anatomi modellerini ister (paralel indirilir), her dosya geldikçe
 * sahneye eklenir. Önbellek oturum boyunca kalır; vücut değiştirip geri dönünce anında gelir.
 */
export function useModels(body: BodyModel, withOptional = false): ModelsState {
  const [state, setState] = useState<Omit<ModelsState, 'schematic'>>({ body, parts: [], loaded: new Set(), failed: [], progress: 0, done: false });

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
  const schematic = useMemo(() => schematicParts(current.parts), [current.parts]);
  return { ...current, schematic };
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
