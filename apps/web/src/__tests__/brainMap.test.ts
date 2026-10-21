import { describe, expect, it } from 'vitest';
import { BRAIN_REGIONS, INTERIOR_ACCEPTANCE, brainPath, interiorById, interiorFor, stagePersonal, validateInterior } from '@kh/analysis';
import { extractFindings } from '../lib/imagingFindings';
import { brainNodeOf, findingsAt, regionStatus } from '../lib/brainReport';
import { deeperTrail, depthOf, doctorQuestions, interiorStep, plainReading, sentenceLocation } from '../lib/reportSteps';
import { doctorNote } from '../lib/share';
import { search } from '../lib/search';
import { hrefFor, parseHash } from '../state/router';
import { reportFindingsFrom } from '../lib/analysisBridge';

const REPORT = `KRANİAL MR İNCELEMESİ
BULGULAR:
Her iki frontal lob subkortikal beyaz cevherde birkaç adet milimetrik T2/FLAIR hiperintens odak izlendi.
Difüzyon ağırlıklı incelemede kısıtlanma saptanmadı.
Lateral ventriküller ve sulkuslar olağan genişliktedir.
Sol talamusta 4 mm laküner infarkt ile uyumlu olabilecek odak izlendi.
Sağ maksiller sinüste mukozal kalınlaşma mevcuttur.
SONUÇ: Frontal beyaz cevherde nonspesifik milimetrik hiperintens odaklar. Klinik korelasyon önerilir.`;

const findings = extractFindings(REPORT, 'beyin');
const byText = (frag: string) => findings.find((f) => f.text.includes(frag))!;
const brain = findings.flatMap((f) => {
  const loc = brainNodeOf(f);
  return loc ? [{ finding: f, ...loc, fileId: 'd', index: 0, docName: 'rapor', date: '2026-03-15', dateKnown: true, ocr: false }] : [];
});

describe('beyin haritası: rapor cümlesi → bölge', () => {
  it('her cümle doğru bölgeye yerleşir; sinüs cümlesi beyne yazılmaz', () => {
    expect(brainNodeOf(byText('Her iki frontal'))?.node).toBe('brain.frontal');
    expect(brainNodeOf(byText('Sol talamusta'))?.node).toBe('brain.thalamus');
    expect(brainNodeOf(byText('Lateral ventriküller'))?.node).toBe('brain.ventricles');
    expect(brainNodeOf(byText('maksiller sinüste'))).toBeNull();
  });

  it('taraf yalnızca raporda yazıyorsa yola eklenir ("her iki" → yarıküreler)', () => {
    expect(brainNodeOf(byText('Her iki frontal'))!.path).toEqual(['brain', 'brain.cerebrum', 'brain.frontal']);
    expect(brainPath('brain.frontal', 'left')).toEqual(['brain', 'brain.hemisphere-left', 'brain.frontal']);
    expect(brainPath('brain.frontal')).not.toContain('brain.hemisphere-left');
    // Rapor bulgusunun birleşik modeldeki yolu da aynı kurala uyar
    const rf = reportFindingsFrom([byText('Her iki frontal')]);
    expect(rf[0]!.location?.path).toEqual(['brain', 'brain.cerebrum', 'brain.frontal']);
  });

  it('bölge durumu: dikkat > belirsiz > olağan; adı geçmeyen bölge "none"', () => {
    expect(regionStatus(findingsAt('brain.frontal', brain))).toBe('attention');
    expect(regionStatus(findingsAt('brain.thalamus', brain))).toBe('uncertain');
    expect(regionStatus(findingsAt('brain.ventricles', brain))).toBe('normal');
    expect(regionStatus(findingsAt('brain.occipital', brain))).toBe('none');
  });
});

describe('sade dil ve adım adım yol', () => {
  it('sözcüklerin anlamı, katman ve taraf yalnızca cümlede yazandan', () => {
    const r = plainReading(byText('Her iki frontal'));
    expect(r.headline).toMatch(/dikkat çeken bir ifade var\. Bu bir tanı değildir/);
    const all = r.lines.join(' ');
    expect(all).toMatch(/Milimetrik: milimetre boyutunda/);
    expect(all).toMatch(/Hiperintens/);
    expect(all).toMatch(/FLAIR/);
    expect(all).toMatch(/Sayı: birden fazla/);
    expect(r.side).toBe('İki tarafta');
    expect(r.depth?.text).toMatch(/subkortikal/);
    expect(depthOf('Periventriküler beyaz cevherde odak')?.tissue).toBe('white');
    expect(depthOf('Sol frontal kortikal alan')?.tissue).toBe('gray');
    expect(plainReading(byText('Difüzyon')).headline).toMatch(/OLMADIĞI yazıyor; bu bir bulgu değil/);
    expect(plainReading(byText('nonspesifik')).lines.join(' ')).toMatch(/Nonspesifik: tek bir nedene özgü değil/);
  });

  it('İçine gir: cümle bölgenin iç dünyasında kişisel veri olarak görünür; beyaz cevher basamağı ayrıca açılır', () => {
    const b = brain.find((x) => x.finding.text.includes('Her iki frontal'))!;
    const step = interiorStep('brain.frontal', b)!;
    expect(step.interior).toBe('brain.frontal');
    const def = interiorById('brain.frontal')!;
    expect(def.stages[step.stage - 1]!.node).toBe('brain.frontal');
    expect(def.stages[step.deeperStage! - 1]!.node).toBe('tissue.white-matter');
    // Aynı cümle rapor bulgusu olarak iç dünyanın basamağına bağlanır (kaynağıyla)
    const rf = reportFindingsFrom([b.finding]);
    const personal = stagePersonal(def.stages[step.stage - 1]!, { latestLabs: [], reportFindings: rf });
    expect(personal.findings).toHaveLength(1);
    expect(personal.findings[0]).toMatchObject({ source: 'RADIOLOGY_REPORT', localized: 'report-text' });
    expect(deeperTrail(b)).toMatchObject({ organ: 'brain.white-matter', trail: ['tissue.white-matter', 'cell.oligodendrocyte'] });
  });

  it('hekime sorular cümleye göre ve tekrarsız', () => {
    const q = doctorQuestions(byText('Her iki frontal'));
    expect(q[0]).toMatch(/odakların olası nedeni/);
    expect(new Set(q).size).toBe(q.length);
    expect(q.length).toBeLessThanOrEqual(5);
  });
});

