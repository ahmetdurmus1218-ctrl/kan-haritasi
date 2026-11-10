import { describe, expect, it } from 'vitest';
import { SIM_MODELS, clampParams, defaultParams, scenarioParams, simModelById, simulate, sampleAt, type Metric, type SimModel } from '../index';

const run = (id: string, scenario?: string, extra: Record<string, number> = {}) => {
  const model = simModelById.get(id)!;
  const p = { ...scenarioParams(model, scenario), ...extra };
  const { samples, unstable } = simulate(model, p);
  expect(unstable).toBe(false);
  const metrics = Object.fromEntries(model.metrics(samples, clampParams(model, p)).map((m: Metric) => [m.key, m.value]));
  return { model, samples, m: metrics as Record<string, number> };
};

describe('fizyoloji modelleri: yapı ve dürüstlük', () => {
  it('14 model; her biri varsayım, geçerlilik, sınır, kaynak ve denklem taşır', () => {
    expect(SIM_MODELS.length).toBe(14);
    expect(new Set(SIM_MODELS.map((m) => m.id)).size).toBe(14);
    for (const m of SIM_MODELS) {
      expect(m.assumptions.length, m.id).toBeGreaterThanOrEqual(2);
      expect(m.limits.length, m.id).toBeGreaterThanOrEqual(1);
      expect(m.sources.length, m.id).toBeGreaterThanOrEqual(1);
      expect(m.equations.length, m.id).toBeGreaterThanOrEqual(2);
      expect(m.validity.length, m.id).toBeGreaterThan(20);
      expect(m.scenarios.length, m.id).toBeGreaterThanOrEqual(3);
      expect(/^[a-z0-9-]{1,40}$/.test(m.id), m.id).toBe(true);
    }
  });

  it.each(SIM_MODELS.map((m) => [m.id, m] as const))('%s: normal ve bütün senaryolar sayısal olarak kararlı, seriler tanımlı', (_id, model: SimModel) => {
    for (const s of [undefined, ...model.scenarios.map((x) => x.id)]) {
      const p = scenarioParams(model, s);
      const { samples, unstable } = simulate(model, p);
      expect(unstable, `${model.id}/${s}`).toBe(false);
      expect(samples.length).toBeGreaterThan(50);
      for (const def of model.series) expect(Number.isFinite(samples[samples.length - 1]!.v[def.key]), `${model.id}/${s}/${def.key}`).toBe(true);
      for (const metric of model.metrics(samples, p)) expect(metric.label.length).toBeGreaterThan(2);
      for (const c of model.curves?.(samples, p) ?? []) for (const l of c.lines) expect(l.points.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), `${model.id}/${c.id}`).toBe(true);
    }
    // Senaryo parametreleri tanımlı aralıkta ve gerçekten bir şeyi değiştiriyor.
    const base = defaultParams(model);
    for (const s of model.scenarios) {
      expect(Object.keys(s.set).every((k) => k in base), `${model.id}/${s.id}`).toBe(true);
      expect(Object.entries(s.set).some(([k, v]) => v !== base[k])).toBe(true);
      expect(clampParams(model, { ...base, ...s.set })).toEqual({ ...base, ...s.set });
    }
  });

  it('aralık dışı ve geçersiz parametreler sıkıştırılır', () => {
    const m = simModelById.get('kalp-dongusu')!;
    const p = clampParams(m, { hr: 9999, emax: Number.NaN, bilinmeyen: 3 });
    expect(p.hr).toBe(180);
    expect(p.emax).toBe(3);
    expect('bilinmeyen' in p).toBe(false);
  });
});

