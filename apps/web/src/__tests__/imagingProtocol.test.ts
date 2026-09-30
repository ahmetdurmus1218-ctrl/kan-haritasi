import { describe, expect, it } from 'vitest';
import { extractFindings } from '../lib/imagingFindings';
import { evaluate, protocolFor, techniqueOf } from '../lib/imagingProtocol';

const BRAIN_REPORT = `KRANİAL MR İNCELEMESİ
KLİNİK BİLGİ: Baş ağrısı.
TEKNİK: Aksiyel T2, FLAIR, difüzyon ağırlıklı ve sagittal T1 sekanslar kontrastsız alınmıştır.
BULGULAR:
Her iki frontal lob subkortikal beyaz cevherde birkaç adet milimetrik T2/FLAIR hiperintens odak izlendi.
Difüzyon ağırlıklı incelemede kısıtlanma saptanmadı.
Lateral ventriküller ve sulkuslar olağan genişliktedir.
Sağ maksiller sinüste mukozal kalınlaşma mevcuttur.
SONUÇ:
Frontal beyaz cevherde nonspesifik milimetrik hiperintens odaklar.
Klinik korelasyon önerilir.`;

const byKey = (r: ReturnType<typeof evaluate>, key: string) => r.find((x) => x.item.key === key)!;

