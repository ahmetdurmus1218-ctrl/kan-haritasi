import type { SourceBox, TextItem } from './types';

export interface Token {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  conf?: number;
}

export interface Line {
  page: number;
  tokens: Token[];
  text: string;
  box: SourceBox;
  conf?: number;
}

/**
 * Metin parçalarını satırlara, satırları kelimelere ayırır.
 * - Aynı satır: dikey merkezleri, yüksekliğin ~yarısı kadar yakın olan parçalar.
 * - PDF.js bazen bir kelimeyi birkaç parçaya böler; aralarında boşluk yoksa birleştirilir.
 */
export function buildLines(items: TextItem[], pageSizes: Map<number, { w: number; h: number }> = new Map()): Line[] {
  const byPage = new Map<number, TextItem[]>();
  for (const it of items) {
    if (!it.text || !it.text.trim()) continue;
    const list = byPage.get(it.page) ?? [];
    list.push(it);
    byPage.set(it.page, list);
  }

  // Eğik fotoğrafta aynı tablo satırındaki kelimelerin y'si kayar; OCR eğimi düzeltilmiş merkezi (cy) verir.
  const center = (it: TextItem) => it.cy ?? it.y + it.h / 2;
  const lines: Line[] = [];
  for (const [page, list] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => center(a) - center(b) || a.x - b.x);
    const groups: TextItem[][] = [];
    for (const it of list) {
      const cy = center(it);
      const g = groups[groups.length - 1];
      if (g) {
        const gy = g.reduce((s, x) => s + center(x), 0) / g.length;
        const gh = Math.max(...g.map((x) => x.h));
        if (Math.abs(cy - gy) <= Math.max(gh, it.h) * 0.5) {
          g.push(it);
          continue;
        }
      }
      groups.push([it]);
    }

    const size = pageSizes.get(page);
    for (const g of groups) {
      g.sort((a, b) => a.x - b.x);
      const tokens: Token[] = [];
      let prev: TextItem | null = null;
      for (const it of g) {
        const parts = splitWords(it);
        for (const [idx, part] of parts.entries()) {
          const last = tokens[tokens.length - 1];
          const gap = prev && last ? part.x - (last.x + last.w) : Infinity;
          // Yalnızca önceki parçanın hemen bitişiğinde başlayan ilk kelime birleştirilir.
          const glue = idx === 0 && prev !== null && !/^\s/.test(it.text) && gap < Math.max(0.6, part.h * 0.12);
          if (glue && last) {
            last.text += part.text;
            last.w = part.x + part.w - last.x;
          } else {
            tokens.push({ text: part.text, x: part.x, y: part.y, w: part.w, h: part.h, conf: it.conf });
          }
        }
        prev = it;
      }
      const x0 = Math.min(...g.map((t) => t.x));
      const y0 = Math.min(...g.map((t) => t.y));
      const x1 = Math.max(...g.map((t) => t.x + t.w));
      const y1 = Math.max(...g.map((t) => t.y + t.h));
      const confs = g.map((t) => t.conf).filter((c): c is number => c !== undefined);
      lines.push({
        page,
        tokens,
        text: tokens.map((t) => t.text).join(' '),
        box: { page, x: x0, y: y0, w: x1 - x0, h: y1 - y0, pageW: size?.w, pageH: size?.h },
        conf: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : undefined,
      });
    }
  }
  return lines;
}

/** Bir parçayı boşluklardan kelimelere böler; kelime konumları karakter oranıyla yaklaşık hesaplanır. */
function splitWords(it: TextItem): Array<{ text: string; x: number; y: number; w: number; h: number }> {
  const raw = it.text.replace(/\s+/g, ' ');
  const words = raw.trim().split(' ').filter(Boolean);
  if (words.length <= 1) {
    return [{ text: words[0] ?? '', x: it.x, y: it.y, w: it.w, h: it.h }];
  }
  const perChar = it.w / Math.max(1, raw.length);
  const out: Array<{ text: string; x: number; y: number; w: number; h: number }> = [];
  let cursor = 0;
  for (const w of words) {
    const idx = raw.indexOf(w, cursor);
    out.push({ text: w, x: it.x + idx * perChar, y: it.y, w: w.length * perChar, h: it.h });
    cursor = idx + w.length;
  }
  return out;
}