describe('kalp döngüsü', () => {
  it('normal: fizyolojik atım hacmi, EF, debi ve kan basıncı', () => {
    const { m } = run('kalp-dongusu');
    expect(m.sv).toBeGreaterThan(60);
    expect(m.sv).toBeLessThan(100);
    expect(m.ef).toBeGreaterThan(50);
    expect(m.ef).toBeLessThan(72);
    expect(m.co).toBeGreaterThan(4);
    expect(m.co).toBeLessThan(7.5);
    expect(m.sbp).toBeGreaterThan(100);
    expect(m.sbp).toBeLessThan(140);
    expect(m.dbp).toBeGreaterThan(60);
    expect(m.dbp).toBeLessThan(90);
  });
  it('debi ≈ (OAB − venöz basınç) / direnç (kütle korunumu)', () => {
    const { m } = run('kalp-dongusu');
    expect((m.map! - 3) / 1).toBeCloseTo((m.co! * 1000) / 60, 0);
  });
  it('senaryolar: kasılma ↓ → EF ↓; egzersiz → debi ↑; sert arter → nabız basıncı ↑; ön yük ↓ → atım hacmi ↓ (Frank–Starling)', () => {
    const n = run('kalp-dongusu').m;
    expect(run('kalp-dongusu', 'dusuk-kasilma').m.ef).toBeLessThan(n.ef! - 12);
    expect(run('kalp-dongusu', 'egzersiz').m.co).toBeGreaterThan(n.co! * 1.5);
    const stiff = run('kalp-dongusu', 'sert-arter').m;
    expect(stiff.sbp! - stiff.dbp!).toBeGreaterThan((n.sbp! - n.dbp!) * 1.5);
    expect(run('kalp-dongusu', 'dusuk-dolum').m.sv).toBeLessThan(n.sv! * 0.75);
    const hf = run('kalp-dongusu', 'sert-karincik').m;
    expect(hf.edv).toBeLessThan(n.edv! * 0.75);
    expect(hf.ef).toBeGreaterThan(45);
  });
});

describe('gaz değişimi', () => {
  it('normal: alveol gaz denklemiyle uyumlu', () => {
    const { m } = run('gaz-degisimi');
    expect(m.paco2).toBeGreaterThan(38);
    expect(m.paco2).toBeLessThan(43);
    expect(m.pao2).toBeGreaterThan(85);
    expect(m.pao2).toBeLessThan(100);
    expect(m.sat).toBeGreaterThan(96);
    expect(m.cao2).toBeGreaterThan(19);
    expect(m.cao2).toBeLessThan(21);
  });
  it('anemi: doygunluk aynı, içerik düşük; hipoventilasyon: pCO₂ ↑, pH ↓; yükseklik: pO₂ ↓', () => {
    const n = run('gaz-degisimi').m;
    const a = run('gaz-degisimi', 'anemi').m;
    expect(a.sat).toBeCloseTo(n.sat!, 1);
    expect(a.cao2).toBeLessThan(n.cao2! * 0.6);
    const h = run('gaz-degisimi', 'hipoventilasyon').m;
    expect(h.paco2).toBeGreaterThan(70);
    expect(h.ph).toBeLessThan(7.3);
    expect(run('gaz-degisimi', 'yukseklik').m.pao2).toBeLessThan(60);
  });
});

describe('glukoz–insülin', () => {
  it('normal öğün: tepe 30–75 dk içinde, 2. saatte < 140, sonunda açlığa döner', () => {
    const { m, samples } = run('glukoz-insulin');
    expect(m.peak).toBeGreaterThan(120);
    expect(m.peak).toBeLessThan(165);
    expect(m.tpeak).toBeGreaterThan(25);
    expect(m.tpeak).toBeLessThan(80);
    expect(m.g120).toBeLessThan(140);
    expect(samples[samples.length - 1]!.v.g).toBeGreaterThan(75);
    expect(samples[samples.length - 1]!.v.g).toBeLessThan(100);
    expect(sampleAt(samples, 5)!.v.g).toBeCloseTo(90, 3);
  });
  it('duyarlılık ↓ → glukoz ve insülin ↑; salgı ↓ → glukoz ↑, insülin ↓; öğün yoksa değişim yok', () => {
    const n = run('glukoz-insulin').m;
    const r = run('glukoz-insulin', 'direnc').m;
    expect(r.g120).toBeGreaterThan(n.g120! + 15);
    expect(r.ipeak).toBeGreaterThan(n.ipeak!);
    const s = run('glukoz-insulin', 'salgi').m;
    expect(s.peak).toBeGreaterThan(n.peak! + 20);
    expect(s.ipeak).toBeLessThan(n.ipeak! * 0.6);
    expect(run('glukoz-insulin', undefined, { carbs: 0 }).m.peak).toBeCloseTo(90, 3);
  });
});

