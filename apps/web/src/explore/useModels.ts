import { useEffect, useState } from 'react';
import { Box3 } from 'three';
import { LOAD_ORDER, OPTIONAL_ASSETS, type ModelPart, loadAsset } from '../anatomy/models';
import { MODEL_ASSETS } from '../anatomy/assets.generated';
import type { LoadableAsset } from '../anatomy/assets.generated';
import { SCHEMATIC_PARTS } from '../anatomy/schematic';

export interface ModelsState {
  parts: ModelPart[];
  loaded: Set<LoadableAsset>;
  failed: LoadableAsset[];
  /** 0..1 */
  progress: number;
  done: boolean;
}

/**
 * Anatomi modellerini sırayla ister (paralel indirilir, küçükten büyüğe sıralı), her dosya
 * geldikçe sahneye eklenir. Önbellek oturum boyunca kalır; ekran yeniden açılınca anında gelir.
 */
export function useModels(withOptional = false): ModelsState {
  const [state, setState] = useState<ModelsState>({ parts: [], loaded: new Set(), failed: [], progress: 0, done: false });

  useEffect(() => {
    let cancelled = false;
    const order: LoadableAsset[] = withOptional ? [...LOAD_ORDER, ...OPTIONAL_ASSETS] : LOAD_ORDER;
    const total = order.reduce((n, a) => n + MODEL_ASSETS[a].bytes, 0);
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
    for (const asset of order) {
      loadAsset(asset, (n) => {
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
  }, [withOptional]);

  return state;
}

/** Yapı başına sınır kutuları (kamera çerçeveleme için). */
export function structureBoxes(parts: ModelPart[]): Map<string, Box3> {
  const map = new Map<string, Box3>();
  for (const p of [...parts, ...SCHEMATIC_PARTS]) {
    const b = map.get(p.structure) ?? new Box3();
    b.union(p.box);
    map.set(p.structure, b);
  }
  return map;
}
