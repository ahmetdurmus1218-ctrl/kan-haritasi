# Kan Haritası

**Dijital vücut haritası:** elindeki sağlık verisini — tahlil, rapor ve **ham tıbbi görüntünün kendisi** — mümkün olduğunca kaynağından analiz eder, bulguları anatomiye, fizyolojiye ve diğer verilerinle ilişkilendirir. **Rapor opsiyoneldir:** yalnızca bir MR fotoğrafı, EKG ya da ultrason görüntüsü yüklesen de sistem "rapor bulunamadı" deyip durmaz; görüntüden ne çıkarılabiliyorsa onu, ne çıkarılamıyorsa onu açıkça söyler. Hiçbir bulgu uydurulmaz.

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
- **Belirli bir derleme:** **Actions → Android APK →** ilgili çalıştırma → **Artifacts** → `KanHaritasi-APK-1.0.N`. Bu kopya 7 gün saklanır. GitHub'ın Actions depolama kotası dolarsa burada görünmeyebilir; `apk-son` yayını yine de güncellenir.

Kurulumda "bilinmeyen kaynak" izni istenir. APK, derleme sırasında `INTERNET` izni içermediği otomatik olarak doğrulanarak üretilir.

## Arayüz: önce "Vücudum nasıl?", ayrıntı istenince

Özellikler silinmedi; sadece ilk bakışta görünmüyorlar. Her ekran tek bir soruyu yanıtlar ve en fazla 3–5 kart gösterir. Teknik bilgiler kapalı "Teknik detaylar" ya da "Daha fazla göster" bölümlerinde durur.

- **Gezinme:**
  - Masaüstünde solda: Ana sayfa · Vücudum · Zamanım · Verilerim, üstte belirgin **+ Veri ekle**, altta Ara (Ctrl/⌘+K) ve "Ayarlar ve gizlilik".
  - Telefonda alttaki çubukta en fazla 5 öğe var: Ana sayfa · Vücudum · **+ Ekle** (ortada) · Zamanım · Daha. "Daha" bir alt sayfa açar: Verilerim, tüm sonuçlar, 3B vücut, ayarlar.
  - Kapsam raporu, simülasyonlar ve "Hakkında" ana gezinmede yok; arama ve sayfa içi bağlantılarla açılır.
- **Ana sayfa** (`#/`): "Vücudum nasıl?" sorusuna tek cümlelik özet verir (ör. "2 organla ilişkili sonuç referans dışında · 1 organda görüntü/rapor gözlemi · 3 değer takipte"). Organ "hasta" denmez; hiçbir şey yoksa "Bu verilerde belirgin bir anormallik saptanmadı" yazar ("normal" değil). İki eylemi var: Veri ekle ve Vücudumu gör. Altında en fazla üç "Son durum" kartı (acil değer, en çok dikkat isteyen organ, ne değişti, son görüntü) yer alır. Veri yoksa boş durum gösterilir ve yükleme alanı doğrudan oradadır.
- **Tek yükleme akışı** (`#/ekle`, ayrıca Ana sayfa ve Verilerim): kan tahlili, rapor, MR/BT/röntgen/ultrason, EKG, DICOM klasörü ya da ZIP aynı alana bırakılır ve türünü sistem kendisi anlar. Türü elle seçmek isteğe bağlıdır ("Türünü kendim seçeyim"), bu yüzden MR yüklerken 20 seçenek görünmez.
- **Görüntü sonucu:**
  - Gerçek ilerleme adımları gösterilir: Dosya okundu → Görüntü türü ve bölge belirleniyor → Görüntü analiz ediliyor.
  - Yalnızca kural tabanlı ön kontrol çalıştıysa başlık **"Görüntü ön incelemesi tamamlandı"** olur ("Analiz tamamlandı" değil) ve yanında "ön kontrol · tıbbi model değil" yazar. Altında: "Bu bir MR görüntüsü gibi görünüyor · Beyin", türün ve bölgenin kaynağı (**kullanıcı seçimi** / DICOM başlığı / görüntüden), **inceleme kapsamı** ("2 görüntü (fotoğraf)" ya da "DICOM seri · 180 kesit") ve fotoğrafta "Görüntü kapsamı sınırlı: 2 kesit mevcut".
  - Hemen altında yetenek paneli: ✓ Görüntü okundu · ✓ Görüntü kalitesi · ✓ Kesitleri ayırma · ✓ Orta hat · ✓ Sağ-sol simetri ön kontrolü · ◻ Lezyon analizi (bu kurulumda tıbbi AI modeli yok) · ◻ Organ segmentasyonu · ◻ MR sekansı (belirlenemedi; DICOM başlığında varsa "MR sekansı: FLAIR · DICOM başlığından").
  - Sağ-sol farkı **"görüntü asimetrisi gözlemi"** olarak gösterilir; bulgu, lezyon ya da anormallik değildir. Fark yoksa: "Sağ-sol simetri ön kontrolünde belirgin fark görülmedi. Bu sonuç görüntünün normal olduğunu göstermez."
  - Düğmeler: **Gözlemleri gör** ve **Vücudumda göster**. Gözlem kartı: yer, ne görüldüğü, kaynak (kural tabanlı ön kontrol) ve [İncele].
  - "Teknik detaylar": Model: Sağ-sol ayna karşılaştırması · Tür: Heuristic · Versiyon: 1.0.0 · Cihazda: Evet · sekans durumu, kalite ve sınırlar.
  - Sistematik değerlendirme kapsama göre kurulur: 2 kesitlik fotoğrafta "Görüntü kapsamı sınırlı" başlığı çıkar, protokol başlıkları kapalı listede durur; başlık durumları ✓ görüntüden (ön kontrol) · ? belirsiz · — değerlendirilemedi · raporda belirtilmiş diye ayrılır.