describe('böbrek süzmesi', () => {
  it('normal: GFR ≈ 100–130, süzme oranı ≈ %20, kreatinin dengede', () => {
    const { m, samples } = run('bobrek-suzme');
    expect(m.gfr).toBeGreaterThan(100);
    expect(m.gfr).toBeLessThan(130);
    expect(m.ff).toBeGreaterThan(15);
    expect(m.ff).toBeLessThan(23);
    expect(samples[0]!.v.cr).toBeCloseTo(m.cr!, 2);
    expect(m.cr).toBeGreaterThan(0.7);
    expect(m.cr).toBeLessThan(1);
  });
  it('kreatinin yeni dengesi = üretim / GFR; kas kütlesi GFR\'yi değiştirmez', () => {
    const n = run('bobrek-suzme').m;
    const lost = run('bobrek-suzme', 'nefron').m;
    expect(lost.gfr).toBeLessThan(n.gfr! * 0.6);
    expect(lost.crss).toBeCloseTo(100 / lost.gfr!, 2);
    expect(lost.cr).toBeGreaterThan(n.cr! * 1.4);
    const muscle = run('bobrek-suzme', 'kas').m;
    expect(muscle.gfr).toBeCloseTo(n.gfr!, 5);
    expect(muscle.crss).toBeCloseTo(n.crss! * 1.5, 2);
  });
  it('getirici daralması GFR\'yi düşürür; götürücü gevşemesi de', () => {
    const n = run('bobrek-suzme').m;
    expect(run('bobrek-suzme', 'getirici').m.gfr).toBeLessThan(n.gfr! * 0.7);
    expect(run('bobrek-suzme', 'goturucu').m.gfr).toBeLessThan(n.gfr!);
  });
});

describe('asit-baz', () => {
  it('normal: pH 7,40; metabolik asidozda telafi Winter formülüne ulaşır ve pH\'yı kısmen düzeltir', () => {
    expect(run('asit-baz').m.ph).toBeCloseTo(7.4, 2);
    const a = run('asit-baz', 'met-asidoz').m;
    expect(a.hco3).toBeCloseTo(12, 0);
    expect(a.pco2).toBeCloseTo(1.5 * 12 + 8, 0);
    expect(a.ph).toBeGreaterThan(7.2);
    expect(a.ph).toBeLessThan(7.36);
    const none = run('asit-baz', 'telafisiz').m;
    expect(none.pco2).toBeCloseTo(40, 0);
    expect(none.ph).toBeLessThan(a.ph! - 0.1);
  });
  it('solunumsal asidoz: akut pH düşük, kronik telafiyle HCO₃⁻ ≈ 31 ve pH yükselir', () => {
    const r = run('asit-baz', 'sol-asidoz').m;
    expect(r.pco2).toBeCloseTo(60, 0);
    expect(r.hco3).toBeGreaterThan(29.5);
    expect(r.hco3).toBeLessThan(31.5);
    expect(r.ph).toBeGreaterThan(r.ph0! + 0.05);
    expect(r.ph).toBeLessThan(7.4);
  });
});

describe('aksiyon potansiyeli (Hodgkin–Huxley)', () => {
  it('eşik üstü uyarı tek aksiyon potansiyeli; eşik altı hiç; sürekli uyarı tekrarlı ateşleme', () => {
    const n = run('aksiyon-potansiyeli').m;
    expect(n.spikes).toBe(1);
    expect(n.peak).toBeGreaterThan(20);
    expect(n.rest).toBeCloseTo(-65, 0);
    const sub = run('aksiyon-potansiyeli', 'esik-alti').m;
    expect(sub.spikes).toBe(0);
    expect(sub.peak).toBeLessThan(-40);
    expect(run('aksiyon-potansiyeli', 'tekrar').m.spikes).toBeGreaterThanOrEqual(3);
  });
  it('Na⁺ kanalları kapalıyken ateşleme yok; yüksek potasyum dinlenimi depolarize eder', () => {
    expect(run('aksiyon-potansiyeli', 'na-blok').m.spikes).toBe(0);
    expect(run('aksiyon-potansiyeli', 'yuksek-k').m.rest).toBeGreaterThan(-60);
    expect(run('aksiyon-potansiyeli', 'dusuk-k').m.rest).toBeLessThan(-66.5);
  });
});

