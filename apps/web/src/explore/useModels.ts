import { useEffect, useState } from 'react';
import { Box3 } from 'three';
import { LOAD_ORDER, TOTAL_BYTES, type ModelPart, loadAsset } from '../anatomy/models';
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
export function useModels(): ModelsState {
  const [state, setState] = useState<ModelsState>({ parts: [], loaded: new Set(), failed: [], progress: 0, done: false });

  useEffect(() => {
    let cancelled = false;
    const bytes = new Map<LoadableAsset, number>();
    const results = new Map<LoadableAsset, ModelPart[]>();
    const failed: LoadableAsset[] = [];
    let raf = 0;
    const publish = () => {
      raf = 0;
      if (cancelled) return;
      const loadedBytes = [...bytes.values()].reduce((a, b) => a + b, 0);
      const parts = LOAD_ORDER.flatMap((a) => results.get(a) ?? []);
      const settled = results.size + failed.length;
      setState({
        parts,
        loaded: new Set(results.keys()),
        failed: [...failed],
        progress: Math.min(1, loadedBytes / TOTAL_BYTES),
        done: settled === LOAD_ORDER.length,
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(publish);
    };
    for (const asset of LOAD_ORDER) {
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
  }, []);

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