- **Vücudum** (`#/vucudum`):
  - Özet satırı, "3B vücudu aç" ve **"Vücudun nasıl çalıştığını keşfet"** girişleri, **sistemlere göre** gezinme (Sindirim → İnce bağırsak…).
  - En fazla beş "dikkat çeken organ". Her organ yalnızca kendi birincil testleriyle sayılır; CRP gibi tek bir organa özgü olmayan testler bir organa yazılmaz.
  - Son değişiklikler.
  - "Tüm organlar" ve "Teknik detaylar" kapalı bölümlerdedir.
  - Organa dokununca alt sayfa açılır: kısa özet, Bulgular ve sonuçlar · Normalde nasıl çalışır? · 3B'de göster · Detaylı incele.
- **Organ sayfası** — önce organın kendisi, sonra kişinin durumu, en son (isterse) hücre/molekül:
  1. **Nasıl çalışır?** normal işlev ve bölümler · [Fizyolojiyi adım adım incele]
  2. **Benim durumum** renkli sonuçlar, görüntü/rapor gözlemleri, durum (Veri yok / Veri mevcut / İlişkili anormallik var / Takipte / Belirsiz), [Sonuçlarımı gör] · [Benim durumuma göre göster] · **[Neden?]** (bu değerlendirme hangi verilere dayanıyor, ne eksik)
  3. **Bunlar nasıl ilişkili?** organlar arası akış (Mide → İnce bağırsak → Kalın bağırsak), tıklanabilir
  4. **İç yapı** [Organın içine gir] — adım adım: İnce bağırsak → Bağırsak duvarı → Mukozal yüzey → Villuslar → Enterosit; her adımda seviye ("Seviye 3 / Doku"), aynı seviyedeki yapılar ve var olan eğitsel sahne (VillusScene, AlveolusScene, NephronScene…)
  5. **Daha derine in** [Derinlemesine incele] — doku → hücre → biyolojik süreç → molekül, her seviye ayrı açılır ("Hücreyi gör", "Süreci gör", "Moleküler mekanizmayı gör"); her derinlikte "Vücut › Sindirim sistemi › İnce bağırsak › Villuslar › Enterosit" yolu görünür, geri tuşu bir seviye yukarı döner.
- **Vücut akışları** (`#/akis`, `#/akis/<akış>/<adım>[/benim]`): 14 akış — sindirim, bağırsakta emilim, demir emilimi, kalp ve dolaşım, solunum, böbrek, kan şekeri (pankreas → insülin → hücre), pankreas enzimleri, hormon ekseni, sinir sistemi, bağışıklık, alyuvarın yaşamı, kas kasılması, adet döngüsü. "← Önceki · 3 / 8 · Sonraki →", her basamak tıklanabilir; basamaktan organ sayfasına, 3B'ye ve iç sahneye geçilir. **Benim durumuma göre göster**: kişinin sonuçları ilgili basamaklara bağlanır (ör. Ferritin ↓ → Emilim); ilişki her zaman **olası** (POSSIBLE_RELATION) — "Bu sonuçlar bağırsak emilimiyle ilişkili olabilir; ancak tek başına bağırsak emilim bozukluğunu kanıtlamaz." Verisi olmayan basamak "sorunlu" gösterilmez.
- **Zamanım** (`#/zaman`):
  - Önce "Ne değişti?": "↑ HbA1c 5,4 → 6,3", "+ Yeni MR · Beyin" gibi en fazla beş satır.
  - Değer grafikleri tek düğmeyle açılır.
  - Rapor geçmişi yıllara göre gruplanır; en yeni yıl açık gelir.
- **Verilerim** (`#/belgeler`, `#/sonuclar`): Belgeler | Sonuçlar sekmeleri.
- **Arama** (Ctrl/⌘+K ya da büyüteç): organ, bölge ve test adlarında arar. Örneğin "pankreas" için Sonuçlar · Görüntüler ve bulgular · Normalde nasıl çalışır? · Zaman çizelgesi bağlantıları çıkar; "alın lobu" beynin frontal lobunu bulur. Sağlık verisinin içeriği aranmaz.
- **Renkler** tek kaynaktan gelir (`apps/web/src/lib/tone.ts`; her durum için metin, kenar, arka plan, simge):
  - Aralıkta: nötr. Hafif yüksek: amber (Takip) · belirgin yüksek: turuncu (Dikkat) · düşük: mavi · kritik: kırmızı (yalnızca bu).
  - Anormal sonuçta yalnızca küçük rozet değil; **test adı, değer, birim ve ▲ Yüksek / ▼ Düşük** aynı tonu taşır (sonuç listesi, sonuç ayrıntısı, organ sayfası, organ alt sayfası, akışlar). Referans metni sakin kalır.
  - Rapor: "Kitle izlenmedi" → "Bulunmadı · raporda izlenmedi" (nötr, kırmızı değil); "şüpheli görünüm" → belirsiz; "değerlendirilemedi" → değerlendirilemedi (normal de anormal de değil); "lezyon izlendi" → dikkat (kesin tanı anlamı taşımaz).
  - Ek durumlar: belirsiz, değerlendirilemedi, raporda belirtilmiş, görüntüden (kural tabanlı), rapordan.
