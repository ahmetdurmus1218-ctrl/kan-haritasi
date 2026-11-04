# Model lisans haritası

Bu belge uygulamaya gömülü tıbbi görüntü modellerini, eklenmeyenleri ve nedenlerini tek yerde toplar. Kesin izinli modeller ile lisansı belirsiz olanlar ayrı tutulur. Belirsiz bir model "izinli" gibi paketlenmez.

Son güncelleme: 2026-11-04.

## 1. Uygulamaya gömülü modeller (izinli, doğrulanmış)

Her modelin klasöründe (`apps/web/public/ai-models/<kimlik>/`) şunlar vardır: `manifest.json` (görev, girdi/çıktı, sürüm, SHA-256, lisans, kaynak, sınırlar, doğrulama) ve `NOTICE.txt` (atıf, kaynak ağırlık URL'si ve SHA-256, yapılan değişiklik). Apache-2.0 §4(a) gereği lisansın tam metni de uygulamayla birlikte dağıtılır: `apps/web/public/ai-models/LICENSE-Apache-2.0.txt`.

| Kimlik | Model | Lisans | Değişiklik bildirimi (NOTICE) | Uygulamada yaptığı gerçek iş |
| --- | --- | --- | --- | --- |
| `totalseg-ct-total-3mm` | TotalSegmentator `total` (Dataset297, v2.0.0) | Apache-2.0 (eğitim verisi CC BY 4.0) | PyTorch → ONNX (opset 17), float16 saklama, TopK(4) çıktısı | BT serisi → 117 yapının 3B etiket hacmi → hacim, kesit aralığı, maske katmanı, **kişisel 3B organ yüzeyi**, İçine gir |
| `totalseg-mr-total-3mm` | TotalSegmentator `total_mr` (Dataset852, v2.5.0) | Apache-2.0 | aynı | MR serisi → 50 yapı → aynı zincir (kişisel 3B dahil) |
| `totalseg-ct-kidney-cysts` | TotalSegmentator `kidney_cysts` (Dataset789) | Apache-2.0 | aynı | Basamaklı patoloji: böbrek kisti maskesi → kişisel organ sahnesinde bulgu yüzeyi |
| `totalseg-ct-effusion` | TotalSegmentator `pleural_pericard_effusion` (Dataset315) | Apache-2.0 | aynı | Basamaklı patoloji: plevral/perikardiyal sıvı maskesi |
| `totalseg-ct-liver-segments` | TotalSegmentator `liver_segments` (Dataset570) | Apache-2.0 | aynı | Couinaud I–VIII (anizotropik 0,8 × 0,8 × 1,5 mm ızgara) |
| `xrv-densenet121-nih` | TorchXRayVision densenet121-res224-nih | Apache-2.0 (NIH ChestX-ray14 verisi kısıtlamasız, atıfla) | PyTorch → ONNX, sigmoid, float16 saklama | Göğüs röntgeni → 14 bulgu skoru. **Konum üretmez**: kutu/maske çizilmez, kişisel 3B üretmez |
| `kh-brain-mri-pattern` | Kan Haritası beyin MR örüntü modeli (2B ağ, ~2 M parametre; kendi eğitimimiz) | CC BY 4.0 (ağırlıklar). Eğitim verisi: UPENN-GBM, Vestibular-Schwannoma-SEG (CC BY 4.0, TCIA/IDC); ARC, CCNRP, MPI-LEMON, FCD, ds007908 (CC0, OpenNeuro). Kapı negatifleri: IDC koleksiyonları (CC BY 3.0 / 4.0) | Sıfırdan eğitim → ONNX (opset 17); atıflar ve veri kişi/kesit sayıları NOTICE.txt'de | Beyin MR kesiti (fotoğraf/ekran/DICOM kesiti) → 4 örüntü olasılığı, sağlıklı referansa uzaklık (yüzdelik), katkı haritası, eğitim dışı kapısı. **Tanı değildir**; bilmediği hastalıklar manifestte ve ekranda yazar |

Doğrulama sayıları (resmi çıktıyla Dice, voksel uyumu; örüntü modelinde hasta bazlı ayrık test) README'deki "Gerçek yerel modeller" tablosunda ve `apps/web/src/__tests__/realModels.test.ts` içindedir.

## 2. Bilinçli olarak eklenmeyenler

| Model | Durum | Neden |
| --- | --- | --- |
| **EchoNet-Dynamic** | Eklenmedi | Stanford araştırma lisansı. Yeniden dağıtım için yazılı izin gerekir, izin yok. |
| TotalSegmentator lisanslı görevleri (heartchambers_highres, appendicular_bones, tissue_types, brain_structures, coronary_arteries, face…), brain_aneurysm | Eklenmedi | Ticari olmayan ya da ayrı lisans (ör. CC BY-NC). APK'ya gömülemez. |

## 3. Açık lisanslı ama bu derlemede eklenemeyenler (teknik / doğrulama)

| Model | Lisans durumu | Neden eklenmedi |
| --- | --- | --- |
| TotalSegmentator `lung_nodules` (Dataset913) | Açık (Apache-2.0) | ResidualEncoder ağı, 820 MB ağırlık, [128,192,192] karo: telefonda bellek ve süre sınırını aşıyor. |
| TotalSegmentator `liver_lesions` (Dataset591) | Açık | Gerçek bir LiTS vakasında kararsız sonuç verdi (Dice 0,71 ↔ 0,14, büyük tümör bazı ayarlarda kaçtı). Güvenilir bulgu üretmediği için eklenmedi. |
| TotalSegmentator `cerebral_bleed` (Dataset150) | Açık | Ağ uyumlu. Resmi çıktıyla karşılaştırılacak açık bir baş BT'si bulunamadığı için doğrulanmadı ve eklenmedi. |
| TotalSegmentator `teeth` / `craniofacial_structures` | Açık | 0,5 mm ızgara ve kafatası basamaklaması cihazda saatler sürüyor. |
| ChestX-Det PSPNet | Apache-2.0 | Doğrulandı ama 131 MB ve ≥ 8 GB RAM gerektiriyor. İsteğe bağlı paket olarak üretilir ve "Model kur" ile eklenir. |

## 4. Lisansı veya ağırlığı bu ortamda doğrulanamayanlar (belirsiz: paketlenmez)

Ağırlıklar Hugging Face, Zenodo, NGC ve GitHub sürüm sayfalarında barındırılıyor. 2026-10-17 tarihli ölçüm: `huggingface.co` ve `zenodo.org` için bağlantı kurulamadı (HTTP 000), `github.com/.../releases` için 403 alındı; yalnızca PyPI ve npm erişilebilir. Ağırlık indirilip SHA-256 ile ve resmi çıktıyla doğrulanamayan model eklenmez.

| Model | Bilinen / beklenen lisans | Durum |
| --- | --- | --- |
| MONAI VISTA3D | Kod Apache-2.0. Ağırlıkların lisansı ayrı (NVIDIA, ticari olmayan olabilir) | **Belirsiz.** İndirilemedi, eklenmedi. |
| MONAI Model Zoo `spleen_ct_segmentation`, whole-body / renal / abdominal paketleri | Paket Apache-2.0. Eğitim verisinin lisansı pakete göre değişir (MSD: CC BY-SA 4.0) | İndirilemedi (Hugging Face / NGC erişimi yok), doğrulanamadı. Dalak ve böbrek zaten TotalSegmentator `total` ile bölütleniyor. |
| DepthPolyp | Doğrulanamadı | **Belirsiz.** Ağırlık ve lisans metnine erişilemedi. |
| MedSAM, UNI/UNI2, CONCH, Virchow, PLIP, RETFound, OpenMedLab | Çoğu kapılı erişim ve/veya ticari olmayan lisans | Eklenmedi. |

Bu modeller ancak şu koşullarla eklenir: ağırlık sabit bir URL'den indirilip SHA-256 ile sabitlenir, lisans metni okunur ve izin verdiği doğrulanır, `scripts/models/build_models.py` ile ONNX'e çevrilir, gerçek bir görüntüde resmi çıktıyla karşılaştırılır.

## 5. Kişisel 3B ve köken kuralları (tüm modeller için)

- Yalnızca **voksel maskesi** üreten bölütleme modelleri kişisel 3B organ yüzeyi oluşturur (`#/kisisel/<organ>`). Sınıflandırıcılar (TorchXRayVision) konum ve 3B üretmez.
- Kişisel organ ekranında model, modalite, girdi, çıktı, kaynak ve lisans gösterilir. İç dünya seviyeleri (lümen içeriği, doku, hücre, molekül) "ANATOMİK EĞİTİM" etiketini taşır.
