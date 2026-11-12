# Tam vücut anatomi envanteri ve eksik listesi

**Durum: Aşama 1–3 entegre edildi (2026-11-12); tam vücut henüz tamamlanmadı.** Aşağıdaki §0 bu turda
yapılanları, §7 hâlâ eksik olanları listeler. §1–§6 ilk envanterdir (Aşama 0); değişen satırlar §0'da.

## 0. Bu turda yapılanlar

| Aşama | Ne yapıldı | Nerede | Not |
|---|---|---|---|
| 1 | **İskelette her kemik ayrı mesh** (erkek 247, kadın: 25 omur + sakrum/koksiks + pelvis parçaları HRA'dan, diğerleri BodyParts3D'den uyarlanmış). Her mesh'te FMA kimliği, kaynaktaki ad, Türkçe ve Latince ad, kaynak kodu ve kadında "uyarlandı" işareti (glTF `extras`) | Temel model (`skeleton.glb`), APK içinde | Türkçe/Latince adlar `assets-pipeline/names-tr.ts` sözlüğünden; sözlükte olmayan ad uydurulmaz |
| 1 | Panelde tek yapı: ad, Latince, bölüm, kaynak kimliği, kaynak ve lisans; liste "Modeldeki tek tek yapılar"; aramada tek yapılar; doğrudan bağlantı `#/vucut/yapi/<yapı>/e-…` | `BodyPanels.tsx`, `SearchOverlay.tsx` | |
| 1 | Kadında erkekten uyarlanan her yapı (kemikler, kaslar, mide, yemek borusu, hipofiz, böbreküstü, diyafram, BodyParts3D gövde damarları, tüm kadın paketleri) **mora kaydırılmış renk + "Erkek referansından uyarlanmıştır"** etiketi | `palette.ts`, `sources.ts` | |
| 2 | **Z-Anatomy dönüştürme hattı**: FBX → glTF, 72 kemik çifti üzerinden Umeyama hizalama (ortalama 4,4 mm, en büyük 21 mm), dişler/kulak yapıları için kemiğine yerel ICP (alt çene 5,7 mm, şakak 4–5 mm kaydırma, artık 0,4–2,5 mm), NC lisanslı ve lisansı belirsiz parçaların otomatik dışlanması, yumuşak normaller, meshopt sıkıştırma | `assets-pipeline/zanatomy-*.ts` | Kadın paketleri temel modeldeki kadın kemik/kaslarıyla aynı erkek → kadın eklem uyumundan geçer |
| 2 | **İsteğe bağlı paketler (.khpack)**: dosyadan kurulur; manifest + lisans + SHA-256 denetlenir, özet uygulamaya gömülü resmi listeyle (`packs.generated.ts`) eşleşmezse kurulmaz; IndexedDB'de saklanır, internetsiz çalışır; aç/kapa, kaldır. Uygulamanın internet izni yok, değişmedi | `anatomy/packs.ts`, Gizlilik ve veriler → Anatomi paketleri | Paketler APK'ya girmez; derlemede ayrı ek ve `apk-son` sürümünde ayrı dosya |
| 2 | Paket etkinken yerini aldığı temel yapılar gizlenir (bölgesel kaslar, şematik sinirler, şematik kol-bacak damarları, şematik tiroid, şematik dış/orta kulak); paket yüklenene kadar temel model görünür | `useModels.ts` | Sistem bazlı yükleme: paket yalnız kurulu ve açıkken yüklenir |
| 2 | **Organı vücuttan ayır** (araç çubuğu / D tuşu): odaktaki yapı vücudun önüne taşınır, kamera kadrajlar | `BodyScene.tsx`, `Explorer.tsx` | |
| 3 | 6 sistem paketi × 2 vücut (aşağıda) | `anatomy-packs/` | |

