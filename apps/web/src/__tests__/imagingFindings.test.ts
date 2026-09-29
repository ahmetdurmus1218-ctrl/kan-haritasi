import { describe, expect, it } from 'vitest';
import { extractFindings, spineLevel } from '../lib/imagingFindings';

const byText = (list: ReturnType<typeof extractFindings>, frag: string) => list.find((f) => f.text.includes(frag))!;

describe('görüntüleme raporundan bulgular', () => {
  it('beyin MR: lob, taraf, olağan/dikkat ayrımı', () => {
    const t = `BEYİN MR
KLİNİK BİLGİ: Baş ağrısı.
BULGULAR:
Sol frontal lobda subkortikal beyaz cevherde T2/FLAIR hiperintens nonspesifik gliotik odak izlendi.
Ventriküller normal genişliktedir. Orta hat yapıları simetriktir.
Serebellum ve beyin sapı doğaldır.
Sağ maksiller sinüste mukozal kalınlaşma izlendi.
SONUÇ: Sol frontal nonspesifik gliotik odak. Sağ maksiller sinüzit ile uyumlu olabilir.`;
    const f = extractFindings(t, 'beyin');
    const glio = byText(f, 'Sol frontal lobda');
    expect(glio).toMatchObject({ structure: 'brain', part: 'frontal', side: 'left', status: 'abnormal', located: 'text' });
    expect(glio.where).toBe('Sol frontal lob');
    expect(byText(f, 'Ventriküller normal')).toMatchObject({ part: 'ventricles', status: 'normal' });
    expect(byText(f, 'Serebellum')).toMatchObject({ part: 'cerebellum', status: 'normal' });
    expect(byText(f, 'maksiller sinüste')).toMatchObject({ structure: 'airways', side: 'right', status: 'abnormal' });
    expect(byText(f, 'uyumlu olabilir').status).toBe('uncertain');
    // Klinik bilgi bulgu değildir
    expect(f.some((x) => x.text.includes('Baş ağrısı'))).toBe(false);
  });

  it('bel MR: omurga seviyeleri ve "izlenmedi" olumsuzlaması', () => {
    const t = `LOMBER MR
BULGULAR:
L4-5 disk aralığında santral protrüzyon izlenmiştir, belirgin spinal kanal stenozu izlenmedi.
L5-S1 seviyesinde sol paramedian ekstrüzyon sol S1 sinir kökünü basılamaktadır.
Diğer seviyelerde herniasyon saptanmadı.
T2 ağırlıklı sekanslarda konus medullaris normaldir.`;
    const f = extractFindings(t, 'lomber');
    expect(byText(f, 'L4-5')).toMatchObject({ structure: 'spinal-cord', part: 'lumbar', level: 'L4–L5', status: 'abnormal' });
    expect(byText(f, 'L5-S1')).toMatchObject({ level: 'L5–S1', side: 'left', status: 'abnormal' });
    expect(byText(f, 'Diğer seviyelerde').status).toBe('normal');
    expect(byText(f, 'konus medullaris').level).toBeUndefined();
  });

  it('batın US, akciğer BT, diz MR: organ bölümleri', () => {
    const us = extractFindings('BULGULAR: Karaciğer boyutu artmış, grade 2 hepatosteatoz ile uyumlu. Safra kesesinde 8 mm taş izlendi. Sağ böbrekte 12 mm basit kortikal kist. Dalak normal boyuttadır.', 'batin');
    expect(byText(us, 'Karaciğer boyutu')).toMatchObject({ structure: 'liver', status: 'abnormal' });
    expect(byText(us, 'Safra kesesinde')).toMatchObject({ structure: 'gallbladder', part: 'gallbladder', status: 'abnormal' });
    expect(byText(us, 'böbrekte')).toMatchObject({ structure: 'kidneys', side: 'right', status: 'abnormal' });
    expect(byText(us, 'Dalak normal')).toMatchObject({ structure: 'spleen', status: 'normal' });
    const ct = extractFindings('BULGULAR: Sağ akciğer alt lobda 6 mm nodül izlendi. Plevral efüzyon saptanmadı.', 'toraks');
    expect(byText(ct, 'alt lobda')).toMatchObject({ structure: 'lungs', part: 'right-lower', status: 'abnormal' });
    expect(byText(ct, 'efüzyon saptanmadı').status).toBe('normal');
    const knee = extractFindings('BULGULAR: Medial menisküs arka boynuzunda grade 3 yırtık izlendi. Ön çapraz bağ sağlamdır.', 'diz');
    expect(byText(knee, 'Medial menisküs')).toMatchObject({ structure: 'knee', part: 'meniscus', status: 'abnormal' });
    expect(byText(knee, 'Ön çapraz bağ')).toMatchObject({ part: 'acl', status: 'normal' });
  });

  it('rapor başlığı, hasta/tarih satırı ve alt bilgi bulgu sayılmaz; Bulgular + Sonuç tekrarı aynı anahtarı taşır', () => {
    const t = `ÖRNEK MERKEZ\nHasta: Sentetik Hasta Tetkik tarihi: 15.03.2026\nBULGULAR:\nSol frontal lobda hiperintens odak izlendi.\nSONUÇ:\nSol frontal lobda hiperintens odak.\nBu belge test amaçlı üretilmiştir.`;
    const f = extractFindings(t, 'beyin');
    expect(f).toHaveLength(2);
    expect(f[0]!.key).toBe(f[1]!.key);
  });

  it('konum sözcüğü yoksa belgenin bölgesi kullanılır ve bu belirtilir', () => {
    const f = extractFindings('SONUÇ: Belirgin patolojik bulgu saptanmadı.', 'beyin');
    expect(f[0]).toMatchObject({ structure: 'brain', located: 'region', status: 'normal' });
  });

  it('endoskopi ve EKG raporu: bulgu yere ve duruma ayrılır', () => {
    const e = extractFindings('BULGULAR: Özofagus mukozası doğal. Antrumda yaygın hiperemi ve erozyonlar izlendi. SONUÇ: Antral gastrit.', 'mide');
    expect(byText(e, 'Özofagus')).toMatchObject({ structure: 'esophagus', status: 'normal' });
    expect(byText(e, 'erozyonlar')).toMatchObject({ structure: 'stomach', status: 'abnormal' });
    expect(byText(extractFindings('Bulbus doğal. Erozif antral gastrit.', 'mide'), 'Bulbus')).toMatchObject({ structure: 'small-intestine', part: 'duodenum', status: 'normal' });
    expect(byText(extractFindings('Erozif antral gastrit.', 'mide'), 'gastrit')).toMatchObject({ structure: 'stomach', located: 'text', status: 'abnormal' });
    const k = extractFindings('Normal sinüs ritmi. Sağ dal bloğu izlendi.', 'kalp');
    expect(byText(k, 'sinüs ritmi')).toMatchObject({ structure: 'heart', located: 'region', status: 'normal' });
    expect(byText(k, 'dal bloğu')).toMatchObject({ structure: 'heart', status: 'abnormal' });
  });

  it('omurga seviyesi okuma: MR sekansı seviye sanılmaz', () => {
    expect(spineLevel('L4-L5 diski')?.level).toBe('L4–L5');
    expect(spineLevel('C5–6 seviyesinde')?.level).toBe('C5–C6');
    expect(spineLevel('T2-FLAIR sekansta hiperintens')).toBeUndefined();
    expect(spineLevel('T11-12 aralığı')?.level).toBe('T11–T12');
  });
});