- **Alt sayfalar** (`Sheet`): telefonda alttan açılır, masaüstünde sağ panel olur. Yerel `<dialog>` kullanılır, bu yüzden odak tuzağı, Esc ve arka plana dokununca kapanma çalışır. Telefonda gezinme, üst simgeler, sekmeler, organ çipleri ve açılır bölümlerin dokunma alanı en az 44 px; odak halkası görünür.

## Ham veriden dijital vücut haritasına (çok kipli analiz)

```
HAM VERİ (görüntü · DICOM · fotoğraf · PDF · tahlil · rapor)
  → kalite kontrolü → tür (modalite) ve bölge tahmini → modaliteye uygun analiz adaptörü
  → GÖZLEMLER (kaynak · güven · konum · model/sürüm · sınırlar)
  → anatomik konum (Beyin › Sağ yarıküre › Alın lobu) → organ / doku / sistem
  → normal anatomi + normal fizyoloji (bilgi grafiği) ↔ kişisel veriler
  → örüntüler (destekleyen / çelişen / eksik) → zaman içinde değişim → açıklama + belirsizlik
```

- **Kaynaklar asla karışmaz.** Her gözlem ve bulgu kaynağını taşır: `IMAGE_ANALYSIS` (görüntünün piksellerinden), `RADIOLOGY_REPORT` / `OCR` (rapordan), `LAB`, `DICOM_METADATA`, `USER_INPUT`, `DERIVED`, `KNOWLEDGE`. Rapordaki "sol frontal lezyon" ifadesi görüntü üzerinde piksel konumu gibi gösterilmez ("yaklaşık anatomik konum — rapor/metin tabanlı"); görüntü gözlemi rapor bulgusu gibi gösterilmez ("radyolog raporu değildir, doğrulanmamış").
- **Güven** = "algoritma bu gözlemi ne kadar güvenilir buluyor"; hastalık olasılığı değildir.
- **Rapor yoksa:** `analyze_image()`, rapor varsa `analyze_report()`, tahlil varsa `analyze_labs()`, önceki çalışma varsa `compare_temporally()`, sonra `merge_available_evidence()` (`packages/analysis/src/fusion.ts`). "Rapor yoksa analiz yok" mantığı yoktur.
- **Model yoksa:** durum `MEVCUT DEĞİL` (IMAGE_ANALYSIS_STATUS: UNAVAILABLE) ve "Bu modalite için otomatik görüntü yorumu bu kurulumda yok" yazılır; her adaptör yapabildiği ve yapamadığı yetenekleri tek tek listeler.

### Modalite desteği — dürüst tablo

Bu kurulumda **öğrenilmiş (yapay zekâ) görüntü modeli yoktur.** Görüntü analizleri cihazda çalışan, açıklanabilir sinyal işleme/kural algoritmalarıdır; harici yapay zekâ servisi **bağlı değildir**.

| Modalite | Gerçekten yapılan (görüntünün kendisinden) | Yapılmayan (mimari hazır, model yok) |
| --- | --- | --- |
| **MR / BT / PET-BT** (fotoğraf, ekran görüntüsü, DICOM) | **Görüntü geometrisi / sağ-sol simetri ön kontrolü** (tıbbi görüntü tanı modeli DEĞİL): kesitlere ayırma, orta hat ve eğiklik, iki yarının ayna karşılaştırması → "görüntü asimetrisi gözlemi" (gerçek görüntü üzerinde kutu + fark haritası), gözlem alanının yaklaşık beyin konumu, baş kesiti şeklinden bölge önerisi. MR sekansı yalnızca **DICOM başlığından** okunur | Lezyon analizi, organ segmentasyonu, görüntüden sekans/kontrast tanıma, iki tarafı eşit etkileyen değişiklikler — gerçek model gerekir (`medicalAI.ts`) |
| **EKG** (kâğıt fotoğrafı/taraması) | Milimetrik ızgaradan kalibrasyon (alt piksel), şerit (derivasyon sırası) sayısı, R tepeleri → **RR aralığı, kalp hızı, RR düzenliliği** | PR, QRS, QT/QTc, ST/T, aks, derivasyon adları — **ölçülmez, uydurulmaz** |
| **Ultrason / Doppler / EKO** | Ultrason görüntü alanının (yelpaze) tanınması; bölge seçimden/dosya adından (kaynağıyla) | Organ tanıma, otomatik ölçüm, kist/kitle/taş adayı, Doppler akım |
| **Patoloji / mikroskopi** | Boyalı doku alanı, çekirdek sayımı, yoğunluk ve ortalama büyüklük | Doku tipi, hücre morfolojisi, normal histolojiyle karşılaştırma, tanı |
| **Röntgen, mamografi, endoskopi/kolonoskopi, dermatoloji, diş, fundus** | Kalite kontrolü, tür tahmini; görüntü saklanır, görüntüleyicide açılır, elle ölçülür | Architecture ready for image analysis — bu türler için model yok (`adapters/unavailable.ts`) |
| **Belge fotoğrafı** (tahlil kâğıdı, rapor, e-Nabız) | Belge olarak tanınır → OCR → test adı, değer, birim, referans aralığı yapılandırılır | — |

Her görüntüde **kalite kontrolü** yapılır: düşük çözünürlük, bulanıklık (kenar genişliği), parlama, kesilmiş kenar, düşük kontrast, çok karanlık/parlak. Kötü kalite güveni düşürür; kullanılamayacak kadar küçük görüntü çökmeden reddedilir.

