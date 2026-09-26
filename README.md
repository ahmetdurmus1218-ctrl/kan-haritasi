# Kan Haritası

Laboratuvar raporunu yükle, sonuçlarını 3D vücut modelinde keşfet. Sunucu yok, hesap yok: raporlar ve sonuçlar yalnızca cihazda, şifreli durur.

> Kan Haritası teşhis koymaz. Sonuçlarını anlamana yardım eden eğitim amaçlı bir araçtır.

Mimari dokümanı: **Kan Haritası — Mimari v1** (Claude Docs). Bu depo o dokümandaki yol haritasını izler.

## Durum

| Faz | Kapsam | Durum |
| --- | --- | --- |
| 0 | Monorepo, lint güvenlik kuralları, CSP + Trusted Types, CI | ✅ |
| 1 | Şifreli kasa, dosya doğrulama, Belgelerim (yükle, görüntüle, indir, yeniden adlandır, sil), PDF ve görsel görüntüleyici, kilit, gizlilik ekranı | ✅ |
| 2 | Android kabuğu (Compose + WebView, Keystore + biyometrik, SAF, FLAG_SECURE, `INTERNET` izni yok) | ⏳ |
| 3 | Okuma hattı: PDF metni, OCR, LOINC eşleme, onay ekranı, Sonuçlarım | ⏳ `NOT CONNECTED` |
| 4 | 3D anatomi, sistem katmanları, "Vücutta göster" | ⏳ |
| 5 | Damar içi, prosedürel damar ağı, LDL eğitimsel simülasyonu | ⏳ |
| 6 | Zaman çizelgesi, şifreli yedek, Verilerimi indir | ⏳ |
| 7 | Sağlamlaştırma, performans, erişilebilirlik, lisans/atıf | ⏳ |

Henüz bağlı olmayan her şey arayüzde açıkça işaretlidir (`NOT CONNECTED`, `FAZ n`); sahte sonuç gösterilmez.

## Çalıştırma

Gereksinim: Node 20+ ve pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm verify       # lint + tip denetimi + test + derleme + güvenlik kapıları
```

**Telefonda denemek:** WebCrypto yalnızca güvenli bağlamda (HTTPS veya `localhost`) çalışır; `http://192.168.x.x` adresinde kasa açılmaz. İki yol:

- Android + USB: `adb reverse tcp:5173 tcp:5173`, sonra telefonda `http://localhost:5173`.
- HTTPS barındırma: `.github/workflows/pages.yml` iş akışını elle çalıştır (GitHub Pages). Sunucu yalnızca uygulama dosyalarını sunar; raporlar tarayıcıdan çıkmaz.

## Yapı

```
packages/
  vault/      Şifreli kasa: Argon2id → ana anahtar → dosya başına anahtar, parçalı AES-256-GCM, kripto-imha
  ingest/     Yükleme doğrulaması: imza, boyut, görsel başlığından piksel sınırı, PDF işaretleri, dosya adı temizleme
  platform/   PlatformAdapter arayüzü (Web şimdi, Android Faz 2)
apps/web/     Vite + React + Tailwind PWA; tüm ekranlar
  vite-plugins/security.ts   CSP, güvenlik başlıkları (_headers), service worker — tek kaynak
scripts/      CI güvenlik kapıları
fixtures/     Yalnızca sentetik raporlar (make_fixtures.py ile üretilir)
tests/        Depo düzeyi güvenlik testleri
```

## Faz 0–1: ne yapıldı

**Ne ve neden.** Sağlık verisi dokunan her özellik bu temelin üstüne kurulacağı için önce kasa, yükleme doğrulaması ve belge yönetimi yazıldı. Arayüz tek web çekirdeğinde; Android kabuğu aynı çekirdeği WebView içinde taşıyacak.

**Kasa (`@kh/vault`).**

- Parola → Argon2id (64 MiB, 3 iterasyon) → anahtar şifreleme anahtarı → 256 bit ana anahtar (MK) sarılır. MK yalnızca kilit açıkken, dışa aktarılamayan `CryptoKey` olarak bellekte durur.
- Her dosya kendi 256 bit anahtarıyla 1 MiB parçalar halinde AES-256-GCM ile şifrelenir. Her parçanın AAD'si dosya kimliği + parça boyutu + parça no + son parça bayrağıdır: parça sırası değişirse, dosya kesilirse veya gövde başka kayda taşınırsa açılmaz.
- Kayıtlar (ad, boyut, SHA-256, dosya anahtarı) MK ile şifrelenir, AAD kayıt türü + kimliğe bağlıdır. Depoda açık duran tek şey rastgele UUID'lerdir.
- Orijinal bayt bayt korunur; indirmede SHA-256 doğrulanır.
- Silme: önce anahtarı taşıyan kayıt, sonra şifreli gövde. Yarım kalan silmede gövde anahtarsız kalır ve bir sonraki kilit açılışında temizlenir. "Tüm verileri sil" önce sarılı MK'yı siler.

