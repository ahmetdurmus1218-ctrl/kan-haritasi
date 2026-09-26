# Kan Haritası

Laboratuvar raporunu yükle, sonuçlarını cihazında okut, insan vücudunun 3D modelinde keşfet. Oradan organın içine gir: doku, hücre ve biyolojik süreçler (ör. LDL ve ateroskleroz) eğitimsel simülasyonlarla anlatılır.

Sunucu yok, hesap yok. Raporlar ve sonuçlar yalnızca cihazda, şifreli durur. Android uygulamasının internet izni bile yoktur.

> **Kan Haritası teşhis koymaz ve tıbbi cihaz değildir.** Tahlil sonucunu anlamana yardım eden eğitim amaçlı bir araçtır. 3D modeldeki vurgular, bir testin genel olarak hangi yapı ve süreçlerle ilişkili olduğunu gösterir. Vücudunda bir bulgunun yerini göstermez.

## APK'yı indir (Android 11+)

- **En kolayı:** GitHub'da **Releases → `apk-son`**. Her `main` gönderiminde yenilenir. Telefondan açıp `KanHaritasi-*.apk` dosyasını indirmen yeterli.
- **Belirli bir derleme:** **Actions → Android APK →** ilgili çalıştırma → **Artifacts** → `KanHaritasi-APK-1.0.N`.

Kurulumda "bilinmeyen kaynak" izni istenir. APK, derleme sırasında `INTERNET` izni içermediği otomatik olarak doğrulanarak üretilir.

## Neler var