**Gözlem ≠ bulgu.** `ImageObservation` (ör. "sağ-sol parlaklık farkı") ile `MedicalFinding` (ör. "lezyon") ayrı varlıklardır. Bulgu yalnızca gerçek bir tıbbi görüntü modelinden (`IMAGE_MODEL`, "model-derived") ya da rapordan gelebilir; kural tabanlı ön kontrol asla bulgu üretmez.

**Tıbbi görüntü modeli sağlayıcıları** (`packages/analysis/src/medicalAI.ts`): `MedicalImageAIProvider` — `analyzeStudy`, `classifyModality`, `classifySequence`, `detectStructures`, `segmentStructures`, `detectFindings`, `localizeFindings`, `measureStructures`, `compareStudies`; her çıktı kaynak, model, model sürümü, güven, konum, anatomik yapı ve sınırlarını taşır. MR, BT, röntgen, ultrason, mamografi, patoloji, EKG ve endoskopi için sağlayıcı yeri vardır; **bugün hepsi `unavailable`** döner (depoda gerçek model yok, hiçbir şey uydurulmaz). Gerçek bir sağlayıcı `MedicalImageProviderRegistry.register()` ile eklendiğinde `runMedicalImageModel` bulgu → konum (piksel/voksel) → anatomi (bilgi grafiği yolu) → 3B zincirini otomatik kurar, zaman aşımı ve hata yönetimi yapar, cihaz dışına veri gönderecekse önce onay ister. Yapılandırma anahtarları (sunucu/yerel servis tarafında okunur; API anahtarı ön yüze gömülmez): `MEDICAL_AI_PROVIDER`, `MEDICAL_AI_BASE_URL`, `MEDICAL_AI_API_KEY`, `MRI_MODEL`, `CT_MODEL`, `XRAY_MODEL`, `PATHOLOGY_MODEL`. Web sürümünün CSP'si (`connect-src 'self'`) ve APK'nın internet izni olmaması nedeniyle uzak bir model bu sürümde zaten çağrılamaz.

**"Vücutta göster" açıklaması konuma göre değişir:** gerçek model konumu varsa "Bulgu, görüntü analizinden elde edilen konum bilgisiyle 3B anatomide gösteriliyor"; yalnızca bölge biliniyorsa "Bu gösterim görüntünün ait olduğu organı/bölgeyi gösterir; belirli bir bulgunun kesin konumu değildir"; rapordan ise "Konum rapordaki anatomik ifadeden eşleştirildi; gerçek piksel koordinatı değildir".

