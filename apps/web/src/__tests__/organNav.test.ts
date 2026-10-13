import { describe, expect, it } from 'vitest';
import { FLOWS } from '@kh/analysis';
import { type Route, hrefFor, parseHash } from '../state/router';
import { labStyle, reportTone } from '../lib/tone';
import { extractFindings } from '../lib/imagingFindings';
import { search } from '../lib/search';
import { INSIDE } from '../explore/inside/registry';
import { limitedCoverage } from '../lib/imagingProtocol';
import { LOCATION_NOTICE } from '../lib/locationNotice';

describe('organ gezinmesi: rotalar', () => {
  it('genel bakış, iç yapı, derin inceleme (iz), akış ve sistem rotaları gidip gelir', () => {
    const routes: Route[] = [
      { name: 'organ', id: 'small-intestine' },
      { name: 'organ', id: 'small-intestine', view: 'ic' },
      { name: 'organ', id: 'small-intestine', view: 'derin', trail: ['tissue.intestinal-wall', 'tissue.villus', 'cell.enterocyte'] },
      { name: 'organ', id: 'pancreas', view: 'benim' },
      { name: 'flow' },
      { name: 'flow', id: 'intestinal-absorption', step: 3, personal: true },
      { name: 'system', id: 'digestive' },
    ];
    for (const r of routes) expect(parseHash(hrefFor(r))).toEqual(r);
  });

  it('geçersiz iz ya da adım güvenle düzeltilir', () => {
    expect(parseHash('#/organ/brain/derin/../../x')).toEqual({ name: 'organ', id: 'brain', view: 'derin', trail: [] });
    expect(parseHash('#/akis/<script>/1')).toEqual({ name: 'flow' });
    expect(parseHash('#/akis/digestion/abc')).toEqual({ name: 'flow', id: 'digestion', step: 1 });
    expect(parseHash('#/sistem/')).toEqual({ name: 'mybody' });
  });
});

describe('renk sistemi (tek kaynak)', () => {
  it('yüksek: ad/değer/durum aynı turuncu-amber tonda; düşük: mavi; kritik: kırmızı; normal: nötr', () => {
    const highMild = labStyle({ status: 'high', severity: 'mild' });
    expect(highMild).toMatchObject({ tone: 'follow', direction: 'high', statusLabel: '▲ Yüksek', text: 'text-caution-fg' });
    const highMarked = labStyle({ status: 'high', severity: 'marked' });
    expect(highMarked).toMatchObject({ tone: 'attention', text: 'text-high' });
    const low = labStyle({ status: 'low', severity: 'mild' });
    expect(low).toMatchObject({ direction: 'low', statusLabel: '▼ Düşük', text: 'text-low' });
    expect(labStyle({ status: 'low', severity: 'mild', critical: true }).text).toBe('text-danger');
    const normal = labStyle({ status: 'normal', severity: 'normal' });
    expect(normal.direction).toBeUndefined();
    expect(normal.text).toBe('text-fg');
    expect(normal.statusLabel).toBe('Aralıkta');
  });

  it('rapor: "izlenmedi" nötr, şüphe belirsiz, değerlendirilemedi ayrı, bulgu dikkat', () => {
    expect(reportTone({ status: 'normal', negated: true })).toBe('normal');
    expect(reportTone({ status: 'uncertain', negated: false })).toBe('uncertain');
    expect(reportTone({ status: 'not-assessed', negated: false })).toBe('not-assessed');
    expect(reportTone({ status: 'abnormal', negated: false })).toBe('attention');
  });
});

describe('rapor cümleleri: normal ≠ yok ≠ değerlendirilemedi', () => {
  const f = extractFindings('BULGULAR: Kitle izlenmedi. Sol frontalde kitle açısından şüpheli görünüm. Hipofiz bu inceleme ile değerlendirilemedi. Sağ frontalde 8 mm lezyon izlendi.', 'beyin');
  const by = (re: RegExp) => f.find((x) => re.test(x.text))!;
  it('"Kitle izlenmedi" → bulgu yok (olumsuzlanmış), kırmızı değil', () => {
    expect(by(/izlenmedi/)).toMatchObject({ status: 'normal', negated: true });
  });
  it('"şüpheli görünüm" → belirsiz', () => {
    expect(by(/şüpheli/).status).toBe('uncertain');
  });
  it('"değerlendirilemedi" → not-assessed (normal değil, anormal değil)', () => {
    expect(by(/değerlendirilemedi/).status).toBe('not-assessed');
  });
  it('"lezyon izlendi" → dikkat', () => {
    expect(by(/lezyon izlendi/).status).toBe('abnormal');
  });
});

describe('akışlar arayüze bağlı', () => {
  it('akışlardaki her iç sahne uygulamada var', () => {
    for (const fl of FLOWS) for (const s of fl.steps) if (s.inside) expect(s.inside in INSIDE, `${fl.id}/${s.id}: ${s.inside}`).toBe(true);
  });
  it('arama akışları da bulur ("emilim")', () => {
    const hits = search('emilim');
    expect(hits.some((h) => h.kind === 'flow' && h.route.name === 'flow')).toBe(true);
  });
});

describe('görüntüleme kapsamı ve konum açıklaması', () => {
  it('fotoğraf ve tek kesit sınırlı kapsamdır; uzun DICOM serisi değildir', () => {
    expect(limitedCoverage({ kind: 'photo', frames: 2 })).toBe(true);
    expect(limitedCoverage({ kind: 'dicom-single', frames: 1 })).toBe(true);
    expect(limitedCoverage({ kind: 'dicom-series', frames: 180 })).toBe(false);
  });
  it('"Vücutta göster" üç durumu ayırır', () => {
    expect(LOCATION_NOTICE.model).toMatch(/konum bilgisiyle 3B anatomide/);
    expect(LOCATION_NOTICE.region).toMatch(/kesin konumu değildir/);
    expect(LOCATION_NOTICE.report).toMatch(/gerçek piksel koordinatı değildir/);
  });
});