| Alan | İçerik |
| --- | --- |
| **Belgelerim** | PDF/JPG/PNG yükleme (imza, boyut, piksel ve sayfa sınırları), şifreli saklama, PDF ve görsel görüntüleyici (yakınlaştır, sayfa, döndür, tam ekran), orijinali bayt bayt indirme, yeniden adlandırma, silme |
| **Okuma** | PDF metin katmanı; taranmış sayfa ve fotoğraflar için cihazda OCR (Tesseract, Türkçe + İngilizce). 74 testlik LOINC kataloğu, Türkçe ondalık, birim dönüşümü, rapordaki referans aralığı, düşük güvenli satırlar işaretli |
| **Onay** | Okunan her değer onaydan geçer: düzeltme, tanınmayan satırı bir teste bağlama (kalıcı takma ad), elle ekleme, kaynağı belgede vurgulama |
| **Sonuçlarım** | Yüksek/düşük/normal, aralık çubuğu, "bu test neyi ölçer", olası etkenler, doktora sorulabilecekler |
| **Keşfet (3D)** | Sinematik açılış, sistem menüsü, katmanlar, üzerine gelince ad; tıklayınca kamera organa gider, diğerleri söner. Seviyeler: Vücut / Sistem / Organ / Yapı (tek tek damarlar, göz damarlarına kadar) / Doku / Hücre / Süreç. Sonuçların ilgili yapıları yüksek/düşük renginde nabız gibi atar |
| **İçeri gir** | Damar içi ve 8 aşamalı LDL–ateroskleroz simülasyonu; alveol ve gaz değişimi; nefron ve süzme; karaciğer lobülü; pankreas adacığı ve insülin; tiroid folikülü; kemik iliği. Oynat/duraklat, hız, aşama çizelgesi, nesneye dokununca açıklama. Ekranda her zaman **"Eğitimsel biyolojik simülasyon"** etiketi |
| **Vücutta göster** | Tahlilden keşif yolu: LDL → koroner arterler → damar içi → simülasyon; ALT → karaciğer → lobül; kreatinin → böbrek → nefron; glukoz → pankreas → adacık |
| **Zaman** | Test başına eğilim grafiği (her ölçümün kendi raporundaki referans bandıyla), noktadan rapora ve vücuda gidiş, tablo görünümü, rapor geçmişi |
| **Yedek** | `.khyedek` şifreli yedek (ayrı yedek parolası), başka cihaza geri yükleme, tekrarları atlama |
| **Verilerimi indir** | Şifresiz ZIP: orijinaller + `sonuclar.json` + `sonuclar.csv` (açık uyarıyla) |
| **Gizlilik** | Veri akışı, depolama, açma yöntemleri (parola, Android'de parmak izi/yüz/PIN), otomatik kilit, profil, tüm verileri sil |

Olmayan veya bağlanmamış her şey arayüzde açıkça yazar: harici yapay zekâ **BAĞLI DEĞİL**, kas ve mide modeli **MODEL GEREKİR**, dört bez **şematik**.

## Güvenlik modeli (kısa)

- **Kasa:** parola → Argon2id (64 MiB, 3 tur) → 256 bit ana anahtar sarılır. Her belge kendi anahtarıyla, 1 MiB'lık parçalar halinde AES-256-GCM ile şifrelenir. Parça AAD'si dosya kimliği, parça no ve son-parça bayrağını içerir: sıra değişirse, dosya kesilirse ya da taşınırsa açılmaz. Rapor ve sonuç kayıtları da ana anahtarla şifrelidir; depoda açık duran tek şey rastgele UUID'lerdir.
- **Android:** Kotlin/Compose kabuğu içinde WebView (yalnızca `appassets.androidplatform.net`). Cihaz kilidi anahtarı Android Keystore'da durur ve her kullanımda biyometri/PIN ister. `FLAG_SECURE`, `allowBackup=false`, internet izni yok, köprü yalnızca ana çerçeve ve kendi kökeni için.
- **Web:** CSP `connect-src 'self'` (veri gönderilebilecek hedef yok), Trusted Types, satır içi script yok. PDF.js, OCR ve 3D dosyalarının hepsi uygulamayla paketlenir; CDN yok. Lint kuralları `fetch`, `innerHTML`, `eval`, `console` ve serbest `localStorage` kullanımında derlemeyi durdurur.
- **Yedek:** `KHYEDEK1` başlığı + Argon2id + parçalı AES-256-GCM. Başlığın tamamı AAD'ye girer, kurcalanan yedek açılmaz.
- **Sunucu tarafı konular:** Oturum, IDOR/BOLA, CSRF ve hız sınırı gibi başlıklar bu mimaride geçerli değil, çünkü sunucu yok. Bunların karşılığı cihazdaki şifreli kasadır.

## Testler

- **86 birim/güvenlik testi (Vitest):** kripto ve kurcalama, sızıntı (depoda açık metin yok), silme, yükleme saldırıları (sahte uzantı, dev PNG başlığı, path traversal), ayrıştırıcı (gerçek PDF fixture'ında 14/14), katalog bütünlüğü, yedek (yanlış parola, kurcalanmış gövde/başlık, sürüm), ZIP, XSS.
- **Uçtan uca (gerçek Chromium, CI'da her gönderimde):**
  - `tests/e2e/smoke.py`: kasa, belgeler, görüntüleyici, indirme, silme, kilit.
  - `tests/e2e/flow.py`: PDF ve fotoğraf okuma, onay, sonuçlar, vücutta göster, simülasyon, nesne seçimi, Esc ile dönüş.
  - `tests/e2e/data.py`: zaman çizelgesi, şifreli yedek → yeni kasaya geri yükleme, ZIP doğrulaması.
  - Hepsinde: CSP ihlali yok, konsol hatası yok, uygulama dışına istek yok.
- **Derleme kapıları:** CSP meta, izleme alan adı taraması, test verisinde TC kimlik no taraması, OSV bağımlılık açıkları, APK'da `INTERNET` izni kontrolü.

## Geliştirme

Gereksinim: Node 22 ve pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm verify       # lint + tip denetimi + test + derleme + güvenlik kapıları
```

Uçtan uca testler için önce `pnpm build`, sonra `apps/web` içinde `npx vite preview --port 4173` çalıştır. Ardından `python3 tests/e2e/flow.py` (Playwright gerekir).

**Telefonda web sürümü:** WebCrypto yalnızca güvenli bağlamda çalışır. `adb reverse tcp:5173 tcp:5173` ile `http://localhost:5173` adresini kullan ya da `pages.yml` iş akışını elle çalıştırıp GitHub Pages'ten aç.

**Android:** `apps/android` (Gradle 8.14, AGP 8.7, Kotlin 2.0, minSdk 30). Web çekirdeği derlenip APK'ya varlık olarak kopyalanır: `pnpm build && cd apps/android && ./gradlew assembleRelease`.

### İmza anahtarı (önemli)

Depodaki `apps/android/keystore/kh-debug.jks` **herkese açık bir hata ayıklama anahtarıdır**. Denemek için uygundur ama gerçek dağıtım için kullanma. Kendi anahtarını tanımlamak için GitHub'da **Settings → Secrets and variables → Actions** altında şunları ekle:

| Gizli anahtar | Değer |
| --- | --- |
| `KH_KEYSTORE_B64` | `base64 -w0 benim.jks` çıktısı |
| `KH_KEYSTORE_PASSWORD` | keystore parolası |
| `KH_KEY_ALIAS` | anahtar adı |
| `KH_KEY_PASSWORD` | anahtar parolası |

Tanımlı olduklarında iş akışı otomatik olarak bu anahtarı kullanır. Not: Anahtar değişince telefondaki eski sürümün üstüne kurulum yapılamaz. Önce eski uygulamayı kaldırman gerekir; kaldırmadan önce **şifreli yedek al**.

### 3D modelleri yeniden üretmek

```bash
pnpm --filter @kh/assets-pipeline fetch   # HRA kaynaklarını belirli bir commit'ten indirir (~560 MB)
pnpm --filter @kh/assets-pipeline build   # sadeleştir, nicemle, meshopt ile sıkıştır → apps/web/public/models
```

## Yapı

```
packages/
  vault/      Şifreli kasa + şifreli yedek (Argon2id, parçalı AES-256-GCM, kripto-imha)
  ingest/     Yükleme doğrulaması
  catalog/    74 test (LOINC), birimler, aralıklar, anatomi yapıları, süreçler, açıklama metinleri
  parser/     PDF metin katmanı / OCR satırlarından sonuç çıkarma
  platform/   PlatformAdapter (web, Android köprüsü)
apps/web/     Vite + React + Tailwind; three.js / React Three Fiber
  src/anatomy/   model yükleme, malzemeler, yapı eşlemesi, şematik bezler
  src/explore/   Keşfet ekranı, sinematik kamera, gürültü geçişi, paneller
  src/explore/inside/   içeri-gir sahneleri, aşama/nesne içerikleri
apps/android/ Kotlin + Compose kabuğu (WebView, Keystore, SAF)
assets-pipeline/  HRA → uygulama GLB dönüşümü
tests/        güvenlik testleri ve uçtan uca betikler
fixtures/     yalnızca sentetik raporlar
```

## Bilinen sınırlar

- **Vücut modeli:** Tek bir erkek referans vücududur (HRA). Senin taraman değildir. Kas ve mide modeli yok. Tiroid, hipofiz, hipotalamus ve böbreküstü şematiktir. İskelet yalnızca omurga ve pelvisten oluşur.
- **Doku ve hücre sahneleri** temsilidir: prosedürel üretilmiştir, ölçekler anlaşılır olsun diye değiştirilmiştir.
- **OCR** fotoğraf kalitesine bağlıdır. Düşük güvenli satırlar işaretlenir ve hiçbir değer onaysız kaydedilmez.
- **Veri kalıcılığı:** Web'de tarayıcı, depolama dolarsa veriyi silebilir. Düzenli şifreli yedek al.
- **Bellek:** JavaScript dizeleri bellekten silinemez; belge anahtarları kısa süre bellekte bulunur. Ana anahtar hiçbir zaman dize olarak tutulmaz.
- **Kilit açılışı:** Argon2id ana iş parçacığında çalışır; kilit açılırken yaklaşık 0,5–1 saniyelik donma olur.
- **Grafik:** 3D için WebGL gerekir. Eski cihazlarda sahneler yavaş olabilir. "Hareketi azalt" ayarı açıksa geçişler sadeleşir.

## Lisanslar

- **3D anatomi modelleri:** HuBMAP Human Reference Atlas, 3D Reference Object Library, CC BY 4.0. Ayrıntı ve yapılan değişiklikler `apps/web/public/models/ATTRIBUTION.txt` dosyasında ve uygulamadaki Hakkında ekranında.
- **Açık kaynak bileşenler:** React, three.js, React Three Fiber, drei, camera-controls ve hash-wasm MIT lisanslıdır. PDF.js, Tesseract.js ve Tesseract dil modelleri Apache-2.0 lisanslıdır. Tam liste uygulamadaki Hakkında ekranında.
