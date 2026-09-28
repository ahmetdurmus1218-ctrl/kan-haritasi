import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FileInfo } from '@kh/vault';
import { DocumentRow } from '../screens/DocumentsPage';
import { parseHash } from '../state/router';
import { nextBlockDelayMs } from '../state/settings';
import { userMessage, GENERIC_ERROR } from '../lib/messages';

const file = (displayName: string): FileInfo => ({
  id: '11111111-2222-4333-8444-555555555555',
  displayName,
  originalFileName: 'x.pdf',
  mimeType: 'application/pdf',
  kind: 'pdf',
  size: 1234,
  sha256: 'a'.repeat(64),
  createdAt: '2026-09-12T08:40:00.000Z',
  category: 'lab',
});

describe('XSS', () => {
  it('dosya adındaki HTML metin olarak basılır, öğe olarak değil', () => {
    const noop = () => undefined;
    const html = renderToStaticMarkup(
      <ul>
        <DocumentRow file={file('<img src=x onerror=alert(1)>')} busy={false} onOpen={noop} onDownload={noop} onRename={noop} onDelete={noop} />
      </ul>,
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('yönlendirme', () => {
  it('URL yalnızca geçerli UUID kabul eder; yol ifadeleri listeye döner', () => {
    expect(parseHash('#/belge/11111111-2222-4333-8444-555555555555')).toEqual({ name: 'document', id: '11111111-2222-4333-8444-555555555555' });
    expect(parseHash('#/belge/../../etc/passwd')).toEqual({ name: 'documents' });
    expect(parseHash('#/belge/<script>')).toEqual({ name: 'documents' });
    expect(parseHash('#/bilinmeyen')).toEqual({ name: 'documents' });
  });
});

describe('kilit denemesi sınırlaması', () => {
  it('5 hatadan sonra artan bekleme, en fazla 15 dk', () => {
    expect(nextBlockDelayMs(4)).toBe(0);
    expect(nextBlockDelayMs(5)).toBe(30_000);
    expect(nextBlockDelayMs(6)).toBe(60_000);
    expect(nextBlockDelayMs(40)).toBe(15 * 60_000);
  });
});

describe('hata mesajları', () => {
  it('bilinmeyen hatanın ayrıntısı kullanıcıya gösterilmez', () => {
    expect(userMessage(new Error('IndexedDB failed at /internal/path 10.2.0.5'))).toBe(GENERIC_ERROR);
  });
});
