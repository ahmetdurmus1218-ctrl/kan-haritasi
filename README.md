# Kan Haritası

Laboratuvar raporunu yükle, sonuçlarını cihazında okut, insan vücudunun 3D modelinde keşfet. MR, tomografi (BT), röntgen ve ultrason görüntülerini ve raporlarını da aynı şifreli kasada sakla ve görüntüle. Oradan organın içine gir: doku, hücre ve biyolojik süreçler (ör. LDL ve ateroskleroz) eğitimsel simülasyonlarla anlatılır.

Sunucu yok, hesap yok. Raporlar ve sonuçlar yalnızca cihazda, şifreli durur. Android uygulamasının internet izni bile yoktur.

> **Kan Haritası teşhis koymaz ve tıbbi cihaz değildir.** Tahlil sonucunu anlamana yardım eden eğitim amaçlı bir araçtır. 3D modeldeki vurgular, bir testin genel olarak hangi yapı ve süreçlerle ilişkili olduğunu gösterir. Vücudunda bir bulgunun yerini göstermez.

## iPhone, iPad ve bilgisayarda (web)

**https://ahmetdurmus1218-ctrl.github.io/kan-haritasi/** — Safari, Chrome, Edge ve Firefox'ta çalışır; her `main` gönderiminde güncellenir (`gh-pages` dalı).

> İlk kurulumda bir kez: GitHub'da **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / `(root)` → Save**.

- **iPhone/iPad:** Safari'de aç → Paylaş → **Ana Ekrana Ekle**. Uygulama gibi tam ekran açılır, ilk açılıştan sonra çevrimdışı da çalışır.
- Web sürümünde de her şey cihazda kalır: sayfa yalnızca uygulama dosyalarını indirir, rapor ve sonuçlar tarayıcının şifreli kasasında durur.
- Telefon ile bilgisayar arasında otomatik eşitleme **yoktur** (sunucu yok, bilinçli karar). Verileri taşımak için bir cihazda şifreli yedek al, öbüründe geri yükle.

## APK'yı indir (Android 11+)

- **En kolayı:** GitHub'da **Releases → `apk-son`**. Her `main` gönderiminde yenilenir. Telefondan açıp `KanHaritasi-*.apk` dosyasını indirmen yeterli.
- **Belirli bir derleme:** **Actions → Android APK →** ilgili çalıştırma → **Artifacts** → `KanHaritasi-APK-1.0.N`.

Kurulumda "bilinmeyen kaynak" izni istenir. APK, derleme sırasında `INTERNET` izni içermediği otomatik olarak doğrulanarak üretilir.

## Neler var

