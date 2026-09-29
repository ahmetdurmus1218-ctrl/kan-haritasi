import { describe, expect, it } from 'vitest';
import { detectDocType, findTerms, guessCategory, guessRegion, isReadableReport, splitReport } from '../lib/imaging';

describe('görüntüleme yardımcıları', () => {
  it('dosya adından tür tahmini', () => {
    expect(guessCategory('beyin_mr_2026.pdf')).toBe('mr');
    expect(guessCategory('Toraks BT.pdf')).toBe('ct');
    expect(guessCategory('PA Akciğer Grafisi.jpg')).toBe('xray');
    expect(guessCategory('tiroid usg.png')).toBe('us');
    expect(guessCategory('Kan tahlili.pdf')).toBeUndefined();
    expect(guessCategory('hemogram-foto.jpg')).toBeUndefined();
  });

  it('yeni türler dosya adından: özgül tür genelden önce', () => {
    expect(guessCategory('PET-BT sonucu.pdf')).toBe('pet');
    expect(guessCategory('mamografi_2026.pdf')).toBe('mammo');
    expect(guessCategory('Kolonoskopi raporu.pdf')).toBe('endoscopy');
    expect(guessCategory('biyopsi-patoloji.pdf')).toBe('pathology');
    expect(guessCategory('EKG 12 derivasyon.jpg')).toBe('ekg');
    expect(guessCategory('spirometri.pdf')).toBe('pft');
    expect(guessCategory('DEXA kemik.pdf')).toBe('dexa');
  });

  it('metinden belge türü önerisi: yeterli işaret gerekir, tahlil kısaltmaları yanıltmaz', () => {
    expect(detectDocType('KRANİAL MR İNCELEMESİ\nT2A ve FLAIR sekanslarda hiperintens odak izlendi.')).toMatchObject({ category: 'mr' });
    expect(detectDocType('HİSTOPATOLOJİ RAPORU\nMakroskopi: 3 adet doku parçası. Mikroskopi: kronik gastrit.')?.category).toBe('pathology');
    expect(detectDocType('Özofagogastroduodenoskopi: Özofagus normal. Antrumda hiperemi, bulbus doğal.')?.category).toBe('endoscopy');
    expect(detectDocType('EKG: Normal sinüs ritmi, kalp hızı 72/dk, QTc 410 ms.')?.category).toBe('ekg');
    expect(detectDocType('Spirometri: FEV1 %92, FVC %95, FEV1/FVC 0.81')?.category).toBe('pft');
    expect(detectDocType('Kemik mineral yoğunluğu (DXA): L1-L4 T skoru -1.8, osteopeni.')?.category).toBe('dexa');
    expect(detectDocType('Bilateral mamografi: BI-RADS 2.')?.category).toBe('mammo');
    expect(detectDocType('FDG PET-BT: SUVmax 4.2 hipermetabolik lenf nodu.')?.category).toBe('pet');
    // Tahlil raporunda geçen "direkt bilirubin", "PA" gibi kısaltmalar röntgen sanılmaz.
    expect(detectDocType('Direkt bilirubin 0.2 mg/dL PA  Hemoglobin 14')).toBeUndefined();
    expect(detectDocType('')).toBeUndefined();
  });

  it('yeni türlerin terimleri sözlükte', () => {
    const keys = (t: string) => findTerms(t).map((x) => x.key);
    expect(keys('Antrumda intestinal metaplazi ve düşük dereceli displazi, polip.')).toEqual(expect.arrayContaining(['metaplazi', 'displazi', 'polip']));
    expect(keys('Normal sinüs ritmi. QTc 420 ms. Sağ dal bloğu.')).toEqual(expect.arrayContaining(['sinus-ritmi', 'qt', 'blok']));
    expect(keys('FEV1/FVC oranı ve DLCO')).toEqual(expect.arrayContaining(['fev1', 'dlco']));
    expect(keys('T skoru -2.7, osteoporoz; BI-RADS 3; SUVmax 5')).toEqual(expect.arrayContaining(['t-skoru', 'osteopeni', 'birads', 'suv']));
  });

  it('bölge tahmini: özgül bölge genelden önce gelir', () => {
    expect(guessRegion('BRAIN')).toBe('beyin');
    expect(guessRegion('LOMBER MR')).toBe('lomber');
    expect(guessRegion('Sol Diz MR')).toBe('diz');
    expect(guessRegion('KNEE')).toBe('diz');
    expect(guessRegion('Hipofiz MR dinamik')).toBe('hipofiz');
    expect(guessRegion('Üst batın USG')).toBe('batin');
    expect(guessRegion('rapor.pdf')).toBeUndefined();
  });

  it('rapor bölümleri', () => {
    const s = splitReport(['LOMBER MR', 'KLİNİK BİLGİ: Bel ağrısı', 'TEKNİK', 'Sagittal T1, T2', 'BULGULAR:', 'L4-5 diskte bulging.', 'Nöral foramenler açık.', 'SONUÇ: L4-5 bulging.'].join('\n'));
    expect(s.map((x) => x.kind)).toEqual(['diger', 'klinik', 'teknik', 'bulgular', 'sonuc']);
    expect(s.find((x) => x.kind === 'bulgular')!.text).toBe('L4-5 diskte bulging.\nNöral foramenler açık.');
    expect(s.find((x) => x.kind === 'sonuc')!.text).toBe('L4-5 bulging.');
    expect(splitReport('Serbest metin')).toEqual([{ kind: 'diger', title: 'Rapor', text: 'Serbest metin' }]);
  });

  it('sözlük terimleri; yanlış eşleşme yok', () => {
    const keys = findTerms('L4-5 diskte posterior protrüzyon ve sağ nöral foramende hafif daralma. Beyaz cevherde T2 hiperintens odaklar.').map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['protruzyon', 'foramen', 'stenoz', 'hiperintens']));
    // "bağırsak" bağ (ligament) değildir; "bulgu" bül değildir; "taşınır" taş değildir.
    expect(findTerms('Bağırsak ansları olağan. Bulgular taşınır.').map((t) => t.key)).toEqual(['dogal']);
    // "kontrastsız çekim" kontrast tutulumu değildir.
    expect(findTerms('Sekanslar kontrastsız alınmıştır.').map((t) => t.key)).toEqual([]);
    expect(findTerms('Lezyonda belirgin kontrast tutulumu var.').map((t) => t.key)).toContain('kontrast');
  });
});