describe('beynin her bölgesine girilir', () => {
  it('haritadaki her bölgenin kendi iç dünyası var ve kurallara uyar', () => {
    for (const r of BRAIN_REGIONS) {
      const def = interiorById(r.interior);
      expect(def, r.node).toBeDefined();
      expect(validateInterior(def!)).toEqual([]);
      expect(interiorFor(r.node)?.organId, r.node).toBe(r.interior);
    }
  });

  it('dolu beyin bölgelerinde lümen yok; karıncıklar BOS dolu boşluk', () => {
    for (const id of INTERIOR_ACCEPTANCE.beyin!) {
      const d = interiorById(id)!;
      if (id === 'brain.ventricles') expect(d.lumen?.contents?.join(' ')).toMatch(/Beyin-omurilik sıvısı/);
      else if (d.type === 'solid') expect(d.stages.some((s) => s.kind === 'lumen' || s.kind === 'content')).toBe(false);
    }
  });

  it('yarıküre düğümleri yarıküreler iç dünyasına, lob basamakları lob iç dünyasına götürür', () => {
    expect(interiorFor('brain.hemisphere-left')?.organId).toBe('brain.cerebrum');
    const brainDef = interiorById('brain')!;
    const lobe = brainDef.stages.find((s) => s.id === 'lobe')!;
    expect(lobe.next?.map((n) => n.to)).toEqual(['brain.frontal', 'brain.temporal', 'brain.parietal', 'brain.occipital']);
  });
});

describe('her organda rapor cümlesi adım adım', () => {
  const LUMBAR = `LOMBER MR
BULGULAR:
L4-5 disk aralığında santral protrüzyon izlenmiştir, belirgin spinal kanal stenozu izlenmedi.
SONUÇ: L4-5 santral protrüzyon.`;
  const ABDOMEN = `ÜST BATIN USG
BULGULAR:
Karaciğer boyutu normal, parankim ekojenitesi artmıştır (grade 1 hepatosteatoz ile uyumlu).`;

  it('beyin dışı cümleler de konum, sade anlam, iç dünya ve derin seviye alır', () => {
    const liver = extractFindings(ABDOMEN, 'batin').find((f) => f.text.includes('Karaciğer'))!;
    const loc = sentenceLocation(liver);
    expect(loc.node).toBe('liver');
    const ref = { finding: liver, ...loc, fileId: 'd', index: 0, docName: 'usg', date: '2026-01-01', dateKnown: false, ocr: true };
    expect(plainReading(liver).lines.join(' ')).toMatch(/Hepatosteatoz/);
    expect(interiorStep('liver', ref)?.interior).toBe('liver');
    expect(deeperTrail(ref)).toMatchObject({ organ: 'liver', trail: [] });
    const lumbar = extractFindings(LUMBAR, 'lomber').find((f) => f.text.startsWith('L4-5'))!;
    expect(sentenceLocation(lumbar).path.length).toBeGreaterThan(0);
    expect(plainReading(lumbar).lines.join(' ')).toMatch(/Protrüzyon/);
  });

  it('hekime götür notu: cümle, yer, sade anlam ve tekrarsız sorular; OCR bilgisi korunur', () => {
    const note = doctorNote(brain.filter((b) => b.finding.status !== 'normal'));
    expect(note).toMatch(/“Her iki frontal lob subkortikal/);
    expect(note).toMatch(/Milimetrik: milimetre boyutunda/);
    expect(note).toMatch(/Sorularım:/);
    const qs = note.split('Sorularım:')[1]!.split('\n').filter((l) => l.startsWith('• '));
    expect(new Set(qs).size).toBe(qs.length);
    expect(note).toMatch(/tanı değildir/);
  });

  it('arama: "beyin haritası" ve lob adları haritaya götürür', () => {
    const hit = search('beyin haritası')[0]!;
    expect(hit.route).toEqual({ name: 'brain' });
    const lobe = search('alın lobu').find((h) => h.title.startsWith('Alın'))!;
    expect(lobe.links.find((l) => l.label === 'Beyin haritası')?.route).toEqual({ name: 'brain', region: 'brain.frontal' });
  });

  it('cümle rotası: #/cumle/<belge>/<n> ayrıştırılır, geçersizler reddedilir', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(parseHash(`#/cumle/${id}/3`)).toEqual({ name: 'sentence', file: id, n: 3 });
    expect(hrefFor({ name: 'sentence', file: id, n: 3 })).toBe(`#/cumle/${id}/3`);
    expect(parseHash(`#/cumle/${id}/0`).name).toBe('images');
    expect(parseHash('#/cumle/../1').name).toBe('images');
    expect(parseHash('#/beyin/brain.frontal')).toEqual({ name: 'brain', region: 'brain.frontal' });
  });
});