| Paket | Yapı | Üçgen | Boyut | İçerik |
|---|---:|---:|---:|---|
| Kaslar, tendonlar ve fasyalar | 664 | 520 bin | 4,3 MB | Tek tek kaslar (tendonlarıyla), 76 fasya, bursalar, tendon kılıfları; göz kasları HRA'da kalır |
| Eklemler ve bağlar | 345 | 139 bin | 1,4 MB | Kapsüller, bağlar, eklem diskleri, zarlar; diz bağları/menisküs HRA'da, omurlar arası diskler BodyParts3D'de kalır |
| Sinirler | 265 | 260 bin | 2,0 MB | Kafa sinirleri I–XII ve dalları, boyun sinirleri, brakiyal ve bel-sakral pleksus dalları, sempatik zincir, spinal ganglionlar, beyin ve omurilik zarları |
| Damarlar | 534 | 332 bin | 3,0 MB | Kol-bacak arter ve venleri (el/ayak dallarına kadar), dış/iç karotis dalları, vertebral arter, Willis halkası, dural sinüsler, gövde duvarı ve pelvis dalları; kalp ve ana gövde damarları HRA'da kalır |
| Lenf düğümleri | 158 | 73 bin | 0,7 MB | Baş, boyun, koltuk altı-kol, göğüs, karın, pelvis, kasık-bacak düğüm grupları |
| Baş-boyun | 124 | 164 bin | 1,2 MB | Dil, damak, dişeti, tükürük bezleri ve kanalları, yutak, burun boşluğu ve sinüsler, gırtlak kıkırdakları, 28 diş, tiroid ve 4 paratiroid, kulak kepçesi, kulak zarı, kemikçikler, Östaki borusu |

(Değerler erkek paketleri; kadın paketleri aynı yapı sayısında, üçgen ve boyut ±%1.)

Tarih: 2026-11-12 · Dal: `ccr-3b782f4c-3pfpxw`

Sayıların kaynağı:

- Mevcut durum: `apps/web/public/models/manifest.json` ve `apps/web/src/anatomy/coverage.generated.ts`
  (GLB düğümlerinden üretilir).
- Z-Anatomy: FBX dosyaları bu ortamda indirildi, `assets-pipeline/zanatomy-index.py` ile tek tek
  sayıldı. Mesh listesi: [`docs/anatomy-sources/z-anatomy-meshes.csv`](anatomy-sources/z-anatomy-meshes.csv).
- HRA: GitHub deposunun dosya ağacı listelendi.
- BodyParts3D 3.0: parça ve hiyerarşi tabloları indirildi.

Doğrulayamadığım her şey aşağıda **"doğrulanamadı"** diye işaretli.

---

## 1. Kalite ölçeği

| Not | Anlamı |
|---|---|
| **A** | Gerçek tarama/segmentasyon kaynaklı, yapı başına ayrı mesh, iç bölümleri ayrı |
| **B** | Gerçek mesh ama kaba birleştirilmiş (ör. bütün omurga tek parça) |
| **C** | Gerçek mesh ama başka bir vücuttan uyarlanmış (erkek → kadın dönüşümü) |
| **D** | Şematik çizim (tüp, küre…). Gerçek model değil, uygulamada "şematik" etiketli |
| **—** | Yok |

---

## 2. Kaynaklar ve lisanslar

