import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODEL_RESEARCH, OLD_INVENTORY_TASKS, type ModelResearchRecord, adapterGroupOf, renderResearchMarkdown, researchReport, validateResearchRegistry } from '../modelRegistry';

const ROOT = resolve(__dirname, '../../../..');
const AI = resolve(ROOT, 'apps/web/public/ai-models');
const byId = (id: string) => MODEL_RESEARCH.find((r) => r.id === id)!;

describe('model araştırma kaydı', () => {
  it('kurallara uyar (VERIFIED kanıtı, sahte konum yok, "erişemedim" tek başına UNAVAILABLE değil, lisans)', () => {
    expect(validateResearchRegistry(MODEL_RESEARCH)).toEqual([]);
  });

  it('eski 19 "eklenemedi" kaydının her biri yeniden denetlendi (RECHECKED)', () => {
    expect(OLD_INVENTORY_TASKS).toHaveLength(19);
    const rep = researchReport();
    expect(rep.rechecked).toBe(19);
    // Yeniden araştırmada durumu değişenler: kanama (VERIFIED), polip (VERIFIED paket), MONAI/MedSAM (AVAILABLE) …
    expect(rep.recheckChanged).toBeGreaterThanOrEqual(10);
    expect(byId('totalseg-ct-cerebral-bleed').recheck?.previousEntry).toBe('Beyin içi kanama');
    expect(byId('depthpolyp-kvasir').recheck?.previousEntry).toBe('Polip, kanama, lezyon');
  });

  it('uygulamayla gelen her model kayıtta VERIFIED ve manifestiyle aynı (sürüm, kaynak ağırlık özeti)', () => {
    const index = JSON.parse(readFileSync(resolve(AI, 'index.json'), 'utf8')) as { models: string[] };
    const bundled = MODEL_RESEARCH.filter((r) => r.distribution === 'bundled');
    expect(bundled.map((r) => r.manifestId).sort()).toEqual([...index.models].sort());
    for (const r of bundled) {
      const m = JSON.parse(readFileSync(resolve(AI, r.manifestId!, 'manifest.json'), 'utf8')) as { version: string; upstream?: { weights: string; weightsSha256: string } };
      expect(r.status, r.id).toBe('VERIFIED');
      expect(m.version, r.id).toBe(r.version);
      expect(m.upstream?.weights.replace(/^https:\/\//, ''), r.id).toBe(r.weightsUrl);
      expect(`sha256:${m.upstream?.weightsSha256}`, r.id).toBe(r.checksum);
    }
  });

  it('isteğe bağlı paketler: kayıttaki paket manifesti uygulamanın paket listesinde', () => {
    const packs = JSON.parse(readFileSync(resolve(AI, 'packs.json'), 'utf8')) as { packs: Array<{ id: string; upstream?: { weightsSha256: string } }> };
    const p = MODEL_RESEARCH.filter((r) => r.distribution === 'pack' && r.id !== 'xrv-pspnet-chestxdet');
    for (const r of p) {
      const m = packs.packs.find((x) => x.id === r.manifestId);
      expect(m, r.id).toBeDefined();
      expect(`sha256:${m!.upstream?.weightsSha256}`).toBe(r.checksum);
    }
  });

  it('sınıflandırıcılar (röntgen, mamografi yoğunluğu, patoloji yaması) konum vermez', () => {
    for (const id of ['xrv-densenet121-nih', 'monai-breast-density', 'monai-pathology-tumor', 'xrv-chex-mimic']) expect(byId(id).capabilities.localization, id).toBe('none');
    const bad: ModelResearchRecord = { ...byId('xrv-densenet121-nih'), id: 'x', capabilities: { ...byId('xrv-densenet121-nih').capabilities, localization: 'box' } };
    expect(validateResearchRegistry([...MODEL_RESEARCH, bad]).some((e) => e.includes('sınıflandırıcı konum veremez'))).toBe(true);
  });

  it('erişim engeli UNAVAILABLE nedeni sayılmaz; doğrulanmamış model VERIFIED / dağıtılmış gösterilemez', () => {
    const base = byId('medsam');
    const asUnavailable: ModelResearchRecord = { ...base, id: 'y', status: 'UNAVAILABLE', weightsUrl: 'https://example.invalid/w.pt', sourcesChecked: ['x'] };
    const errs = validateResearchRegistry([...MODEL_RESEARCH, asUnavailable]);
    expect(errs.some((e) => e.includes('en az 3 kaynak'))).toBe(true);
    expect(errs.some((e) => e.includes('ağırlık adresi biliniyorsa UNAVAILABLE değil'))).toBe(true);
    const fakeVerified: ModelResearchRecord = { ...base, id: 'z', status: 'VERIFIED', verified: true };
    expect(validateResearchRegistry([...MODEL_RESEARCH, fakeVerified]).some((e) => e.includes('SHA-256'))).toBe(true);
    const leaked: ModelResearchRecord = { ...byId('echonet-dynamic'), id: 'w', distribution: 'bundled' };
    expect(validateResearchRegistry([...MODEL_RESEARCH, leaked]).some((e) => e.includes('gömülemez'))).toBe(true);
  });

  it('rapor: her durum sayılır, her kaydın nedeni var; modalite grupları', () => {
    const rep = researchReport();
    expect(Object.values(rep.counts).reduce((a, b) => a + b, 0)).toBe(rep.total);
    expect(rep.counts.VERIFIED).toBeGreaterThanOrEqual(8);
    for (const l of rep.lines) expect(l.reason.length, l.id).toBeGreaterThan(20);
    for (const g of ['CT', 'MRI', 'XRAY', 'ECHO', 'ECG', 'PATHOLOGY', 'OCT', 'FUNDUS', 'ENDOSCOPY', 'PET', 'DEXA', 'ANGIO', 'DENTAL', 'MAMMOGRAPHY'] as const) expect(rep.byModality.find((m) => m.group === g)!.total, g).toBeGreaterThan(0);
    expect(adapterGroupOf('COLONOSCOPY')).toBe('ENDOSCOPY');
    expect(adapterGroupOf('ECHOCARDIOGRAPHY')).toBe('ECHO');
    expect(adapterGroupOf('DOCUMENT')).toBeNull();
  });

  it('docs/MODEL_RESEARCH.md kayıttan üretilmiş ve güncel (yenilemek için KH_UPDATE_DOCS=1)', () => {
    const path = resolve(ROOT, 'docs/MODEL_RESEARCH.md');
    const md = renderResearchMarkdown();
    if (process.env.KH_UPDATE_DOCS) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, md);
    }
    expect(existsSync(path)).toBe(true);
    // Büyük metinde fark dökümü yerine eşitlik: belge eskiyse KH_UPDATE_DOCS=1 ile yeniden üret
    expect(readFileSync(path, 'utf8') === md, 'docs/MODEL_RESEARCH.md güncel değil').toBe(true);
  });
});
