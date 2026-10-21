import { describe, expect, it } from 'vitest';
import { BRAIN_REGIONS, INTERIOR_ACCEPTANCE, brainPath, interiorById, interiorFor, stagePersonal, validateInterior } from '@kh/analysis';
import { extractFindings } from '../lib/imagingFindings';
import { brainNodeOf, deeperTrail, depthOf, doctorQuestions, findingsAt, interiorStep, plainReading, regionStatus } from '../lib/brainReport';
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
  return loc ? [{ finding: f, ...loc, fileId: 'd', docName: 'rapor', date: '2026-03-15', dateKnown: true }] : [];
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
