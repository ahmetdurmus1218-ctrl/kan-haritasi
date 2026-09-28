import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeFrame, parseDicom, validateUpload } from '../index';

const DIR = join(__dirname, '../../../../fixtures/imaging');

describe('sentetik görüntüleme örnekleri (fixtures/imaging)', () => {
  it('MR serisi: 8 kesit, aynı seri, sıralı', () => {
    const names = readdirSync(join(DIR, 'beyin-mr')).filter((n) => n.startsWith('IM'));
    expect(names).toHaveLength(8);
    const infos = names.map((n) => parseDicom(readFileSync(join(DIR, 'beyin-mr', n))));
    expect(new Set(infos.map((i) => i.seriesUid)).size).toBe(1);
    expect(infos.map((i) => i.instanceNumber).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const first = readFileSync(join(DIR, 'beyin-mr', names[0]!));
    const f = decodeFrame(first, infos[0]!);
    expect(f.kind === 'gray' && f.max).toBeLessThan(4096);
    expect(infos[0]).toMatchObject({ modality: 'MR', bodyPart: 'BRAIN', studyDescription: 'BEYİN MR (SENTETİK)', rows: 96, bitsStored: 12 });
  });

  it('DICOMDIR reddedilir; BT kesiti örtük VR ile okunur', () => {
    expect(validateUpload({ bytes: readFileSync(join(DIR, 'beyin-mr', 'DICOMDIR')), fileName: 'DICOMDIR' })).toEqual({ ok: false, code: 'DICOM_NO_IMAGE' });
    const ct = readFileSync(join(DIR, 'toraks-bt.dcm'));
    const info = parseDicom(ct);
    expect(info).toMatchObject({ modality: 'CT', bodyPart: 'CHEST', studyDate: '2025-12-01' });
    const f = decodeFrame(ct, info);
    expect(f.kind === 'gray' && [f.min, f.max]).toEqual([-1000, 900]);
  });
});