describe('kas kasılması', () => {
  it('seğirme < toplanma < tetanos; tetanos düzgün; boy–gerim platosu', () => {
    const tw = run('kas-kasilmasi').m;
    const sum = run('kas-kasilmasi', 'toplanma').m;
    const tet = run('kas-kasilmasi', 'tetanos').m;
    expect(tw.peak).toBeGreaterThan(8);
    expect(tw.peak).toBeLessThan(45);
    expect(sum.peak).toBeGreaterThan(tw.peak!);
    expect(tet.peak).toBeGreaterThan(sum.peak!);
    expect(tet.peak).toBeGreaterThan(80);
    expect(tet.ripple).toBeLessThan(5);
    expect(run('kas-kasilmasi', 'tetanos-eksik').m.ripple).toBeGreaterThan(tet.ripple!);
    expect(run('kas-kasilmasi', 'gergin').m.peak).toBeLessThan(tet.peak! * 0.5);
    expect(run('kas-kasilmasi', 'kisa').m.peak).toBeLessThan(tet.peak! * 0.8);
  });
});

describe('tiroid ekseni', () => {
  it('denge korunur; birincil yetersizlikte TSH ↑ sT4 ↓; bağımsız salgıda TSH baskılı; merkezi durumda TSH yükselmez', () => {
    const n = run('tiroid-ekseni').m;
    expect(n.tsh).toBeCloseTo(1.5, 1);
    expect(n.ft4).toBeCloseTo(1.2, 2);
    const hypo = run('tiroid-ekseni', 'birincil-hipo').m;
    expect(hypo.tsh).toBeGreaterThan(10);
    expect(hypo.ft4).toBeLessThan(0.9);
    const mild = run('tiroid-ekseni', 'hafif').m;
    expect(mild.tsh).toBeGreaterThan(2.5);
    expect(mild.ft4).toBeGreaterThan(0.93);
    const hyper = run('tiroid-ekseni', 'hiper').m;
    expect(hyper.tsh).toBeLessThan(0.1);
    expect(hyper.ft4).toBeGreaterThan(1.8);
    const central = run('tiroid-ekseni', 'merkezi').m;
    expect(central.ft4).toBeLessThan(0.9);
    expect(central.tsh).toBeLessThan(4.2);
  });
});

describe('demir ve eritropoez', () => {
  it('normal: bir yılda denge kayması yok', () => {
    const n = run('demir-eritropoez').m;
    expect(n.hb).toBeCloseTo(14.5, 0);
    expect(n.ferritin).toBeGreaterThan(80);
    expect(n.ferritin).toBeLessThan(125);
    expect(n.absorb).toBeGreaterThan(1);
    expect(n.absorb).toBeLessThan(2);
  });
  it('kan kaybı: önce ferritin, sonra hemoglobin düşer; emilim artar', () => {
    const b = run('demir-eritropoez', 'kan-kaybi').m;
    expect(b.tfer).toBeGreaterThan(20);
    expect(b.thb).toBeGreaterThan(b.tfer!);
    expect(b.hb).toBeLessThan(12);
    expect(b.absorb).toBeGreaterThan(3);
  });
  it('inflamasyon: ferritin düşmez ama doygunluk ve hemoglobin düşer; EPO ↓: hemoglobin ↓, ferritin ↑', () => {
    const n = run('demir-eritropoez').m;
    const i = run('demir-eritropoez', 'inflamasyon').m;
    expect(i.ferritin).toBeGreaterThan(n.ferritin!);
    expect(i.tsat).toBeLessThan(20);
    expect(i.hb).toBeLessThan(n.hb! - 0.5);
    const e = run('demir-eritropoez', 'epo').m;
    expect(e.hb).toBeLessThan(n.hb! - 1.5);
    expect(e.ferritin).toBeGreaterThan(n.ferritin!);
  });
});

describe('su dengesi', () => {
  it('normal: sodyum 140 sabit, idrar ≈ 1,7 L/gün', () => {
    const { m, samples } = run('su-dengesi');
    expect(m.namin).toBeCloseTo(140, 0);
    expect(m.namax).toBeCloseTo(140, 0);
    expect(samples[10]!.v.urine).toBeGreaterThan(55);
    expect(samples[10]!.v.urine).toBeLessThan(90);
  });
  it('su yükü: seyreltik bol idrar, sodyum az değişir; susuzluk: sodyum ↑ idrar yoğun; baskılanamayan ADH: sodyum belirgin ↓', () => {
    const w = run('su-dengesi', 'su-yuku').m;
    expect(w.urmax).toBeGreaterThan(300);
    expect(w.namin).toBeGreaterThan(134);
    const d = run('su-dengesi', 'susuzluk').m;
    expect(d.namax).toBeGreaterThan(143);
    expect(d.uosm).toBeGreaterThan(800);
    const s = run('su-dengesi', 'adh').m;
    expect(s.namin).toBeLessThan(w.namin! - 1.5);
    expect(s.urmax).toBeLessThan(120);
  });
});