**Yükleme (`@kh/ingest`).** Uzantıya ve tarayıcının bildirdiği MIME'ye güvenilmez; imza (magic byte) belirleyicidir. 20 MB sınırı dosya okunmadan önce uygulanır. PNG/JPEG boyutu görsel çözülmeden başlıktan okunur (40 MP, kenar 8000 px) — sıkıştırma bombası koruması. PDF'te 30 sayfa sınırı, şifreli PDF ve gömülü script işaretlenir (PDF.js'te script zaten çalışmaz). Dosya adından yol bileşenleri, kontrol ve yön değiştirme karakterleri atılır.

**Tarayıcı sertleştirmesi.**

- CSP: `connect-src 'self'` (uygulamanın veri gönderebileceği bir hedef yok), `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'none'`.
- Trusted Types: `innerHTML`, `eval`, yabancı kökenli script/worker URL'leri kapalı.
- PDF.js'in CMap, font ve WASM dosyaları uygulamayla paketlenir; hiçbir CDN'e istek yok.
- Lint kuralları: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon`, `console` ve serbest `localStorage` kullanımı derlemeyi durdurur.
- Otomatik kilit (arka planda 0/1/5/15 dk), 5 hatalı denemeden sonra artan bekleme, sekme gizlenince içerik bulanıklaşır.

**Testler.** 46 birim/güvenlik testi (Vitest) + gerçek Chromium'da uçtan uca doğrulama:

| Alan | Doğrulanan |
| --- | --- |
| Kripto | Yanlış parola, NFC/NFD parola eşdeğerliği, kısa parola, kilitli kasada tüm işlemlerin reddi, meta verisinde DoS parametreleri |
| Kurcalama | Tek bayt değişikliği, parça sırası, kesme, gövdeyi başka kayda taşıma, kaydı başka kimliğe taşıma |
| Sızıntı | Depoda (OPFS + IndexedDB) açık metin, hasta adı, dosya adı veya `%PDF-` imzası yok |
| Silme | Kayıt + anahtar + gövde gider; yarım silme temizlenir; tüm verileri sil |
| Yükleme | `.pdf` uzantılı çalıştırılabilir/HTML, 20 MB+, 50.000 px PNG başlığı, kesik görsel, uzantı uyuşmazlığı, path traversal adları, çift yükleme |
| Arayüz | Dosya adındaki HTML metin olarak kalır (XSS), URL'de yalnızca UUID, bilinmeyen hata ayrıntısı gösterilmez |
| Derleme | CSP meta etiketi, satır içi script yok, izleme alan adı yok, test verisinde TC Kimlik No yok |

**Bilinen sınırlar (dürüst liste).**

- Tek dosya silmede tarayıcının depolama motoru eski baytları fiziksel olarak hemen silmeyebilir; bu baytlar şifrelidir ve anahtarları kayıtla birlikte silinir. Kesin garanti "Tüm verileri sil"dedir (ana anahtar yok edilir).
- JavaScript dizeleri bellekten silinemez; dosya anahtarları kısa süre base64 dize olarak bellekte bulunur. Ana anahtar hiçbir zaman dize olarak tutulmaz.
- Tarayıcı eklentileri açık sayfayı okuyabilir; gizlilik ekranında yazıyor.
- Argon2id ana iş parçacığında çalışır (kilit açılışında ~0,5–1 sn donma). Worker'a taşınacak.
- Web'de tarayıcı, depolama dolarsa veriyi silebilir; `persist()` istenir. Şifreli yedek Faz 6'da.
- PDF.js'in "legacy" derlemesi kullanılır: güncel derleme, Android WebView'da ve bazı Chrome sürümlerinde henüz olmayan JS API'lerine (ör. `Map.getOrInsertComputed`) ihtiyaç duyuyor.

## Lisans notu

3D anatomi modelleri (Faz 4) CC BY-SA kaynaklardan türetilecek; türetilen GLB dosyaları aynı lisansla paylaşılacak ve uygulamada atıf ekranı olacak. Uygulama kodu bundan etkilenmez.
