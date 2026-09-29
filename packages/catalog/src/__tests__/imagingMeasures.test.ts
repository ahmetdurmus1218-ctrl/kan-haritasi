import { describe, expect, it } from 'vitest';
import { evaluateMeasure, findMeasurements, formatMeasure, imagingMeasureByKey, IMAGING_MEASURES, structureById } from '../index';

const pick = (text: string, region?: string) => findMeasurements(text, { region }).map((m) => [m.key, m.value, m.site ?? null]);

describe('görüntüleme ölçüm kataloğu', () => {
  it('her ölçümün 3B yapısı var, anahtarlar tekil', () => {
    expect(new Set(IMAGING_MEASURES.map((m) => m.key)).size).toBe(IMAGING_MEASURES.length);
    for (const m of IMAGING_MEASURES) {
      expect(structureById.has(m.structure), m.key).toBe(true);
      expect(m.ranges.length, m.key).toBeGreaterThan(0);
      expect(m.what.length, m.key).toBeGreaterThan(20);
    }
  });

  it('batın USG raporu', () => {
    const t = `Karaciğer boyutu 172 mm olup parankim ekojenitesi artmıştır (grade 1 hepatosteatoz).
Karaciğerde 12 mm basit kist izlendi.
Safra kesesi duvar kalınlığı 2 mm. Koledok çapı 4,5 mm.
Dalak boyutu 13,5 cm ile hafif artmıştır.
Sağ böbrek 108x45 mm, sol böbrek 96x42 mm boyutlarındadır; parankim kalınlığı sağda 14 mm, solda 16 mm.
Abdominal aorta çapı 2,4 cm.`;
    expect(pick(t, 'batin')).toEqual([
      ['dalak-boyu', 135, null],
      ['karaciger-boyu', 172, null],
      ['koledok', 4.5, null],
      ['safra-kesesi-duvari', 2, null],
      ['bobrek-boyu', 108, 'Sağ'],
      ['bobrek-boyu', 96, 'Sol'],
      ['bobrek-parankim', 14, 'Sağ'],
      ['bobrek-parankim', 16, 'Sol'],
      ['abdominal-aort', 24, null],
    ]);
  });

  it('karaciğerdeki kist boyu karaciğer boyu sanılmaz; birimsiz uzunluk alınmaz', () => {
    expect(pick('Karaciğerde 12 mm kist.')).toEqual([]);
    expect(pick('Dalak 13 ölçüldü.')).toEqual([]);
  });

  it('prostat: hacim ya da üç boyuttan elipsoid hacmi', () => {
    expect(pick('Prostat hacmi 42 cc.')).toEqual([['prostat-hacmi', 42, null]]);
    const [m] = findMeasurements('Prostat boyutları 50x40x45 mm.');
    expect(m!.key).toBe('prostat-hacmi');
    expect(m!.value).toBeCloseTo(46.8, 0);
  });

  it('ekokardiyografi', () => {
    const t = 'LVEDD: 49 mm, Sol atriyum çapı 42 mm. EF: %55. sPAB 30 mmHg.';
    expect(pick(t)).toEqual([
      ['ejeksiyon-fraksiyonu', 55, null],
      ['sol-ventrikul-capi', 49, null],
      ['sol-atriyum', 42, null],
      ['pulmoner-basinc', 30, null],
    ]);
  });

  it('DEXA: bölgelere göre T-skoru ve derece', () => {
    const t = 'L1-L4 T skoru: -2,7; Femur boyun T skoru -1,8.';
    expect(pick(t)).toEqual([
      ['t-skoru', -2.7, 'Bel omurları'],
      ['t-skoru', -1.8, 'Kalça'],
    ]);
    const def = imagingMeasureByKey.get('t-skoru')!;
    expect(evaluateMeasure(def, -2.7, 'female')).toMatchObject({ status: 'low', grade: 'Osteoporoz aralığında' });
    expect(evaluateMeasure(def, -1.8, 'female').grade).toBe('Osteopeni (düşük kemik kütlesi) aralığında');
    expect(evaluateMeasure(def, -0.5, 'female')).toMatchObject({ status: 'normal', grade: 'Normal aralıkta' });
  });

  it('omurga kanalı bölgeye göre; akciğer nodülü yalnızca göğüste', () => {
    expect(pick('L4-5 düzeyinde spinal kanal ön-arka çapı 9 mm ölçülmüştür.', 'lomber')).toEqual([['lomber-kanal', 9, null]]);
    expect(pick('C5-6 düzeyinde spinal kanal ön-arka çapı 11 mm.', 'servikal')).toEqual([['servikal-kanal', 11, null]]);
    expect(pick('Sağ alt lobda 8 mm nodül izlendi.', 'toraks')).toEqual([['akciger-nodulu', 8, null]]);
    expect(pick('Tiroid sağ lobda 8 mm nodül izlendi.', 'tiroid')).toEqual([]);
    const lomber = imagingMeasureByKey.get('lomber-kanal')!;
    expect(evaluateMeasure(lomber, 9, 'male')).toMatchObject({ status: 'low', grade: 'Belirgin (mutlak) darlık aralığında' });
  });

  it('oranlar: kardiyotorasik oran ve Evans; yüzde olarak da', () => {
    expect(pick('Kardiyotorasik oran 0,55 ile artmıştır.')).toEqual([['kardiyotorasik-oran', 0.55, null]]);
    expect(pick('KTO %48.')).toEqual([['kardiyotorasik-oran', 0.48, null]]);
    expect(pick('Evans indeksi 0,34 ölçülmüştür.')).toEqual([['evans-indeksi', 0.34, null]]);
  });

  it('cinsiyete göre aralık; bilinmiyorsa geniş aralık', () => {
    const ef = imagingMeasureByKey.get('ejeksiyon-fraksiyonu')!;
    expect(evaluateMeasure(ef, 53, 'female').status).toBe('low');
    expect(evaluateMeasure(ef, 53, 'male').status).toBe('normal');
    expect(evaluateMeasure(ef, 53, 'unspecified').status).toBe('normal');
    expect(formatMeasure(ef, 55)).toBe('%55');
    expect(formatMeasure(imagingMeasureByKey.get('dalak-boyu')!, 135)).toBe('135 mm');
  });
});
