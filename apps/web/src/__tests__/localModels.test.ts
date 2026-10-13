/**
 * Yerel model kurulumu (manifest + SHA-256) ve gerçek çıkarım motoru (ONNX Runtime Web, WASM) ile
 * TEST AMAÇLI sahte model: bulgu → kutu → anatomi. Test modeli uygulamaya paketlenmez.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalModelProvider, type RasterImage, defaultMedicalImageProviders, modelVersionOf, runMedicalImageModel, validateManifest } from '@kh/analysis';
import { importModelFiles, listModels, memoryBackend, modelBytes, removeModel, setModelBackend, sha256Hex } from '../lib/localModels/store';
import { ortEngineFactory } from '../lib/localModels/engine';

const DIR = resolve(__dirname, '../../../../tests/fixtures/models/mock-detector');
const manifestText = readFileSync(resolve(DIR, 'manifest.json'), 'utf8');
const modelBuf = readFileSync(resolve(DIR, 'model.onnx'));
const bytes = () => modelBuf.buffer.slice(modelBuf.byteOffset, modelBuf.byteOffset + modelBuf.byteLength) as ArrayBuffer;

const file = (name: string, data: ArrayBuffer | string) => {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
  return { name, size: buf.byteLength, arrayBuffer: async () => buf as ArrayBuffer, text: async () => (typeof data === 'string' ? data : new TextDecoder().decode(buf)) };
};

describe('yerel model kurulumu', () => {
  beforeEach(() => setModelBackend(memoryBackend()));

  it('manifest + .onnx doğrulanır, SHA-256 eşleşir, kurulur ve kaldırılır', async () => {
    expect(await sha256Hex(bytes())).toBe(JSON.parse(manifestText).sha256);
    const r = await importModelFiles([file('manifest.json', manifestText), file('model.onnx', bytes())]);
    expect(r.ok).toBe(true);
    const list = await listModels();
    expect(list.map((m) => m.manifest.id)).toEqual(['kh-test-mock-detector']);
    expect(list[0]!.size).toBe(modelBuf.byteLength);
    expect((await modelBytes('kh-test-mock-detector'))?.byteLength).toBe(modelBuf.byteLength);
    await removeModel('kh-test-mock-detector');
    expect(await listModels()).toEqual([]);
  });

  it('SHA-256 uyuşmazsa, manifest yoksa ya da bozuksa model kabul edilmez', async () => {
    const tampered = new Uint8Array(bytes().slice(0));
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
    const bad = await importModelFiles([file('manifest.json', manifestText), file('model.onnx', tampered.buffer)]);
    expect(bad).toEqual({ ok: false, errors: [expect.stringMatching(/SHA-256/)] });
    expect((await importModelFiles([file('model.onnx', bytes())])).ok).toBe(false);
    expect((await importModelFiles([file('manifest.json', '{bozuk'), file('model.onnx', bytes())])).ok).toBe(false);
    expect((await importModelFiles([file('manifest.json', JSON.stringify({ ...JSON.parse(manifestText), format: 'pt' })), file('model.onnx', bytes())])).ok).toBe(false);
    expect(await listModels()).toEqual([]);
  });
});

describe('gerçek ONNX çıkarımı (test modeli, cihazda)', () => {
  it('sahte test modeli: bulgu → kutu → anatomi (beyin › frontal) → köken', async () => {
    const v = validateManifest(JSON.parse(manifestText));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const m = v.manifest;
    expect(m.name).toMatch(/TEST/);
    const W = 200;
    const H = 160;
    const gray = new Float32Array(W * H).fill(90);
    const img = { width: W, height: H, gray } as RasterImage;
    const reg = defaultMedicalImageProviders();
    reg.register(new LocalModelProvider(m, async () => new Uint8Array(bytes()), ortEngineFactory()));
    const run = await runMedicalImageModel({ images: [img], modality: 'MRI', context: {} }, reg, { identity: modelVersionOf(m), documentId: 'd1' });
    expect(run.status).toBe('ran');
    if (run.status !== 'ran') return;
    expect(run.findings).toHaveLength(1);
    const f = run.findings[0]!;
    expect(f.finding).toBe('Test bulgusu (sahte model)');
    expect(f.localization).toMatchObject({ kind: 'pixel', frame: 0, box: { x: 44, y: 29, w: 40, h: 32 } });
    expect(f.anatomicalStructure?.path).toEqual(['brain', 'brain.hemisphere-left', 'brain.frontal']);
    expect(f.provenance).toMatchObject({ derivation: 'model-derived', documentId: 'd1', model: { sha256: m.sha256 } });
    expect(f.confidence.kind === 'score' && f.confidence.value).toBeGreaterThan(0.5);
  }, 60_000);
});