describe('rapor başlıkları', () => {
  it('"Klinik korelasyon önerilir" başlık sanılmaz', () => {
    const sec = splitReport('SONUÇ:\nFrontal odaklar.\nKlinik korelasyon önerilir.');
    expect(sec).toHaveLength(1);
    expect(sec[0]!.kind).toBe('sonuc');
    expect(sec[0]!.text).toContain('Klinik korelasyon önerilir.');
  });
});

describe('OCR metni gerçekten rapor mu', () => {
  it('film/MR fotoğrafından çıkan anlamsız harf öbekleri rapor sayılmaz', () => {
    for (const t of ['ERAS Gn', 'ee a wr ,| Ra EE Sl', 'Tl 4 xz qwrtpl mnbv', '| ~~ ee — ; SEEN eee Ra pan aa', 'L R 12/24 SE 4', ''])
      expect(isReadableReport(t), t).toBe(false);
  });
  it('gerçek rapor metni okunabilir sayılır', () => {
    for (const t of [
      'BEYİN MR\nBULGULAR: Ventriküller normal genişliktedir. Sulkuslar olağandır.\nSONUÇ: Normal beyin MR.',
      'LOMBER MR RAPORU Teknik: sagital ve aksiyel T1 T2 sekanslar. Bulgular: L4-5 disk protrüzyonu izlendi.',
      'Tüm batın ultrasonografi: Karaciğer boyutu normal, dalak 13 cm. Sonuç: Hafif splenomegali.',
    ])
      expect(isReadableReport(t), t).toBe(true);
  });
});