| Kaynak | İçerik | Lisans | Erişim (bu ortam) | Uygulamada |
|---|---|---|---|---|
| **HuBMAP Human Reference Atlas (HRA)** 3D Reference Object Library, GitHub `f1a3a63` (2023, v1.0–v1.4) | Erkek (VH Male) ve kadın (VH Female) organları, damarlar, beyin, göz, diz, rahim, yumurtalık, meme | CC BY 4.0 | ✅ git | **Kullanılıyor** |
| HRA "united female/male" **v1.10** (cdn.humanatlas.io) | Kadın gövdesi: 964 mesh; beyin 283 bölge, böbrek 87 bölüm (üçüncü taraf README'sine göre) | CC BY 4.0 | ❌ 403 (proxy) | Yok — **doğrulanamadı** |
| **BodyParts3D 3.0** (DBCLS), GitHub kopyası `f0eeb6e` | Erkek iskelet (tek tek kemik), kaslar, deri, mide, yemek borusu, bezler | CC BY-SA 2.1 JP | ✅ git | **Kullanılıyor** (716 parça indiriliyor, birleştirilerek kullanılıyor) |
| **BodyParts3D 4.0** (dbarchive.biosciencedbc.jp) | 2.234 ayrı erkek mesh | Üçüncü taraf ATTRIBUTION'a göre resmi sitede **CC BY 4.0** (2025-02-27) | ❌ 403 | Yok — lisans ve dosya **doğrulanamadı** |
| **Z-Anatomy** (LluisV/Z-Anatomy, `PC-Version` `6c7f901`) | BodyParts3D türevi + ek modeller: tek tek kemik, eklem/bağ, kas, fasya, sinir, damar, lenf düğümü, yüz/kulak kepçesi | CC BY-SA 4.0 (+ BP3D CC BY-SA 2.1 JP atfı) | ✅ git (9 FBX, 227 MB) | Yok — aday |
| ↳ Z-Anatomy içindeki ek modeller | Kafa sinirleri (Univ. of Dundee) | CC BY 4.0 | | Kullanılabilir |
| | **İç kulak** (Univ. of Dundee) | **CC BY-NC-SA 4.0 — ticari olmayan** | | **Alınmamalı** |
| | **Böbrek** (lissiecowley) | **CC BY-NC 4.0 — ticari olmayan** | | **Alınmamalı** (HRA böbreği zaten var) |
| | "Brainder", "White matter" (Univ. of Washington) | Belirtilmemiş | | **Lisans doğrulanamadı** — alınmamalı (HRA beyni zaten var) |
| **Andreassen ve ark. 2023** (Sci Data 10:34) | Visible Human **Kadın**: 76 alt ekstremite kası (ayrıca erkek) | CC BY 4.0 | ❌ 403 (simtk.org, digitalcommons.du.edu) | Yok — **doğrulanamadı** |
| **Human Atlas** (GitHub `ashemag/human-atlas`) | Web görüntüleyici; veri: BodyParts3D 4.0 | Kod MIT, veri CC BY 4.0 (README) | ✅ README | Yok |
| **Human-Atlas** (GitHub `slorksmo/Human-Atlas`) | Erkek BP3D 4.0 + kadın HRA v1.10 + Andreassen kadın bacak kasları | Kod MIT, veri CC BY 4.0 (README) | ✅ README | Yok |
| Visible Body "Human Anatomy Atlas" | Ticari uygulama | Kapalı lisans | — | **Kullanılamaz.** Yukarıdaki GitHub "Human Atlas" projeleriyle aynı şey değil |

Lisans kuralları:

1. **ShareAlike yükümlülüğü:** BodyParts3D 3.0 ve Z-Anatomy'den türetilen GLB dosyaları
   ShareAlike'tır. Bu dosyalar aynı lisansla dağıtılır ve atıf `ATTRIBUTION.txt` ile birlikte gider.
   Uygulama kodu bundan etkilenmez; yükümlülük yalnızca model dosyalarına uygulanır.
2. **Ticari olmayan parçalar:** CC BY-NC / BY-NC-SA lisanslı parçalar, uygulamanın dağıtımıyla
   uyumlu olmayabilir. Bu yüzden hiçbiri alınmaz.
3. **BodyParts3D 4.0:** CC BY 4.0'a geçiş doğrulanırsa BP3D kaynaklı parçalardaki ShareAlike yükü
   kalkar. Doğrulama için resmi `lic.html` sayfasına erişim gerekir (§8).
4. **Kod ve veri lisansı ayrı:** Human Atlas projelerinde kod (MIT) ile veri (CC BY 4.0) ayrı
   lisanslı. Bu projelerin kodu kopyalanmayacak; yalnızca aynı açık veri kaynakları (BP3D, HRA,
   Andreassen) asıl kaynaklarından alınacak.

---

## 3. Şu an uygulamada olanlar

Erkek: 41 yapı, 316 bölüm, ≈ 838 bin üçgen. Kadın: 43 yapı, 322 bölüm. Toplam 45 MB GLB
(meshopt sıkıştırmalı).

Kas dışındaki tüm sistemler açılışta yükleniyor, vücut başına ≈ 18 MB. Kaslar isteğe bağlı yükleniyor.

| Sistem | Erkek | Kadın | Kaynak | Not |
|---|---|---|---|---|
| Deri | 1 mesh | 1 mesh | Erkek: BP3D · Kadın: HRA | Erkek **B**, kadın **A** (kendi vücudu). Deri altı ve fasya yok |
| İskelet | 18 birleşik parça (kafatası, omurga, göğüs kafesi, pelvis, kol/bacak/el/ayak grupları) | 19 | BP3D 3.0 (kadın omurga ve pelvisi HRA) | Erkek **B**, kadın **C** (omurga ve pelvis **A**). Kaynakta tek tek kemik var, uygulama birleştiriyor |
| Eklem / bağ | Yalnız diz: menisküs, kıkırdak, ön/arka çapraz bağ, yan bağlar, patellar bağ | aynı | HRA | **A** (yalnız diz) |
| Kaslar | 15 bölgesel parça (uyluk, sırt…) | 15 | BP3D 3.0 | Erkek **B**, kadın **C**. Tek tek kas, tendon, kas lifi yok |
| Beyin | 22 bölge, beyincik, beyin sapı (mezensefalon, pons, medulla) | aynı | HRA (Allen) | **A** |
| Omurilik | 4 bölge | 4 | HRA | **A** |
| Göz | 15 katman, göz kasları, optik sinir | aynı | HRA | **A** |
| Kulak | Dış yol, kulak zarı, kemikçikler, koklea (küre/koni/spiral) | aynı | — | **D** |
| Periferik sinir | 9 sinir (brakiyal, median, ulnar, radial, femoral, siyatik, tibial, peroneal, vagus) | aynı | — | **D** (tüp). Kafa sinirleri, pleksuslar, otonom sinir sistemi yok |
| Kalp | 4 boşluk, septum, 4 kapak, papiller kaslar | aynı | HRA | **A** |
| Gövde damarları | Aort, karotis, subklavyen, iliyak, karın ve böbrek damarları, koroner damarlar, akciğer damarları, göz damarları (~130 dal) | ~135 | HRA | **A** |
| Kol ve bacak damarları | 26 dal | 26 | — | **D** (tüp) |
| Kılcal damar | — | — | — | Yok (yalnız prosedürel mikro sahne) |
| Akciğer, hava yolu | 5 lob, hilum, trakea, bronşlar, kıkırdak halkalar, gırtlak, epiglot | aynı | HRA | **A** |
| Burun, ağız, dil, diş, yutak, tükürük bezleri | — | — | — | Yok |
| Yemek borusu, mide | 1'er mesh | 1'er mesh | BP3D | **B** (iç anatomi yok) |
| İnce ve kalın bağırsak | Duodenum, jejunum, ileum, çekum, kolonlar, rektum | aynı | HRA | **A** |
| Karaciğer, safra, pankreas | Loblar, safra yolları, pankreas bölümleri ve kanalları | aynı | HRA | **A** |
| Böbrek, üriner yol | Korteks, piramit, papilla, kaliks, pelvis, üreter, mesane, üretra (erkek) | aynı (kadın üretrası yok) | HRA | **A** |
| Erkek üreme | Testis, prostat (5 bölge), vezikül, vas deferens, penis | — | HRA + BP3D | **A/B** |
| Kadın üreme | — | Rahim (4 bölüm, bağlar), yumurtalık, tüpler, vajina, meme (yağ, lob, kanal, bağ) | HRA | **A** (kadının kendi modeli) |
| Endokrin | Hipofiz, böbreküstü (BP3D), epifiz, hipotalamus (HRA) | aynı | | **B/A**. Tiroid **D**, paratiroid yok |
| Lenf / bağışıklık | Dalak, timus, bademcikler, örnek tek lenf düğümü (iç yapı) | aynı | HRA | **A** (yalnız örnek düğüm). Lenf zincirleri ve damarları yok |
| Diyafram | 1 mesh | 1 | BP3D | **B/C** |

Kullanıcı etkileşimleri şu an var:

- deri röntgen / düz / gizli
- sistem katmanları
- seçme, gizleme, izole etme
- kesit düzlemi
- iç görünüm saydamlığı
- döndürme ve yakınlaştırma
- Türkçe/Latince arama

Organı vücuttan ayırma, bölgesel yükleme ve LOD yok.

---

## 4. Aday kaynaklarda bulunanlar (bu ortamda sayıldı)

Z-Anatomy FBX içeriği. Etiket noktaları (`.j`, `.i`) sayılmadı. Kas tutunma yüzeyleri ayrı satırda.

| Dosya | Gerçek yapı mesh'i | Üçgen | İçerik |
|---|---:|---:|---|
| SkeletalSystem | 277 | ≈ 0,73 M | Tek tek kemikler: kafatası kemikleri, omurga 26 parça (omurlar, sakrum, koksiks), kaburgalar ve 20 kostal kıkırdak. El: 8 karpal, 5 metakarp, 14 falanks (×2); ayak kemikleri de tek tek. 28 diş, kemikçikler, gırtlak ve burun kıkırdakları |
| ↳ kas tutunma yüzeyleri | 705 | ≈ 0,92 M | Kemik üzerindeki kas origo (`.o`) ve insersiyo (`.e`) bölgeleri — "tendon bağlantıları" için |
| Joints | 413 | 0,36 M | Bağlar, eklem kapsülleri, intervertebral diskler, nucleus pulposus, menisküsler, TME |
| MuscularSystem | 418 kas + 76 fasya + 78 bursa + 40 tendon kılıfı | 2,3 M | Baş, boyun, gövde, sırt, kol, bacak, pelvis kasları tek tek; tendonlar; fasyalar |
| NervousSystem | 582 | 2,4 M | Beyin 250 (giruslar/sulkuslar), omurilik 31, spinal sinirler ve dalları 194 (pleksuslar, parmak sinirleri dahil). Kafa sinirleri I–XII (52), sempatik zincir 6, meninksler 6, göz 32, kulak 8 |
| CardioVascular | 676 | 1,6 M | Sistemik arterler 394 (kol, bacak, el, ayak, beyin dalları dahil), venler 206, akciğer damarları, koroner damarlar, kalp yapıları |
| LymphoidOrgans | 164 | 0,13 M | **158 adlandırılmış lenf düğümü grubu** (servikal, aksiller, inguinal, mezenterik, mediastinal…), timus, dalak yüzeyleri |
| VisceralSystem | 118 | 0,70 M | **Tiroid, 4 paratiroid**, hipofiz (ön/arka), **dil, yumuşak damak, dişeti, tükürük bezleri ve kanalları**, yutak 3 bölüm, burun mukozası, akciğer segmentleri ve bronşları, karaciğer segmentleri, sindirim kanalı, erkek genital (14) |
| Regions of human body | 256 | 0,14 M | Yüz bölgeleri, **kulak kepçesi (42 parça)**, el/ayak yüzeyleri, tırnak, saç |

HRA'da bulunup henüz kullanılmayanlar:

- Organ içi damar ağaçları: böbrek, karaciğer, kalp, dalak, rahim, göz, safra kesesi ve kalın bağırsak
  için (`VH_*_Blood_Vasculature_*`). Kılcal damar öncesi dallanmayı örnek bölgelerde göstermek için
  uygun.
- Kadın ve erkek diz kasları (`VH_*_Muscles_Knee`). Kadınınki gerçek kadın kası.
- Plasenta.

---

## 5. Kadın anatomisi

- **Kadının kendi modelinden gelenler (HRA VH Female):** deri, omurga, pelvis, diz, tüm iç organlar,
  damarlar, beyin, göz, kadın üreme organları ve meme.
- **Erkekten uyarlananlar (C):** kafatası, kaburgalar, omuz kuşağı, kol, el ve ayak kemikleri; tüm
  iskelet kasları; şematik sinir ve damarlar. Uygulama ve README bunu belirtiyor. İskelet kası için
  ayrıca açıkça "erkek kaynaklı" işareti konacak.
- **Kadın kaynağı bulunan tek ek:** Andreassen 2023'teki 76 alt ekstremite kası (CC BY 4.0). Bu ortamda
  indirilemedi (§8).
- Kol kasları ve kafatası/kaburga kemikleri için ücretsiz, lisanslı bir kadın kaynağı bulunamadı.
  **Kendi kontrol ettiğim sonuç:** HRA GitHub ve Z-Anatomy'de bu yapılar için kadın modeli yok. HRA
  v1.10 bilgisi ise üçüncü taraf README'sine dayanıyor, doğrulanmadı.
- Z-Anatomy'de kadın genital sistemi ve meme yok; yalnızca erkek genitali var.
- **Karar uygulaması:** Erkekten uyarlanan her yapı üç şeyle işaretlenecek: "erkek referansından
  uyarlandı" etiketi, ayrı renk ve ayrı açılır katman. Kas için ileride iki yol var:
  1. Kadın vücudunda erkek kası hiç gösterilmez.
  2. Gösterilir ama açıkça etiketlenir.

  Bu tercih sende.

---

## 6. Kılcal damar, lenf düğümü, mikroskobik yapılar

- **Kılcal damar:** Hiçbir açık kaynakta vücut ölçeğinde tek tek kılcal mesh yok. Uygulanacak yol:
  1. HRA organ içi damar ağaçları, örnek organlarda arteriyol düzeyine yakın dallanmayı gösterir.
  2. Kılcal yatak, kaynağıyla belirtilmiş temsili mikro sahne olarak kalır ve "temsili" diye
     etiketlenir.
- **Lenf düğümleri:** Z-Anatomy'de adlandırılmış 158 düğüm grubu var. Lenf **damarları** (toraks
  kanalı vb.) hiçbir kaynakta model olarak yok, eksik listesinde kalacak.