describe('sistematik değerlendirme şeması', () => {
  it('belge türü ve bölgeden şema seçilir; kullanıcı başlık istemek zorunda kalmaz', () => {
    expect(protocolFor('mr', 'beyin').key).toBe('brain-mr');
    expect(protocolFor('ct', 'beyin').key).toBe('brain-ct');
    expect(protocolFor('mr', 'beyin', 'Beyin MR anjiyografi (TOF)').key).toBe('vessels');
    expect(protocolFor('us', 'boyun', 'Karotis Doppler USG').key).toBe('vessels');
    expect(protocolFor('ct', 'toraks').key).toBe('chest-ct');
    expect(protocolFor('xray', 'toraks').key).toBe('chest-xray');
    expect(protocolFor('mr', 'lomber').key).toBe('spine');
    expect(protocolFor('us', 'kalp').key).toBe('heart');
    expect(protocolFor('us', 'batin').key).toBe('abdomen');
    expect(protocolFor('ekg', 'kalp').key).toBe('ekg');
    expect(protocolFor('mr', undefined).key).toBe('generic');
    // Beyin MR şeması plak benzeri odakları, kitle etkisini ve ventrikülleri kendiliğinden içerir
    const keys = protocolFor('mr', 'beyin').items.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['demiyelinizan', 'orta-hat', 'ventrikul', 'enfarkt', 'kanama', 'kontrast', 'damar', 'kalite']));
  });

  it('teknik: sekanslar, kontrastsız çekim ve kalite sınırlaması okunur', () => {
    const t = techniqueOf('mr', [BRAIN_REPORT]);
    expect([...t.seen].sort()).toEqual(['dwi', 'mr', 't2flair']);
    expect(t.noContrast).toBe(true);
    expect(t.known).toBe(true);
    expect(t.quality).toBeUndefined();
    const q = techniqueOf('mr', ['Belirgin hareket artefaktı nedeniyle değerlendirme sınırlıdır. T2 aksiyel.']);
    expect(q.quality).toMatch(/hareket artefaktı/);
  });

  it('beyin MR raporu: her başlık rapordan, eksik sekanstan ya da "değerlendirilemedi" olarak ayrılır; hiçbiri "yok" sayılmaz', () => {
    const findings = extractFindings(BRAIN_REPORT, 'beyin');
    const r = evaluate(protocolFor('mr', 'beyin'), { category: 'mr', findings, hasReport: true, hasImage: false, technique: techniqueOf('mr', [BRAIN_REPORT]) });
    expect(byKey(r, 'demiyelinizan')).toMatchObject({ status: 'report', tone: 'abnormal' });
    expect(byKey(r, 'beyaz-gri')).toMatchObject({ status: 'report', tone: 'abnormal' });
    expect(byKey(r, 'enfarkt')).toMatchObject({ status: 'report', tone: 'normal' });
    expect(byKey(r, 'ventrikul')).toMatchObject({ status: 'report', tone: 'normal' });
    expect(byKey(r, 'cevre')).toMatchObject({ status: 'report', tone: 'abnormal' });
    // Kontrastsız çekim, SWI ve anjiyo yok: bu başlıklar "sekans eksik", "yok" değil
    expect(byKey(r, 'kontrast').status).toBe('no-sequence');
    expect(byKey(r, 'mikrokanama').status).toBe('no-sequence');
    expect(byKey(r, 'damar').status).toBe('no-sequence');
    expect(byKey(r, 'kontrast').note).toMatch(/“yok” denemez/);
    // Raporda geçmeyen başlık: değerlendirilemedi
    expect(byKey(r, 'orta-hat')).toMatchObject({ status: 'not-evaluated' });
    expect(byKey(r, 'orta-hat').note).toMatch(/bulgu olmadığı anlamına gelmez/);
    expect(byKey(r, 'kalite').status).toBe('report-general');
  });

  it('yalnızca görüntü (rapor yok): başlıklar uzman değerlendirmesi gerektirir; sağ-sol karşılaştırması yalnızca ilgili başlığa yazılır', () => {
    const tech = techniqueOf('mr', ['AX T2']);
    const r = evaluate(protocolFor('mr', 'beyin'), { category: 'mr', findings: [], hasReport: false, hasImage: true, technique: tech, image: { compared: 3, flagged: 1 } });
    expect(byKey(r, 'demiyelinizan').status).toBe('expert');
    expect(byKey(r, 'orta-hat')).toMatchObject({ status: 'image' });
    expect(byKey(r, 'orta-hat').note).toMatch(/yalnızca parlaklık farkı/);
    expect(r.filter((x) => x.status === 'image')).toHaveLength(1);
  });

  it('genel "patolojik bulgu saptanmadı" ifadesi başlığı olağan saymaz, "genel ifade" olarak ayrılır', () => {
    const text = 'BULGULAR: Lateral ventriküller olağan. SONUÇ: Belirgin patolojik bulgu saptanmadı.';
    const r = evaluate(protocolFor('mr', 'beyin'), { category: 'mr', findings: extractFindings(text, 'beyin'), hasReport: true, hasImage: false, technique: techniqueOf('mr', [text]) });
    expect(byKey(r, 'ventrikul').status).toBe('report');
    expect(byKey(r, 'orta-hat').status).toBe('report-general');
    expect(byKey(r, 'orta-hat').note).toMatch(/ayrıca yazılmamış/);
  });

  it('BT: difüzyon gerektiren başlık yöntemden dolayı eksik; omurga BT\'de omurilik için MR gerekir', () => {
    const r = evaluate(protocolFor('ct', 'lomber'), { category: 'ct', findings: [], hasReport: true, hasImage: false, technique: techniqueOf('ct', ['']) });
    expect(byKey(r, 'omurilik')).toMatchObject({ status: 'no-sequence' });
    expect(byKey(r, 'omurilik').note).toMatch(/bu inceleme yönteminde yok/);
  });

  it('omurga raporu: fıtık, kanal ve kök başlıkları rapor cümlelerine bağlanır', () => {
    const text = 'BULGULAR: Lomber lordoz düzleşmiştir. L4-L5 diskte sol paramedyan protrüzyon izlendi, sol L5 sinir köküne temas etmektedir. Spinal kanal dar değildir. SONUÇ: L4-L5 disk protrüzyonu.';
    const r = evaluate(protocolFor('mr', 'lomber'), { category: 'mr', findings: extractFindings(text, 'lomber'), hasReport: true, hasImage: false, technique: techniqueOf('mr', [text]) });
    expect(byKey(r, 'dizilim')).toMatchObject({ status: 'report', tone: 'abnormal' });
    expect(byKey(r, 'fitik')).toMatchObject({ status: 'report', tone: 'abnormal' });
    expect(byKey(r, 'kok').status).toBe('report');
    expect(byKey(r, 'kanal').status).toBe('report');
    expect(byKey(r, 'omurilik').status).toBe('not-evaluated');
  });
});
