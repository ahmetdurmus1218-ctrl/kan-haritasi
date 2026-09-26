import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, readJpegSize, sanitizeFileName, validateUpload } from '../index';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function pdf(body = '1 0 obj << /Type /Catalog >> endobj'): Uint8Array {
  return ascii(`%PDF-1.7\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF`);
}

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set(ascii('IHDR'), 12);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  b.set([8, 6, 0, 0, 0], 24);
  return b;
}

/** SOI + APP0 + SOF0 + EOI; piksel verisi yok, yalnızca başlık. */
function jpeg(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}

describe('dosya imzası', () => {
  it('geçerli PDF, PNG ve JPEG kabul edilir', () => {
    const p = validateUpload({ bytes: pdf(), fileName: 'Kan Tahlili.pdf', declaredMime: 'application/pdf' });
    expect(p).toMatchObject({ ok: true, kind: 'pdf', mimeType: 'application/pdf', fileName: 'Kan Tahlili.pdf', displayName: 'Kan Tahlili' });

    expect(validateUpload({ bytes: png(1200, 1600), fileName: 'tahlil.png' })).toMatchObject({ ok: true, kind: 'png', width: 1200, height: 1600 });
    expect(validateUpload({ bytes: jpeg(4080, 3060), fileName: 'IMG_2031.JPG' })).toMatchObject({ ok: true, kind: 'jpeg', width: 4080, height: 3060 });
  });

  it('uzantısı .pdf olan çalıştırılabilir dosya reddedilir', () => {
    const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, ...new Array(60).fill(0)]);
    expect(validateUpload({ bytes: exe, fileName: 'rapor.pdf', declaredMime: 'application/pdf' })).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' });
  });

  it('HTML içeriği (.png uzantılı) reddedilir', () => {
    expect(validateUpload({ bytes: ascii('<html><script>alert(1)</script></html>'), fileName: 'x.png' })).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' });
  });

  it('desteklenmeyen uzantı, içerik PDF olsa bile reddedilir', () => {
    expect(validateUpload({ bytes: pdf(), fileName: 'rapor.exe' })).toEqual({ ok: false, code: 'UNSUPPORTED_EXTENSION' });
    expect(validateUpload({ bytes: pdf(), fileName: 'rapor.svg' })).toEqual({ ok: false, code: 'UNSUPPORTED_EXTENSION' });
  });

  it('PDF ↔ görsel uzantı uyuşmazlığı reddedilir, JPEG ↔ PNG düzeltilir', () => {
    expect(validateUpload({ bytes: pdf(), fileName: 'foto.jpg' })).toEqual({ ok: false, code: 'EXTENSION_MISMATCH' });
    expect(validateUpload({ bytes: png(100, 100), fileName: 'rapor.pdf' })).toEqual({ ok: false, code: 'EXTENSION_MISMATCH' });
    const fixed = validateUpload({ bytes: png(100, 100), fileName: 'ekran.jpg' });
    expect(fixed).toMatchObject({ ok: true, kind: 'png', fileName: 'ekran.png', warnings: ['EXTENSION_CORRECTED'] });
  });

  it('uzantısız dosya imzaya göre adlandırılır', () => {
    expect(validateUpload({ bytes: jpeg(800, 600), fileName: 'IMG_1234' })).toMatchObject({ ok: true, fileName: 'IMG_1234.jpg' });
  });

  it('tarayıcının bildirdiği MIME türüne güvenilmez, yalnızca uyarı olur', () => {
    const r = validateUpload({ bytes: pdf(), fileName: 'a.pdf', declaredMime: 'text/html' });
    expect(r).toMatchObject({ ok: true, mimeType: 'application/pdf', warnings: ['MIME_MISMATCH'] });
  });
});

describe('boyut ve sıkıştırma bombası', () => {
  it('boş ve 20 MB üstü dosya reddedilir', () => {
    expect(validateUpload({ bytes: new Uint8Array(0), fileName: 'a.pdf' })).toEqual({ ok: false, code: 'EMPTY' });
    const big = new Uint8Array(DEFAULT_LIMITS.maxBytes + 1);
    big.set(ascii('%PDF-1.7'));
    expect(validateUpload({ bytes: big, fileName: 'a.pdf' })).toEqual({ ok: false, code: 'TOO_LARGE' });
  });

  it('başlığı 50.000 × 50.000 px diyen PNG çözülmeden reddedilir', () => {
    expect(validateUpload({ bytes: png(50_000, 50_000), fileName: 'bomb.png' })).toEqual({ ok: false, code: 'IMAGE_TOO_LARGE' });
  });

  it('kenarı 8000 px üstü veya 40 MP üstü görsel reddedilir', () => {
    expect(validateUpload({ bytes: jpeg(9000, 100), fileName: 'uzun.jpg' })).toEqual({ ok: false, code: 'IMAGE_TOO_LARGE' });
    expect(validateUpload({ bytes: jpeg(7500, 7500), fileName: 'dev.jpg' })).toEqual({ ok: false, code: 'IMAGE_TOO_LARGE' });
  });

  it('kesik PNG ve boyut işaretçisi olmayan JPEG bozuk sayılır', () => {
    expect(validateUpload({ bytes: png(100, 100).slice(0, 20), fileName: 'k.png' })).toEqual({ ok: false, code: 'CORRUPT' });
    expect(validateUpload({ bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), fileName: 'k.jpg' })).toEqual({ ok: false, code: 'CORRUPT' });
    expect(readJpegSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff]))).toBeNull();
  });
});

describe('PDF güvenlik işaretleri', () => {
  it('şifreli PDF ve JavaScript içeren PDF işaretlenir', () => {
    expect(validateUpload({ bytes: pdf('trailer << /Encrypt 5 0 R >>'), fileName: 'a.pdf' })).toMatchObject({ ok: true, warnings: ['PDF_ENCRYPTED'] });
    expect(validateUpload({ bytes: pdf('<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>'), fileName: 'a.pdf' })).toMatchObject({
      ok: true,
      warnings: ['PDF_HAS_SCRIPT'],
    });
  });
});

describe('dosya adı temizleme', () => {
  it('yol bileşenleri atılır (path traversal)', () => {
    expect(sanitizeFileName('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanitizeFileName('C:\\Users\\x\\..\\rapor.pdf')).toBe('rapor.pdf');
    expect(validateUpload({ bytes: pdf(), fileName: '../../x.pdf' })).toMatchObject({ ok: true, fileName: 'x.pdf' });
  });

  it('yön değiştirme ve kontrol karakterleri atılır', () => {
    expect(sanitizeFileName('rapor\u202Efdp.exe')).toBe('raporfdp.exe');
    expect(sanitizeFileName('a\u0000b\u0007c.pdf')).toBe('abc.pdf');
    expect(sanitizeFileName('<b onmouseover=x>rapor.pdf')).toBe('b onmouseover=xrapor.pdf');
  });

  it('gizli dosya noktaları, boş ad ve aşırı uzun ad ele alınır', () => {
    expect(sanitizeFileName('...rapor.pdf')).toBe('rapor.pdf');
    expect(sanitizeFileName('   ')).toBe('belge');
    const long = sanitizeFileName(`${'ş'.repeat(300)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith('.pdf')).toBe(true);
  });
});