- **Mikroskobik yapılar:** Mevcut doku/hücre sahneleri prosedüreldir ve "Eğitimsel · Temsili"
  etiketlidir. Doğrulanabilir bir 3B mikroskobik kaynak (ör. HRA hücre/doku ölçekli modelleri)
  ayrıca araştırılacak. Şu an "temsili" olarak kalıyorlar.

---

## 7. Eksik yapılar listesi (açık)

Durum sütunu bu turdan sonraki hâlidir.

| # | Yapı | Aday | Durum (2026-11-12) |
|---|---|---|---|
| 1 | Tek tek kemikler (≈ 206 + kıkırdaklar, diskler) | BP3D 3.0 | **Yapıldı** — temel modelde her kemik ayrı. Kadında kafatası, kaburga, kol, el ve ayak kemikleri erkekten uyarlanmış (işaretli) |
| 2 | Eklemler, bağlar, eklem diskleri (diz dışı) | Z-Anatomy | **Paketle** (345 yapı). Kadında omurlar arası disk yok (HRA kadın omurgasında disk modeli yok) |
| 3 | Tek tek kaslar, tendonlar, fasya, bursa | Z-Anatomy | **Paketle** (664 yapı). Kadında erkekten uyarlanmış (işaretli) |
| 4 | Kas tutunma yüzeyleri (origo/insersiyo) | Z-Anatomy (705) | **Yapılmadı** — sonraki tur |
| 5 | Kafa sinirleri, pleksuslar, periferik sinirler, sempatik zincir | Z-Anatomy | **Paketle** (265 yapı); şematik sinirlerin yerini alır |
| 6 | Kol, bacak, el, ayak, baş-boyun, beyin damarları | Z-Anatomy | **Paketle** (534 yapı); şematik kol-bacak damarlarının yerini alır |
| 7 | Tiroid, paratiroid | Z-Anatomy | **Paketle**; şematik tiroidin yerini alır |
| 8 | Dış kulak, kulak zarı, kemikçikler, Östaki borusu | Z-Anatomy | **Paketle**. **İç kulak (koklea, vestibül, yarım daire kanalları) şematik kalır** (tek kaynak CC BY-NC-SA) |
| 9 | Dil, damak, dişler, dişeti, tükürük bezleri, yutak, burun boşluğu, sinüsler | Z-Anatomy | **Paketle** |
| 10 | Mide ve yemek borusu iç katları | — | Kaynak yok |
| 11 | Lenf düğümü grupları | Z-Anatomy | **Paketle** (158 grup) |
| 12 | Lenf damarları, toraks kanalı | — | Kaynak bulunamadı |
| 13 | Deri altı yağ dokusu (vücut ölçeğinde) | — | Kaynak bulunamadı |
| 14 | Kılcal damarlar | HRA organ içi damar ağaçları | **Yapılmadı** — HRA'nın organ içi damar ağaçları (böbrek, karaciğer, kalp, dalak, rahim, göz…) sonraki tur; kılcal yatak yalnız temsili sahnede |
| 15 | Kadın kafatası, kaburga, kol, el ve ayak kemikleri | — | Kaynak yok → uyarlanmış + etiketli |
| 16 | Kadın iskelet kasları | Andreassen 2023 (yalnız bacak) | Erişim yok (simtk.org, digitalcommons.du.edu engelli) |
| 17 | Kadın üretrası, kadın dış genital | HRA v1.10 | Doğrulanamadı (cdn.humanatlas.io engelli) |
| 18 | Beyinde ayrıntılı giruslar | HRA v1.10 / Z-Anatomy | Z-Anatomy beyin yüzeylerinin lisansı belirsiz → alınmadı; HRA v1.10'a erişim yok |
| 19 | Periton, mezenter, omentum | Z-Anatomy (sınırlı) | Yapılmadı |
| 20 | LOD (aynı yapının çok çözünürlüklü sürümleri) | — | **Yapılmadı**: temel model (orta) + paket (yüksek) iki düzey var; mesafeye göre otomatik geçiş yok |
| 21 | Türkçe adlar (kas, damar, bağ, lenf) | — | Sözlük yalnız kemikler, dişler, kafa sinirleri, ana sinirler ve baş-boyun organlarını kapsıyor; diğerlerinde uluslararası ad |
| 22 | Gerçek cihazda mobil/masaüstü performans ölçümü | — | Yalnız yazılımsal WebGL (SwiftShader) ile e2e; gerçek telefon ölçümü yok |

