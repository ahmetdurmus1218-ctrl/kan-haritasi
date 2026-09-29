import { describe, expect, it } from 'vitest';
import { findTerms, guessCategory, guessRegion, isReadableReport, splitReport } from '../lib/imaging';

describe('görüntüleme yardımcıları', () => {
  it('dosya adından tür tahmini', () => {
    expect(guessCategory('beyin_mr_2026.pdf')).toBe('mr');
    expect(guessCategory('Toraks BT.pdf')).toBe('ct');
    expect(guessCategory('PA Akciğer Grafisi.jpg')).toBe('xray');
    expect(guessCategory('tiroid usg.png')).toBe('us');
    expect(guessCategory('Kan tahlili.pdf')).toBeUndefined();
    expect(guessCategory('hemogram-foto.jpg')).toBeUndefined();
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