Yeni bir modalite modeli eklemek mevcut sistemi bozmaz: `ImageAnalysisAdapter` arayüzünü uygulayan adaptör `AdapterRegistry.register()` ile kaydedilir (ör. `FundusAnalysisAdapter`). Sağlayıcı soyutlaması (`AIProvider`, `MedicalVisionProvider`: `analyzeImage`, `detectFindings`, `localizeFinding`, `segmentStructure`, `classifyModality`, `estimateAnatomy`) desteklenmeyen yöntemlerde `unavailable` ve nedenini döndürür. Veriyi cihaz dışına gönderecek bir sağlayıcı eklenirse önce "Bu veri harici bir yapay zekâ servisine gönderilebilir" onayı istenir (bugün CSP ve Android'in internet izni olmaması bunu zaten engeller).

### Vücudum ve organ sayfaları

- **Vücudum** (`#/vucudum`): dikkat çeken organlar ve her birinde tahlil / rapor bulgusu / görüntü gözlemi sayısı. Tüm organlar sistemlere göre listelenir. Kritik değerlerde "acil değerlendirme gerekebilir — doktor değerlendirmesi gerekir" uyarısı çıkar (tanı iddiası olmadan).
- **Organ sayfası** (`#/organ/<düğüm>`, `/benim`, `/ic`, `/derin/<düğüm>/…`): genel bakış · kişisel ayrıntı · iç yapı · derinlemesine inceleme (yukarıdaki "Arayüz" bölümü).
  - **Benim durumum (ayrıntı):** tahliller (referans kaynağıyla, renkli), görüntü gözlemleri (güvenle), rapor cümleleri (izlenmedi / belirsiz / değerlendirilemedi ayrı), örüntülerin kanıt paneli (✓ destekleyen, ✗ çelişen, ? eksik), görüntülemeler, "Fizyolojide nerede?", normal ↔ ben farkı, zaman içindeki eğilim, eski ↔ yeni görüntüleme ve **belirsizlik** (ölçülmüş / olasılıksal / eksik).
  - Bilgi grafiğine mide, ince bağırsak (duodenum, jejunum, ileum; duvar → mukoza → villus → enterosit, kılcal damar ve lenf kanalı; besin, demir, B12 ve folat emilimi) ve kalın bağırsak eklendi.
- **"Neden? / Neyi etkiler?"**: Bulgu → etkilenen anatomi → normal işlevi → olası etkilenen süreçler → ilişkili verilerin → sınırlar.
- **3B ↔ organ sayfası ↔ gerçek görüntü:** görüntü gözleminden "3B anatomide göster", 3B organ panelinden organ sayfasına ve oradan o bölgenin gerçek görüntülerine.
- **Bilgi grafiği** (`packages/analysis/src/knowledge`): beyin (yarıküreler, loblar, derin yapılar, beyaz cevher → miyelinli akson → oligodendrosit → miyelin), kalp ve iletim sistemi (EKG ölçümleri), pankreas (endokrin/ekzokrin → insülin/glukagon/amilaz/lipaz → kan şekeri → hücrelerin glukoz kullanımı → enerji), karaciğer (protein sentezi → albümin → sıvı dağılımı; enzimler; safra), böbrek (glomerül → süzme → sıvı-elektrolit → kan basıncı; EPO), akciğer, tiroid, kemik iliği. Biyobelirteç düğümleri laboratuvar kataloğuna bağlıdır; bağlantılar testlerle denetlenir.
- **Örüntü motoru** (`patterns.ts`): veriyle tanımlı örüntüler (karaciğer hücresi enzimleri, safra akışı, protein üretimi, kan şekeri, pankreas enzimleri, böbrek süzmesi, elektrolitler, demir eksikliği, tiroid, kolesterol, inflamasyon, kalp hızı); laboratuvar, rapor ve görüntü kanıtını kaynağıyla birleştirir, tanı koymaz.
- **Eğilim** (HbA1c 5,4 → 6,3 gibi): yıllık eğim, yön, referansı geçiş; "eğilim tek başına tanı koydurmaz". **Eski ↔ yeni görüntüleme:** yeni / devam eden / kaybolan / büyüyen / küçülen; görüntü çakıştırma (registration) yapılmadığı açıkça yazılır.

## Neler var

| Alan | İçerik |
| --- | --- |
| **Verilerim** | Tek alana PDF/JPG/PNG/DICOM/ZIP yükleme (tür otomatik), tahlil/görüntüleme filtresi (imza, boyut, piksel ve sayfa sınırları), şifreli saklama, PDF ve görsel görüntüleyici (yakınlaştır, sayfa, döndür, tam ekran), orijinali bayt bayt indirme, yeniden adlandırma, silme |
| **Okuma** | PDF metin katmanı; taranmış sayfa, fotoğraf ve ekran görüntüsü (ör. e-Nabız) için cihazda OCR (Tesseract, Türkçe). Görüntüler iki farklı sayfa bölütlemesiyle okunur; iki okumanın uyuşmadığı değerler doğrulamaya düşer. 81 testlik LOINC kataloğu (hemogram ve akyuvar alt türleri, biyokimya, lipid, tiroid, cinsiyet hormonları, kortizol, prolaktin, vitamin-mineral, demir, pıhtılaşma), Türkçe ondalık, birim dönüşümü, farklı sütun düzenleri, rapordaki referans aralığı (etiketli, cinsiyete ya da döngü evresine göre verilen aralıklar dahil), düşük güvenli satırlar işaretli |
| **Görüntüleme (MR, BT, röntgen, ultrason)** | Belge türünü sistem kendisi anlar; istenirse yüklerken elle seçilir (Tahlil / MR / Tomografi (BT) / Röntgen / Ultrason / Diğer). **DICOM** dosyaları (CD/USB'deki `.dcm` veya uzantısız `IM000001` gibi dosyalar) cihazda okunur: masaüstünde **klasör seçerek** içe aktarma (DICOMDIR ve görüntüleyici programları atlanır), aynı seriye ait kesitler listede tek satır ve tek görüntüleyicide. Görüntüleyici: kesit kaydırma (tekerlek, ok tuşları, kaydırıcı), pencere/seviye (sağ tıkla sürükle ya da kontrast aracı), BT ön ayarları (yumuşak doku, akciğer, kemik, beyin, karaciğer; Hounsfield), negatif, yakınlaştırma, tam ekran. Sıkıştırmasız, RLE ve JPEG Baseline çözülür; JPEG 2000 / JPEG-LS tanınır ama çözülmez (dosya saklanır, açıkça söylenir). Tür, bölge (beyin, bel omurgası, diz, toraks…), çekim tarihi ve seri başlıktan otomatik gelir; **hasta adı ve kimlik numarası okunmaz, gösterilmez**. Radyoloji raporu (PDF/fotoğraf) okunur, Klinik bilgi / Teknik / Bulgular / Sonuç bölümlerine ayrılır, elle düzeltilebilir; raporda geçen ~45 terimin (hiperintens, protrüzyon, stenoz, konsolidasyon, BI-RADS…) genel anlamı gösterilir, bölge 3B vücutta açılır. **Fotoğrafı çekilmiş film veya ekran görüntüsü** (JPG/PNG) de aynı görüntüleyicide açılır: otomatik kontrast, pencere/seviye, negatif, döndürme. Kâğıt rapor fotoğrafı kendiliğinden okunur; film fotoğrafında okuma yapılmaz. Tahlil diye yüklenen film fotoğrafında OCR'dan önce "görüntüleme mi?" diye sorulur; değer bulunamayan belgede de aynı seçenek çıkar. Görüntüleme raporları **Sonuçlar** ekranında (raporun kendi "Sonuç" bölümü ve terimleriyle), **Zaman** ekranının rapor geçmişinde ve **Keşfet**'te ilgili organın bulutunda ("Görüntülemem") ve organ panelinde ("Görüntülemelerin", raporun sonucuyla) görünür. **Ölçümler tahlil gibi:** raporda yazan ölçümler (dalak/karaciğer/böbrek boyu, koledok, portal ven, aort çapı, prostat ve tiroid hacmi, kardiyotorasik oran, Evans indeksi, orta hat kayması, bel/boyun kanalı çapı, akciğer nodülü, EF, sol karıncık ve kulakçık, pulmoner basınç, karotis IMT, kemik yoğunluğu T-skoru — 25 ölçüm) otomatik okunur ve genel referans aralığına göre Normal / Yüksek / Düşük gösterilir; açınca ne ölçtüğü, olası nedenler (kesin değil), doktora sorulabilecekler, vücutta göster ve içeri gir. Görüntü üzerinde **cetvel** (DICOM'da mm), **iki çizgiden oran** (fotoğrafta da) ve BT'de **yoğunluk (HU)** ölçülüp aynı şekilde kaydedilir. Referans dışı ölçümler 3B vücutta ilgili organı tahliller gibi renklendirir. **Görüntü geometrisi / sağ-sol simetri ön kontrolü** (tıbbi görüntü tanı modeli değildir): yazısı ve raporu olmayan MR/BT fotoğrafı ya da DICOM kesiti cihazda incelenir: kolaj kesitlere ayrılır, her kesitte orta hat (eğiklik dahil) bulunur, sağ yarı sol yarının ayna görüntüsüyle karşılaştırılır ve karşı tarafa göre belirgin daha parlak/koyu kalan alanlar "görüntü asimetrisi gözlemi" olarak fark haritası ve kutuyla işaretlenir ("Kesit 2 · görüntünün sol üst kısmı · daha parlak"). Yandan (sagital) ve simetrik olmayan kesitler karşılaştırılmaz ve bu açıkça yazılır; kesitlerin şekli baş kesitine benziyorsa bölge olarak "Beyin" önerilir (onay ister). Kullanıcı "Sonuçlarıma ekle" derse 3B'de ilgili organ işaretlenir ve organ panelindeki "Sonucuma göre" bu görüntüyü açar. Bu bir sağ-sol fark ölçümüdür, tanı değildir: normal asimetriler, sinüsler, baş eğikliği ve fotoğraf açısı yanlış işarete; iki tarafı eşit etkileyen değişiklikler kaçırılmaya yol açabilir. Uygulama görüntüye bakıp teşhis koymaz. Her görüntüleme belgesinde **Vücutta göster** vardır; bölge bilinmiyorsa önce bölge sorulur, seçilen bölge belgeye kaydedilir. Aynı çekime ait görüntü ve rapor (aynı tür ve tarih ya da aynı bölge, 7 güne kadar arayla) birbirine bağlanır: MR kesitleri raporun sonucunu da gösterir. Uygulama görüntüyü veya raporu **yorumlamaz**; ön kontrol yalnızca sağ-sol farkını gösterir |
| **Onay** | Okunan her değer onaydan geçer: düzeltme, tanınmayan satırı bir teste bağlama (kalıcı takma ad), elle ekleme, kaynağı belgede vurgulama |
| **Sonuçlarım** | Yüksek/düşük/normal, aralık çubuğu, "bu test neyi ölçer", olası etkenler, doktora sorulabilecekler |
| **Keşfet (3D)** | Seçilebilir **erkek ve kadın** vücudu (48 yapı, her vücutta 300+ ayrı bölüm: kalp odacıkları ve kapakları, 22 beyin bölgesi, göz katmanları, böbrek iç yapısı, akciğer lobları, karaciğer segmentleri, diz bağları…; Türkçe ve Latince adlar). Sonuçla ilişkili organlar belirgin, diğerleri soluk; organa dokununca küçük dijital **bilgi bulutu** (Sonucum · Temelde nasıl çalışır · Sonucuma göre · İçeri gir). Arama (Türkçe/Latince, Ctrl+K), izole et, gizle, kesit görünümü, iç anatomi, klavye kısayolları, açık/koyu/sistem teması. Seviyeler: İnsan / Sistem / Organ / Bölüm / Doku / Hücre / Süreç |
| **İçeri gir** | 22 simülasyon sahnesi + 20 doku atlası sahnesi (her 3B yapının içine girilebilir). Simülasyonlar: damar içi ve 8 aşamalı LDL–ateroskleroz; kan hücreleri; alveol ve gaz değişimi; nefron ve süzme; karaciğer lobülü; pankreas adacığı; tiroid folikülü; kemik iliği; nöron ve sinaps (sinir sinyali); retina (görme); koklea (işitme); kalp kası (kasılma); sarkomer (kas kasılması); osteon (kemik yenilenmesi); mide bezi (sindirim, B12); bağırsak villusu (emilim); deri (D vitamini); hücre ve enerji (ATP); hormon salgısı; lenf düğümü (bağışıklık); yumurtalık; testis. Her sahne "Temelde nasıl çalışır" (tipik değerler) ya da "Sonucuma göre" (senin değerlerin) açılabilir. Sahnedeki sayı, boyut ve renkler kişinin son sonuçlarına göre çizilir; "tipik değerler" ile karşılaştırılabilir. Oynat/duraklat, hız, aşama çizelgesi, nesneye dokununca açıklama. Ekranda her zaman **"Eğitimsel biyolojik simülasyon"** etiketi. **Doku atlası** (`src/explore/inside/tissues.ts`, veriyle tanımlı, tek bir prosedürel sahneyle çizilir): yemek borusu, kalın bağırsak, safra kesesi, mesane, prostat, rahim, fallop tüpü, vajina, meme, eklem kıkırdağı, solunum yolu, timus, bademcik, hipofiz, böbreküstü bezi, epifiz, dalak, toplardamar duvarı, ekzokrin pankreas, vas deferens. Duvar katmanları lümenden dışa sıralı; katmana dokununca kamera o katmana iner; peristaltizm, sil vuruşu, salgı ve akış basit animasyonla gösterilir. Bu sahneler **"Doku atlası · şematik"** etiketlidir ve sonuçlara göre değişmez. Her yapının sahneleri "kendi dokusu / ortak doku tipi / ilişkili doku" diye etiketlenir; ilişkili doku (ör. safra kesesinden karaciğer lobülüne) asla kendi dokusu gibi gösterilmez. Yeni organ eklemek için `tissues.ts`'e bir profil ve `anatomy/organs.ts`'e bir bağlantı yeterlidir |
| **Vücutta göster** | Tahlilden keşif yolu: LDL → koroner arterler → damar içi → simülasyon; hemogram → kan hücreleri; ALT → karaciğer → lobül; kreatinin → böbrek → nefron; glukoz → pankreas → adacık; CK → iskelet kasları. Aralık dışı bulgular arasında ileri/geri gezinme. CRP, lökosit, ferritin gibi tek bir organa özgü olmayan testler bunu açıkça belirtir |
| **Zaman** | Test başına eğilim grafiği (her ölçümün kendi raporundaki referans bandıyla), noktadan rapora ve vücuda gidiş, tablo görünümü, rapor geçmişi |
| **Yedek** | `.khyedek` şifreli yedek (ayrı yedek parolası), başka cihaza geri yükleme, tekrarları atlama |
| **Verilerimi indir** | Şifresiz ZIP: orijinaller + `sonuclar.json` + `sonuclar.csv` (açık uyarıyla). DICOM dosyalarında kimlik alanları (hasta adı, kimlik no, doğum tarihi, erişim no, kurum ve hekim adları, iç içe diziler dahil) varsayılan olarak temizlenir; kasadaki özgün dosya değişmez |
| **Gizlilik** | Veri akışı, depolama, açma yöntemleri (parola, Android'de parmak izi/yüz/PIN), otomatik kilit, profil, tüm verileri sil |

Olmayan veya bağlanmamış her şey arayüzde açıkça yazar: harici yapay zekâ **BAĞLI DEĞİL**; tiroid, kulak, kol-bacak damarları ve periferik sinirler **şematik**. Uygulamadaki **Kapsam raporu** (`#/kapsam`) her yapı için iki vücutta dış görünüm, bölüm sayısı, iç keşif derinliği (simülasyon / şematik doku atlası / yalnızca ilişkili doku), sahne ve süreç durumunu model dosyalarından ve uygulama verisinden okuyarak gösterir.

## Güvenlik modeli (kısa)

- **Kasa:** parola → Argon2id (64 MiB, 3 tur) → 256 bit ana anahtar sarılır. Her belge kendi anahtarıyla, 1 MiB'lık parçalar halinde AES-256-GCM ile şifrelenir. Parça AAD'si dosya kimliği, parça no ve son-parça bayrağını içerir: sıra değişirse, dosya kesilirse ya da taşınırsa açılmaz. Rapor ve sonuç kayıtları da ana anahtarla şifrelidir; depoda açık duran tek şey rastgele UUID'lerdir.
- **Android:** Kotlin/Compose kabuğu içinde WebView (yalnızca `appassets.androidplatform.net`). Cihaz kilidi anahtarı Android Keystore'da durur ve her kullanımda biyometri/PIN ister. `FLAG_SECURE`, `allowBackup=false`, internet izni yok, köprü yalnızca ana çerçeve ve kendi kökeni için.
- **Web:** CSP `connect-src 'self'` (veri gönderilebilecek hedef yok), Trusted Types, satır içi script yok. PDF.js, OCR ve 3D dosyalarının hepsi uygulamayla paketlenir; CDN yok. Lint kuralları `fetch`, `innerHTML`, `eval`, `console` ve serbest `localStorage` kullanımında derlemeyi durdurur.
- **Yedek:** `KHYEDEK1` başlığı + Argon2id + parçalı AES-256-GCM. Başlığın tamamı AAD'ye girer, kurcalanan yedek açılmaz.
- **Sunucu tarafı konular:** Oturum, IDOR/BOLA, CSRF ve hız sınırı gibi başlıklar bu mimaride geçerli değil, çünkü sunucu yok. Bunların karşılığı cihazdaki şifreli kasadır.

## Testler

- **Çok kipli analiz ve kabul senaryoları (Vitest):** `packages/analysis/src/__tests__` (kalite, modalite, EKG ölçümü — alt piksel ızgara dahil, adaptör kaydı, bilgi grafiği bütünlüğü ve zincirleri, örüntü motoru, eğilim, eski↔yeni karşılaştırma, referans önceliği) ve `apps/web/src/__tests__/acceptance.test.ts`: **A** yalnızca MR (gerçek fikstür fotoğrafı, rapor yok — 20 adım), **B** MR + rapor, **C** MR + kan, **D** eski + yeni MR, **E** yalnızca EKG, **F** yalnızca pankreas ultrasonu, **G** yalnızca patoloji, **H** yalnızca tahlil fotoğrafı ve **MR + rapor + kan + önceki MR** birleşik modeli. DICOM anonimleştirme (açık/örtük VR, iç içe diziler).
- **Birim/güvenlik testleri (Vitest):** kripto ve kurcalama, sızıntı (depoda açık metin yok), silme, yükleme saldırıları (sahte uzantı, dev PNG başlığı, path traversal), ayrıştırıcı, katalog bütünlüğü, yorum motoru, yedek (yanlış parola, kurcalanmış gövde/başlık, sürüm), ZIP, XSS.
- **Sentetik rapor seti (`fixtures/`):** 7 PDF (hemogram, biyokimya, kadın hormon, vitamin-mineral, lipid, çoklu anormallik, genel) ve 4 görüntü (eğik telefon fotoğrafı, gürültülü tarama, e-Nabız benzeri ekran görüntüsü, düz tarama); her biri farklı bir laboratuvar düzeni. PDF'lerde her satırın değeri, durumu ve beklenen yorum örüntüleri; görüntülerde gerçek Tesseract ile okuma ve **yanlış okunan hiçbir değerin doğrulama işareti olmadan geçmemesi** test edilir.
- **Uçtan uca (gerçek Chromium, CI'da her gönderimde):**
  - `tests/e2e/smoke.py`: kasa, belgeler, görüntüleyici, indirme, silme, kilit.
  - `tests/e2e/flow.py`: PDF ve fotoğraf okuma, onay, sonuçlar, renk kabulü (90/91: yüksek LDL adı ve değeri aynı tonda, düşük ferritin mavi, normal glukoz nötr; pankreas sayfasında trigliserid adı/değeri/▲ aynı tonda), vücutta göster, simülasyon, nesne seçimi, Esc ile dönüş.
  - `tests/e2e/data.py`: zaman çizelgesi, şifreli yedek → yeni kasaya geri yükleme, ZIP doğrulaması.
  - `tests/e2e/multimodal.py`: rapor olmadan MR fotoğrafı, EKG, ultrason ve patoloji görüntüsünün ön incelemesi; Vücudum → organ alt sayfası → organ sayfası, "Neden?" zinciri; kabul senaryoları 87 (Vücudum → Sindirim → İnce bağırsak: nasıl çalışır → içini göster → fizyoloji adım adım → benim durumum → derinleş), 88 (beyin MR fotoğrafı: ✓ kesit/orta hat/simetri, ◻ lezyon/segmentasyon/sekans, vücutta göster → beyin), 95 (2 kesit: tam MR değerlendirmesi denmez), keşif modu (10 sistem), breadcrumb ve geri dönüş. Ayrıca:
    - "Veri ekle" ve "Vücudum" ilk ekranda görünür; gezinmede teknik öğe yoktur.
    - MR sonucunda en fazla 8 görünür düğme bulunur; model ayrıntıları "Teknik detaylar"da.
    - Beyaz cevher için seviye seviye iniş (doku → oligodendrosit → miyelin oluşumu → miyelin) çalışır.
    - "pankreas" araması doğru sonucu verir.
    - Telefonda alt gezinme en fazla 5 öğedir, "Daha" alt sayfası açılır, yatay taşma yoktur.
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
  analysis/   Çok kipli analiz çekirdeği: kaynaklı tipler, kalite, modalite/bölge tahmini, görüntü adaptörleri
              (kesitsel simetri, EKG, ultrason, patoloji, "model yok" adaptörleri), sağlayıcı soyutlaması,
              bilgi grafiği, örüntü motoru, eğilim, eski↔yeni karşılaştırma, birleşik sağlık modeli, organ görünümü
  vault/      Şifreli kasa + şifreli yedek (Argon2id, parçalı AES-256-GCM, kripto-imha)
  ingest/     Yükleme doğrulaması, DICOM okuma ve anonimleştirme, sağ-sol görüntü incelemesi
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

- **Görüntü analizi:** Öğrenilmiş bir tıbbi görüntü modeli paketlenmiyor; `MedicalImageAIProvider` sağlayıcılarının hepsi `unavailable` döner. Lezyon analizi, organ segmentasyonu ve görüntüden sekans tanıma gerçek bir model gerektirir. MR/BT'de yalnızca sağ-sol simetri ön kontrolü yapılır (lezyon tespiti değildir; normal varyantlar yanlış işarete, iki tarafı eşit etkileyen değişiklikler kaçırılmaya yol açar). Beyin konumu radyolojik düzen ve "ön taraf yukarıda" varsayımıyla tahmin edilir; kesit düzeyi bilinmediği için alternatif loblar listelenir. MR ile BT fotoğraftan güvenilir ayırt edilemez. EKG'de kâğıt hızı 25 mm/sn varsayılır; DICOM dalga formu EKG okunmaz. Ultrasonda organ görüntüden tanınmaz. Patolojide büyütme bilinmediği için ölçümler mikrometreye çevrilmez.
- **Görüntüleyici:** DICOM serisinde kesit kaydırma ve pencere/seviye var; eksenel seriden sagital/koronal yeniden yapılandırma (MPR) yok.
- **Vücut akışları** genel fizyoloji bilgisidir ve sabit 14 akışla sınırlıdır; kişisel katman yalnızca laboratuvar sonuçlarını basamaklara bağlar (görüntü/rapor bulguları organ sayfasında gösterilir).
- **Eski ↔ yeni karşılaştırma** görüntü çakıştırması yapmaz; eşleştirme anatomik konum etiketiyle, boyut değişimi rapordaki ölçülerle yapılır.
- **Bilgi grafiği** şimdilik beyin, kalp, pankreas, karaciğer, böbrek, akciğer, tiroid, kemik iliği, mide, ince ve kalın bağırsağı ayrıntılı kapsar; diğer yapılar 3B kataloğundaki kısa açıklamayla gösterilir. C-peptid gibi bazı belirteçler grafikte var ama laboratuvar kataloğunda henüz yok (organ sayfasında "eksik" olarak yazar).

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