| Alan | İçerik |
| --- | --- |
| **Belgelerim** | PDF/JPG/PNG/DICOM yükleme, tahlil/görüntüleme filtresi (imza, boyut, piksel ve sayfa sınırları), şifreli saklama, PDF ve görsel görüntüleyici (yakınlaştır, sayfa, döndür, tam ekran), orijinali bayt bayt indirme, yeniden adlandırma, silme |
| **Okuma** | PDF metin katmanı; taranmış sayfa, fotoğraf ve ekran görüntüsü (ör. e-Nabız) için cihazda OCR (Tesseract, Türkçe). Görüntüler iki farklı sayfa bölütlemesiyle okunur; iki okumanın uyuşmadığı değerler doğrulamaya düşer. 81 testlik LOINC kataloğu (hemogram ve akyuvar alt türleri, biyokimya, lipid, tiroid, cinsiyet hormonları, kortizol, prolaktin, vitamin-mineral, demir, pıhtılaşma), Türkçe ondalık, birim dönüşümü, farklı sütun düzenleri, rapordaki referans aralığı (etiketli, cinsiyete ya da döngü evresine göre verilen aralıklar dahil), düşük güvenli satırlar işaretli |
| **Görüntüleme (MR, BT, röntgen, ultrason)** | Yüklerken belge türü seçilir (Tahlil / MR / Tomografi (BT) / Röntgen / Ultrason / Diğer). **DICOM** dosyaları (CD/USB'deki `.dcm` veya uzantısız `IM000001` gibi dosyalar) cihazda okunur: masaüstünde **klasör seçerek** içe aktarma (DICOMDIR ve görüntüleyici programları atlanır), aynı seriye ait kesitler listede tek satır ve tek görüntüleyicide. Görüntüleyici: kesit kaydırma (tekerlek, ok tuşları, kaydırıcı), pencere/seviye (sağ tıkla sürükle ya da kontrast aracı), BT ön ayarları (yumuşak doku, akciğer, kemik, beyin, karaciğer; Hounsfield), negatif, yakınlaştırma, tam ekran. Sıkıştırmasız, RLE ve JPEG Baseline çözülür; JPEG 2000 / JPEG-LS tanınır ama çözülmez (dosya saklanır, açıkça söylenir). Tür, bölge (beyin, bel omurgası, diz, toraks…), çekim tarihi ve seri başlıktan otomatik gelir; **hasta adı ve kimlik numarası okunmaz, gösterilmez**. Radyoloji raporu (PDF/fotoğraf) okunur, Klinik bilgi / Teknik / Bulgular / Sonuç bölümlerine ayrılır, elle düzeltilebilir; raporda geçen ~45 terimin (hiperintens, protrüzyon, stenoz, konsolidasyon, BI-RADS…) genel anlamı gösterilir, bölge 3B vücutta açılır. **Fotoğrafı çekilmiş film veya ekran görüntüsü** (JPG/PNG) de aynı görüntüleyicide açılır: otomatik kontrast, pencere/seviye, negatif, döndürme. Kâğıt rapor fotoğrafı kendiliğinden okunur; film fotoğrafında okuma yapılmaz. Tahlil diye yüklenen film fotoğrafında OCR'dan önce "görüntüleme mi?" diye sorulur; değer bulunamayan belgede de aynı seçenek çıkar. Görüntüleme raporları **Sonuçlar** ekranında (raporun kendi "Sonuç" bölümü ve terimleriyle), **Zaman** ekranının rapor geçmişinde ve **Keşfet**'te ilgili organın bulutunda ("Görüntülemem") ve organ panelinde ("Görüntülemelerin", raporun sonucuyla) görünür. **Ölçümler tahlil gibi:** raporda yazan ölçümler (dalak/karaciğer/böbrek boyu, koledok, portal ven, aort çapı, prostat ve tiroid hacmi, kardiyotorasik oran, Evans indeksi, orta hat kayması, bel/boyun kanalı çapı, akciğer nodülü, EF, sol karıncık ve kulakçık, pulmoner basınç, karotis IMT, kemik yoğunluğu T-skoru — 25 ölçüm) otomatik okunur ve genel referans aralığına göre Normal / Yüksek / Düşük gösterilir; açınca ne ölçtüğü, olası nedenler (kesin değil), doktora sorulabilecekler, vücutta göster ve içeri gir. Görüntü üzerinde **cetvel** (DICOM'da mm), **iki çizgiden oran** (fotoğrafta da) ve BT'de **yoğunluk (HU)** ölçülüp aynı şekilde kaydedilir. Referans dışı ölçümler 3B vücutta ilgili organı tahliller gibi renklendirir. **Otomatik görüntü incelemesi (deneysel):** yazısı ve raporu olmayan MR/BT fotoğrafı ya da DICOM kesiti cihazda incelenir: kolaj kesitlere ayrılır, her kesitte orta hat (eğiklik dahil) bulunur, sağ yarı sol yarının ayna görüntüsüyle karşılaştırılır ve karşı tarafa göre belirgin daha parlak/koyu kalan alanlar fark haritası ve kutuyla işaretlenir ("Kesit 2 · görüntünün sol üst kısmı · daha parlak"). Yandan (sagital) ve simetrik olmayan kesitler karşılaştırılmaz ve bu açıkça yazılır; kesitlerin şekli baş kesitine benziyorsa bölge olarak "Beyin" önerilir (onay ister). Kullanıcı "Sonuçlarıma ekle" derse 3B'de ilgili organ işaretlenir ve organ panelindeki "Sonucuma göre" bu görüntüyü açar. Bu bir sağ-sol fark ölçümüdür, tanı değildir: normal asimetriler, sinüsler, baş eğikliği ve fotoğraf açısı yanlış işarete; iki tarafı eşit etkileyen değişiklikler kaçırılmaya yol açabilir. Uygulama görüntüye bakıp teşhis koymaz. Her görüntüleme belgesinde **Vücutta göster** vardır; bölge bilinmiyorsa önce bölge sorulur, seçilen bölge belgeye kaydedilir. Aynı çekime ait görüntü ve rapor (aynı tür ve tarih ya da aynı bölge, 7 güne kadar arayla) birbirine bağlanır: MR kesitleri raporun sonucunu da gösterir. Uygulama görüntüyü veya raporu **yorumlamaz**; otomatik inceleme yalnızca sağ-sol farkını gösterir |
| **Onay** | Okunan her değer onaydan geçer: düzeltme, tanınmayan satırı bir teste bağlama (kalıcı takma ad), elle ekleme, kaynağı belgede vurgulama |
| **Sonuçlarım** | Yüksek/düşük/normal, aralık çubuğu, "bu test neyi ölçer", olası etkenler, doktora sorulabilecekler |
| **Keşfet (3D)** | Seçilebilir **erkek ve kadın** vücudu (48 yapı, her vücutta 300+ ayrı bölüm: kalp odacıkları ve kapakları, 22 beyin bölgesi, göz katmanları, böbrek iç yapısı, akciğer lobları, karaciğer segmentleri, diz bağları…; Türkçe ve Latince adlar). Sonuçla ilişkili organlar belirgin, diğerleri soluk; organa dokununca küçük dijital **bilgi bulutu** (Sonucum · Temelde nasıl çalışır · Sonucuma göre · İçeri gir). Arama (Türkçe/Latince, Ctrl+K), izole et, gizle, kesit görünümü, iç anatomi, klavye kısayolları, açık/koyu/sistem teması. Seviyeler: İnsan / Sistem / Organ / Bölüm / Doku / Hücre / Süreç |
| **İçeri gir** | 22 simülasyon sahnesi + 20 doku atlası sahnesi (her 3B yapının içine girilebilir). Simülasyonlar: damar içi ve 8 aşamalı LDL–ateroskleroz; kan hücreleri; alveol ve gaz değişimi; nefron ve süzme; karaciğer lobülü; pankreas adacığı; tiroid folikülü; kemik iliği; nöron ve sinaps (sinir sinyali); retina (görme); koklea (işitme); kalp kası (kasılma); sarkomer (kas kasılması); osteon (kemik yenilenmesi); mide bezi (sindirim, B12); bağırsak villusu (emilim); deri (D vitamini); hücre ve enerji (ATP); hormon salgısı; lenf düğümü (bağışıklık); yumurtalık; testis. Her sahne "Temelde nasıl çalışır" (tipik değerler) ya da "Sonucuma göre" (senin değerlerin) açılabilir. Sahnedeki sayı, boyut ve renkler kişinin son sonuçlarına göre çizilir; "tipik değerler" ile karşılaştırılabilir. Oynat/duraklat, hız, aşama çizelgesi, nesneye dokununca açıklama. Ekranda her zaman **"Eğitimsel biyolojik simülasyon"** etiketi. **Doku atlası** (`src/explore/inside/tissues.ts`, veriyle tanımlı, tek bir prosedürel sahneyle çizilir): yemek borusu, kalın bağırsak, safra kesesi, mesane, prostat, rahim, fallop tüpü, vajina, meme, eklem kıkırdağı, solunum yolu, timus, bademcik, hipofiz, böbreküstü bezi, epifiz, dalak, toplardamar duvarı, ekzokrin pankreas, vas deferens. Duvar katmanları lümenden dışa sıralı; katmana dokununca kamera o katmana iner; peristaltizm, sil vuruşu, salgı ve akış basit animasyonla gösterilir. Bu sahneler **"Doku atlası · şematik"** etiketlidir ve sonuçlara göre değişmez. Her yapının sahneleri "kendi dokusu / ortak doku tipi / ilişkili doku" diye etiketlenir; ilişkili doku (ör. safra kesesinden karaciğer lobülüne) asla kendi dokusu gibi gösterilmez. Yeni organ eklemek için `tissues.ts`'e bir profil ve `anatomy/organs.ts`'e bir bağlantı yeterlidir |
| **Vücutta göster** | Tahlilden keşif yolu: LDL → koroner arterler → damar içi → simülasyon; hemogram → kan hücreleri; ALT → karaciğer → lobül; kreatinin → böbrek → nefron; glukoz → pankreas → adacık; CK → iskelet kasları. Aralık dışı bulgular arasında ileri/geri gezinme. CRP, lökosit, ferritin gibi tek bir organa özgü olmayan testler bunu açıkça belirtir |
| **Zaman** | Test başına eğilim grafiği (her ölçümün kendi raporundaki referans bandıyla), noktadan rapora ve vücuda gidiş, tablo görünümü, rapor geçmişi |
| **Yedek** | `.khyedek` şifreli yedek (ayrı yedek parolası), başka cihaza geri yükleme, tekrarları atlama |
| **Verilerimi indir** | Şifresiz ZIP: orijinaller + `sonuclar.json` + `sonuclar.csv` (açık uyarıyla) |
| **Gizlilik** | Veri akışı, depolama, açma yöntemleri (parola, Android'de parmak izi/yüz/PIN), otomatik kilit, profil, tüm verileri sil |

Olmayan veya bağlanmamış her şey arayüzde açıkça yazar: harici yapay zekâ **BAĞLI DEĞİL**; tiroid, kulak, kol-bacak damarları ve periferik sinirler **şematik**. Uygulamadaki **Kapsam raporu** (`#/kapsam`) her yapı için iki vücutta dış görünüm, bölüm sayısı, iç keşif derinliği (simülasyon / şematik doku atlası / yalnızca ilişkili doku), sahne ve süreç durumunu model dosyalarından ve uygulama verisinden okuyarak gösterir.

## Güvenlik modeli (kısa)

- **Kasa:** parola → Argon2id (64 MiB, 3 tur) → 256 bit ana anahtar sarılır. Her belge kendi anahtarıyla, 1 MiB'lık parçalar halinde AES-256-GCM ile şifrelenir. Parça AAD'si dosya kimliği, parça no ve son-parça bayrağını içerir: sıra değişirse, dosya kesilirse ya da taşınırsa açılmaz. Rapor ve sonuç kayıtları da ana anahtarla şifrelidir; depoda açık duran tek şey rastgele UUID'lerdir.
- **Android:** Kotlin/Compose kabuğu içinde WebView (yalnızca `appassets.androidplatform.net`). Cihaz kilidi anahtarı Android Keystore'da durur ve her kullanımda biyometri/PIN ister. `FLAG_SECURE`, `allowBackup=false`, internet izni yok, köprü yalnızca ana çerçeve ve kendi kökeni için.
- **Web:** CSP `connect-src 'self'` (veri gönderilebilecek hedef yok), Trusted Types, satır içi script yok. PDF.js, OCR ve 3D dosyalarının hepsi uygulamayla paketlenir; CDN yok. Lint kuralları `fetch`, `innerHTML`, `eval`, `console` ve serbest `localStorage` kullanımında derlemeyi durdurur.
- **Yedek:** `KHYEDEK1` başlığı + Argon2id + parçalı AES-256-GCM. Başlığın tamamı AAD'ye girer, kurcalanan yedek açılmaz.
- **Sunucu tarafı konular:** Oturum, IDOR/BOLA, CSRF ve hız sınırı gibi başlıklar bu mimaride geçerli değil, çünkü sunucu yok. Bunların karşılığı cihazdaki şifreli kasadır.

## Testler

- **151 birim/güvenlik testi (Vitest):** kripto ve kurcalama, sızıntı (depoda açık metin yok), silme, yükleme saldırıları (sahte uzantı, dev PNG başlığı, path traversal), ayrıştırıcı, katalog bütünlüğü, yorum motoru, yedek (yanlış parola, kurcalanmış gövde/başlık, sürüm), ZIP, XSS.
- **Sentetik rapor seti (`fixtures/`):** 7 PDF (hemogram, biyokimya, kadın hormon, vitamin-mineral, lipid, çoklu anormallik, genel) ve 4 görüntü (eğik telefon fotoğrafı, gürültülü tarama, e-Nabız benzeri ekran görüntüsü, düz tarama); her biri farklı bir laboratuvar düzeni. PDF'lerde her satırın değeri, durumu ve beklenen yorum örüntüleri; görüntülerde gerçek Tesseract ile okuma ve **yanlış okunan hiçbir değerin doğrulama işareti olmadan geçmemesi** test edilir.
- **Uçtan uca (gerçek Chromium, CI'da her gönderimde):**
  - `tests/e2e/smoke.py`: kasa, belgeler, görüntüleyici, indirme, silme, kilit.
  - `tests/e2e/flow.py`: PDF ve fotoğraf okuma, onay, sonuçlar, vücutta göster, simülasyon, nesne seçimi, Esc ile dönüş.
  - `tests/e2e/data.py`: zaman çizelgesi, şifreli yedek → yeni kasaya geri yükleme, ZIP doğrulaması.
  - `tests/e2e/reports.py`: 9 farklı raporun uygulamada okunması, onayı, özet sayıları, çoklu bulgu örüntüleri, doğrulama listesi, tek organa özgü olmayan test, 3B'ye geçiş ve bulgular arası gezinme.
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

**Telefonda web sürümü:** WebCrypto yalnızca güvenli bağlamda çalışır. `adb reverse tcp:5173 tcp:5173` ile `http://localhost:5173` adresini kullan ya da GitHub Pages sürümünü aç (her `main` gönderiminde `pages.yml` ile yayımlanır).

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
pnpm --filter @kh/assets-pipeline fetch   # HRA ve BodyParts3D kaynaklarını belirli commit'lerden indirir (~1,7 GB)
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
  src/anatomy/   model yükleme, malzemeler, yapı eşlemesi, şematik tiroid
  src/explore/   Keşfet ekranı, sinematik kamera, gürültü geçişi, paneller
  src/explore/inside/   içeri-gir sahneleri, aşama/nesne içerikleri
apps/android/ Kotlin + Compose kabuğu (WebView, Keystore, SAF)
assets-pipeline/  HRA + BodyParts3D → uygulama GLB dönüşümü
tests/        güvenlik testleri ve uçtan uca betikler
fixtures/     yalnızca sentetik raporlar
```

## Bilinen sınırlar

- **Vücut modelleri:** Erkek ve kadın referans vücutları: organlar ve damarlar HRA'dan (VH Male / VH Female); erkek derisi, iskelet ve kaslar BodyParts3D'den. Kadın vücudunda BodyParts3D kemik ve kasları erkek → kadın benzerlik dönüşümüyle yerleştirildi (ortalama sapma ≈ 1,3 cm); kollar ve bacaklar her eklemin etrafında döndürülerek kadın derisine oturtuldu (`assets-pipeline/fit.ts`), diz kıkırdağı ve bağları iki vücutta da kemiklere ICP ile oturtuldu. `pnpm --filter @kh/assets-pipeline check-fit` her parçanın derinin dışında kalan oranını ölçer. Senin taraman değildir. Tiroid, kulak, kol-bacak damarları ve periferik sinirler şematiktir. Doku/hücre/süreç sahneleri prosedürel ve temsilidir; molekül düzeyi yalnızca temsili parçacıklarla anlatılır.
- **Eşitleme:** Cihazlar arası otomatik eşitleme yok (sunucu ve hesap yok). Taşıma şifreli yedek dosyasıyla yapılır.
- **Doku ve hücre sahneleri** temsilidir: prosedürel üretilmiştir, ölçekler anlaşılır olsun diye değiştirilmiştir.
- **OCR** fotoğraf kalitesine bağlıdır. Türkçe modelde "%" işareti sık sık başka karakter okunur (uygulama testin adına bakarak düzeltir ve bunu işaretler); çok bozuk satırlar (ör. "0,7" yerine "0/7") okunamaz ve elle girilmelidir. Düşük güvenli ya da iki okumada farklı çıkan değerler işaretlenir; hiçbir değer onaysız kaydedilmez.
- **Döngü evresine göre verilen hormon aralıkları** (östradiol, progesteron, FSH, LH) otomatik değerlendirilmez: hangi evrenin geçerli olduğunu yazılım bilemez; kullanıcıdan uygun aralığı girmesi istenir.
- **Veri kalıcılığı:** Web'de tarayıcı, depolama dolarsa veriyi silebilir. Düzenli şifreli yedek al.
- **Bellek:** JavaScript dizeleri bellekten silinemez; belge anahtarları kısa süre bellekte bulunur. Ana anahtar hiçbir zaman dize olarak tutulmaz.
- **Kilit açılışı:** Argon2id ana iş parçacığında çalışır; kilit açılırken yaklaşık 0,5–1 saniyelik donma olur.
- **Grafik:** 3D için WebGL gerekir. Eski cihazlarda sahneler yavaş olabilir. "Hareketi azalt" ayarı açıksa geçişler sadeleşir.

## Lisanslar

- **3D anatomi modelleri:** HuBMAP Human Reference Atlas, 3D Reference Object Library, CC BY 4.0 (organlar, damarlar); BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP (erkek derisi, iskelet, kaslar ve bazı organlar — bu parçaları içeren model dosyaları aynı lisansla dağıtılır). Ayrıntı ve yapılan değişiklikler `apps/web/public/models/ATTRIBUTION.txt` dosyasında ve uygulamadaki Hakkında ekranında.
- **Açık kaynak bileşenler:** React, three.js, React Three Fiber, drei, camera-controls ve hash-wasm MIT lisanslıdır. PDF.js, Tesseract.js ve Tesseract dil modelleri Apache-2.0 lisanslıdır. Tam liste uygulamadaki Hakkında ekranında.
