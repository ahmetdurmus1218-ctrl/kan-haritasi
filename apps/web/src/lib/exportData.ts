import type { Vault } from '@kh/vault';
import { STATUS_LABEL, testByKey } from '@kh/catalog';
import { listReports } from './reports';
import { makeZip, safeEntryName, type ZipEntry } from './zip';

/**
 * "Verilerimi indir": ŞİFRESİZ bir ZIP. Kullanıcının kendi isteğiyle, kendi cihazına kaydedilir.
 *  - belgeler/     yüklenen orijinal dosyalar (değiştirilmeden)
 *  - sonuclar.json onaylanmış tüm sonuçlar (makine okunur)
 *  - sonuclar.csv  aynı veriler, tablo programları için (UTF-8, noktalı virgül)
 *  - OKUBENI.txt   içerik ve uyarı
 */
export async function buildExport(vault: Vault, onProgress?: (done: number, total: number) => void): Promise<{ bytes: Uint8Array<ArrayBuffer>; files: number; results: number }> {
  const { files } = await vault.listFiles();
  const reports = await listReports(vault);
  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  const fileNames = new Map<string, string>();

  for (let i = 0; i < files.length; i++) {
    const { info, bytes } = await vault.readFile(files[i]!.id);
    const ext = info.kind === 'pdf' ? '.pdf' : info.kind === 'png' ? '.png' : '.jpg';
    const base = safeEntryName(info.displayName.replace(/\.(pdf|png|jpe?g)$/i, ''), `belge-${i + 1}`);
    let name = `belgeler/${base}${ext}`;
    for (let n = 2; used.has(name); n++) name = `belgeler/${base}-${n}${ext}`;
    used.add(name);
    fileNames.set(info.id, name);
    entries.push({ name, data: bytes, date: new Date(info.createdAt) });
    onProgress?.(i + 1, files.length + 1);
  }

  const rows = reports.flatMap((r) =>
    r.results.map((res) => ({
      raporTarihi: r.reportDate ?? '',
      laboratuvar: r.labName ?? '',
      belge: fileNames.get(r.fileId) ?? '',
      test: testByKey.get(res.testKey)?.nameTr ?? res.rawName,
      testKodu: res.testKey,
      loinc: res.loinc,
      raporlananAd: res.rawName,
      deger: res.qualifier ? `${res.qualifier}${res.value}` : String(res.value),
      birim: res.unit,
      referans: res.refText,
      referansKaynagi: res.refSource === 'report' ? 'rapor' : res.refSource === 'catalog' ? 'genel katalog' : 'yok',
      durum: STATUS_LABEL[res.status],
      kullaniciDuzeltti: res.userEdited ? 'evet' : 'hayır',
    })),
  );

  const json = {
    uygulama: 'Kan Haritası',
    olusturma: new Date().toISOString(),
    not: 'Bu dosya şifresizdir. Sonuçlar bilgilendirme amaçlıdır; tanı yerine geçmez.',
    raporlar: reports.map((r) => ({
      raporTarihi: r.reportDate ?? null,
      laboratuvar: r.labName ?? null,
      belge: fileNames.get(r.fileId) ?? null,
      okumaYontemi: r.method,
      onayTarihi: r.createdAt,
      sonuclar: r.results.map((res) => ({
        test: testByKey.get(res.testKey)?.nameTr ?? res.rawName,
        testKodu: res.testKey,
        loinc: res.loinc,
        raporlananAd: res.rawName,
        deger: res.value,
        niteleyici: res.qualifier ?? null,
        birim: res.unit,
        kanonikDeger: res.canonicalValue,
        kanonikBirim: testByKey.get(res.testKey)?.unit ?? null,
        referansMin: res.refMin ?? null,
        referansMax: res.refMax ?? null,
        referans: res.refText,
        referansKaynagi: res.refSource,
        durum: res.status,
        kullaniciDuzeltti: res.userEdited,
      })),
    })),
  };

  const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const headers = Object.keys(rows[0] ?? { raporTarihi: '' });
  const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(String((r as Record<string, string>)[h] ?? ''))).join(';'))].join('\r\n');
  const enc = new TextEncoder();
  entries.push({ name: 'sonuclar.json', data: enc.encode(JSON.stringify(json, null, 2)) });
  entries.push({ name: 'sonuclar.csv', data: enc.encode(`\uFEFF${csv}\r\n`) });
  entries.push({
    name: 'OKUBENI.txt',
    data: enc.encode(
      [
        'Kan Haritası — verilerin',
        '',
        'Bu arşiv ŞİFRESİZDİR. Kimlerle paylaştığına ve nerede sakladığına dikkat et.',
        '',
        'belgeler/      Yüklediğin orijinal rapor dosyaları (değiştirilmedi)',
        'sonuclar.json  Onayladığın tüm sonuçlar',
        'sonuclar.csv   Aynı sonuçlar; Excel/LibreOffice ile açılabilir (ayraç: ;)',
        '',
        'Sonuçlar bilgilendirme amaçlıdır ve tıbbi tanı yerine geçmez.',
        'Şifreli ve geri yüklenebilir bir kopya için uygulamadaki "Şifreli yedek al" seçeneğini kullan.',
        '',
      ].join('\r\n'),
    ),
  });
  const bytes = makeZip(entries);
  for (const e of entries) if (e.name.startsWith('belgeler/')) e.data.fill(0);
  onProgress?.(files.length + 1, files.length + 1);
  return { bytes, files: files.length, results: rows.length };
}
