import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { interiorFor } from '@kh/analysis';
import { type Atlas, type AtlasManifest, PRESETS, families, groupOf, huToU8, labelBounds, labelLut, pick, presetById, transferLut, u8ToHu } from '../tomography/atlas';

const DIR = resolve(__dirname, '../../public/atlas/ct-body');
const manifest = JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8')) as AtlasManifest;

describe('Gerçek BT atlası (tomografi görünümü): dosya bütünlüğü ve köken', () => {
  it('manifest: kaynak, lisans (CC BY 4.0), DOI, "senin vücudun değil" notu; dosyalar SHA-256 ile doğrulanır', () => {
    expect(manifest.schema).toBe('kh-ct-atlas/1');
    expect(manifest.license).toBe('CC BY 4.0');
    expect(manifest.doi).toMatch(/^https:\/\/doi\.org\/10\.7937\//);
    expect(manifest.notes.join(' ')).toMatch(/kullanıcının vücudu değildir/);
    for (const name of ['volume.bin', 'labels.bin'] as const) {
      const buf = readFileSync(resolve(DIR, name));
      expect(createHash('sha256').update(buf).digest('hex'), name).toBe(manifest.files[name].sha256);
      const raw = gunzipSync(buf);
      expect(raw.length).toBe(manifest.shape[0] * manifest.shape[1] * manifest.shape[2]);
      expect(createHash('sha256').update(raw).digest('hex'), `${name} ham`).toBe(manifest.files[name].rawSha256);
    }
  });

  it('organ etiketleri gerçekten var: kalp, aort, karaciğer, akciğerler, böbrekler, omurlar; her ailenin iç dünyası bulunur', () => {
    const keys = new Set(manifest.labels.map((l) => l.key));
    for (const k of ['heart', 'aorta', 'liver', 'kidney_left', 'kidney_right', 'spleen']) expect(keys.has(k), k).toBe(true);
    expect([...keys].some((k) => k.startsWith('lung_'))).toBe(true);
    expect([...keys].some((k) => k.startsWith('vertebrae_'))).toBe(true);
    const fam = families(manifest.labels);
    expect(fam.find((f) => f.name === 'Omurlar')!.ids.length).toBeGreaterThan(10);
    const heart = fam.find((f) => f.ids.some((id) => manifest.labels.find((l) => l.id === id)?.key === 'heart'))!;
    expect(heart.group).toBe('heart');
    expect(interiorFor(heart.structure ?? heart.node ?? '')?.organId).toBe('heart');
    // Kalbin bu taramadaki hacmi gerçekçi (yetişkin kalbi ~ 400–1200 mL)
    expect(heart.ml).toBeGreaterThan(300);
    expect(heart.ml).toBeLessThan(1500);
  });
});

describe('HU eşlemesi ve aktarım tabloları', () => {
  it('HU ↔ 8 bit gidiş-dönüş yumuşak dokuda ~3–4 HU hassasiyetinde', () => {
    for (const hu of [-1000, -500, -100, 0, 40, 60, 200, 300, 1000]) {
      const back = u8ToHu(huToU8(hu, manifest.huMap), manifest.huMap);
      expect(Math.abs(back - hu), String(hu)).toBeLessThanOrEqual(hu > -200 && hu < 300 ? 2 : 25);
    }
  });

  it('sinematik önayarda hava saydam, kontrastlı kan ve kemik opak; kemik önayarında yumuşak doku saydam', () => {
    const tf = transferLut(presetById('cinematic'), manifest.huMap);
    const a = (hu: number) => tf[huToU8(hu, manifest.huMap) * 4 + 3]!;
    expect(a(-1000)).toBe(0);
    expect(a(-600)).toBe(0);
    expect(a(250)).toBeGreaterThan(80);
    expect(a(1200)).toBeGreaterThan(200);
    const bone = transferLut(presetById('bones'), manifest.huMap);
    expect(bone[huToU8(50, manifest.huMap) * 4 + 3]).toBe(0);
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it('organ seçiminde yalnızca seçilen etiketler görünür; kemik önayarında damar/kalp gizli', () => {
    const heart = manifest.labels.find((l) => l.key === 'heart')!;
    const liver = manifest.labels.find((l) => l.key === 'liver')!;
    const lut = labelLut(manifest.labels, presetById('cinematic'), new Set([heart.id]));
    expect(lut[heart.id * 4 + 3]).toBe(255);
    expect(lut[liver.id * 4 + 3]).toBe(0);
    expect(lut[3]).toBe(0);
    const bones = labelLut(manifest.labels, presetById('bones'));
    expect(bones[heart.id * 4 + 3]).toBe(0);
    expect(groupOf('vertebrae_L1')).toBe('bones');
    expect(groupOf('aorta')).toBe('vessels');
  });
});

describe('Dokunarak organ seçme (CPU ışın yürütme, ekrandakiyle aynı kurallar)', () => {
  // 8×8×8 sentetik hacim: ortada 4×4×4 "kalp" (300 HU, etiket 51), çevresi hava
  const shape: [number, number, number] = [8, 8, 8];
  const vol = new Uint8Array(512).fill(huToU8(-1000, manifest.huMap));
  const lab = new Uint8Array(512);
  for (let z = 2; z < 6; z++) for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
    vol[x + 8 * (y + 8 * z)] = huToU8(300, manifest.huMap);
    lab[x + 8 * (y + 8 * z)] = 51;
  }
  const atlas: Atlas = { manifest: { ...manifest, shape, labels: [{ id: 51, key: 'heart', finding: 'Kalp', ml: 1 }] }, volume: vol, labels: lab };
  const tf = transferLut(presetById('cinematic'), manifest.huMap);
  const all = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] };

  it('önden atılan ışın kalbe çarpar; ıska geçen ışın boş döner', () => {
    const lut = labelLut(atlas.manifest.labels, presetById('cinematic'));
    const hit = pick(atlas, tf, lut, [0.5, 1.5, 0.5], [0, -1, 0], all);
    expect(hit?.label).toBe(51);
    expect(hit!.hu).toBeGreaterThan(250);
    expect(pick(atlas, tf, lut, [0.05, 1.5, 0.05], [0, -1, 0], all)).toBeNull();
  });

  it('kesim kutusu kalbi dışarıda bırakınca seçilmez; seçili olmayan (soluk) organ kolay seçilmez', () => {
    const lut = labelLut(atlas.manifest.labels, presetById('cinematic'));
    expect(pick(atlas, tf, lut, [0.5, 1.5, 0.5], [0, -1, 0], { min: [0, 0, 0], max: [1, 1, 0.2] })).toBeNull();
    const ghosted = labelLut(atlas.manifest.labels, presetById('cinematic'), new Set([99]));
    expect(pick(atlas, tf, ghosted, [0.5, 1.5, 0.5], [0, -1, 0], all, 0.01)?.label ?? null).not.toBe(51);
    const b = labelBounds(atlas, new Set([51]))!;
    expect(b.center.every((c) => Math.abs(c - 0.44) < 0.1)).toBe(true);
  });
});