describe('pıhtılaşma', () => {
  it('normal: gecikme → patlama → sönme; fibrin oluşur', () => {
    const { m, samples } = run('pihtilasma');
    expect(m.lag).toBeGreaterThan(1);
    expect(m.lag).toBeLessThan(10);
    expect(m.ttp).toBeGreaterThan(m.lag!);
    expect(m.peak).toBeGreaterThan(0.1);
    expect(samples[samples.length - 1]!.v.iia).toBeLessThan(m.peak! * 0.1);
    expect(samples[samples.length - 1]!.v.fn).toBeGreaterThan(2.5);
  });
  it('faktör eksikliği ve antitrombin: tepe ↓; protrombin ↓: toplam trombin ↓; düşük fibrinojen: trombin aynı, fibrin az', () => {
    const n = run('pihtilasma').m;
    expect(run('pihtilasma', 'faktor').m.peak).toBeLessThan(n.peak! * 0.5);
    expect(run('pihtilasma', 'antitrombin').m.etp).toBeLessThan(n.etp! * 0.5);
    expect(run('pihtilasma', 'protrombin').m.etp).toBeLessThan(n.etp! * 0.5);
    const f = run('pihtilasma', 'fibrinojen');
    expect(f.m.peak).toBeCloseTo(n.peak!, 5);
    expect(f.samples[f.samples.length - 1]!.v.fn).toBeLessThan(0.81);
    expect(run('pihtilasma', 'guclu-tetik').m.lag).toBeLessThan(n.lag!);
  });
});

describe('bağışıklık yanıtı', () => {
  it('ilk karşılaşma temizlenir; bellekle tepe çok daha düşük ve temizlenme daha erken', () => {
    const n = run('bagisiklik-yaniti').m;
    expect(n.clear).toBeGreaterThan(5);
    expect(n.clear).toBeLessThan(25);
    expect(n.peak).toBeGreaterThan(0.05);
    const mem = run('bagisiklik-yaniti', 'bellek').m;
    expect(mem.peak).toBeLessThan(n.peak! * 0.2);
    expect(mem.clear).toBeLessThan(n.clear!);
    expect(run('bagisiklik-yaniti', 'zayif-edinsel').m.clear! > n.clear! || Number.isNaN(run('bagisiklik-yaniti', 'zayif-edinsel').m.clear)).toBe(true);
    expect(run('bagisiklik-yaniti', 'zayif-dogal').m.peak).toBeGreaterThan(n.peak!);
  });
});

describe('bilirubin', () => {
  it('normal dengede; hemoliz ve konjugasyon ↓ → indirekt ↑; engel → direkt ↑', () => {
    const n = run('bilirubin').m;
    expect(n.ind).toBeCloseTo(0.6, 1);
    expect(n.dir).toBeCloseTo(0.15, 2);
    const h = run('bilirubin', 'hemoliz').m;
    expect(h.ind).toBeGreaterThan(2);
    expect(h.ind).toBeLessThan(5);
    expect(h.frac).toBeLessThan(25);
    const g = run('bilirubin', 'konjugasyon').m;
    expect(g.ind).toBeGreaterThan(1.5);
    expect(g.dir).toBeLessThan(0.3);
    const o = run('bilirubin', 'tikaniklik').m;
    expect(o.dir).toBeGreaterThan(1.5);
    expect(o.frac).toBeGreaterThan(50);
  });
});

describe('sindirim', () => {
  it('karışık öğün 1–4 saatte boşalır; emilim sırası karbonhidrat > protein > yağ; yağlı öğün daha geç', () => {
    const { m, samples } = run('sindirim-emilim');
    expect(m.t50).toBeGreaterThan(60);
    expect(m.t50).toBeLessThan(180);
    const mid = sampleAt(samples, 180)!.v;
    expect(mid.carb!).toBeGreaterThan(mid.prot!);
    expect(mid.prot!).toBeGreaterThan(mid.fat!);
    expect(run('sindirim-emilim', 'yagli').m.t50).toBeGreaterThan(m.t50!);
    expect(run('sindirim-emilim', 'hafif').m.tend).toBeLessThan(m.tend!);
    // Kütle korunumu: 6 saat sonunda emilen karbonhidrat ≤ %100.
    expect(samples[samples.length - 1]!.v.carb).toBeLessThanOrEqual(100.001);
  });
});
