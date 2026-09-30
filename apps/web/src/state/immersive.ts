import { useSyncExternalStore } from 'react';

/**
 * "Yalnızca model" kipi: Keşfet ekranında tüm paneller ve uygulama çerçevesi (üst çubuk, alt gezinme,
 * kenar çubuğu) gizlenir; ekranda yalnızca 3B model kalır. Kip ekrandan çıkınca kendiliğinden kapanır.
 */
let immersive = false;
const listeners = new Set<() => void>();

export function setImmersive(value: boolean): void {
  if (immersive === value) return;
  immersive = value;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useImmersive(): boolean {
  return useSyncExternalStore(subscribe, () => immersive);
}
