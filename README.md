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

Özellikler silinmedi; sadece ilk bakışta görünmüyorlar. Her ekran tek bir soruyu yanıtlar ve en fazla 3–5 kart gösterir. Teknik bilgiler kapalı "Nasıl analiz edildi?" ya da "Daha fazla göster" bölümlerinde durur.

- **Gezinme:**
  - Masaüstünde solda: **Özet · Vücudum · Sonuçlar · Görüntüler · Zamanım**, üstte belirgin **+ Veri ekle**, altta Ara (Ctrl/⌘+K), Belgelerim ve "Ayarlar ve gizlilik".
  - Telefonda alttaki çubukta 5 öğe var: **Özet · Vücudum · (+) Ekle · Sonuçlar · Daha**. "Daha" bir alt sayfa açar: Görüntüler, Zamanım, Belgelerim, 3B vücut, ayarlar.
  - Kapsam raporu, simülasyonlar ve "Hakkında" ana gezinmede yok; arama ve sayfa içi bağlantılarla açılır.
- **Özet** (`#/`): "Vücudum nasıl?" sorusuna tek cümlelik özet verir (ör. "2 organla ilişkili sonuç referans dışında · 1 organda görüntü/rapor gözlemi · 3 değer takipte"). Organ "hasta" denmez; hiçbir şey yoksa "Bu verilerde belirgin bir anormallik saptanmadı" yazar ("normal" değil). İki eylemi var: Veri ekle ve Vücudumu gör. Altında en fazla üç "Son durum" kartı (acil değer, en çok dikkat isteyen organ, ne değişti, son görüntü) yer alır. Veri yoksa boş durum gösterilir ve yükleme alanı doğrudan oradadır.
- **Tek yükleme akışı** (`#/ekle`, ayrıca Özet ve Belgelerim): kan tahlili, rapor, MR/BT/röntgen/ultrason, EKG, DICOM klasörü ya da ZIP aynı alana bırakılır ve türünü sistem kendisi anlar. Türü elle seçmek isteğe bağlıdır ("Türünü kendim seçeyim"), bu yüzden MR yüklerken 20 seçenek görünmez.
- **Görüntü sonucu:**
  - Gerçek ilerleme adımları gösterilir: Dosya okundu → Görüntü türü ve bölge belirleniyor → Görüntü analiz ediliyor.
  - Her görüntü **üç durumdan biriyle** gösterilir, karıştırılmaz (`data-state`):
    - **"Yerel tıbbi AI modeli ile analiz edildi."** — yalnızca cihazda kurulu gerçek bir model bu görüntüde çalıştıysa ("yerel model · cihazda").
    - **"Görüntü ön incelemesi yapıldı. Bu sonuç tıbbi AI modeli sonucu değildir."** — yalnızca kural tabanlı ön kontrol çalıştıysa ("ön inceleme · tıbbi model değil").
    - **"Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor."** — ne model ne ön inceleme varsa (ör. röntgen, endoskopi). Altında: "Bu bir MR görüntüsü gibi görünüyor · Beyin", türün ve bölgenin kaynağı (**kullanıcı seçimi** / DICOM başlığı / görüntüden), **inceleme kapsamı** ("2 görüntü (fotoğraf)" ya da "DICOM seri · 180 kesit") ve fotoğrafta "Görüntü kapsamı sınırlı: 2 kesit mevcut".
  - Hemen altında yetenek paneli: ✓ Görüntü okundu · ✓ Görüntü kalitesi · ✓ Kesitleri ayırma · ✓ Orta hat · ✓ Sağ-sol simetri ön kontrolü · ◻ Lezyon analizi (bu kurulumda tıbbi AI modeli yok) · ◻ Organ segmentasyonu · ◻ MR sekansı (belirlenemedi; DICOM başlığında varsa "MR sekansı: FLAIR · DICOM başlığından").
  - Sağ-sol farkı **"görüntü asimetrisi gözlemi"** olarak gösterilir; bulgu, lezyon ya da anormallik değildir. Fark yoksa: "Sağ-sol simetri ön kontrolünde belirgin fark görülmedi. Bu sonuç görüntünün normal olduğunu göstermez."
  - Düğmeler: **Gözlemleri gör** ve **Vücudumda göster**. Gözlem kartı: yer, ne görüldüğü, kaynak (kural tabanlı ön kontrol) ve [İncele].
  - Model çalıştıysa: görüntü üzerinde modelin kutusu/maskesi, "Model bulguları" (güven %, piksel konumu, anatomi yolu, rapor ile uyum/**ÇELİŞKİ**), Organ sayfası · 3B anatomide göster · Bu bölge ne?, ve "Model kökeni (provenance)": model adı/sürümü/kimliği, SHA-256, lisans, kaynak, kullanım amacı, sınırlar. İlerleme ("Yerel model yükleniyor… / inceliyor…") ve **İptal** vardır.
  - "Nasıl analiz edildi?": Model: Sağ-sol ayna karşılaştırması · Tür: Heuristic · Versiyon: 1.0.0 · Cihazda: Evet · sekans durumu, kalite ve sınırlar.
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
- **Sonuçlar** (`#/sonuclar`) ve **Belgelerim** (`#/belgeler`): Belgeler | Sonuçlar sekmeleri.
- **Görüntüler** (`#/goruntuler`): tüm görüntüleme çalışmaları; her satırda durum rozeti (◆ Yerel AI modeli · N bulgu / ◇ Ön inceleme · tıbbi model değil / ○ Görüntü analizi yok), rapor ayrı rozet (Rapor · N cümle / Rapor yok) ve varsa **⚠ Rapor ↔ model çelişkisi**.
- **Arama** (Ctrl/⌘+K ya da büyüteç): organ, bölge ve test adlarında arar. Örneğin "pankreas" için Sonuçlar · Görüntüler ve bulgular · Normalde nasıl çalışır? · Zaman çizelgesi bağlantıları çıkar; "alın lobu" beynin frontal lobunu bulur. Sağlık verisinin içeriği aranmaz.
- **Renkler** tek kaynaktan gelir (`apps/web/src/lib/tone.ts`; her durum için metin, kenar, arka plan, simge):
  - Aralıkta: nötr. Hafif yüksek: amber (Takip) · belirgin yüksek: turuncu (Dikkat) · düşük: mavi · kritik: kırmızı (yalnızca bu).
  - Anormal sonuçta yalnızca küçük rozet değil; **test adı, değer, birim ve ▲ Yüksek / ▼ Düşük** aynı tonu taşır (sonuç listesi, sonuç ayrıntısı, organ sayfası, organ alt sayfası, akışlar). Referans metni sakin kalır.
  - Rapor: "Kitle izlenmedi" → "Bulunmadı · raporda izlenmedi" (nötr, kırmızı değil); "şüpheli görünüm" → belirsiz; "değerlendirilemedi" → değerlendirilemedi (normal de anormal de değil); "lezyon izlendi" → dikkat (kesin tanı anlamı taşımaz).
  - Ek durumlar: belirsiz, değerlendirilemedi, raporda belirtilmiş, görüntüden (kural tabanlı), rapordan.
  - Aynı kaynak zaman çizelgesi noktalarını (`TONE_VAR`, `labColor`) ve 3B organ vurgularını (`TONE_HEX`, three.js CSS değişkeni okuyamadığı için onaltılık) da besler. Renk hiçbir yerde tek başına anlam taşımaz: ▲/▼, ⚠, ◆, ◇ simgesi ve metin her zaman eşlik eder.
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
- **Model yoksa:** "Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor." yazılır; her adaptör yapabildiği ve yapamadığı yetenekleri tek tek listeler.
- **Köken (provenance)** her kanıtta tek kurala göre çıkarılır (`provenanceOf`): `model-derived` (yerel tıbbi model; model kimliği, sürüm, SHA-256, lisans, belge, kare), `heuristic-derived` (kural tabanlı ön inceleme), `report-derived` (rapor metni), `lab`, `user`.

## Çevrimdışı mimari ve yerel tıbbi AI

**Uygulama internet gerektirmez; bu bir güvenlik gereksinimidir.** Hasta verisi (MR, BT, röntgen, ultrason, Doppler, EKO, mamografi, patoloji, EKG, endoskopi, DICOM, PDF, laboratuvar sonuçları) cihazdan dışarı gönderilmez. Uzak tıbbi AI, OpenAI/Gemini/Claude API'leri, bulut çıkarımı, analitik, telemetri, reklam ve çökme raporlama **yoktur**: veriyi cihaz dışına gönderen bir sağlayıcı kaydedilmek istenirse hata verilir ve hiçbir koşulda (onayla bile) çalıştırılmaz. Web'de CSP `connect-src 'self'`, Android'de `INTERNET` izni manifestten **kaldırılır** (`tools:node="remove"`, CI derlenen APK'yı ayrıca denetler).

```
2B: görüntü (fotoğraf / DICOM kesiti / röntgen)     Model: ai-models/<id>/{model.onnx, manifest.json, NOTICE.txt}
  → modalite + bölge tahmini                          (uygulamayla gelir, aynı kökenden okunur, SHA-256 doğrulanır)
  → ön işleme (kırpma, kenar yumuşatmalı boyutlandırma,   ya da kullanıcının kurduğu model → IndexedDB
    NCHW, ölçek, mean/std)
  → ONNX Runtime Web (WASM, analiz işçisinde) → kutu · maske · çok etiketli skor (konum vermez → yalnızca organ)

3B: DICOM serisi (BT/MR, ≥ 10 kesit)
  → kesit sırası + yönelim + aralık (güvenilmezse nedeniyle ret) → hasta koordinatı (LPS)
  → RAS'a hizalı izotropik ızgara (3 mm anatomi / 1,5 mm patoloji) → sıfır olmayan bölgeye kırpma
  → normalizasyon (BT: veri kümesi parmak izi; MR: z-skor) → kayan pencere (adım 0,8, Gauss ağırlığı)
  → her karonun en yüksek 4 sınıfıyla bellek dostu birleştirme → argmax → etiket hacmi
  → yapı başına hacim (mL), ağırlık merkezi, sınırlar (LPS mm), kesit aralığı → görüntü üzerinde maske
  → basamaklı patoloji modeli: anatomi sonucundaki ilgili organların kutusu + pay → yalnızca orada 1,5 mm'de

Her iki yol: MedicalFinding / ModelStructure (IMAGE_MODEL, konum, provenance: model + sürüm + SHA-256 + lisans
+ belge + kesit + zaman) → anatomi (bilgi grafiği) → organ sayfası → sistem → 3B → fizyoloji akışları
→ rapor ile uyum / ÇELİŞKİ → modeller arası uyuşmazlık ("Modeller arasında uyuşmazlık var")
```

- **Gerçek modeller uygulamayla gelir; model yoksa sahte sonuç yoktur.** Aşağıdaki tablodaki 5 model APK'nın ve web paketinin içindedir, cihazda çalışır. Modeli olmayan modalitelerde (ultrason, Doppler, EKO, mamografi, patoloji, EKG, endoskopi, fundus, diş) "bu cihazda tıbbi AI modeli bulunmuyor" yazar; seri modeli yoksa "Bu analiz için gerekli yerel model cihazda kurulu değil." Sağ-sol simetri ön kontrolü hiçbir zaman AI modeli gibi gösterilmez, rastgele sonuç üretilmez.
- **Model kurmak (ek model):** Ayarlar ve gizlilik → **Yerel tıbbi görüntü modelleri** → "Model kur (.onnx + .json)". Manifest alanları: `id, name, version, modalities, task (detection|segmentation|classification), format: onnx, file, sha256, license, source, intendedUse, input {name, layout NCHW, channels 1|3, width, height, scale, mean, std}, output {boxes, scores, labels, boxFormat | mask | logits}, labels [{id, finding, structure}], scoreThreshold, limitations`. Eksik/yanlış alanlar tek tek listelenir; SHA-256 uyuşmazsa model kabul edilmez; en fazla 600 MB.
- **Performans:** motor ve model ilk kullanımda yüklenir (lazy), oturum SHA-256 ile önbellekte tutulur, model baytları işçiye bir kez gönderilir; ilerleme gösterilir; **İptal** işçiyi sonlandırıp belleği bırakır; model kaldırılınca oturum atılır.
- **Yetenek kaydı** (`capabilitiesFor`, Ayarlar → "Bu cihazda neler yapılabiliyor?"): 12 modalite (MR, BT, röntgen, ultrason, Doppler, EKO, mamografi, patoloji, EKG, endoskopi, fundus, diş) için DICOM okuma, ön işleme, MR sekansı, kural tabanlı ön inceleme, yerel model, görüntü üzerinde konum, anatomi eşlemesi ve MPR; desteklenmeyen her biri `supported: false` ve **nedeniyle**.
- **Rapor + görüntü ayrı kaynaktır.** Aynı çalışmanın raporu model bulgusuyla anatomik yol üzerinden karşılaştırılır: aynı yapıda olumlu ifade → "uyumlu olabilir"; "olağan / izlenmedi" → **"ÇELİŞKİ: … İki kaynak ayrı gösterilir; değerlendirme hekime aittir."**; kardeş bölge (sol frontal ↔ sağ temporal) ilişkilendirilmez. Çelişki analiz kartında, Görüntüler listesinde ve organ sayfasında gösterilir.
- **Modeller arası uyuşmazlık:** birden çok model aynı görüntüde çalışırsa sonuçlar körü körüne birleştirilmez (`modelAgreement.ts`, kurallar veriyle): skor ↔ maskeden ölçüm (ör. kardiyomegali skoru ↔ kardiyotorasik oran), konum ↔ anatomi (bulgu bildirilen yapıyı anatomi modeli bulamadıysa), aynı bulguda zıt skorlar → "**Modeller arasında uyuşmazlık var**", iki taraf da gösterilir.
- **Basamaklı patoloji modeli** (`volume.cascade` manifest alanı): önce anatomi modeli çalışmış olmalıdır; yoksa "önce anatomi bölütlemesi gerekir" yazar ve **tahminle kırpılmaz**. Yardımcı sınıflar (`dropLabels`) sonuçtan silinir. Bulgu sınıfları için gösterim eşiği (`minMl`; altı "eşik altı" diye ayrı yazılır) ve fizyolojik üst sınır (`normalMaxMl`, ör. kalp zarında ≤ 50 mL sıvı normaldir) manifestte veriyle tanımlıdır (hastalığa özel kod yok).
- **Test modeli:** `tests/fixtures/models/mock-detector` — `make_mock_model.py` ile üretilen 447 baytlık, **TEST AMAÇLI SAHTE** bir ONNX modeli ("TEST — sahte bulgu modeli (tıbbi değil)"); sabit bir kutu ve görüntü parlaklığından türeyen bir skor verir. Yalnızca testlerde zinciri (kurulum → çıkarım → kutu → anatomi → organ sayfası → akış → köken) doğrulamak için kullanılır; uygulamaya paketlenmez.

### Gerçek yerel modeller (uygulamayla gelir) — lisans tablosu

| Model (kimlik) | Modalite · görev | Girdi → çıktı | Sürüm / kaynak ağırlık | Lisans | Boyut | Doğrulama (aynı ağırlıklarla resmi çıktıya karşı) |
| --- | --- | --- | --- | --- | --- | --- |
| **TotalSegmentator — BT anatomi** (`totalseg-ct-total-3mm`) | BT · 117 yapı 3B bölütleme (organ, damar, kemik, kas) | DICOM serisi → 3 mm etiket hacmi, yapı hacmi/kesit aralığı | v2.0.0-weights, Dataset297 (`--fast`) | Apache-2.0 (veri CC BY 4.0) | 33 MB | Dice ort. 0,999 (en düşük yapı 0,981), voksel uyumu %99,97 |
| **TotalSegmentator MRI — MR anatomi** (`totalseg-mr-total-3mm`) | MR (sekanstan bağımsız) · 50 yapı | DICOM serisi → 3 mm etiket hacmi | v2.5.0-weights, Dataset852 | Apache-2.0 | 33 MB | Dice ort. 0,999, voksel uyumu %99,98 |
| **TotalSegmentator — böbrek kisti** (`totalseg-ct-kidney-cysts`) | BT · patoloji (basamaklı) | anatomi sonucu + seri → böbrek/karaciğer/dalak/kolon çevresi, 1,5 mm kist maskesi | v2.5.0-weights, Dataset789 | Apache-2.0 | 62 MB | nnU-Net v2 öngörücüsüyle böbrek Dice 0,978/0,985; kistli gerçek BT'de (MSD spleen_19) sol böbrek kisti resmi 0,58 ↔ 0,51 mL (Dice 0,865); kistsiz iki BT'de ikisi de kist bulmadı |
| **TotalSegmentator — plevral/perikardiyal efüzyon** (`totalseg-ct-effusion`) | BT · patoloji (basamaklı) | anatomi sonucu + seri → akciğerler + 5 cm, 1,5 mm sıvı maskesi | v2.0.0-weights, Dataset315 | Apache-2.0 | 62 MB | gerçek göğüs BT'sinde (MSD lung_053): akciğer Dice 0,988; perikard sıvısı resmi 3,1 ↔ 2,8 mL (Dice 0,85) |
| **TorchXRayVision — göğüs röntgeni** (`xrv-densenet121-nih`) | Röntgen · 14 bulgu çok etiketli skor | PNG/JPEG/DICOM → 224×224 → skor (konum **vermez**) | densenet121-res224-nih | Apache-2.0 (NIH veri: kısıtlamasız, atıfla) | 14 MB | kütüphanenin kendi skorlarıyla en büyük fark 3,4e-5 (fp16: ≤ 3,4e-4) |

Her modelin klasöründe `manifest.json` (görev, girdi/çıktı, sürüm, SHA-256, lisans, kaynak, sınırlar, cihaz uyumu, doğrulama) ve `NOTICE.txt` vardır. Modeller `scripts/models/build_models.py` ile **tekrar üretilebilir**: sabit URL'den indirilen ağırlık SHA-256 ile doğrulanır → PyTorch → ONNX (opset 17, çıktı karşılaştırması) → ağırlıklar float16 saklanır (hesap float32; int8 nicemleme doğruluğu düşürdüğü için kullanılmadı) → 3B modellere TopK(4) çıktısı eklenir. Cihaz: BT anatomi karo başına ~40–50 sn (tek çekirdek WASM), tipik seri 1–9 karo; patoloji modelleri 1,5 mm'de daha uzun sürer (süre çalıştırmadan önce gösterilir, iptal edilebilir).

**Eklenmeyen modeller ve nedenleri:**

| Model | Neden eklenmedi |
| --- | --- |
| TotalSegmentator lisanslı görevleri (heartchambers_highres, appendicular_bones, tissue_types, brain_structures, coronary_arteries, aortic_sinuses, face, thigh_shoulder_muscles…) ve brain_aneurysm | Ticari olmayan / ayrı lisans (CC BY-NC vb.) — APK'ya gömülemez |
| TotalSegmentator lung_nodules (Dataset913) | Açık lisanslı, ancak ResidualEncoder ağı ve 1,25×0,74×0,74 mm ızgarada [128,192,192] karo: telefonda bellek ve süre olarak kullanılamaz (ağırlık 820 MB) |
| TotalSegmentator cerebral_bleed, liver_lesions ve diğer açık patoloji görevleri | Bu oturumda doğrulama verisi ve süre sınırı nedeniyle eklenmedi (aynı basamaklı altyapıyla eklenebilir; doğrulanmadan eklenmez) |
| MONAI Model Zoo paketleri, MedSAM ve Hugging Face/Zenodo'da barındırılan modeller | Ağırlıklar Hugging Face / Zenodo'da; bu derleme ortamında erişim kuruluş politikasıyla kapalı — doğrulanamayan ağırlık eklenmez. Bazılarının lisansı ticari olmayan |
| ChestX-Det PSPNet (göğüs röntgeni anatomi, Apache-2.0) | Dönüştürüldü ve doğrulandı (maske uyumu %100) ama 131 MB ve ≥ 8 GB RAM ister: uygulamaya gömülmedi, `build_models.py --packs` ile isteğe bağlı paket olarak üretilir ve "Model kur" ile eklenir |
| Mamografi, endoskopi, dijital patoloji, fundus, diş, EKG/EKO/Doppler, PET/DEXA modelleri | Açık, yeniden dağıtılabilir ve doğrulanabilir ağırlıklı bir model bulunamadı ya da lisans belirsiz/ticari olmayan — eklenmedi; bu modalitelerde "model yok" yazar |

### Modalite desteği — dürüst tablo

**BT, MR ve göğüs röntgeninde gerçek öğrenilmiş modeller** cihazda çalışır (yukarıdaki tablo). Diğer modalitelerde "gerçekten yapılan" sütunu cihazda çalışan, açıklanabilir sinyal işleme/kural algoritmalarıdır; kullanıcı bir ONNX modeli kurarsa o modelin modalitelerinde "yerel tıbbi AI modeli" durumu açılır. Harici yapay zekâ servisi **desteklenmez**.

| Modalite | Gerçekten yapılan (görüntünün kendisinden) | Yapılmayan |
| --- | --- | --- |
| **BT** (DICOM serisi) | **3B anatomi bölütleme** (117 yapı: hacim, kesit aralığı, görüntü üzerinde maske, organ sayfası, 3B) ve **patoloji modelleri**: böbrek kisti, plevral/perikardiyal efüzyon (hacim, konum, Normal ↔ Sende) | Kitle/nodül/kanama tespiti, lezyon karakterizasyonu, tanı |
| **MR** (DICOM serisi) | **3B anatomi bölütleme** (50 yapı); sekans yalnızca DICOM başlığından | Lezyon tespiti, beyin içi yapılar, görüntüden sekans tanıma |
| **MR / BT fotoğraf veya tek kesit** | **Görüntü geometrisi / sağ-sol simetri ön kontrolü** (tıbbi görüntü tanı modeli DEĞİL): kesitlere ayırma, orta hat, ayna karşılaştırması → "görüntü asimetrisi gözlemi"; 3B modeller fotoğrafta çalıştırılmaz (nedeni yazılır) | Lezyon analizi, organ segmentasyonu |
| **Göğüs röntgeni** | **14 bulgu için olasılık skoru** (TorchXRayVision; görüntü düzeyinde, konum vermez → yalnızca ilgili organ), kalite kontrolü | Bulgunun görüntüdeki yeri (sahte kutu çizilmez), yan grafi, çocuk grafisi |
| **EKG** (kâğıt fotoğrafı/taraması) | Milimetrik ızgaradan kalibrasyon (alt piksel), şerit (derivasyon sırası) sayısı, R tepeleri → **RR aralığı, kalp hızı, RR düzenliliği** | PR, QRS, QT/QTc, ST/T, aks, derivasyon adları — **ölçülmez, uydurulmaz** |
| **Ultrason / Doppler / EKO** | Ultrason görüntü alanının (yelpaze) tanınması; bölge seçimden/dosya adından (kaynağıyla) | Organ tanıma, otomatik ölçüm, kist/kitle/taş adayı, Doppler akım |
| **Patoloji / mikroskopi** | Boyalı doku alanı, çekirdek sayımı, yoğunluk ve ortalama büyüklük | Doku tipi, hücre morfolojisi, normal histolojiyle karşılaştırma, tanı |
| **Mamografi, endoskopi/kolonoskopi, dermatoloji, diş, fundus, göğüs dışı röntgen** | Kalite kontrolü, tür tahmini; görüntü saklanır, görüntüleyicide açılır, elle ölçülür | Bu türler için açık lisanslı doğrulanmış model yok (`adapters/unavailable.ts`) |
| **Belge fotoğrafı** (tahlil kâğıdı, rapor, e-Nabız) | Belge olarak tanınır → OCR → test adı, değer, birim, referans aralığı yapılandırılır | — |

Her görüntüde **kalite kontrolü** yapılır: düşük çözünürlük, bulanıklık (kenar genişliği), parlama, kesilmiş kenar, düşük kontrast, çok karanlık/parlak. Kötü kalite güveni düşürür; kullanılamayacak kadar küçük görüntü çökmeden reddedilir.

**Gözlem ≠ bulgu.** `ImageObservation` (ör. "sağ-sol parlaklık farkı") ile `MedicalFinding` (ör. "lezyon") ayrı varlıklardır. Bulgu yalnızca gerçek bir tıbbi görüntü modelinden (`IMAGE_MODEL`, "model-derived") ya da rapordan gelebilir; kural tabanlı ön kontrol asla bulgu üretmez.

**Tıbbi görüntü modeli sağlayıcıları** (`packages/analysis/src/medicalAI.ts`, `localModel.ts`): `MedicalImageAIProvider` — `analyzeStudy`, `classifyModality`, `classifySequence`, `detectStructures`, `segmentStructures`, `detectFindings`, `localizeFindings`, `measureStructures`, `compareStudies`; her çıktı kaynak, model, model sürümü, güven, konum, anatomik yapı ve sınırlarını taşır. Modeli olmayan modalite grubu `unavailable` döner; uygulamayla gelen ya da kurulu bir 2B ONNX modeli `LocalModelProvider` olarak kaydedilince `runMedicalImageModel` bulgu → konum (piksel kutusu/maske/nokta) → anatomi (bilgi grafiği yolu) → 3B zincirini kurar, zaman aşımı ve hata yönetimi yapar. Uzak sağlayıcı, API anahtarı ya da sunucu adresi yapılandırması **yoktur**.

**"Vücutta göster" açıklaması konuma göre değişir:** gerçek model konumu varsa "Bulgu, görüntü analizinden elde edilen konum bilgisiyle 3B anatomide gösteriliyor"; yalnızca bölge biliniyorsa "Bu gösterim görüntünün ait olduğu organı/bölgeyi gösterir; belirli bir bulgunun kesin konumu değildir"; rapordan ise "Konum rapordaki anatomik ifadeden eşleştirildi; gerçek piksel koordinatı değildir".

Yeni bir modalite modeli eklemek mevcut sistemi bozmaz: `ImageAnalysisAdapter` arayüzünü uygulayan adaptör `AdapterRegistry.register()` ile kaydedilir (ör. `FundusAnalysisAdapter`). Sağlayıcı soyutlaması (`AIProvider`, `MedicalVisionProvider`: `analyzeImage`, `detectFindings`, `localizeFinding`, `segmentStructure`, `classifyModality`, `estimateAnatomy`) desteklenmeyen yöntemlerde `unavailable` ve nedenini döndürür. Veriyi cihaz dışına gönderecek bir sağlayıcı kaydedilemez.

### Vücudum ve organ sayfaları

- **Vücudum** (`#/vucudum`): dikkat çeken organlar ve her birinde tahlil / rapor bulgusu / görüntü gözlemi sayısı. Tüm organlar sistemlere göre listelenir. Kritik değerlerde "acil değerlendirme gerekebilir — doktor değerlendirmesi gerekir" uyarısı çıkar (tanı iddiası olmadan).
- **Organ sayfası** (`#/organ/<düğüm>`, `/benim`, `/ic`, `/derin/<düğüm>/…`): genel bakış · kişisel ayrıntı · iç yapı · derinlemesine inceleme (yukarıdaki "Arayüz" bölümü). Yerel model bulgusu varsa "Benim durumum"da ◆ ile özetlenir, ayrıntıda "Yerel tıbbi AI modelinin bulguları" (TIBBİ GÖRÜNTÜ MODELİ rozeti, model adı, güven, anatomi yolu, rapor ile çelişki, "Görüntüyü aç") gösterilir; organ alt sayfası ve Vücudum özeti de bunu sayar ("1 yerel AI modeli bulgusu", tanı değildir).
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
| **Belgelerim** | Tek alana PDF/JPG/PNG/DICOM/ZIP yükleme (tür otomatik), tahlil/görüntüleme filtresi (imza, boyut, piksel ve sayfa sınırları), şifreli saklama, PDF ve görsel görüntüleyici (yakınlaştır, sayfa, döndür, tam ekran), orijinali bayt bayt indirme, yeniden adlandırma, silme |
| **Okuma** | PDF metin katmanı; taranmış sayfa, fotoğraf ve ekran görüntüsü (ör. e-Nabız) için cihazda OCR (Tesseract, Türkçe). Görüntüler iki farklı sayfa bölütlemesiyle okunur; iki okumanın uyuşmadığı değerler doğrulamaya düşer. 81 testlik LOINC kataloğu (hemogram ve akyuvar alt türleri, biyokimya, lipid, tiroid, cinsiyet hormonları, kortizol, prolaktin, vitamin-mineral, demir, pıhtılaşma), Türkçe ondalık, birim dönüşümü, farklı sütun düzenleri, rapordaki referans aralığı (etiketli, cinsiyete ya da döngü evresine göre verilen aralıklar dahil), düşük güvenli satırlar işaretli |
| **Görüntüleme (MR, BT, röntgen, ultrason)** | Belge türünü sistem kendisi anlar; istenirse yüklerken elle seçilir (Tahlil / MR / Tomografi (BT) / Röntgen / Ultrason / Diğer). **DICOM** dosyaları (CD/USB'deki `.dcm` veya uzantısız `IM000001` gibi dosyalar) cihazda okunur: masaüstünde **klasör seçerek** içe aktarma (DICOMDIR ve görüntüleyici programları atlanır), aynı seriye ait kesitler listede tek satır ve tek görüntüleyicide. Görüntüleyici: kesit kaydırma (tekerlek, ok tuşları, kaydırıcı), pencere/seviye (sağ tıkla sürükle ya da kontrast aracı), BT ön ayarları (yumuşak doku, akciğer, kemik, beyin, karaciğer; Hounsfield), negatif, yakınlaştırma, tam ekran. Sıkıştırmasız, RLE ve JPEG Baseline çözülür; JPEG 2000 / JPEG-LS tanınır ama çözülmez (dosya saklanır, açıkça söylenir). Tür, bölge (beyin, bel omurgası, diz, toraks…), çekim tarihi ve seri başlıktan otomatik gelir; **hasta adı ve kimlik numarası okunmaz, gösterilmez**. Radyoloji raporu (PDF/fotoğraf) okunur, Klinik bilgi / Teknik / Bulgular / Sonuç bölümlerine ayrılır, elle düzeltilebilir; raporda geçen ~45 terimin (hiperintens, protrüzyon, stenoz, konsolidasyon, BI-RADS…) genel anlamı gösterilir, bölge 3B vücutta açılır. **Fotoğrafı çekilmiş film veya ekran görüntüsü** (JPG/PNG) de aynı görüntüleyicide açılır: otomatik kontrast, pencere/seviye, negatif, döndürme. Kâğıt rapor fotoğrafı kendiliğinden okunur; film fotoğrafında okuma yapılmaz. Tahlil diye yüklenen film fotoğrafında OCR'dan önce "görüntüleme mi?" diye sorulur; değer bulunamayan belgede de aynı seçenek çıkar. Görüntüleme raporları **Sonuçlar** ekranında (raporun kendi "Sonuç" bölümü ve terimleriyle), **Zaman** ekranının rapor geçmişinde ve **Keşfet**'te ilgili organın bulutunda ("Görüntülemem") ve organ panelinde ("Görüntülemelerin", raporun sonucuyla) görünür. **Ölçümler tahlil gibi:** raporda yazan ölçümler (dalak/karaciğer/böbrek boyu, koledok, portal ven, aort çapı, prostat ve tiroid hacmi, kardiyotorasik oran, Evans indeksi, orta hat kayması, bel/boyun kanalı çapı, akciğer nodülü, EF, sol karıncık ve kulakçık, pulmoner basınç, karotis IMT, kemik yoğunluğu T-skoru — 25 ölçüm) otomatik okunur ve genel referans aralığına göre Normal / Yüksek / Düşük gösterilir; açınca ne ölçtüğü, olası nedenler (kesin değil), doktora sorulabilecekler, vücutta göster ve içeri gir. Görüntü üzerinde **cetvel** (DICOM'da mm), **iki çizgiden oran** (fotoğrafta da) ve BT'de **yoğunluk (HU)** ölçülüp aynı şekilde kaydedilir. Referans dışı ölçümler 3B vücutta ilgili organı tahliller gibi renklendirir. **Görüntü geometrisi / sağ-sol simetri ön kontrolü** (tıbbi görüntü tanı modeli değildir): yazısı ve raporu olmayan MR/BT fotoğrafı ya da DICOM kesiti cihazda incelenir: kolaj kesitlere ayrılır, her kesitte orta hat (eğiklik dahil) bulunur, sağ yarı sol yarının ayna görüntüsüyle karşılaştırılır ve karşı tarafa göre belirgin daha parlak/koyu kalan alanlar "görüntü asimetrisi gözlemi" olarak fark haritası ve kutuyla işaretlenir ("Kesit 2 · görüntünün sol üst kısmı · daha parlak"). Yandan (sagital) ve simetrik olmayan kesitler karşılaştırılmaz ve bu açıkça yazılır; kesitlerin şekli baş kesitine benziyorsa bölge olarak "Beyin" önerilir (onay ister). Kullanıcı "Sonuçlarıma ekle" derse 3B'de ilgili organ işaretlenir ve organ panelindeki "Sonucuma göre" bu görüntüyü açar. Bu bir sağ-sol fark ölçümüdür, tanı değildir: normal asimetriler, sinüsler, baş eğikliği ve fotoğraf açısı yanlış işarete; iki tarafı eşit etkileyen değişiklikler kaçırılmaya yol açabilir. Uygulama görüntüye bakıp teşhis koymaz. Her görüntüleme belgesinde **Vücutta göster** vardır; bölge bilinmiyorsa önce bölge sorulur, seçilen bölge belgeye kaydedilir. Aynı çekime ait görüntü ve rapor (aynı tür ve tarih ya da aynı bölge, 7 güne kadar arayla) birbirine bağlanır: MR kesitleri raporun sonucunu da gösterir. Uygulama görüntüyü veya raporu **yorumlamaz**; ön kontrol yalnızca sağ-sol farkını gösterir |
| **Onay** | Okunan her değer onaydan geçer: düzeltme, tanınmayan satırı bir teste bağlama (kalıcı takma ad), elle ekleme, kaynağı belgede vurgulama |
| **Sonuçlarım** | Yüksek/düşük/normal, aralık çubuğu, "bu test neyi ölçer", olası etkenler, doktora sorulabilecekler |
| **Keşfet (3D)** | Seçilebilir **erkek ve kadın** vücudu (48 yapı, her vücutta 300+ ayrı bölüm: kalp odacıkları ve kapakları, 22 beyin bölgesi, göz katmanları, böbrek iç yapısı, akciğer lobları, karaciğer segmentleri, diz bağları…; Türkçe ve Latince adlar). Sonuçla ilişkili organlar belirgin, diğerleri soluk; organa dokununca küçük dijital **bilgi bulutu** (Sonucum · Temelde nasıl çalışır · Sonucuma göre · İçeri gir). Arama (Türkçe/Latince, Ctrl+K), izole et, gizle, kesit görünümü, iç anatomi, klavye kısayolları, açık/koyu/sistem teması. Seviyeler: İnsan / Sistem / Organ / Bölüm / Doku / Hücre / Süreç |
| **İçeri gir** | 22 simülasyon sahnesi + 20 doku atlası sahnesi (her 3B yapının içine girilebilir). Simülasyonlar: damar içi ve 8 aşamalı LDL–ateroskleroz; kan hücreleri; alveol ve gaz değişimi; nefron ve süzme; karaciğer lobülü; pankreas adacığı; tiroid folikülü; kemik iliği; nöron ve sinaps (sinir sinyali); retina (görme); koklea (işitme); kalp kası (kasılma); sarkomer (kas kasılması); osteon (kemik yenilenmesi); mide bezi (sindirim, B12); bağırsak villusu (emilim); deri (D vitamini); hücre ve enerji (ATP); hormon salgısı; lenf düğümü (bağışıklık); yumurtalık; testis. Her sahne "Temelde nasıl çalışır" (tipik değerler) ya da "Sonucuma göre" (senin değerlerin) açılabilir. Sahnedeki sayı, boyut ve renkler kişinin son sonuçlarına göre çizilir; "tipik değerler" ile karşılaştırılabilir. Oynat/duraklat, hız, aşama çizelgesi, nesneye dokununca açıklama. Ekranda her zaman **"Eğitimsel biyolojik simülasyon"** etiketi. **Doku atlası** (`src/explore/inside/tissues.ts`, veriyle tanımlı, tek bir prosedürel sahneyle çizilir): yemek borusu, kalın bağırsak, safra kesesi, mesane, prostat, rahim, fallop tüpü, vajina, meme, eklem kıkırdağı, solunum yolu, timus, bademcik, hipofiz, böbreküstü bezi, epifiz, dalak, toplardamar duvarı, ekzokrin pankreas, vas deferens. Duvar katmanları lümenden dışa sıralı; katmana dokununca kamera o katmana iner; peristaltizm, sil vuruşu, salgı ve akış basit animasyonla gösterilir. Bu sahneler **"Doku atlası · şematik"** etiketlidir ve sonuçlara göre değişmez. Her yapının sahneleri "kendi dokusu / ortak doku tipi / ilişkili doku" diye etiketlenir; ilişkili doku (ör. safra kesesinden karaciğer lobülüne) asla kendi dokusu gibi gösterilmez. Yeni organ eklemek için `tissues.ts`'e bir profil ve `anatomy/organs.ts`'e bir bağlantı yeterlidir |
| **Vücutta göster** | Tahlilden keşif yolu: LDL → koroner arterler → damar içi → simülasyon; hemogram → kan hücreleri; ALT → karaciğer → lobül; kreatinin → böbrek → nefron; glukoz → pankreas → adacık; CK → iskelet kasları. Aralık dışı bulgular arasında ileri/geri gezinme. CRP, lökosit, ferritin gibi tek bir organa özgü olmayan testler bunu açıkça belirtir |
| **Zaman** | Test başına eğilim grafiği (her ölçümün kendi raporundaki referans bandıyla), noktadan rapora ve vücuda gidiş, tablo görünümü, rapor geçmişi |
| **Yedek** | `.khyedek` şifreli yedek (ayrı yedek parolası), başka cihaza geri yükleme, tekrarları atlama |
| **Verilerimi indir** | Şifresiz ZIP: orijinaller + `sonuclar.json` + `sonuclar.csv` (açık uyarıyla). DICOM dosyalarında kimlik alanları (hasta adı, kimlik no, doğum tarihi, erişim no, kurum ve hekim adları, iç içe diziler dahil) varsayılan olarak temizlenir; kasadaki özgün dosya değişmez. Görüntüsüne yazı yakılmış (ya da olası) DICOM dosyaları `OKUBENI.txt`'de ve ekranda ayrıca listelenir (pikseldeki yazı silinmez) |
| **Gizlilik** | Veri akışı, depolama, açma yöntemleri (parola, Android'de parmak izi/yüz/PIN), otomatik kilit, profil, tüm verileri sil |

Olmayan veya bağlanmamış her şey arayüzde açıkça yazar: harici yapay zekâ **YOK (desteklenmez)**, yerel model kurulu değilse "bu cihazda tıbbi AI modeli bulunmuyor"; tiroid, kulak, kol-bacak damarları ve periferik sinirler **şematik**. Uygulamadaki **Kapsam raporu** (`#/kapsam`) her yapı için iki vücutta dış görünüm, bölüm sayısı, iç keşif derinliği (simülasyon / şematik doku atlası / yalnızca ilişkili doku), sahne ve süreç durumunu model dosyalarından ve uygulama verisinden okuyarak gösterir.

## Güvenlik modeli (kısa)

- **Kasa:** parola → Argon2id (64 MiB, 3 tur) → 256 bit ana anahtar sarılır. Her belge kendi anahtarıyla, 1 MiB'lık parçalar halinde AES-256-GCM ile şifrelenir. Parça AAD'si dosya kimliği, parça no ve son-parça bayrağını içerir: sıra değişirse, dosya kesilirse ya da taşınırsa açılmaz. Rapor ve sonuç kayıtları da ana anahtarla şifrelidir; depoda açık duran tek şey rastgele UUID'lerdir.
- **Android:** Kotlin/Compose kabuğu içinde WebView (yalnızca `appassets.androidplatform.net`). Cihaz kilidi anahtarı Android Keystore'da durur ve her kullanımda biyometri/PIN ister. `FLAG_SECURE`, `allowBackup=false`, internet izni yok, köprü yalnızca ana çerçeve ve kendi kökeni için.
- **Web:** CSP `connect-src 'self'` (veri gönderilebilecek hedef yok), `script-src 'self' 'wasm-unsafe-eval'` (yalnızca paketli WASM: OCR, ONNX), Trusted Types, satır içi script yok. PDF.js, OCR, ONNX Runtime ve 3D dosyalarının hepsi uygulamayla paketlenir; CDN yok. Service worker yalnızca aynı kökenden GET ile uygulama dosyalarını önbelleğe alır.
- **Çevrimdışı denetim:** `tests/security/offline.test.ts` kaynakta `fetch`/XHR/WebSocket/EventSource/sendBeacon ve uzak adres, uzak AI yapılandırması ve analitik/telemetri/reklam/çökme raporlama paketleri olmadığını, Android manifestinde INTERNET izninin kaldırıldığını ve CSP'yi her test koşusunda denetler. Lint kuralları `fetch`, `innerHTML`, `eval`, `console` ve serbest `localStorage` kullanımında derlemeyi durdurur.
- **Yedek:** `KHYEDEK1` başlığı + Argon2id + parçalı AES-256-GCM. Başlığın tamamı AAD'ye girer, kurcalanan yedek açılmaz.
- **Sunucu tarafı konular:** Oturum, IDOR/BOLA, CSRF ve hız sınırı gibi başlıklar bu mimaride geçerli değil, çünkü sunucu yok. Bunların karşılığı cihazdaki şifreli kasadır.

## Testler

- **Çok kipli analiz ve kabul senaryoları (Vitest):** `packages/analysis/src/__tests__` (kalite, modalite, EKG ölçümü — alt piksel ızgara dahil, adaptör kaydı, bilgi grafiği bütünlüğü ve zincirleri, örüntü motoru, eğilim, eski↔yeni karşılaştırma, referans önceliği) ve `apps/web/src/__tests__/acceptance.test.ts`: **A** yalnızca MR (gerçek fikstür fotoğrafı, rapor yok — 20 adım), **B** MR + rapor, **C** MR + kan, **D** eski + yeni MR, **E** yalnızca EKG, **F** yalnızca pankreas ultrasonu, **G** yalnızca patoloji, **H** yalnızca tahlil fotoğrafı ve **MR + rapor + kan + önceki MR** birleşik modeli. DICOM anonimleştirme (açık/örtük VR, iç içe diziler).
- **Gerçek modeller (Vitest, ONNX Runtime):** `apps/web/src/__tests__/realModels.test.ts` — gömülü modeller gerçek görüntülerde çalıştırılır ve **aynı ağırlıklarla üretilmiş resmi çıktıyla** karşılaştırılır: BT (voksel uyumu > %99,5, ort. Dice > 0,98; karaciğer hacmi, sağ-sol konumu), MR (aynı eşikler), röntgen (14 skor, Python'a ±0,03), basamaklı böbrek kisti modeli (kırpma kutusu, modelin böbrek maskesi ↔ anatomi modeli Dice > 0,85, kist yok, kesit aralığı özgün seriye göre), anatomi sonucu olmadan basamaklı modelin reddi. `packages/analysis/src/__tests__/volumeModel.test.ts`: karo adımları, RLE, kırpma kutusu ve kaydırılmış köken, yardımcı sınıf silme, eşik altı / fizyolojik / bulgu sınıflaması, manifest alanları.
- **Yerel AI ve dürüstlük (Vitest):** `localModel.test.ts` (manifest doğrulama, ön işleme, tespit/segmentasyon/sınıflandırma son işleme, sahte motorla `LocalModelProvider` — tembel yükleme, tek yükleme, modalite reddi, dispose —, model → kutu → anatomi → köken, 12 modalite yetenekleri, üç durum, köken türetimi, rapor ↔ model uyumu/ÇELİŞKİ/kardeş bölge, akış basamağına bağlama), `modalities.test.ts` (MR, BT, röntgen, ultrason, patoloji, EKG, endoskopi: model yokken asla "model" durumu yok, lezyon üretilmez), `apps/web/src/__tests__/localModels.test.ts` (kurulum + SHA-256 uyuşmazlığı; **gerçek ONNX Runtime ile** test modeli: bulgu → kutu → beyin › frontal → köken), `packages/ingest/src/__tests__/mpr.test.ts` (yakılmış yazı (0028,0301), ikincil yakalama, yönelim; MPR geometrisi, düzlem adları, voksel doğruluğu ve mm oranı, güvenilmez seride ret nedenleri), `tests/security/offline.test.ts` (kaynakta ağ API'si ve uzak adres yok, yasaklı paket yok, uzak AI yapılandırması yok, ORT yalnızca yerel WASM, Android INTERNET izni kaldırılmış, CSP).
- **Birim/güvenlik testleri (Vitest):** kripto ve kurcalama, sızıntı (depoda açık metin yok), silme, yükleme saldırıları (sahte uzantı, dev PNG başlığı, path traversal), ayrıştırıcı, katalog bütünlüğü, yorum motoru, yedek (yanlış parola, kurcalanmış gövde/başlık, sürüm), ZIP, XSS.
- **Sentetik rapor seti (`fixtures/`):** 7 PDF (hemogram, biyokimya, kadın hormon, vitamin-mineral, lipid, çoklu anormallik, genel) ve 4 görüntü (eğik telefon fotoğrafı, gürültülü tarama, e-Nabız benzeri ekran görüntüsü, düz tarama); her biri farklı bir laboratuvar düzeni. PDF'lerde her satırın değeri, durumu ve beklenen yorum örüntüleri; görüntülerde gerçek Tesseract ile okuma ve **yanlış okunan hiçbir değerin doğrulama işareti olmadan geçmemesi** test edilir.
- **Uçtan uca (gerçek Chromium, CI'da her gönderimde):**
  - `tests/e2e/smoke.py`: kasa, belgeler, görüntüleyici, indirme, silme, kilit.
  - `tests/e2e/flow.py`: PDF ve fotoğraf okuma, onay, sonuçlar, renk kabulü (90/91: yüksek LDL adı ve değeri aynı tonda, düşük ferritin mavi, normal glukoz nötr; pankreas sayfasında trigliserid adı/değeri/▲ aynı tonda), vücutta göster, simülasyon, nesne seçimi, Esc ile dönüş.
  - `tests/e2e/data.py`: zaman çizelgesi, şifreli yedek → yeni kasaya geri yükleme, ZIP doğrulaması.
  - `tests/e2e/multimodal.py`: rapor olmadan MR fotoğrafı, EKG, ultrason ve patoloji görüntüsünün ön incelemesi; Vücudum → organ alt sayfası → organ sayfası, "Neden?" zinciri; kabul senaryoları 87 (Vücudum → Sindirim → İnce bağırsak: nasıl çalışır → içini göster → fizyoloji adım adım → benim durumum → derinleş), 88 (beyin MR fotoğrafı: ✓ kesit/orta hat/simetri, ◻ lezyon/segmentasyon/sekans, vücutta göster → beyin), 95 (2 kesit: tam MR değerlendirmesi denmez), keşif modu (10 sistem), breadcrumb ve geri dönüş. Ayrıca:
    - "Veri ekle" ve "Vücudum" ilk ekranda görünür; gezinmede teknik öğe yoktur.
    - MR sonucunda en fazla 8 görünür düğme bulunur; model ayrıntıları "Nasıl analiz edildi?" bölümünde.
    - Beyaz cevher için seviye seviye iniş (doku → oligodendrosit → miyelin oluşumu → miyelin) çalışır.
    - "pankreas" araması doğru sonucu verir.
    - Telefonda alt gezinme en fazla 5 öğedir, "Daha" alt sayfası açılır, yatay taşma yoktur.
  - `tests/e2e/realmodels.py` (**gerçek modeller, gerçek görüntüler**): model deposu (5 model, lisans, kaynak, SHA-256; uygulamayla gelen kaldırılamaz); NIH göğüs röntgeni → TorchXRayVision → kardiyomegali skoru, 14 skor, sahte kutu yok, köken; BT serisi → patoloji modeli önce anatomi ister → 3B anatomi bölütleme (cihazda) → yapılar, maske katmanı, Görüntüde / Organ / 3B, organ sayfasında model yapısı → böbrek kisti modeli (basamaklı) → resmi çıktı gibi kist yok, köken; MR serisi → MR anatomi bölütleme.
  - `tests/e2e/localai.py`: uygulamayla gelen 5 model, modeli olmayan 9 modalitede "model yok"; beyin MR fotoğrafında 3B MR modeli çalıştırılmaz (nedeni yazılır, ön inceleme, model bulgusu yok); test modelini kur (bozuk SHA-256 reddi) → aynı görüntüde **yerel model** durumu, gerçek görüntü üzerinde kutu, güven, beyin › frontal lob, köken (SHA-256) → Görüntüler rozeti → organ sayfası → sinir sistemi akışında "İşleme" basamağı → Vücudum özeti; aynı görüntüye "beyin olağan" raporu → **ÇELİŞKİ** gösterilir, kaynaklar ayrı; model kaldırılınca yeniden ön inceleme; 8 kesitlik DICOM'da MPR yapılmaz ve nedeni yazılır; yakılmış yazı bilgisi.
  - `tests/e2e/explore.py`: 3B keşif ekranı, 22 sahne, iç yapı, kişisel mod.
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

Uçtan uca testler için önce `pnpm build`, sonra `pnpm preview --port 4173` çalıştır. Ardından her betik ayrı çalıştırılır (Playwright gerekir; `CHROME_PATH` ile tarayıcı seçilebilir):

```bash
for s in smoke flow data reports imaging multimodal localai explore; do python3 tests/e2e/$s.py; done
```

Her derlemeden sonra önizleme sunucusunu yeniden başlat (eski sunucu yeni dosya adlarını görmez).

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
              bilgi grafiği, örüntü motoru, eğilim, eski↔yeni karşılaştırma, birleşik sağlık modeli, organ görünümü,
              yerel model altyapısı (localModel.ts: manifest, ön/son işleme, sağlayıcı, yetenekler, üç durum)
  vault/      Şifreli kasa + şifreli yedek (Argon2id, parçalı AES-256-GCM, kripto-imha)
  ingest/     Yükleme doğrulaması, DICOM okuma ve anonimleştirme, yakılmış yazı riski, MPR (mpr.ts), sağ-sol görüntü incelemesi
  catalog/    74 test (LOINC), birimler, aralıklar, anatomi yapıları, süreçler, açıklama metinleri
  parser/     PDF metin katmanı / OCR satırlarından sonuç çıkarma
  platform/   PlatformAdapter (web, Android köprüsü)
apps/web/     Vite + React + Tailwind; three.js / React Three Fiber
  src/anatomy/   model yükleme, malzemeler, yapı eşlemesi, şematik tiroid
  src/explore/   Keşfet ekranı, sinematik kamera, gürültü geçişi, paneller
  src/explore/inside/   içeri-gir sahneleri, aşama/nesne içerikleri
  src/lib/localModels/  ONNX Runtime Web motoru (engine.ts) ve model deposu (store.ts, SHA-256, IndexedDB)
  src/lib/analysis.worker.ts  görüntü analizi ve yerel model çıkarımı (ana iş parçacığı dışında)
apps/android/ Kotlin + Compose kabuğu (WebView, Keystore, SAF)
assets-pipeline/  HRA + BodyParts3D → uygulama GLB dönüşümü
tests/        güvenlik/çevrimdışı testleri, uçtan uca betikler, TEST AMAÇLI sahte ONNX modeli (tests/fixtures/models)
fixtures/     yalnızca sentetik raporlar
```

## Bilinen sınırlar

- **Görüntü analizi:** Gömülü modeller BT/MR anatomi bölütleme, iki BT patoloji görevi (böbrek kisti, efüzyon) ve göğüs röntgeni skorlarıdır; bunlar dışında lezyon tespiti yoktur. Modellerin uygulamadaki dönüşümü resmi çıktıyla doğrulandı; **klinik doğrulukları** bu uygulamada ayrıca doğrulanmadı (yayımlanmış başarımları kaynaklarında) ve hiçbiri onaylı tıbbi cihaz değildir. Böbrek kisti modeli yalnızca küçük (0,58 mL) bir kistli vakada, efüzyon modeli yalnızca küçük perikard sıvılı bir vakada resmi çıktıyla karşılaştırıldı; büyük kist ya da belirgin efüzyonlu vakada ayrıca doğrulanmadı. 3B modeller tek çekirdek WASM'da çalışır (WebGPU yok: doğruluk değişmeden hızlandırma yapılamadığı için eklenmedi); büyük seriler dakikalar sürer. Kullanıcının kurduğu ek modellerin klinik doğruluğu doğrulanmaz (yalnızca SHA-256). MR/BT fotoğrafında yalnızca sağ-sol simetri ön kontrolü yapılır (lezyon tespiti değildir; normal varyantlar yanlış işarete, iki tarafı eşit etkileyen değişiklikler kaçırılmaya yol açar). Beyin konumu radyolojik düzen ve "ön taraf yukarıda" varsayımıyla tahmin edilir; kesit düzeyi bilinmediği için alternatif loblar listelenir. MR ile BT fotoğraftan güvenilir ayırt edilemez. EKG'de kâğıt hızı 25 mm/sn varsayılır; DICOM dalga formu EKG okunmaz. Ultrasonda organ görüntüden tanınmaz. Patolojide büyütme bilinmediği için ölçümler mikrometreye çevrilmez.
- **Görüntüleyici:** DICOM serisinde kesit kaydırma, pencere/seviye, ölçüm ve **MPR** var. MPR yalnızca ≥ 10 kesitlik, aynı yönelimli, düzenli aralıklı, tek kareli ve bellek sınırını aşmayan seride yapılır; aksi hâlde nedeni yazılır. MPR görüntüsünde ölçüm kapalıdır (enterpolasyon). Görüntüye yakılmış yazı başlıktan/SOP sınıfından tahmin edilir; pikseldeki yazı otomatik **silinmez** (görüntü ekranında ve dışa aktarmada uyarılır).
- **Vücut akışları** genel fizyoloji bilgisidir ve sabit 14 akışla sınırlıdır; kişisel katman laboratuvar sonuçlarını ve konumlu rapor/model bulgularını basamaklara **olası ilişki** olarak bağlar.
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
- **Tıbbi görüntü modelleri** (`apps/web/public/ai-models/*/NOTICE.txt`): TotalSegmentator (Wasserthal J. ve ark., Radiology: AI 2023; D'Antonoli ve ark., Radiology 2025) — Apache-2.0, yalnızca açık lisanslı görevler (total, total_mr, kidney_cysts, pleural_pericard_effusion); TorchXRayVision (Cohen J.P. ve ark., MIDL 2022) — Apache-2.0, NIH ChestX-ray14 verisi (NIH Clinical Center, kısıtlamasız kullanım, atıfla). Ağırlıklar değiştirilmeden ONNX'e çevrildi (float16 saklama).
- **Test görüntüleri** (`fixtures/imaging`): TotalSegmentator örnek BT/MR (CC BY 4.0), NIH ChestX-ray14 örneği. Doğrulamada kullanılan gerçek BT'ler (MSD Task06 lung_053 ve Task09 spleen_19, CC BY-SA 4.0) depoya eklenmedi.
- **Açık kaynak bileşenler:** React, three.js, React Three Fiber, drei, camera-controls, hash-wasm ve ONNX Runtime Web MIT lisanslıdır. PDF.js, Tesseract.js ve Tesseract dil modelleri Apache-2.0 lisanslıdır. Tam liste uygulamadaki Hakkında ekranında.
