import { describe, expect, it } from 'vitest';
import { testByKey } from '@kh/catalog';
import { markInRegion, type RgbaImage } from '../lib/rowMarks';
import { type ReviewRow, reevaluate } from '../lib/reports';

type Rgb = [number, number, number];

function canvas(w: number, h: number, bg: Rgb): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...bg, 255], i * 4);
  return { data, width: w, height: h };
}

function rect(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, c: Rgb) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data.set([...c, 255], (y * img.width + x) * 4);
}

function disc(img: RgbaImage, cx: number, cy: number, r: number, c: Rgb) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) img.data.set([...c, 255], (y * img.width + x) * 4);
}

const GRAY: Rgb = [242, 242, 242];
const PINK: Rgb = [242, 202, 212];
const RED: Rgb = [214, 48, 49];
const GREEN: Rgb = [52, 168, 120];
const TEXT: Rgb = [40, 40, 40];

/** e-Nabız satırı: solda simge, ortada ad ve değer (koyu "yazı" blokları). */
function row(img: RgbaImage, y: number, bad: boolean, x = 0) {
  rect(img, x, y, x + 600, y + 24, bad ? PINK : GRAY);
  disc(img, x + 30, y + 12, 8, bad ? RED : GREEN);
  for (let k = 0; k < 6; k++) rect(img, x + 120 + k * 40, y + 6, x + 145 + k * 40, y + 18, TEXT);
}

describe('satır işareti (renkli simge ve zemin)', () => {
  it('pembe zemin + kırmızı simge "aralık dışı", gri zemin + yeşil onay "aralık içi"', () => {
    const img = canvas(700, 120, [255, 255, 255]);
    row(img, 10, true);
    row(img, 50, false);
    // Kutu yalnızca adı ve değeri kapsar (OCR simgeyi okumadı).
    expect(markInRegion(img, { x: 120, y: 8, w: 230, h: 14 })).toBe('out');
    expect(markInRegion(img, { x: 120, y: 48, w: 230, h: 14 })).toBe('in');
  });

  it('işaretsiz tabloda karar verilmez', () => {
    const img = canvas(700, 60, [255, 255, 255]);
    for (let k = 0; k < 6; k++) rect(img, 120 + k * 40, 16, 145 + k * 40, 28, TEXT);
    expect(markInRegion(img, { x: 120, y: 14, w: 230, h: 14 })).toBeUndefined();
  });

  it('yan yana kolajda soldaki tablonun pembe hücresi sağdaki satıra bulaşmaz', () => {
    const img = canvas(1300, 60, [255, 255, 255]);
    row(img, 10, true, 0);
    row(img, 10, false, 640);
    // Sağ tablonun kutusu simgeden başlıyor (OCR simgeyi "o" diye okudu).
    expect(markInRegion(img, { x: 660, y: 8, w: 330, h: 14 })).toBe('in');
  });
});

describe('düzenlenen satırın yeniden değerlendirilmesi', () => {
  const base = (key: string, mark?: 'in' | 'out'): ReviewRow => {
    const t = testByKey.get(key)!;
    return {
      testKey: key, loinc: t.loinc, rawName: key, valueText: '', value: Number.NaN, unit: '', unitKey: 'mg/dl', canonicalValue: null,
      refText: '', refSource: 'none', status: 'unknown', confidence: 1, issues: [], source: { page: 1, x: 0, y: 0, w: 0, h: 0 },
      include: true, userEdited: false, ...(mark ? { reportMark: mark } : {}),
    };
  };

  it('aralık girilmezse genel aralık dışı değer "belirsiz"; rapordaki işaret varsa ona göre', () => {
    const edit = { value: '0,1', unitKey: 'mg/dl', refMin: '', refMax: '' };
    const plain = reevaluate(base('bilirubin-total'), edit, 'male');
    expect(plain.status).toBe('unknown');
    expect(plain.issues).toContain('RANGE_GENERIC');
    expect(reevaluate(base('bilirubin-total', 'in'), edit, 'male').status).toBe('normal');
    expect(reevaluate(base('bilirubin-total', 'out'), edit, 'male').status).toBe('low');
  });

  it('aralık girilirse durum o aralıktan hesaplanır', () => {
    expect(reevaluate(base('bilirubin-total', 'in'), { value: '2,4', unitKey: 'mg/dl', refMin: '0', refMax: '1,2' }, 'male').status).toBe('high');
  });
});