---|---|---|---|
| 1 | Tek tek kemikler (≈ 206 + dişler + kıkırdaklar) | BP3D 3.0 (zaten indiriliyor) veya Z-Anatomy | Mevcut kaynaktan yapılabilir |
| 2 | Eklemler, bağlar, diskler (diz dışı) | Z-Anatomy Joints (413) | Aday |
| 3 | Tek tek kaslar, tendonlar, fasya, bursa | Z-Anatomy Muscular | Aday (erkek) |
| 4 | Kas tutunma yerleri | Z-Anatomy origo/insersiyo yüzeyleri (705) | Aday |
| 5 | Kafa sinirleri, pleksuslar, gerçek periferik sinirler, sempatik zincir | Z-Anatomy Nervous | Aday; şematik tüplerin yerine geçer |
| 6 | Kol, bacak, el, ayak ve beyin damarları | Z-Anatomy CardioVascular | Aday; şematik tüplerin yerine geçer |
| 7 | Tiroid, paratiroid | Z-Anatomy Visceral | Aday; şematik tiroidin yerine geçer |
| 8 | Dış kulak, kulak zarı, kemikçikler, östaki borusu | Z-Anatomy (kepçe, kulak zarı, kemikçikler) | Aday. **İç kulak (koklea, vestibül) NC lisanslı → alınmaz, şematik kalır** |
| 9 | Dil, yumuşak damak, dişler, dişeti, tükürük bezleri, yutak, burun boşluğu | Z-Anatomy | Aday |
| 10 | Mide ve yemek borusu iç yapısı (kat, kıvrım) | — | Kaynak yok (Z-Anatomy'de yalnız yüzey bölgeleri) |
| 11 | Lenf düğümü zincirleri | Z-Anatomy (158) | Aday |
| 12 | Lenf damarları, toraks kanalı | — | Kaynak bulunamadı |
| 13 | Deri altı yağ dokusu (vücut ölçeğinde katman) | — | Kaynak bulunamadı. Doku katmanı mikro sahnede temsili |
| 14 | Kılcal damarlar | HRA organ içi damar ağaçları (kılcal öncesi) | Kısmi, örnek bölge |
| 15 | Kadın kafatası, kaburga, kol ve el kemikleri | — | Kaynak yok → uyarlanmış (C) + etiket |
| 16 | Kadın iskelet kasları | Andreassen 2023 (yalnız bacak) | Erişim gerekli |
| 17 | Kadın üretrası, kadın dış genital | HRA v1.10 olabilir | Doğrulanamadı |
| 18 | Beyinde ayrıntılı giruslar | HRA v1.10 (283 bölge) veya Z-Anatomy (lisans belirsiz) | Doğrulanamadı |
| 19 | Peritoneum, mezenter, omentum | Z-Anatomy (sınırlı) | Aday |

---

## 8. Erişim engelleri

Bu ortamın ağ politikası aşağıdaki adresleri engelliyor (proxy 403):

- `cdn.humanatlas.io`, `humanatlas.io` — HRA v1.10
- `dbarchive.biosciencedbc.jp`, `lifesciencedb.jp` — BodyParts3D 4.0 ve lisans sayfası
- `simtk.org`, `digitalcommons.du.edu`, `doi.org` — Andreassen 2023 kadın kasları
- `www.z-anatomy.com` — Z-Anatomy sitesi (GitHub üzerinden erişim çalışıyor)

Bu kaynaklar için ortamın izinli adres listesine bu alan adlarının eklenmesi gerekir. Eklenmezse bu
kaynaklar kullanılmaz ve listede "doğrulanamadı" olarak kalır.

---

## 9. Depolama: isteğe bağlı paketler

Karar: temel APK küçük kalsın, yüksek çözünürlüklü modeller isteğe bağlı paket olsun ve bir kez
indirildikten sonra çevrimdışı çalışsın.

**Çakışma:** Android uygulaması şu an **internet izni olmadan** derleniyor (`AndroidManifest.xml`:
`INTERNET` kaldırılmış). Testler de uygulamanın dışarıya bağlanmadığını doğruluyor. Paket indirmek
için iki seçenek var:

1. **Dosyadan içe aktarma (öneri):**
   - Kullanıcı paketi (ör. `anatomi-iskelet-erkek.khpack`) GitHub Releases'ten tarayıcıyla indirir.
   - Uygulamada "Paket kur" ile seçer.
   - SHA-256 ve lisans manifesti doğrulanır, paket cihazda saklanır.

   Uygulama yine internete çıkmaz. Mevcut "Model kur" akışıyla aynı mantık.
2. **Uygulama içinden indirme:**
   - INTERNET izni eklenir, yalnızca tek bir sabit adrese (GitHub Releases) izin verilir.
   - Daha kolay ama "uygulama internete çıkmaz" ilkesini değiştirir. CSP ve çevrimdışı testleri
     de buna göre güncellenmesi gerekir.

Temel pakette kalacaklar: mevcut ≈ 18 MB/vücut düşük çözünürlüklü tam vücut. Kaslar zaten isteğe
bağlı yükleniyor.

Paket bölmesi: sistem × bölge × vücut. Örnekler:

- `iskelet-ust-ekstremite-erkek`
- `kas-alt-ekstremite-kadın`
- `sinir-periferik-erkek`

Her pakette LOD0 (yüksek) ve LOD1 (orta) olacak.

Z-Anatomy'nin ham boyutu ≈ 8 milyon üçgen. meshopt ile sadeleştirme ve sıkıştırmadan sonra tahmini
paket toplamı vücut başına 60–120 MB. **Bu bir tahmindir, ölçülmedi.**

---

## 10. Önerilen entegrasyon sırası

Her adım ayrı commit/PR olacak. Her PR'da "tamamlanmayanlar" bölümü bulunacak.

1. **İskelet → tek tek kemikler.**
   - Mevcut BP3D 3.0 kaynağından, yeni indirme gerekmez.
   - Her kemik ayrı mesh olacak: FMA kimliği, Latince ve Türkçe adı, kaynağı.
   - Kadında "erkekten uyarlandı" işareti konacak.
2. **Paket altyapısı:**
   - Bölgesel/sistemsel yükleme, LOD, "Paket kur", indirme sonrası çevrimdışı saklama.
   - Organı vücuttan ayırma (patlatılmış görünüm).
3. **Z-Anatomy dönüştürme hattı:**
   - FBX → GLB, BP3D/HRA koordinatlarına hizalama, NC parçaların otomatik dışlanması.
   - İlk paketler: eklem/bağlar, tek tek kaslar ve tendonlar, gerçek periferik ve kafa sinirleri.
     Bunlar şematik tüplerin yerine geçer.
4. **Kalan Z-Anatomy paketleri:**
   - Kol ve bacak damarları.
   - Baş-boyun: tiroid, paratiroid, dil, diş, tükürük bezleri, yutak, kulak kepçesi.
   - Lenf düğümleri.
5. **HRA organ içi damar ağaçları:** kılcal öncesi örnek bölgeler.
6. **Erişim açılırsa:**
   - BP3D 4.0: CC BY 4.0 lisansını doğrulamak.
   - HRA v1.10 kadın gövdesi.
   - Andreassen kadın bacak kasları.
7. Mobil ve masaüstü performans ölçümleri (FPS, bellek, yükleme süresi) ayrı rapor.

**Gözden geçirme noktası:** 1. adıma başlamadan önce bu envanterdeki kaynak seçimleri ve §5 (kadında
erkek kası) ile §9 (paket yöntemi) kararları onaylanmalı.
