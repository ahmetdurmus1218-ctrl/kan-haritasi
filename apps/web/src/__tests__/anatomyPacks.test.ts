import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Matrix4 } from 'three';
import { strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import type { ModelPart } from '../anatomy/models';

// Resmi paket listesi: testte bilinen bir özetle (gerçek liste model hattından üretilir).
const GLB = new Uint8Array([103, 108, 84, 70, 2, 0, 0, 0, 12, 0, 0, 0]);
const SHA = createHash('sha256').update(GLB).digest('hex');
vi.mock('../anatomy/packs.generated', () => ({
  PACK_ALIGNMENT: { pairs: 72, meanResidualMm: 4.4, maxResidualMm: 21 },
  PACK_INDEX: [
    {
      id: 'kaslar',
      body: 'male',
      title: 'Kaslar',
      summary: '',
      file: 'anatomi-kaslar-erkek.khpack',
      sha256: SHA,
      bytes: 12,
      packBytes: 100,
      triangles: 1,
      elements: 1,
      structures: { 'skeletal-muscle': 1 },
      replaces: ['skeletal-muscle'],
      schematicReplaced: [],
      adapted: false,
    },
  ],
}));

const { verifyPack, installPack, memoryPacks, setPackBackend, PackError } = await import('../anatomy/packs');
const { mergePacks } = await import('../explore/useModels');
const { vesselParts } = await import('../explore/BodyPanels');

function manifest(over: Record<string, unknown> = {}) {
  return {
    format: 'kh-anatomy-pack',
    version: 1,
    id: 'kaslar',
    body: 'male',
    title: 'Kaslar',
    summary: '',
    model: { path: 'model.glb', sha256: SHA, bytes: GLB.byteLength, triangles: 1, elements: 1 },
    structures: { 'skeletal-muscle': 1 },
    replaces: ['skeletal-muscle'],
    schematicReplaced: [],
    adapted: false,
    sources: [{ src: 'za', name: 'Z-Anatomy', license: 'CC BY-SA 4.0', url: 'https://github.com/LluisV/Z-Anatomy' }],
    ...over,
  };
}
function pack(files: Record<string, Uint8Array>): ArrayBuffer {
  const z = zipSync(files);
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
}
const good = () => pack({ 'manifest.json': strToU8(JSON.stringify(manifest())), 'model.glb': GLB, 'ATTRIBUTION.txt': strToU8('Z-Anatomy CC BY-SA 4.0') });

describe('anatomi paketleri — doğrulama', () => {
  it('resmi listedeki özetle eşleşen paket doğrulanır ve kurulur', async () => {
    setPackBackend(memoryPacks());
    const v = await verifyPack(good());
    expect(v.manifest.id).toBe('kaslar');
    const inst = await installPack(good());
    expect(inst.key).toBe('kaslar:male');
  });

  it('ZIP olmayan, eksik, lisanssız, bozuk ya da resmi olmayan paket kurulmaz', async () => {
    await expect(verifyPack(new Uint8Array([1, 2, 3]).buffer)).rejects.toBeInstanceOf(PackError);
    await expect(verifyPack(pack({ 'manifest.json': strToU8(JSON.stringify(manifest())), 'model.glb': GLB }))).rejects.toThrow(/ATTRIBUTION/);
    await expect(
      verifyPack(pack({ 'manifest.json': strToU8(JSON.stringify(manifest({ sources: [] }))), 'model.glb': GLB, 'ATTRIBUTION.txt': strToU8('x') })),
    ).rejects.toThrow(/lisans/);
    // model.glb değiştirilmiş: manifest özeti tutmaz
    const tampered = new Uint8Array(GLB);
    tampered[11] = 9;
    await expect(verifyPack(pack({ 'manifest.json': strToU8(JSON.stringify(manifest())), 'model.glb': tampered, 'ATTRIBUTION.txt': strToU8('x') }))).rejects.toThrow(/SHA-256/);
    // manifest de değiştirilmiş ama resmi listede bu özet yok
    const sha2 = createHash('sha256').update(tampered).digest('hex');
    await expect(
      verifyPack(pack({ 'manifest.json': strToU8(JSON.stringify(manifest({ model: { path: 'model.glb', sha256: sha2, bytes: 12, triangles: 1, elements: 1 } }))), 'model.glb': tampered, 'ATTRIBUTION.txt': strToU8('x') })),
    ).rejects.toThrow(/resmi paket/);
    // listede olmayan paket kimliği
    await expect(verifyPack(pack({ 'manifest.json': strToU8(JSON.stringify(manifest({ id: 'uydurma' }))), 'model.glb': GLB, 'ATTRIBUTION.txt': strToU8('x') }))).rejects.toThrow(/resmi paket listesinde yok/);
  });
});

function part(id: string, structure: string, label: string | null, extra: Partial<ModelPart> = {}): ModelPart {
  return { id, body: 'male', asset: 'muscles', structure, label, element: null, source: null, adapted: false, geometry: new BufferGeometry(), matrix: new Matrix4(), box: new Box3(), ...extra };
}

describe('anatomi paketleri — temel modelle birleşme', () => {
  it('paket hazır olunca yerini aldığı temel yapı çıkar, paket parçaları eklenir; yüklenene kadar temel model kalır', () => {
    const base = [part('a', 'skeletal-muscle', 'thigh-l'), part('b', 'bones', 'femur-l')];
    const inst = { key: 'kaslar:male', manifest: manifest() as never, attribution: '', installedAt: '' };
    const packParts = [part('p1', 'skeletal-muscle', 'thigh-l', { asset: 'pack', pack: 'kaslar:male', element: { id: 'Vastus medialis muscle.l', en: 'Vastus medialis muscle' } })];
    const loading = mergePacks(base, [inst], new Map());
    expect(loading.parts.map((p) => p.id)).toEqual(['a', 'b']);
    expect(loading.packs[0]!.status).toBe('loading');
    const ready = mergePacks(base, [inst], new Map([['kaslar:male', packParts]]));
    expect(ready.parts.map((p) => p.id)).toEqual(['b', 'p1']);
    expect(ready.packs[0]).toMatchObject({ status: 'ready', parts: 1 });
  });

  it('tek tek yapılar (kemik, kas) panelde kendi satırını alır; uyarlanmış olanlar işaretlenir', () => {
    const parts = [
      part('1', 'bones', 'hand-l', { element: { id: 'FMA1', en: 'left first metacarpal bone', tr: 'Sol 1. el tarak kemiği', la: 'Os metacarpi I' }, source: 'bp3d3', adapted: true }),
      part('2', 'bones', 'hand-l', { element: { id: 'FMA2', en: 'left lunate', tr: 'Sol ay kemiği', la: 'Os lunatum' }, source: 'bp3d3', adapted: true }),
      part('3', 'bones', 'skull', { element: { id: 'FMA3', en: 'mandible', tr: 'Alt çene kemiği' }, source: 'bp3d3' }),
    ];
    const list = vesselParts(parts, 'bones');
    expect(list).toHaveLength(3);
    expect(list.map((v) => v.label)).toContain('Sol ay kemiği');
    const lunate = list.find((v) => v.element?.id === 'FMA2')!;
    expect(lunate).toMatchObject({ group: 'Sol el kemikleri', latin: 'Os lunatum', adapted: true, source: 'bp3d3' });
    // Türkçesi yoksa Latince yerine kaynak adı gösterilir (uydurma çeviri yok)
    expect(list.find((v) => v.element?.id === 'FMA3')!.latin).toBe('mandible');
  });
});
