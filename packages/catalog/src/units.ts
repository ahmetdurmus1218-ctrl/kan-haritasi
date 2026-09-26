/**
 * Birim normalizasyonu. Raporlarda aynı birim onlarca biçimde yazılır
 * ("10^3/µL", "x10³/uL", "K/uL", "bin/mm3", "10*9/L"...). Hepsi tek bir anahtara indirgenir;
 * testlerin dönüşüm tabloları bu anahtarları kullanır.
 */
const SUPERSCRIPT: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

export function normalizeUnit(raw: string): string | null {
  if (!raw) return null;
  let u = raw.normalize('NFKC').trim();
  u = u.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => SUPERSCRIPT[c] ?? c);
  u = u.toLowerCase().replace(/\s+/g, '').replace(/[()[\]]/g, '');
  u = u.replace(/[µμ]/g, 'u').replace(/^mc(?=g|mol|iu|u)/, 'u').replace(/\/mc(?=g|l)/, '/u');
  u = u.replace(/×/g, 'x').replace(/\*\*/g, '^').replace(/(\d)\*(\d)/g, '$1^$2').replace(/^x(?=10)/, '');
  u = u.replace(/ıu/g, 'iu').replace(/saat/g, 'h').replace(/sa$/, 'h').replace(/hr$/, 'h');
  // OCR: "UlU/mL" (I yerine l), "»" (yüzde işareti bazı yazı tiplerinde böyle okunur)
  u = u.replace(/^ulu(?=[/-]ml)/, 'uiu').replace(/^u1u(?=[/-]ml)/, 'uiu');
  if (u === '»' || u === '%»') u = '%';
  u = u.replace(/mm³/g, 'mm3');

  const direct: Record<string, string> = {
    'mg/dl': 'mg/dl',
    'mg/100ml': 'mg/dl',
    'g/dl': 'g/dl',
    'gr/dl': 'g/dl',
    'g/l': 'g/l',
    'mg/l': 'mg/l',
    'u/l': 'u/l',
    'iu/l': 'u/l',
    'ui/l': 'u/l',
    'uiu/ml': 'miu/l',
    'uu/ml': 'miu/l',
    'miu/l': 'miu/l',
    'mu/l': 'miu/l',
    'miu/ml': 'miu/ml',
    'ng/ml': 'ng/ml',
    'ug/l': 'ng/ml',
    'pg/ml': 'pg/ml',
    'ng/l': 'pg/ml',
    'ng/dl': 'ng/dl',
    'ug/dl': 'ug/dl',
    'mmol/l': 'mmol/l',
    'meq/l': 'mmol/l',
    'umol/l': 'umol/l',
    'nmol/l': 'nmol/l',
    'pmol/l': 'pmol/l',
    'fl': 'fl',
    'um3': 'fl',
    'pg': 'pg',
    '%': '%',
    'yuzde': '%',
    'l/l': 'l/l',
    'mm/h': 'mm/h',
    'mm/1h': 'mm/h',
    'mm/1.h': 'mm/h',
    'mm/saat': 'mm/h',
    's': 's',
    'sn': 's',
    'sec': 's',
    'saniye': 's',
    'iu/ml': 'iu/ml',
    'u/ml': 'iu/ml',
    'kiu/l': 'iu/ml',
    'mmol/mol': 'mmol/mol',
    'ratio': 'ratio',
    'oran': 'ratio',
    'inr': 'ratio',
  };
  const hit = direct[u];
  if (hit) return hit;
  // Bazı sistemler (ör. e-Nabız) bölü işaretini tire olarak gösterir: "UIU-mL", "10^9-L", "mg-dL".
  if (u.includes('-') && !u.includes('/') && /[a-z%]/.test(u)) {
    const slashed = normalizeUnit(u.replace(/-/g, '/'));
    if (slashed) return slashed;
  }
  // OCR'ın bozduğu "10^9/L": "1049-1", "10^9-1"
  if (/^10[\^4]?9[-/][l1i]$/.test(u)) return '10^9/l';
  if (/^10[\^4]?12[-/][l1i]$/.test(u)) return '10^12/l';

  // OCR'ın bozduğu üst simgeli sayım birimleri: "107 3/uL", "10-3/pL", "10*3/µL" → 10^3/µL
  const ocrCount = /^10[-^7*·.]?([369])\/([upµ]l|mm3)$/.exec(u);
  if (ocrCount) return ({ '3': '10^3/ul', '6': '10^6/ul', '9': '10^9/l' } as Record<string, string>)[ocrCount[1] ?? ''] ?? null;

  // Hücre sayımları
  if (/^(10\^?3|k|bin|10e3)\/(ul|mm3)$/.test(u) || u === '10^3/ul' || u === 'k/ul') return '10^3/ul';
  if (/^(10\^?6|m|milyon|10e6)\/(ul|mm3)$/.test(u)) return '10^6/ul';
  if (/^10\^?9\/l$/.test(u) || u === 'g/l(cell)') return '10^9/l';
  if (/^10\^?12\/l$/.test(u) || u === 't/l') return '10^12/l';
  if (u === '/ul' || u === '/mm3' || u === 'hucre/ul' || u === 'adet/ul' || u === 'hucre/mm3') return '/ul';

  // eGFR
  if (/^ml\/(min|dk|dak)(\/1[.,]73(m2|m\^2)?)?$/.test(u) || /^ml\/(min|dk)\/1[.,]73m?2?$/.test(u)) return 'ml/min/1.73m2';

  return null;
}

/** Dönüşüm: kanonik = değer × çarpan + kaydırma. */
export type Conversion = readonly [factor: number, offset?: number];

export function convert(value: number, conv: Conversion): number {
  return value * conv[0] + (conv[1] ?? 0);
}

/** Sayım birimleri (binlik ayırıcı yorumu için): 7.200 /mm3 → 7200. */
export function isCountUnit(norm: string | null): boolean {
  return norm === '/ul';
}
