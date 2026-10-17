# Model araştırma raporu

> Bu dosya `packages/analysis/src/modelRegistry` kaydından üretilir (`KH_UPDATE_DOCS=1 pnpm vitest run packages/analysis/src/__tests__/modelRegistry.test.ts`). Araştırma tarihi: 2026-10-17.

Araştırma geliştirme sırasında yapılır; uygulama çalışırken internete çıkmaz, hasta verisi hiçbir yere gönderilmez. Çıkarım cihazda yapılır.

## Özet

```
MODEL RESEARCH
Doğrulandı                             9   (VERIFIED)
Ağırlık mevcut (henüz doğrulanmadı)   33   (AVAILABLE)
Kısmen erişilebilir                    1   (PARTIALLY_AVAILABLE)
Dönüştürme gerekiyor                   0   (CONVERSION_REQUIRED)
Cihaz için çok ağır                    8   (HEAVY_RUNTIME)
Yalnızca araştırma lisansı            14   (RESEARCH_ONLY)
Ağırlık bulunamadı                     4   (UNAVAILABLE)
Doğrulamadan geçemedi                  1   (FAILED_VALIDATION)
Toplam                                70
Uygulamayla gelen / isteğe bağlı paket 7 / 2
Eski 19 "eklenemedi" kaydı           19 yeniden denetlendi, 16 kaydın durumu değişti
```

### Bu ortamın ağ erişimi

- Erişilebilen: github.com (sürüm dosyaları: releases/download), raw.githubusercontent.com, pypi.org / files.pythonhosted.org, s3.ap-south-1.amazonaws.com (CQ500), msd-for-monai.s3-us-west-2.amazonaws.com
- Engelli (kuruluş politikası): huggingface.co, zenodo.org, api.ngc.nvidia.com, developer.download.nvidia.com, drive.google.com, download.pytorch.org, physionet.org, datasets.simula.no, tiatoolbox.dcs.warwick.ac.uk
- Engelli bir alan adı tek başına "eklenmedi" nedeni sayılmaz: ağırlığı yayımlanmış modeller **AVAILABLE** olarak kayıtlıdır ve ağı açık bir makinede aynı betiklerle (`scripts/models/build_models.py`) üretilip doğrulanabilir.

## Modaliteye göre

| Modalite | Doğrulanan | Araştırılan |
| --- | --- | --- |
| BT | 5 | 38 |
| MR | 1 | 16 |
| Röntgen | 2 | 6 |
| Ultrason / Doppler | 0 | 2 |
| EKO | 0 | 2 |
| EKG | 0 | 1 |
| Patoloji | 0 | 10 |
| OCT | 0 | 3 |
| Fundus | 0 | 3 |
| Endoskopi / kolonoskopi | 1 | 5 |
| PET / PET-BT | 0 | 1 |
| DEXA | 0 | 1 |
| Anjiyografi / floroskopi | 0 | 1 |
| Diş / CBCT | 0 | 1 |
| Mamografi | 0 | 2 |

## Kayıtlar

| Model | Modalite | Görev | Durum | Konum | Lisans (ticari · yeniden dağıtım · ağırlık) | Dağıtım | Neden / kanıt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TotalSegmentator — BT anatomi (117 yapı) | BT | total (fast) | **VERIFIED** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | uygulamayla gelir | Resmi TotalSegmentator --fast çıktısıyla (aynı ağırlıklar) ortalama Dice 0,999 (en düşük yapı 0,981), voksel uyumu %99,97; uygulamanın TypeScript hattıyla birim testinde (realModels.test.ts) tekrar ölçülür. |
| TotalSegmentator MRI — MR anatomi (50 yapı) | MR | total_mr (fast) | **VERIFIED** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | uygulamayla gelir | Resmi --fast (total_mr) çıktısıyla ortalama Dice 0,999, voksel uyumu %99,98. |
| TotalSegmentator — böbrek kisti (BT patoloji, basamaklı) | BT | kidney_cysts | **VERIFIED** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | uygulamayla gelir | Kistli gerçek BT (MSD spleen_19): resmi 0,58 mL ↔ uygulama hattı 0,51 mL (Dice 0,865); kistsiz iki BT'de ikisi de kist bulmadı. |
| TotalSegmentator — plevral/perikardiyal efüzyon (BT patoloji, basamaklı) | BT | pleural_pericard_effusion | **VERIFIED** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | uygulamayla gelir | Gerçek göğüs BT'sinde (MSD lung_053): akciğer Dice 0,988; perikard sıvısı resmi 3,09 ↔ 3,14 mL (Dice 0,81). |
| TotalSegmentator — karaciğer segmentleri (Couinaud I–VIII) | BT | liver_segments | **VERIFIED** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | uygulamayla gelir | Fikstür BT'de resmi çıktıyla ort. Dice 0,951 (0,941–0,964); gerçek LiTS BT'sinde Dice 0,86–0,97. |
| TotalSegmentator — beyin içi kanama (BT patoloji, basamaklı) | BT | cerebral_bleed | **VERIFIED** (RECHECKED) | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | uygulamayla gelir | CQ500'ün 5 gerçek baş BT'sinde (3 radyoloğun okumasına göre 4 kanamalı, 1 kanamasız; gantri eğimi 8,5–30°; JPEG 2000 → sıkıştırmasız) uygulamanın kendi TypeScript hattı (DICOM okuma → BT anatomi 3 mm → beyin + 3 mm kırpma → bu model, ONNX Runtime WASM) resmi TotalSegmentator -ta cerebral_bleed çıktısıyla karşılaştırıldı: 35,4 ↔ 36,6 mL (Dice 0,914), 42,2 ↔ 43,2 mL (Dice 0,942), 7,2 ↔ 7,7 mL (Dice 0,870); kanamasız vakada ikisi de 0 mL. En küçük odakta (resmi 1,34 mL) uygulama 0 mL buldu; resmi nnU-Net öngörücüsü de aynı ağırlıklarla uygulamanın kırptığı bölgede 0 mL veriyor — küçük odakta modelin kendi sonucu kırpmaya duyarlı (sınırlarda yazılı). ONNX ↔ PyTorch argmax uyumu ≥ %99,9999. Karo başına ~55 sn (tek çekirdek WASM), bu vakalarda 24–45 karo. |
| TorchXRayVision — göğüs röntgeni sınıflandırıcı (NIH, 14 bulgu) | Röntgen | chest X-ray multilabel classification | **VERIFIED** | none | Apache-2.0 (kod ve ağırlık); eğitim verisi NIH ChestX-ray14 (kısıtlamasız, atıfla) (✓ · ✓ · ✓) | uygulamayla gelir | Kütüphanenin kendi skorlarıyla en büyük fark 3,4e-5 (fp16: ≤ 3,4e-4). |
| ChestX-Det PSPNet — göğüs röntgeni anatomi (14 yapı) | Röntgen | chest X-ray anatomy segmentation | **VERIFIED** | pixel | Apache-2.0 (ChestX-Det veri kümesi ve PSPNet ağırlıkları) (✓ · ✓ · ✓) | isteğe bağlı paket | Kütüphanenin kendi çıktısıyla maske uyumu %100, en büyük fark 1,4e-6 (float32). |
| DepthPolyp — kolonoskopi polip bölütleme (MiT-B0) | Endoskopi / kolonoskopi | polyp segmentation | **VERIFIED** (RECHECKED) | pixel | MIT (kod ve ağırlık, ReaganWu/DepthPolyp); eğitim verisi Kvasir-SEG (araştırma/eğitim amaçlı serbest, ticari kullanım için Simula'dan yazılı izin) (? · ✓ · ✓) | isteğe bağlı paket | Depodaki iki Kvasir örneğinde yazarın ONNX betiği, depodaki resmi maskeleri birebir üretti (Dice 1,000 / 1,000). Uygulamanın ön işlemesi (çift doğrusal + kenar yumuşatma, /255) ile resmi PIL ön işlemesi arasında maske Dice 0,998 / 0,999, polip alanı oranı 0,292 ↔ 0,291 ve 0,272 ↔ 0,272. |
| TotalSegmentator v3 — BT anatomi (3 mm) | BT | total_v3 (fast) | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Gömülü v2 anatomi modelinin yeni sürümü; sınıf listesi v2 ile birebir aynı değil. Değiştirmeden önce aynı fikstürlerde resmi v3 çıktısıyla Dice doğrulaması ve basamaklı modellerin etiket eşlemesinin güncellenmesi gerekiyor. |
| TotalSegmentator — vücut / gövde / uzuv / deri (6 mm) | BT | body (fast) | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Hafif (6 mm) ve açık lisanslı; kişisel 3B'de deri/gövde yüzeyi için uygun. Bu sürümde doğrulama sırası kanama modeline verildi; sonra: build_models.py'ye ekle → örnek BT'de resmi çıktıyla Dice → paket. |
| TotalSegmentator MRI — gövde / uzuv (6 mm) | MR | body_mr (fast) | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Açık ve hafif; MR örnek fikstüründe resmi çıktıyla doğrulanınca paket olarak eklenebilir. |
| TotalSegmentator MRI — omurlar (C1–sakrum) | MR | vertebrae_mr | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Bel/boyun MR'ında omur düzeyi eşlemesi için yararlı; omurga MR fikstürü olmadan doğrulanmadı. |
| TotalSegmentator — omur cisimleri ve disk aralıkları | BT | vertebrae_body | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Açık lisanslı; doğrulama verisi (omurga BT) ve cihaz süresi ölçümü bekliyor. |
| TotalSegmentator — gövde boşlukları (karın, göğüs, perikard, mediasten) | BT | trunk_cavities | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | İç dünya sahnelerinde perikard/mediasten kişisel sınırları için uygun; doğrulanmadı. |
| TotalSegmentator — meme dokusu (BT) | BT | breasts | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Normal anatomi bölütlemesi (lezyon değil); doğrulanmadı. |
| TotalSegmentator — gövde kasları (T4–L4) | BT | abdominal_muscles | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Küçük veriyle eğitilmiş (167 kişi); doğrulanmadı. |
| TotalSegmentator MRI — karaciğer segmentleri | MR | liver_segments_mr | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | BT sürümü gömülü; MR sürümü için karaciğer MR'ı fikstürüyle resmi çıktı karşılaştırması gerekiyor. |
| TotalSegmentator — karaciğer lezyonu (MR) | MR, BT | liver_lesions_mr | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | BT lezyon modeli gerçek vakada kararsız çıktı (FAILED_VALIDATION); MR sürümü aynı yöntemle (uzman etiketli vaka) denenmeden eklenmez. |
| TotalSegmentator — kalça protezi | BT | hip_implant | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Dar kullanım alanı; protezli BT olmadan doğrulanamadı. |
| TotalSegmentator — karaciğer damarları + tümör (MSD) | BT | liver_vessels | **AVAILABLE** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Kontrastlı portal faz BT gerektirir; MSD Task08 vakasında resmi çıktıyla karşılaştırılmadan eklenmez. |
| TotalSegmentator — akciğer arter/ven ve hava yolları | BT | lung_vessels | **HEAVY_RUNTIME** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Tüm akciğerler 0,7 mm ızgarada: tipik göğüs BT'sinde 60+ karo, tarayıcıda/telefonda onlarca dakika ve > 3 GB bellek. |
| TotalSegmentator — baş bezleri ve boşlukları (göz, lens, optik sinir, tükürük bezleri, farinks, kulak yolu) | BT | head_glands_cavities | **HEAVY_RUNTIME** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Baş-boyun 0,75 mm ızgarada çok karolu; kişisel göz/kulak 3B'si için değerli, ama cihazda süre ölçümü ve baş BT fikstürüyle doğrulama gerekiyor. |
| TotalSegmentator — boyun kemik/kıkırdak ve karotis/juguler | BT | headneck_bones_vessels | **HEAVY_RUNTIME** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | 0,75 mm baş-boyun ızgarası; cihaz için ağır. |
| TotalSegmentator — baş ve boyun kasları | BT | head_muscles + headneck_muscles | **HEAVY_RUNTIME** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | 0,75 mm ızgara ve iki parçalı model (Dataset778/779); cihaz için ağır. |
| TotalSegmentator — göz kasları | BT | oculomotor_muscles | **HEAVY_RUNTIME** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | 18 kişiyle eğitilmiş ve 0,47 mm ızgara: hem ağır hem az veriyle eğitilmiş. |
| TotalSegmentator — beyin ventrikül bölümleri | BT | ventricle_parts | **HEAVY_RUNTIME** | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | 0,44 mm ızgara; 38 kişiyle eğitilmiş. |
| TotalSegmentator — akciğer nodülü | BT | lung_nodules | **HEAVY_RUNTIME** (RECHECKED) | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | ResidualEncoder ağı ve 765 MB ağırlık: tarayıcıda/telefonda bellek ve süre olarak çalıştırılamıyor. Sonra: masaüstü paketi + WebGPU denemesi. |
| TotalSegmentator — dişler (ToothFairy3, FDI numaralı) ve kafa-yüz yapıları | BT | teeth + craniofacial_structures | **HEAVY_RUNTIME** (RECHECKED) | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | CBCT için 0,5 mm ızgara ve kafatası basamaklaması (Dataset115): cihazda saatler sürer. |
| TotalSegmentator — karaciğer lezyonu (BT) | BT | liver_lesions | **FAILED_VALIDATION** (RECHECKED) | voxel | Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) (✓ · ✓ · ✓) | — | Güvenilir bulgu üretmedi; uygulamaya alınmadı. Sonra: resmi TotalSegmentator ile birden çok LiTS vakasında karşılaştırma ve karo yerleşiminin resmi hatla birebir eşlenmesi. |
| TotalSegmentator lisanslı görevleri (heartchambers_highres, coronary_arteries, aortic_sinuses, tissue_types, appendicular_bones, brain_structures, face, thigh_shoulder_muscles, renal_arteries, aortic_dissection …) | BT, MR | licensed tasks | **RESEARCH_ONLY** (RECHECKED) | voxel | Ayrı lisans: ticari olmayan kullanım için ücretsiz akademik anahtar, ticari lisans yazarlardan (✗ · ✗ · ✗) | — | Lisans anahtarsız indirmeye ve yeniden dağıtıma izin vermiyor; uygulamaya gömülemez. |
| TotalSegmentator — beyin anevrizması (TOF MR, MAXIMUS) | MR | brain_aneurysm | **RESEARCH_ONLY** (RECHECKED) | voxel | CC BY-NC 4.0 (ticari lisans yok) (✗ · ✓ · ?) | — | Ticari olmayan lisans ve 0,39 mm ızgara + 1,17 GB ağırlık: hem gömülemez hem cihaz için çok ağır. |
| MONAI — tüm vücut BT bölütleme (SegResNet, 104 yapı) | BT | whole-body CT segmentation | **AVAILABLE** (RECHECKED) | voxel | Apache-2.0 (paket); veri TotalSegmentator (CC BY 4.0) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — dalak BT bölütleme (UNet) | BT | spleen CT segmentation | **AVAILABLE** | voxel | Apache-2.0 (paket); veri MSD (CC BY-SA 4.0) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — karın çoklu organ (Swin UNETR, BTCV) | BT | multi-organ abdominal CT segmentation | **AVAILABLE** | voxel | Apache-2.0 (paket); veri BTCV (Synapse kullanım koşulları) (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — karın çoklu organ (Aichi) | BT | multi-organ abdominal CT segmentation | **RESEARCH_ONLY** | voxel | Özel kullanım, ticari olmayan, tersine mühendislik yasak (paket LICENSE) (✗ · ✗ · ✗) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — pankreas ve pankreas tümörü (DiNTS) | BT | pancreas + pancreatic tumor segmentation | **AVAILABLE** | voxel | Apache-2.0 (paket); veri MSD Task07 (CC BY-SA 4.0) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — böbrek iç yapıları (korteks, medulla, pelvis; UNesT) | BT | renal structures segmentation | **AVAILABLE** | voxel | Apache-2.0 (paket); veri lisansı paket belgesinde yok (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — kontrastlı BT böbrek yapıları (AVUCTK) | BT | renal CECT segmentation | **RESEARCH_ONLY** | voxel | Apache-2.0 (paket); veri CC BY-NC-SA 4.0 (✗ · ✓ · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — beyin tümörü alt bölgeleri (BraTS 2018, SegResNet) | MR | BraTS brain tumor segmentation | **RESEARCH_ONLY** | voxel | Apache-2.0 (paket); veri BraTS (yalnızca araştırma, atıfla) (✗ · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — tüm beyin 133 yapı (T1 MR, UNesT) | MR | whole brain segmentation | **AVAILABLE** | voxel | Apache-2.0 (paket); veri lisansı paket belgesinde yok (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — prostat MR anatomi (periferik zon, santral bez) | MR | prostate MRI anatomy | **AVAILABLE** | voxel | Apache-2.0 (paket); veri Prostate158 (CC BY 4.0) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — kalp MR kısa eksen: sol/sağ ventrikül ve miyokard | MR | cardiac MRI ventricular segmentation | **AVAILABLE** | pixel | MIT (paket) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (drive.google.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — akciğer nodülü tespiti (RetinaNet, LUNA16) | BT | lung nodule CT detection | **AVAILABLE** | box | Apache-2.0 (paket); veri LUNA16/LIDC-IDRI (CC BY 3.0/4.0) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — tam slaytta metastaz tespiti (Camelyon16, ResNet18) | Patoloji | pathology tumor detection | **AVAILABLE** | none | Apache-2.0 (paket); veri Camelyon16 (CC0) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — HoVer-Net çekirdek bölütleme + sınıflandırma (CoNSeP) | Patoloji | nuclei segmentation + classification (HoVer-Net) | **AVAILABLE** | pixel | Apache-2.0 (paket); veri CoNSeP (paket üçüncü taraf lisansları) (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — çekirdek sınıflandırma (CoNSeP, DenseNet) | Patoloji | nuclei classification | **AVAILABLE** | none | Apache-2.0 (paket); veri CoNSeP (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — mamografi meme yoğunluğu (BI-RADS A–D) | Mamografi | breast density classification | **AVAILABLE** (RECHECKED) | none | Apache-2.0 (paket); eğitim verisi Mayo Clinic (özel, paylaşılmıyor) (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (drive.google.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — endoskopide cerrahi alet bölütleme | Endoskopi / kolonoskopi | endoscopic tool segmentation | **AVAILABLE** | pixel | Apache-2.0 (paket); veri Activ Surgical (özel) (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — endoskopi karesi vücut içi/dışı | Endoskopi / kolonoskopi | in-body vs out-of-body frame classification | **AVAILABLE** | none | Apache-2.0 (paket); veri Activ Surgical (özel) (? · ? · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — OCT retiküler psödodrusen örnek bölütleme | OCT | retinal OCT RPD instance segmentation | **AVAILABLE** | pixel | BSD-2-Clause (paket) (✓ · ✓ · ?) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — kalp MR uzun eksen kapak noktaları (KCL) | MR | cardiac valve landmark detection | **AVAILABLE** | pixel | MIT (paket) (✓ · ✓ · ✓) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MONAI — VISTA3D (BT, 127 sınıf + etkileşimli) | BT | CT foundation segmentation (automatic + point prompt) | **RESEARCH_ONLY** | voxel | Kod Apache-2.0; AĞIRLIKLAR NVIDIA lisansı: yalnızca ticari olmayan (araştırma/değerlendirme) kullanım (✗ · ✗ · ✗) | — | Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi. |
| MedSAM / LiteMedSAM — kutu istemli genel tıbbi bölütleme | BT, MR, Röntgen, Ultrason / Doppler, Endoskopi / kolonoskopi, Fundus, Patoloji, Diş / CBCT, Mamografi, OCT | promptable segmentation | **AVAILABLE** (RECHECKED) | prompt | Apache-2.0 (kod ve ağırlık) (✓ · ✓ · ✓) | — | Ağırlık bu ortamdan indirilemedi. Ayrıca bulgu bulmaz: yapıyı kullanıcının kutusu belirler — görüntüleyicide "kutu çiz → maske" aracı olarak eklenebilir (konum kullanıcıdan gelir, model uydurmaz). |
| MedSAM2 — 3B/video istemli bölütleme | BT, MR, Ultrason / Doppler, EKO, Endoskopi / kolonoskopi | promptable 3D / video segmentation | **AVAILABLE** | prompt | Apache-2.0 (✓ · ✓ · ✓) | — | Hugging Face bu ortamdan erişilemiyor; ayrıca bellek/bellek-dikkat modülü ONNX'e doğrudan çevrilemiyor (özel dışa aktarma gerekir). |
| SAM-Med3D / SAM-Med3D-Turbo — 3B nokta istemli bölütleme | BT, MR | promptable 3D segmentation | **AVAILABLE** | prompt | Apache-2.0 (✓ · ✓ · ?) | — | Ağırlık bu ortamdan indirilemedi; istem (nokta) arayüzü kişisel 3B görüntüleyicisine eklenince değerlendirilebilir. |
| TorchXRayVision — CheXpert / MIMIC-CXR / "all" sınıflandırıcıları → yerine: `xrv-densenet121-nih` | Röntgen | chest X-ray multilabel classification | **RESEARCH_ONLY** (RECHECKED) | none | Kod/ağırlık Apache-2.0; eğitim verisi CheXpert (Stanford araştırma kullanım sözleşmesi) ve MIMIC-CXR (PhysioNet kimlikli erişim) yeniden dağıtıma izin vermiyor (✗ · ✗ · ?) | — | Eğitim verisinin kullanım koşulları nedeniyle uygulamaya gömülmez; NIH modeli (kısıtlamasız veri) kullanılır. |
| Röntgende kırık tespiti (açık ağırlıklı model) | Röntgen | fracture detection | **UNAVAILABLE** (RECHECKED) | box | — (? · ? · ?) | — | Lisansı açık, sürümlü ve doğrulanabilir ağırlıkla yayımlanmış bir kırık modeli bulunamadı (FracAtlas tabanlı çalışmalar ağırlık yayımlamıyor ya da ağırlık lisanssız). |
| EchoNet-Dynamic — sol ventrikül bölütleme (DeepLabV3) ve EF (R(2+1)D) | EKO | LV segmentation + ejection fraction | **RESEARCH_ONLY** (RECHECKED) | pixel | Yazarların telif hakkı: yazılı izin olmadan yeniden dağıtım ve kullanım yasak (LICENSE.txt) (✗ · ✗ · ✗) | — | Lisans yeniden dağıtıma izin vermiyor: uygulamaya gömülmez ve paket olarak dağıtılmaz. Doğrulama için açık bir EKO videosu da bu ortamda yok (EchoNet veri kümesi sözleşmeyle veriliyor). |
| HoVer-Net (özgün) — PanNuke / CoNSeP / MoNuSAC ağırlıkları → yerine: `monai-hovernet-consep` | Patoloji | nuclei instance segmentation + classification | **RESEARCH_ONLY** (RECHECKED) | pixel | Kod MIT; PanNuke ağırlıkları CC BY-NC-SA 4.0 (veri lisansından) (✗ · ✓ · ?) | — | PanNuke ağırlıkları ticari olmayan lisanslı; ayrıca Google Drive ve TIAToolbox sunucusu bu ortamdan erişilemedi. Apache-2.0 lisanslı alternatif: MONAI HoVer-Net (CoNSeP). |
| UNI / UNI2 (MahmoodLab) — patoloji temel modeli | Patoloji | pathology foundation model (feature extractor) | **RESEARCH_ONLY** | none | CC BY-NC-ND 4.0, kapılı Hugging Face erişimi (kurum e-postası ile onay) (✗ · ✗ · ✗) | — | Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir). |
| CONCH (MahmoodLab) — patoloji görüntü-metin temel modeli | Patoloji | pathology foundation model (feature extractor) | **RESEARCH_ONLY** | none | CC BY-NC-ND 4.0, kapılı Hugging Face erişimi (✗ · ✗ · ✗) | — | Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir). |
| Virchow / Virchow2 (Paige) — patoloji temel modeli | Patoloji | pathology foundation model (feature extractor) | **RESEARCH_ONLY** | none | CC BY-NC-ND 4.0, kapılı Hugging Face erişimi (✗ · ✗ · ✗) | — | Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir). |
| PLIP — patoloji dil-görüntü modeli (CLIP) | Patoloji | pathology foundation model (feature extractor) | **RESEARCH_ONLY** | none | Yalnızca araştırma amaçlı (Twitter verisinden eğitildi; model kartındaki kullanım koşulları) (✗ · ✗ · ✗) | — | Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir). |
| OpenMedLab koleksiyonu (STU-Net, MedLSAM, PULSE …) | BT, MR, Patoloji, Fundus, Röntgen | collection (segmentation / classification / foundation) | **PARTIALLY_AVAILABLE** (RECHECKED) | voxel | Depoya göre değişiyor (Apache-2.0 … yalnızca araştırma) (? · ? · ?) | — | Tek bir model değil; her depo ayrı denetlenmeli. Ağırlık bağlantıları bu ortamdan erişilemedi. STU-Net (nnU-Net tabanlı) TotalSegmentator ile aynı dönüştürücüye uygun ilk aday. |
| RETFound — retina (fundus/OCT) temel modeli | Fundus, OCT | retinal foundation model | **RESEARCH_ONLY** (RECHECKED) | none | CC BY-NC 4.0 (LICENSE okundu); ağırlıklar kapılı Hugging Face (✗ · ✓ · ?) | — | Ticari olmayan lisans ve tek başına tanı/konum üretmez; bir görev başlığıyla ince ayar gerekir. |
| ECG-FM — EKG temel modeli (wav2vec 2.0 tarzı) | EKG | 12-lead ECG multilabel classification | **AVAILABLE** (RECHECKED) | none | Kod MIT (LICENSE okundu); ağırlık lisansı model sayfasında belirtilmemiş (? · ? · ?) | — | Hugging Face bu ortamdan erişilemiyor ve ağırlık lisansı belirsiz. Ayrıca uygulamaya EKG kâğıt fotoğrafı geliyor: modelin istediği sayısal 12 derivasyon sinyali için önce güvenilir sayısallaştırma gerekir (şu an yalnızca RR/kalp hızı ölçülüyor). |
| PET/BT lezyon bölütleme (autoPET modelleri) | PET / PET-BT, BT | PET lesion segmentation | **UNAVAILABLE** (RECHECKED) | voxel | — (? · ? · ?) | — | Bu araştırmada sürümlü, lisansı açık ve bu ortamdan indirilebilir PET ağırlığı bulunamadı (yarışma takımlarının ağırlıkları Zenodo/Drive'da ve erişilemedi). Ayrıca SUV hesabı için DICOM radyofarmasötik alanları okunmalı. |
| DEXA kemik yoğunluğu / vücut kompozisyonu | DEXA | bone density / body composition | **UNAVAILABLE** | none | — (? · ? · ?) | — | Açık ağırlıklı, doğrulanabilir bir DEXA modeli bulunamadı; DEXA ölçümleri cihazın kendi yazılımında üretilir ve rapordan okunması daha güvenilirdir. |
| Koroner anjiyografi damar / darlık modelleri | Anjiyografi / floroskopi | coronary vessel segmentation / stenosis | **UNAVAILABLE** (RECHECKED) | pixel | — (? · ? · ?) | — | Lisansı açık ve ağırlığı yayımlanmış bir XA anjiyografi modeli bulunamadı (ARCADE/CADICA çalışmaları ağırlık yayımlamıyor ya da erişilemeyen bağlantılarda). |

## Ayrıntı

### TotalSegmentator — BT anatomi (117 yapı)

- Kimlik: `totalseg-ct-total-3mm` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.0.0-weights/Dataset297_TotalSegmentator_total_3mm_1559subj.zip (135.4 MB) · sürüm: 2.0.0-weights · Dataset297 (3 mm, fast) · özet: sha256:0baa2c8de2975600eb31801dd5c1825cd2b356f794498659cf3348714c073394
- Girdi → çıktı: DICOM serisi → RAS 3 mm ızgara, NCDHW → 3B etiket hacmi (117 yapı), TopK(4)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~1,5–2 GB
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi TotalSegmentator --fast çıktısıyla (aynı ağırlıklar) ortalama Dice 0,999 (en düşük yapı 0,981), voksel uyumu %99,97; uygulamanın TypeScript hattıyla birim testinde (realModels.test.ts) tekrar ölçülür.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator MRI — MR anatomi (50 yapı)

- Kimlik: `totalseg-mr-total-3mm` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset852_TotalSegMRI_total_3mm_1088subj.zip (126.4 MB) · sürüm: 2.5.0-weights · Dataset852 (3 mm, fast) · özet: sha256:6d0d0691e5b09c9faf3a70198ce0d0ccbb8ee1271a72af8f9452565c8df6461b
- Girdi → çıktı: DICOM serisi → RAS 3 mm ızgara → 3B etiket hacmi (50 yapı)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~1,5 GB
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi --fast (total_mr) çıktısıyla ortalama Dice 0,999, voksel uyumu %99,98.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — böbrek kisti (BT patoloji, basamaklı)

- Kimlik: `totalseg-ct-kidney-cysts` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset789_kidney_cyst_501subj.zip (230.6 MB) · sürüm: 2.5.0-weights · Dataset789 (1,5 mm) · özet: sha256:fd528187b1526135894ac03e15861ae4de9b39ed317fbfce06ab9066e9817425
- Girdi → çıktı: Anatomi sonucuna göre kırpılmış BT (1,5 mm) → Kist maskesi (sol/sağ), hacim
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~2 GB
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Kistli gerçek BT (MSD spleen_19): resmi 0,58 mL ↔ uygulama hattı 0,51 mL (Dice 0,865); kistsiz iki BT'de ikisi de kist bulmadı.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — plevral/perikardiyal efüzyon (BT patoloji, basamaklı)

- Kimlik: `totalseg-ct-effusion` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.0.0-weights/Dataset315_thoraxCT.zip (233.7 MB) · sürüm: 2.0.0-weights · Dataset315 (1,5 mm) · özet: sha256:974fd151df6b6755e86b34e3c7a9a11dfcee7351393f09d8621278c0aa2a5a75
- Girdi → çıktı: Akciğer + 5 cm kırpılmış BT (1,5 mm) → Plevral / perikardiyal sıvı maskesi, hacim
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~2 GB
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Gerçek göğüs BT'sinde (MSD lung_053): akciğer Dice 0,988; perikard sıvısı resmi 3,09 ↔ 3,14 mL (Dice 0,81).
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — karaciğer segmentleri (Couinaud I–VIII)

- Kimlik: `totalseg-ct-liver-segments` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset570_ct_liver_segments.zip (230.0 MB) · sürüm: 2.5.0-weights · Dataset570 (0,8 × 0,8 × 1,5 mm) · özet: sha256:76f3bf368cbae7756729bf2971cb1b25a1ee8993a18495f2d563d5edfead8aac
- Girdi → çıktı: Karaciğer + 1 cm kırpılmış BT (anizotropik ızgara) → 8 segment maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~2 GB
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Fikstür BT'de resmi çıktıyla ort. Dice 0,951 (0,941–0,964); gerçek LiTS BT'sinde Dice 0,86–0,97.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — beyin içi kanama (BT patoloji, basamaklı)

- Kimlik: `totalseg-ct-cerebral-bleed` · durum **VERIFIED** (Doğrulandı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.0.0-weights/Dataset150_icb_v0.zip (325.6 MB) · sürüm: 2.0.0-weights · Dataset150 (2,83 × 0,34 × 0,34 mm) · özet: sha256:cd9a41917f134dd20f1aba877c7af4cabedf144f0f7aa1c1d16d6376b2425bb4
- Girdi → çıktı: Beyin + 3 mm kırpılmış kontrastsız baş BT'si; 24 × 256 × 256 karo → Kanama maskesi (voksel), hacim (mL), kesit aralığı
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~2–2,5 GB (24 × 256 × 256 karo, float32 hesap)
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓ — Doğrulama verisi CQ500 (CC BY-NC-SA 4.0) depoya konmadı; yalnızca yerelde ölçüm için kullanıldı.
- Kanıt: CQ500'ün 5 gerçek baş BT'sinde (3 radyoloğun okumasına göre 4 kanamalı, 1 kanamasız; gantri eğimi 8,5–30°; JPEG 2000 → sıkıştırmasız) uygulamanın kendi TypeScript hattı (DICOM okuma → BT anatomi 3 mm → beyin + 3 mm kırpma → bu model, ONNX Runtime WASM) resmi TotalSegmentator -ta cerebral_bleed çıktısıyla karşılaştırıldı: 35,4 ↔ 36,6 mL (Dice 0,914), 42,2 ↔ 43,2 mL (Dice 0,942), 7,2 ↔ 7,7 mL (Dice 0,870); kanamasız vakada ikisi de 0 mL. En küçük odakta (resmi 1,34 mL) uygulama 0 mL buldu; resmi nnU-Net öngörücüsü de aynı ağırlıklarla uygulamanın kırptığı bölgede 0 mL veriyor — küçük odakta modelin kendi sonucu kırpmaya duyarlı (sınırlarda yazılı). ONNX ↔ PyTorch argmax uyumu ≥ %99,9999. Karo başına ~55 sn (tek çekirdek WASM), bu vakalarda 24–45 karo.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi); CQ500 (qure.ai) baş BT veri kümesi ve 3 radyoloğun okuma etiketleri (reads.csv)
- Eski kayıt: "Beyin içi kanama" — Ağırlıklar indirildi ve ağ uyumlu; ancak resmi çıktıyla karşılaştıracak açık bir baş BT'si bu ortamda bulunamadı.

### TorchXRayVision — göğüs röntgeni sınıflandırıcı (NIH, 14 bulgu)

- Kimlik: `xrv-densenet121-nih` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/mlmed/torchxrayvision
- Ağırlık: github.com/mlmed/torchxrayvision/releases/download/v1/nih-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt · sürüm: densenet121-res224-nih (v1) · özet: sha256:31a5475c6b1383a7edbfcaf96af9ce302eb9969cfe28b6b8b5859afc6f274fdf
- Girdi → çıktı: PNG/JPEG/DICOM → 224 × 224 gri → 14 bulgu olasılığı (konum YOK)
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~150 MB
- Lisans: Apache-2.0 (kod ve ağırlık); eğitim verisi NIH ChestX-ray14 (kısıtlamasız, atıfla) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Kütüphanenin kendi skorlarıyla en büyük fark 3,4e-5 (fp16: ≤ 3,4e-4).
- Denetlenen kaynaklar: TorchXRayVision GitHub deposu; GitHub sürümleri (v1); PyPI torchxrayvision

### ChestX-Det PSPNet — göğüs röntgeni anatomi (14 yapı)

- Kimlik: `xrv-pspnet-chestxdet` · durum **VERIFIED** (Doğrulandı)
- Resmi depo: github.com/Deepwise-AILab/ChestX-Det-Dataset
- Ağırlık: github.com/mlmed/torchxrayvision/releases/download/v1/pspnet_chestxray_best_model_4.pth · sürüm: pspnet_chestxray_best_model_4 · özet: sha256:019b167eac6b729fc1bb92bbbc185fc1730aaa65819f4e3fe718186cadc044fc
- Girdi → çıktı: 512 × 512 gri → 14 yapı maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✗ · CPU ✓ · GPU ✗ · bellek: ≥ 8 GB RAM önerilir (ResNet-101, 131 MB)
- Lisans: Apache-2.0 (ChestX-Det veri kümesi ve PSPNet ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Kütüphanenin kendi çıktısıyla maske uyumu %100, en büyük fark 1,4e-6 (float32).
- Denetlenen kaynaklar: ChestX-Det deposu; TorchXRayVision GitHub sürümleri

### DepthPolyp — kolonoskopi polip bölütleme (MiT-B0)

- Kimlik: `depthpolyp-kvasir` · durum **VERIFIED** (Doğrulandı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/ReaganWu/DepthPolyp
- Ağırlık: raw.githubusercontent.com/ReaganWu/DepthPolyp/main/checkpoints/DepthPolyp_Kvasir.onnx (14.6 MB) · sürüm: DepthPolyp_Kvasir (resmi ONNX, depo main dalı) · özet: sha256:883ff8a825a5f51f59d46a9a2c2e9f0a505519140495dfa6800e6b48297c9f5b
- Girdi → çıktı: RGB kolonoskopi karesi → 224 × 224, /255 → Polip olasılık maskesi (sigmoid) + sözde derinlik (gösterilmez)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch → ONNX (yazarın resmi dışa aktarımı, opset 17); ONNX ✓ · ORT Web ✓ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~100 MB (3,6 M parametre, 0,86 GMAC)
- Lisans: MIT (kod ve ağırlık, ReaganWu/DepthPolyp); eğitim verisi Kvasir-SEG (araştırma/eğitim amaçlı serbest, ticari kullanım için Simula'dan yazılı izin) — ticari ? · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓ — Ağırlık MIT olsa da eğitim verisinin koşulları nedeniyle uygulamaya gömülmedi; isteğe bağlı paket olarak üretilir ve "Model kur" ile eklenir.
- Kanıt: Depodaki iki Kvasir örneğinde yazarın ONNX betiği, depodaki resmi maskeleri birebir üretti (Dice 1,000 / 1,000). Uygulamanın ön işlemesi (çift doğrusal + kenar yumuşatma, /255) ile resmi PIL ön işlemesi arasında maske Dice 0,998 / 0,999, polip alanı oranı 0,292 ↔ 0,291 ve 0,272 ↔ 0,272.
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE, checkpoints/, samples/, scripts/infer_onnx.py); Hugging Face ReaganWZY/DepthPolyp (bu ortamdan erişilemedi) · erişilemeyen: huggingface.co
- Eski kayıt: "Polip, kanama, lezyon" — Ağırlıklar Google Drive / Baidu üzerinde ve lisansı belirsiz (PraNet ve benzeri).

### TotalSegmentator v3 — BT anatomi (3 mm)

- Kimlik: `ts-total-v3-fast` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v3.0.0-weights/Dataset836_TotalSegmentator_total_3mm_1559subj.zip (242.2 MB) · sürüm: v3.0.0-weights · Dataset836 (görev 'total_v3 (fast)') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 3 mm ızgara → 3B etiket hacmi: total görevinin v3 sınıfları
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 242 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Gömülü v2 anatomi modelinin yeni sürümü; sınıf listesi v2 ile birebir aynı değil. Değiştirmeden önce aynı fikstürlerde resmi v3 çıktısıyla Dice doğrulaması ve basamaklı modellerin etiket eşlemesinin güncellenmesi gerekiyor.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — vücut / gövde / uzuv / deri (6 mm)

- Kimlik: `ts-body-fast` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.0.0-weights/Dataset300_body_6mm_1559subj.zip (124.3 MB) · sürüm: v2.0.0-weights · Dataset300 (görev 'body (fast)') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 6 mm ızgara → 3B etiket hacmi: body, body_trunc, body_extremities, skin
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 124 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Hafif (6 mm) ve açık lisanslı; kişisel 3B'de deri/gövde yüzeyi için uygun. Bu sürümde doğrulama sırası kanama modeline verildi; sonra: build_models.py'ye ekle → örnek BT'de resmi çıktıyla Dice → paket.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator MRI — gövde / uzuv (6 mm)

- Kimlik: `ts-body-mr-fast` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset598_mri_body_6mm_139subj.zip (42.7 MB) · sürüm: v2.5.0-weights · Dataset598 (görev 'body_mr (fast)') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 6 mm ızgara → 3B etiket hacmi: body_trunc, body_extremities
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 43 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Açık ve hafif; MR örnek fikstüründe resmi çıktıyla doğrulanınca paket olarak eklenebilir.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator MRI — omurlar (C1–sakrum)

- Kimlik: `ts-vertebrae-mr` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset756_mri_vertebrae_1076subj.zip (230.8 MB) · sürüm: v2.5.0-weights · Dataset756 (görev 'vertebrae_mr') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 1,5 mm ızgara → 3B etiket hacmi: 25 omur
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 231 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Bel/boyun MR'ında omur düzeyi eşlemesi için yararlı; omurga MR fikstürü olmadan doğrulanmadı.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — omur cisimleri ve disk aralıkları

- Kimlik: `ts-vertebrae-body` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset305_vertebrae_discs_1559subj.zip (233.6 MB) · sürüm: v2.5.0-weights · Dataset305 (görev 'vertebrae_body') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 1,5 mm ızgara → 3B etiket hacmi: vertebrae_body, intervertebral_discs
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 234 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Açık lisanslı; doğrulama verisi (omurga BT) ve cihaz süresi ölçümü bekliyor.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — gövde boşlukları (karın, göğüs, perikard, mediasten)

- Kimlik: `ts-trunk-cavities` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset343_mediastinum_1786subj.zip (233.2 MB) · sürüm: v2.5.0-weights · Dataset343 (görev 'trunk_cavities') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 1,5 mm ızgara → 3B etiket hacmi: abdominal_cavity, thoracic_cavity, pericardium, mediastinum
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 233 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: İç dünya sahnelerinde perikard/mediasten kişisel sınırları için uygun; doğrulanmadı.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — meme dokusu (BT)

- Kimlik: `ts-breasts` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset527_breasts_1559subj.zip (233.8 MB) · sürüm: v2.5.0-weights · Dataset527 (görev 'breasts') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 1,5 mm ızgara → 3B etiket hacmi: breast
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 234 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Normal anatomi bölütlemesi (lezyon değil); doğrulanmadı.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — gövde kasları (T4–L4)

- Kimlik: `ts-abdominal-muscles` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset952_abdominal_muscles_167subj.zip (124.3 MB) · sürüm: v2.5.0-weights · Dataset952 (görev 'abdominal_muscles') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,75 × 0,75 × 1 mm ızgara → 3B etiket hacmi: 22 kas
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 124 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Küçük veriyle eğitilmiş (167 kişi); doğrulanmadı.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator MRI — karaciğer segmentleri

- Kimlik: `ts-liver-segments-mr` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset576_mri_liver_segments_120subj.zip (229.7 MB) · sürüm: v2.5.0-weights · Dataset576 (görev 'liver_segments_mr') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 1,1 × 1,2 × 3 mm ızgara → 3B etiket hacmi: Couinaud I–VIII
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 230 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: BT sürümü gömülü; MR sürümü için karaciğer MR'ı fikstürüyle resmi çıktı karşılaştırması gerekiyor.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — karaciğer lezyonu (MR)

- Kimlik: `ts-liver-lesions-mr` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset589_ct_mri_liver_lesions_750subj.zip (231.3 MB) · sürüm: v2.5.0-weights · Dataset589 (görev 'liver_lesions_mr') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,86 × 0,86 × 1 mm ızgara → 3B etiket hacmi: liver_lesions
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 231 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: BT lezyon modeli gerçek vakada kararsız çıktı (FAILED_VALIDATION); MR sürümü aynı yöntemle (uzman etiketli vaka) denenmeden eklenmez.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — kalça protezi

- Kimlik: `ts-hip-implant` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.0.0-weights/Dataset260_hip_implant_71subj.zip (232.7 MB) · sürüm: v2.0.0-weights · Dataset260 (görev 'hip_implant') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → özgün çözünürlük (femur/kalça kırpılmış) ızgara → 3B etiket hacmi: hip_implant
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 233 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Dar kullanım alanı; protezli BT olmadan doğrulanamadı.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — karaciğer damarları + tümör (MSD)

- Kimlik: `ts-liver-vessels` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.4.0-weights/Dataset008_HepaticVessel.zip (230.2 MB) · sürüm: v2.4.0-weights · Dataset008 (görev 'liver_vessels') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → özgün çözünürlük (karaciğer kırpılmış) ızgara → 3B etiket hacmi: liver_vessels, liver_tumor
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 230 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Kontrastlı portal faz BT gerektirir; MSD Task08 vakasında resmi çıktıyla karşılaştırılmadan eklenmez.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — akciğer arter/ven ve hava yolları

- Kimlik: `ts-lung-vessels` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset117_lung_airways_arteries_veins_282subj.zip (229.9 MB) · sürüm: v2.5.0-weights · Dataset117 (görev 'lung_vessels') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,70 × 0,70 × 1 mm ızgara → 3B etiket hacmi: lung_arteries, lung_veins, lung_airways, lung_airways_wall
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 230 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Tüm akciğerler 0,7 mm ızgarada: tipik göğüs BT'sinde 60+ karo, tarayıcıda/telefonda onlarca dakika ve > 3 GB bellek.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — baş bezleri ve boşlukları (göz, lens, optik sinir, tükürük bezleri, farinks, kulak yolu)

- Kimlik: `ts-head-glands-cavities` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.3.0-weights/Dataset775_head_glands_cavities_492subj.zip (231.1 MB) · sürüm: v2.3.0-weights · Dataset775 (görev 'head_glands_cavities') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,75 × 0,75 × 1 mm ızgara → 3B etiket hacmi: 19 yapı
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 231 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: Baş-boyun 0,75 mm ızgarada çok karolu; kişisel göz/kulak 3B'si için değerli, ama cihazda süre ölçümü ve baş BT fikstürüyle doğrulama gerekiyor.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — boyun kemik/kıkırdak ve karotis/juguler

- Kimlik: `ts-headneck-bones-vessels` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.3.0-weights/Dataset776_headneck_bones_vessels_492subj.zip (230.8 MB) · sürüm: v2.3.0-weights · Dataset776 (görev 'headneck_bones_vessels') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,75 × 0,75 × 1 mm ızgara → 3B etiket hacmi: 12 yapı
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 231 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: 0,75 mm baş-boyun ızgarası; cihaz için ağır.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — baş ve boyun kasları

- Kimlik: `ts-head-muscles` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.3.0-weights/Dataset777_head_muscles_492subj.zip (230.4 MB) · sürüm: v2.3.0-weights · Dataset777 (görev 'head_muscles + headneck_muscles') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,75 × 0,75 × 1 mm ızgara → 3B etiket hacmi: 11 + 23 kas
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 230 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: 0,75 mm ızgara ve iki parçalı model (Dataset778/779); cihaz için ağır.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — göz kasları

- Kimlik: `ts-oculomotor` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.4.0-weights/Dataset351_oculomotor_muscles_18subj.zip (230.6 MB) · sürüm: v2.4.0-weights · Dataset351 (görev 'oculomotor_muscles') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,47 × 0,47 × 0,85 mm ızgara → 3B etiket hacmi: 19 yapı
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 231 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: 18 kişiyle eğitilmiş ve 0,47 mm ızgara: hem ağır hem az veriyle eğitilmiş.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — beyin ventrikül bölümleri

- Kimlik: `ts-ventricle-parts` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset552_ventricle_parts_38subj.zip (232.8 MB) · sürüm: v2.5.0-weights · Dataset552 (görev 'ventricle_parts') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,44 × 0,43 × 1 mm ızgara → 3B etiket hacmi: 12 ventrikül bölümü
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 233 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: 0,44 mm ızgara; 38 kişiyle eğitilmiş.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)

### TotalSegmentator — akciğer nodülü

- Kimlik: `ts-lung-nodules` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset913_lung_nodules.zip (765.1 MB) · sürüm: v2.5.0-weights · Dataset913 (görev 'lung_nodules') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 1,5 mm (ResidualEncoder) ızgara → 3B etiket hacmi: lung, lung_nodules
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 765 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: ResidualEncoder ağı ve 765 MB ağırlık: tarayıcıda/telefonda bellek ve süre olarak çalıştırılamıyor. Sonra: masaüstü paketi + WebGPU denemesi.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)
- Eski kayıt: "Akciğer nodülü" — Açık lisanslı, ancak ResidualEncoder ağı, 0,74 mm ızgara ve 820 MB ağırlık.

### TotalSegmentator — dişler (ToothFairy3, FDI numaralı) ve kafa-yüz yapıları

- Kimlik: `ts-teeth` · durum **HEAVY_RUNTIME** (Cihaz için çok ağır) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset113_ToothFairy3.zip (232.1 MB) · sürüm: v2.5.0-weights · Dataset113 (görev 'teeth + craniofacial_structures') · özet: —
- Girdi → çıktı: DICOM serisi / NIfTI → 0,5 mm izotropik ızgara → 3B etiket hacmi: 77 sınıf (32 diş + pulpa, çene kemikleri, kanallar)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Resmi görev kaydında var; ağırlık dosyası bu ortamdan indirilebilir (HTTP 200, 232 MB). Mimari, uygulamadaki nnU-Net → ONNX dönüştürücüsüyle uyumlu (PlainConvUNet).
- Neden / sonra nasıl eklenir: CBCT için 0,5 mm ızgara ve kafatası basamaklaması (Dataset115): cihazda saatler sürer.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)
- Eski kayıt: "Diş bölütleme ve numaralandırma" — Açık lisanslı ve ağırlığı erişilebilir; ancak 0,5 mm ızgara cihazda saatler sürer.

### TotalSegmentator — karaciğer lezyonu (BT)

- Kimlik: `ts-liver-lesions` · durum **FAILED_VALIDATION** (Doğrulamadan geçemedi) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset591_ct_liver_lesions_842subj.zip (230.9 MB) · sürüm: 2.5.0-weights · Dataset591 (0,75 × 0,75 × 1 mm) · özet: sha256:b3bdd53de65dc64a46264edfdeb491b18e8f95973a691eeccfa530d1da1678a0
- Girdi → çıktı: Karaciğer + 1 cm kırpılmış BT → Lezyon maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2) → ONNX; ONNX ✓ · ORT Web ✓ · web ✓ · Android ✗ · CPU ✓ · GPU ✗ · bellek: > 3 GB
- Lisans: Apache-2.0 (TotalSegmentator kodu ve açık görev ağırlıkları) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: Dönüştürüldü; gerçek LiTS vakasında (uzman etiketi 12,9 mL tümör) sonuç kırpma/karo yerleşimine aşırı duyarlı (uzman etiketine göre Dice 0,14–0,71; büyük tümör bazı ayarlarda kaçtı).
- Neden / sonra nasıl eklenir: Güvenilir bulgu üretmedi; uygulamaya alınmadı. Sonra: resmi TotalSegmentator ile birden çok LiTS vakasında karşılaştırma ve karo yerleşiminin resmi hatla birebir eşlenmesi.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)
- Eski kayıt: "Karaciğer lezyonu (tümör, metastaz, kist)" — Gerçek LiTS vakasında kararsız sonuç (Dice 0,71 ↔ 0,14).

### TotalSegmentator lisanslı görevleri (heartchambers_highres, coronary_arteries, aortic_sinuses, tissue_types, appendicular_bones, brain_structures, face, thigh_shoulder_muscles, renal_arteries, aortic_dissection …)

- Kimlik: `ts-licensed-tasks` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: — · sürüm: 18 görev (map_to_binary.commercial_models) · özet: —
- Girdi → çıktı: BT / MR serisi → 3B etiket hacmi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Ayrı lisans: ticari olmayan kullanım için ücretsiz akademik anahtar, ticari lisans yazarlardan — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: Resmi kayıtta indirme adresi yok; ağırlıklar lisans sunucusundan anahtarla dağıtılıyor (download_model_with_license_and_unpack).
- Neden / sonra nasıl eklenir: Lisans anahtarsız indirmeye ve yeniden dağıtıma izin vermiyor; uygulamaya gömülemez.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)
- Eski kayıt: "Kalp odacıkları (yüksek çözünürlük), koroner arterler, doku tipleri, apendiküler kemikler, beyin yapıları, yüz" — Ticari olmayan / ayrı lisans gerektiriyor.

### TotalSegmentator — beyin anevrizması (TOF MR, MAXIMUS)

- Kimlik: `ts-brain-aneurysm` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/wasserth/TotalSegmentator
- Ağırlık: github.com/wasserth/TotalSegmentator/releases/download/v2.5.0-weights/Dataset615_MAXIMUS.zip (1169.0 MB) · sürüm: 2.5.0-weights · Dataset615 · özet: —
- Girdi → çıktı: TOF MR anjiyografi → Anevrizma maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: CC BY-NC 4.0 (ticari lisans yok) — ticari ✗ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: Ağırlık dosyası erişilebilir (1,17 GB).
- Neden / sonra nasıl eklenir: Ticari olmayan lisans ve 0,39 mm ızgara + 1,17 GB ağırlık: hem gömülemez hem cihaz için çok ağır.
- Denetlenen kaynaklar: TotalSegmentator GitHub deposu (README görev ve lisans listesi); totalsegmentator/map_tasks_config.py (görev → veri kümesi kimliği → ağırlık sürümü, makine okunur); totalsegmentator/map_to_binary.py (sınıf listeleri, lisanslı görevler); GitHub sürümleri (releases/download, boyut denetimi)
- Eski kayıt: "Beyin anevrizması (TOF)" — CC BY-NC lisansı; 0,39 mm ızgara cihazda çok ağır.

### MONAI — tüm vücut BT bölütleme (SegResNet, 104 yapı)

- Kimlik: `monai-wholebody-ct` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı)) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/wholeBody_ct_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/wholebody_ct_segmentation/versions/0.2.5/files/wholeBody_ct_segmentation_v0.2.5.zip · sürüm: wholeBody_ct_segmentation v0.2.5 · özet: sha1:d3be077219fea4ac9630efddd81c19e0676bf206
- Girdi → çıktı: BT, 1,5 mm (yüksek) / 3 mm (düşük çözünürlük modeli) → 105 kanal etiket
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri TotalSegmentator (CC BY 4.0) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.2.5); ağırlık NVIDIA CDN üzerinde (large_files.yml). Gömülü TotalSegmentator anatomi modeliyle aynı görev; yeni yetenek eklemez.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com
- Eski kayıt: "MONAI Model Zoo (dalak, pankreas tümörü, beyin tümörü, prostat …)" — Ağırlıklar Hugging Face / NGC üzerinde; bu derleme ortamında erişim kuruluş politikasıyla kapalı.

### MONAI — dalak BT bölütleme (UNet)

- Kimlik: `monai-spleen-ct` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/spleen_ct_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/spleen_ct_segmentation/versions/0.5.9/files/spleen_ct_segmentation_v0.5.9.zip · sürüm: spleen_ct_segmentation v0.5.9 · özet: sha1:8e99230050906d0d3cec484010598aa138201892
- Girdi → çıktı: BT 96³ karo → dalak maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri MSD (CC BY-SA 4.0) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.5.9); ağırlık NVIDIA CDN üzerinde (large_files.yml). Dalak zaten TotalSegmentator anatomi modelinde var.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — karın çoklu organ (Swin UNETR, BTCV)

- Kimlik: `monai-btcv-swin-unetr` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/swin_unetr_btcv_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/swin_unetr_btcv_segmentation/versions/0.5.6/files/swin_unetr_btcv_segmentation_v0.5.6.zip · sürüm: swin_unetr_btcv_segmentation v0.5.6 · özet: sha1:3b99a1e0cc2af3dd67349e4bb083ef5063b24d4f
- Girdi → çıktı: BT 96³ → 14 kanal
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri BTCV (Synapse kullanım koşulları) — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.5.6); ağırlık NVIDIA CDN üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — karın çoklu organ (Aichi)

- Kimlik: `monai-multi-organ` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/multi_organ_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/multi_organ_segmentation/versions/0.0.4/files/multi_organ_segmentation_v0.0.4.zip · sürüm: multi_organ_segmentation v0.0.4 · özet: sha1:97ac0df0cbb547fde7a72b10559bf54bd80f3578
- Girdi → çıktı: BT 96³ → 8 kanal
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Özel kullanım, ticari olmayan, tersine mühendislik yasak (paket LICENSE) — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.0.4); ağırlık NVIDIA CDN üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — pankreas ve pankreas tümörü (DiNTS)

- Kimlik: `monai-pancreas-dints` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/pancreas_ct_dints_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/pancreas_ct_dints_segmentation/versions/0.5.0/files/pancreas_ct_dints_segmentation_v0.5.0.zip · sürüm: pancreas_ct_dints_segmentation v0.5.0 · özet: sha1:d90618836201646bf7d74dd3ca47263f743d2d8a
- Girdi → çıktı: BT 96³ → pankreas, tümör
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri MSD Task07 (CC BY-SA 4.0) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.5.0); ağırlık NVIDIA CDN üzerinde (large_files.yml). Lezyon modeli: karaciğer lezyonu deneyimi nedeniyle gerçek vakada uzman etiketiyle doğrulanmadan eklenmez.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — böbrek iç yapıları (korteks, medulla, pelvis; UNesT)

- Kimlik: `monai-renal-unest` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/renalStructures_UNEST_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/renalstructures_unest_segmentation/versions/0.2.5/files/renalStructures_UNEST_segmentation_v0.2.5.zip · sürüm: renalStructures_UNEST_segmentation v0.2.5 · özet: sha1:4dc403a437df87c713f596c33c05cf29888d3fc3
- Girdi → çıktı: BT 96³ → 4 kanal
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri lisansı paket belgesinde yok — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.2.5); ağırlık NVIDIA CDN üzerinde (large_files.yml). Böbreğin İçine gir dünyasında korteks/medulla için kişisel karşılık sağlayabilir.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — kontrastlı BT böbrek yapıları (AVUCTK)

- Kimlik: `monai-renal-cect` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/renalStructures_CECT_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/renalstructures_cect_segmentation/versions/0.2.1/files/renalStructures_CECT_segmentation_v0.2.1.zip · sürüm: renalStructures_CECT_segmentation v0.2.1 · özet: sha1:5638f591903c1e1dce1558435f7a7f6f0c5318ae
- Girdi → çıktı: BT (3 faz) 96³ → 6 kanal
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri CC BY-NC-SA 4.0 — ticari ✗ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.2.1); ağırlık NVIDIA CDN üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — beyin tümörü alt bölgeleri (BraTS 2018, SegResNet)

- Kimlik: `monai-brats` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/brats_mri_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/brats_mri_segmentation/versions/0.5.2/files/brats_mri_segmentation_v0.5.2.zip · sürüm: brats_mri_segmentation v0.5.2 · özet: sha1:6b1dfef29d49c6f6a1d8bf9f65c84125ad37a6e9
- Girdi → çıktı: 4 sekans (T1, T1c, T2, FLAIR) eş kayıtlı → TC, WT, ET
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri BraTS (yalnızca araştırma, atıfla) — ticari ✗ · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.5.2); ağırlık NVIDIA CDN üzerinde (large_files.yml). Ayrıca 4 sekansın eş kaydını (registration) gerektirir; uygulama tek seri işler.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — tüm beyin 133 yapı (T1 MR, UNesT)

- Kimlik: `monai-wholebrain-unest` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/wholeBrainSeg_Large_UNEST_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/wholebrainseg_large_unest_segmentation/versions/0.2.5/files/wholeBrainSeg_Large_UNEST_segmentation_v0.2.5.zip · sürüm: wholeBrainSeg_Large_UNEST_segmentation v0.2.5 · özet: sha1:7213e4261cc8322d035a900a67ed3b4478d4c0db
- Girdi → çıktı: T1 MR (MNI uzayına kayıtlı) 96³ → 133 yapı
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri lisansı paket belgesinde yok — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.2.5); ağırlık NVIDIA CDN üzerinde (large_files.yml). Girdinin MNI şablonuna afin kaydı gerekir (uygulamada yok).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — prostat MR anatomi (periferik zon, santral bez)

- Kimlik: `monai-prostate-mri` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/prostate_mri_anatomy
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/prostate_mri_anatomy/versions/0.3.4/files/prostate_mri_anatomy_v0.3.4.zip · sürüm: prostate_mri_anatomy v0.3.4 · özet: sha1:7ecfbacab9f03edde606479301c78b74c0eda1f4
- Girdi → çıktı: T2 MR 96³ → 3 kanal
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri Prostate158 (CC BY 4.0) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.3.4); ağırlık NVIDIA CDN üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — kalp MR kısa eksen: sol/sağ ventrikül ve miyokard

- Kimlik: `monai-ventricular-sax` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/ventricular_short_axis_3label
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/ventricular_short_axis_3label/versions/0.3.3/files/ventricular_short_axis_3label_v0.3.3.zip · sürüm: ventricular_short_axis_3label v0.3.3 · özet: sha1:b0949b4084c7828a6fdc3d3bae518408e0f28de1
- Girdi → çıktı: 2B kısa eksen kesit 256² → LV kavite, miyokard, RV
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: MIT (paket) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.3.3); ağırlık Google Drive üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (drive.google.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: drive.google.com, huggingface.co, api.ngc.nvidia.com

### MONAI — akciğer nodülü tespiti (RetinaNet, LUNA16)

- Kimlik: `monai-lung-nodule-detection` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/lung_nodule_ct_detection
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/lung_nodule_ct_detection/versions/0.6.8/files/lung_nodule_ct_detection_v0.6.8.zip · sürüm: lung_nodule_ct_detection v0.6.8 · özet: sha1:1abae7a9379861c477f7b189e0171cfcd71370b0
- Girdi → çıktı: BT 0,7 × 0,7 × 1,25 mm → 3B kutu + skor
- Yetenek: sınıflandırma ✗ · tespit ✓ · bölütleme ✗ · konum: box · 3D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri LUNA16/LIDC-IDRI (CC BY 3.0/4.0) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.6.8); ağırlık NVIDIA CDN üzerinde (large_files.yml). Gerçek 3B kutu verir (sınıflandırma değil); TotalSegmentator lung_nodules için daha hafif bir alternatif olabilir.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — tam slaytta metastaz tespiti (Camelyon16, ResNet18)

- Kimlik: `monai-pathology-tumor` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/pathology_tumor_detection
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/pathology_tumor_detection/versions/0.6.2/files/pathology_tumor_detection_v0.6.2.zip · sürüm: pathology_tumor_detection v0.6.2 · özet: sha1:24352fe6210711b74a11eb70ca25ed7efefc7d31
- Girdi → çıktı: 224 × 224 RGB yama → yama başına tümör olasılığı (ısı haritası)
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri Camelyon16 (CC0) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.6.2); ağırlık NVIDIA CDN üzerinde (large_files.yml). Yama sınıflandırıcıdır; ısı haritası yalnızca yamaların konumundan gelir. Uygulama tam slayt (WSI) okumuyor.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — HoVer-Net çekirdek bölütleme + sınıflandırma (CoNSeP)

- Kimlik: `monai-hovernet-consep` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/pathology_nuclei_segmentation_classification
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/pathology_nuclei_segmentation_classification/versions/0.2.6/files/pathology_nuclei_segmentation_classification_v0.2.6.zip · sürüm: pathology_nuclei_segmentation_classification v0.2.6 · özet: sha1:88d3d7dd37ffb0d7221017c13636b98a6d8b5185
- Girdi → çıktı: 256 × 256 H&E yama → çekirdek örnek maskesi + tür (164² merkez)
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri CoNSeP (paket üçüncü taraf lisansları) — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.2.6); ağırlık NVIDIA CDN üzerinde (large_files.yml). Orijinal HoVer-Net (PanNuke) ağırlıklarının aksine paket lisansı Apache-2.0; patoloji zinciri (doku → çekirdek → hücre türü) için en uygun aday.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — çekirdek sınıflandırma (CoNSeP, DenseNet)

- Kimlik: `monai-nuclei-classification` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/pathology_nuclei_classification
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/pathology_nuclei_classification/versions/0.2.0/files/pathology_nuclei_classification_v0.2.0.zip · sürüm: pathology_nuclei_classification v0.2.0 · özet: sha1:f8dd21b3711fa5705a0796704a0a477257b98da1
- Girdi → çıktı: 128 × 128 yama + çekirdek maskesi → 4 sınıf olasılığı
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri CoNSeP — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.2.0); ağırlık NVIDIA CDN üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — mamografi meme yoğunluğu (BI-RADS A–D)

- Kimlik: `monai-breast-density` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı)) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/breast_density_classification
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/breast_density_classification/versions/0.1.6/files/breast_density_classification_v0.1.6.zip · sürüm: breast_density_classification v0.1.6 · özet: sha1:bfaff74dbd6fdbe7326e6dbe53dd874253524f8d
- Girdi → çıktı: 299 × 299 RGB → 4 sınıf olasılığı (konum YOK)
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); eğitim verisi Mayo Clinic (özel, paylaşılmıyor) — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.1.6); ağırlık Google Drive üzerinde (large_files.yml). Yoğunluk sınıflandırıcıdır: kitle/kalsifikasyon için konum vermez ve vermiş gibi gösterilmez.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (drive.google.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: drive.google.com, huggingface.co, api.ngc.nvidia.com
- Eski kayıt: "Kitle, kalsifikasyon, yoğunluk" — Yeniden dağıtılabilir lisanslı ve doğrulanabilir ağırlık bulunamadı.

### MONAI — endoskopide cerrahi alet bölütleme

- Kimlik: `monai-endoscopic-tool` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/endoscopic_tool_segmentation
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/endoscopic_tool_segmentation/versions/0.6.0/files/endoscopic_tool_segmentation_v0.6.0.zip · sürüm: endoscopic_tool_segmentation v0.6.0 · özet: sha1:17da026fdcfb4ed36d7fbb5928ade9977adcc589
- Girdi → çıktı: 736 × 480 RGB → alet maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri Activ Surgical (özel) — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.6.0); ağırlık NVIDIA CDN üzerinde (large_files.yml). Hastaya ait bulgu üretmez (cerrahi aleti bulur); kişisel harita için düşük öncelik.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — endoskopi karesi vücut içi/dışı

- Kimlik: `monai-endoscopic-inbody` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/endoscopic_inbody_classification
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/endoscopic_inbody_classification/versions/0.4.9/files/endoscopic_inbody_classification_v0.4.9.zip · sürüm: endoscopic_inbody_classification v0.4.9 · özet: sha1:4347522da06d8bc0e5c8c34b92ac1448fba86f29
- Girdi → çıktı: 256 × 256 RGB → 2 sınıf
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 (paket); veri Activ Surgical (özel) — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.4.9); ağırlık NVIDIA CDN üzerinde (large_files.yml). Kalite ön denetimi olarak yararlı (vücut dışı kareyi elemek).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — OCT retiküler psödodrusen örnek bölütleme

- Kimlik: `monai-oct-rpd` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/retinalOCT_RPD_segmentation
- Ağırlık: huggingface.co/MONAI/retinalOCT_RPD_segmentation/tree/0.0.1 · sürüm: retinalOCT_RPD_segmentation v0.0.1 · özet: —
- Girdi → çıktı: OCT B-tarama 496 × 1024 → RPD örnek maskeleri
- Yetenek: sınıflandırma ✗ · tespit ✓ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: BSD-2-Clause (paket) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.0.1); ağırlık NVIDIA CDN üzerinde (large_files.yml). Katalogda yalnızca Hugging Face sürümü var (özet yok).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — kalp MR uzun eksen kapak noktaları (KCL)

- Kimlik: `monai-valve-landmarks` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/valve_landmarks
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/valve_landmarks/versions/0.5.0/files/valve_landmarks_v0.5.0.zip · sürüm: valve_landmarks v0.5.0 · özet: sha1:8d708d9da5a8fd263d3e6f98c9a8412324893373
- Girdi → çıktı: 2B uzun eksen 256² → 10 nokta (kapak giriş noktaları)
- Yetenek: sınıflandırma ✗ · tespit ✓ · bölütleme ✗ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: MIT (paket) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.5.0); ağırlık NVIDIA CDN üzerinde (large_files.yml). Ağırlık KCL-BMEIS/bundle-data deposunda da var ve bu ortamdan indirilebiliyor (raw.githubusercontent.com, 13,3 MB); kalp MR fikstürü olmadan doğrulanmadı.
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MONAI — VISTA3D (BT, 127 sınıf + etkileşimli)

- Kimlik: `monai-vista3d` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/Project-MONAI/model-zoo/tree/dev/models/vista3d
- Ağırlık: api.ngc.nvidia.com/v2/models/nvidia/monaihosting/vista3d/versions/0.5.7/files/vista3d_v0.5.7.zip · sürüm: vista3d v0.5.7 · özet: sha1:f534e27e952c4f6ffafc2d912b5b1c867e75d585
- Girdi → çıktı: BT 128³ → etiket hacmi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (MONAI bundle; TorchScript .ts da yayımlanıyor); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Kod Apache-2.0; AĞIRLIKLAR NVIDIA lisansı: yalnızca ticari olmayan (araştırma/değerlendirme) kullanım — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: MONAI kataloğunda sürümlü paket ve özet var (v0.5.7); ağırlık NVIDIA CDN üzerinde (large_files.yml).
- Neden / sonra nasıl eklenir: Ağırlık bu derleme ortamından indirilemedi (developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com engelli); indirilip SHA ve resmi çıktıyla doğrulanmadan uygulamaya alınmaz. Sonra: ağı açık bir makinede paketi indir → TorchScript/ONNX'e çevir → aynı girdide MONAI çıktısıyla karşılaştır → "Model kur" paketi.
- Denetlenen kaynaklar: MONAI Model Zoo models/model_info.json (sürüm, kaynak, özet); paketin configs/metadata.json (görev, girdi/çıktı, veri kaynağı); paketin LICENSE ve docs/data_license.txt; paketin large_files.yml (ağırlık adresi); Hugging Face MONAI kuruluşu; NVIDIA NGC monaihosting · erişilemeyen: developer.download.nvidia.com, huggingface.co, api.ngc.nvidia.com

### MedSAM / LiteMedSAM — kutu istemli genel tıbbi bölütleme

- Kimlik: `medsam` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı)) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/bowang-lab/MedSAM
- Ağırlık: — · sürüm: MedSAM (ViT-B), LiteMedSAM (TinyViT) · özet: —
- Girdi → çıktı: 2B görüntü + kullanıcının çizdiği kutu → kutunun içindeki yapının maskesi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: prompt · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: MedSAM ~360 MB ağırlık; LiteMedSAM ~40 MB
- Lisans: Apache-2.0 (kod ve ağırlık) — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: LICENSE Apache-2.0 (raw.githubusercontent.com'dan okundu); ağırlıklar Google Drive / Hugging Face bağlantılarında.
- Neden / sonra nasıl eklenir: Ağırlık bu ortamdan indirilemedi. Ayrıca bulgu bulmaz: yapıyı kullanıcının kutusu belirler — görüntüleyicide "kutu çiz → maske" aracı olarak eklenebilir (konum kullanıcıdan gelir, model uydurmaz).
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE); Google Drive bağlantıları; Hugging Face (wanglab) · erişilemeyen: drive.google.com, huggingface.co
- Eski kayıt: "Genel bölütleme (MedSAM, SAM-Med3D)" — İstem gerektiren etkileşimli modeller; ağırlıklar Hugging Face / Google Drive üzerinde, erişilemedi.

### MedSAM2 — 3B/video istemli bölütleme

- Kimlik: `medsam2` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/bowang-lab/MedSAM2
- Ağırlık: — · sürüm: MedSAM2 (SAM2.1 tabanlı) · özet: —
- Girdi → çıktı: 3B hacim / video + istem → kesitler boyunca yayılan maske
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: prompt · video · kişisel 3B ✓
- Çalışma ortamı: PyTorch; ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Apache-2.0 — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ✓ · atıf ✓
- Kanıt: LICENSE Apache-2.0 okundu; ağırlıklar Hugging Face'te.
- Neden / sonra nasıl eklenir: Hugging Face bu ortamdan erişilemiyor; ayrıca bellek/bellek-dikkat modülü ONNX'e doğrudan çevrilemiyor (özel dışa aktarma gerekir).
- Denetlenen kaynaklar: GitHub deposu; Hugging Face (wanglab/MedSAM2) · erişilemeyen: huggingface.co

### SAM-Med3D / SAM-Med3D-Turbo — 3B nokta istemli bölütleme

- Kimlik: `sam-med3d` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı))
- Resmi depo: github.com/uni-medical/SAM-Med3D
- Ağırlık: — · sürüm: SAM-Med3D-Turbo · özet: —
- Girdi → çıktı: 128³ hacim + nokta istemi → 3B maske
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: prompt · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ~400 MB ağırlık
- Lisans: Apache-2.0 — ticari ✓ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: LICENSE Apache-2.0 okundu; ağırlıklar Hugging Face / Google Drive'da.
- Neden / sonra nasıl eklenir: Ağırlık bu ortamdan indirilemedi; istem (nokta) arayüzü kişisel 3B görüntüleyicisine eklenince değerlendirilebilir.
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE); Hugging Face (blueyo0); Google Drive · erişilemeyen: huggingface.co, drive.google.com

### TorchXRayVision — CheXpert / MIMIC-CXR / "all" sınıflandırıcıları

- Kimlik: `xrv-chex-mimic` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/mlmed/torchxrayvision
- Ağırlık: github.com/mlmed/torchxrayvision/releases/download/v1/ · sürüm: densenet121-res224-chex / -mimic_ch / -mimic_nb / -all · özet: —
- Girdi → çıktı: 224 × 224 gri → 18 bulgu olasılığı (konum YOK)
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch → ONNX (NIH modeliyle aynı dönüştürücü); ONNX ✓ · ORT Web ✗ · web ✓ · Android ✓ · CPU ✓ · GPU ✗ · bellek: ~150 MB
- Lisans: Kod/ağırlık Apache-2.0; eğitim verisi CheXpert (Stanford araştırma kullanım sözleşmesi) ve MIMIC-CXR (PhysioNet kimlikli erişim) yeniden dağıtıma izin vermiyor — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: Ağırlıklar GitHub sürümlerinden bu ortamdan indirilebiliyor (NIH modeliyle aynı sürüm).
- Neden / sonra nasıl eklenir: Eğitim verisinin kullanım koşulları nedeniyle uygulamaya gömülmez; NIH modeli (kısıtlamasız veri) kullanılır.
- Denetlenen kaynaklar: TorchXRayVision deposu ve sürümleri; CheXpert kullanım sözleşmesi; MIMIC-CXR (PhysioNet) erişim koşulları
- Eski kayıt: "CheXpert / MIMIC eğitimli sınıflandırıcılar" — Eğitim verilerinin kullanım koşulları yeniden dağıtıma izin vermiyor.
- Alternatif: `xrv-densenet121-nih`

### Röntgende kırık tespiti (açık ağırlıklı model)

- Kimlik: `xray-fracture` · durum **UNAVAILABLE** (Ağırlık bulunamadı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: —
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: Kemik röntgeni → kutu
- Yetenek: sınıflandırma ✗ · tespit ✓ · bölütleme ✗ · konum: box · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: — — ticari ? · araştırma ✗ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✗
- Kanıt: MONAI kataloğunda ve TotalSegmentator'da kırık modeli yok; makale depolarının çoğu yalnızca eğitim kodu veriyor.
- Neden / sonra nasıl eklenir: Lisansı açık, sürümlü ve doğrulanabilir ağırlıkla yayımlanmış bir kırık modeli bulunamadı (FracAtlas tabanlı çalışmalar ağırlık yayımlamıyor ya da ağırlık lisanssız).
- Denetlenen kaynaklar: MONAI Model Zoo kataloğu; TotalSegmentator görev listesi; GitHub arama (fracture detection weights); FracAtlas veri kümesi sayfası; Hugging Face (erişilemedi) · erişilemeyen: huggingface.co
- Eski kayıt: "Kırık tespiti" — Lisansı açık ve ağırlığı erişilebilir bir kırık modeli bulunamadı.

### EchoNet-Dynamic — sol ventrikül bölütleme (DeepLabV3) ve EF (R(2+1)D)

- Kimlik: `echonet-dynamic` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/echonet/dynamic
- Ağırlık: github.com/echonet/dynamic/releases/download/v1.0.0/deeplabv3_resnet50_random.pt (317.4 MB) · sürüm: v1.0.0 (deeplabv3_resnet50_random.pt, r2plus1d_18_32_2_pretrained.pt) · özet: sha256:b32ea45b8200e11298ff4021166ff8d187204fb0c27a937bcdb4c518ffcbe1ed
- Girdi → çıktı: Apikal 4 boşluk EKO videosu, 112 × 112 kareler → LV maskesi (kare başına) ve EF (%)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: pixel · video · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: DeepLabV3-ResNet50 ~160 MB; R(2+1)D ~125 MB
- Lisans: Yazarların telif hakkı: yazılı izin olmadan yeniden dağıtım ve kullanım yasak (LICENSE.txt) — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: İki ağırlık GitHub sürümünden indirildi (SHA-256 kaydedildi; R(2+1)D: dd8f8ef7…339f). DeepLabV3 LV modeli yükleme uyarısız (eksik/fazla anahtar 0, eğitim 30. dönem) PyTorch → ONNX (opset 17) çevrildi; aynı 4 rastgele 112 × 112 girdide en büyük logit farkı 1,4e-4, maske uyumu %100. Teknik olarak uygulamanın 2B bölütleme hattına uygun (konum: piksel maskesi).
- Neden / sonra nasıl eklenir: Lisans yeniden dağıtıma izin vermiyor: uygulamaya gömülmez ve paket olarak dağıtılmaz. Doğrulama için açık bir EKO videosu da bu ortamda yok (EchoNet veri kümesi sözleşmeyle veriliyor).
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE.txt); GitHub sürümleri v1.0.0 (iki ağırlık indirildi); EchoNet-Dynamic veri kümesi sayfası (sözleşmeli); CAMUS veri kümesi (kayıt gerektiriyor)
- Eski kayıt: "Organ, kist, akım, EF, odacık bölütleme" — Ağırlıklar ya araştırma lisanslı ya da erişilemeyen sunucularda; video modelleri için doğrulama verisi yok.

### HoVer-Net (özgün) — PanNuke / CoNSeP / MoNuSAC ağırlıkları

- Kimlik: `hovernet-pannuke` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/vqdang/hover_net
- Ağırlık: — · sürüm: hovernet_fast_pannuke_type_tf2pytorch · özet: —
- Girdi → çıktı: 256 × 256 H&E yama (fast: 256 → 164) → çekirdek örnek maskesi + 6 tür
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✓ · konum: pixel · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ~150 MB
- Lisans: Kod MIT; PanNuke ağırlıkları CC BY-NC-SA 4.0 (veri lisansından) — ticari ✗ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: LICENSE (MIT) okundu; ağırlıklar Google Drive / TIAToolbox sunucusunda.
- Neden / sonra nasıl eklenir: PanNuke ağırlıkları ticari olmayan lisanslı; ayrıca Google Drive ve TIAToolbox sunucusu bu ortamdan erişilemedi. Apache-2.0 lisanslı alternatif: MONAI HoVer-Net (CoNSeP).
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE); Google Drive bağlantıları; TIAToolbox model sunucusu; hovernet_inference deposu (lisans notu) · erişilemeyen: drive.google.com, tiatoolbox.dcs.warwick.ac.uk
- Eski kayıt: "Doku, çekirdek, hücre sınıflandırma; temel modeller" — UNI/UNI2, CONCH, Virchow kapılı ve ticari olmayan; PLIP ve HoVer-Net ağırlıkları erişilemedi.
- Alternatif: `monai-hovernet-consep`

### UNI / UNI2 (MahmoodLab) — patoloji temel modeli

- Kimlik: `uni` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/mahmoodlab/UNI
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: 224 × 224 H&E yama → öznitelik vektörü (görev başlığı yok)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ViT-L/H: 1–2,5 GB
- Lisans: CC BY-NC-ND 4.0, kapılı Hugging Face erişimi (kurum e-postası ile onay) — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: Lisans dosyası / model kartı okundu.
- Neden / sonra nasıl eklenir: Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir).
- Denetlenen kaynaklar: Resmi depo / model kartı; Hugging Face (kapılı; bu ortamdan erişilemedi); Makale (Nature Medicine / ilgili yayın) · erişilemeyen: huggingface.co

### CONCH (MahmoodLab) — patoloji görüntü-metin temel modeli

- Kimlik: `conch` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/mahmoodlab/CONCH
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: 224 × 224 H&E yama → öznitelik vektörü (görev başlığı yok)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ViT-L/H: 1–2,5 GB
- Lisans: CC BY-NC-ND 4.0, kapılı Hugging Face erişimi — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: Lisans dosyası / model kartı okundu.
- Neden / sonra nasıl eklenir: Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir).
- Denetlenen kaynaklar: Resmi depo / model kartı; Hugging Face (kapılı; bu ortamdan erişilemedi); Makale (Nature Medicine / ilgili yayın) · erişilemeyen: huggingface.co

### Virchow / Virchow2 (Paige) — patoloji temel modeli

- Kimlik: `virchow` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: huggingface.co/paige-ai/Virchow2
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: 224 × 224 H&E yama → öznitelik vektörü (görev başlığı yok)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ViT-L/H: 1–2,5 GB
- Lisans: CC BY-NC-ND 4.0, kapılı Hugging Face erişimi — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: Lisans dosyası / model kartı okundu.
- Neden / sonra nasıl eklenir: Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir).
- Denetlenen kaynaklar: Resmi depo / model kartı; Hugging Face (kapılı; bu ortamdan erişilemedi); Makale (Nature Medicine / ilgili yayın) · erişilemeyen: huggingface.co

### PLIP — patoloji dil-görüntü modeli (CLIP)

- Kimlik: `plip` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı)
- Resmi depo: github.com/PathologyFoundation/plip
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: 224 × 224 H&E yama → öznitelik vektörü (görev başlığı yok)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ViT-L/H: 1–2,5 GB
- Lisans: Yalnızca araştırma amaçlı (Twitter verisinden eğitildi; model kartındaki kullanım koşulları) — ticari ✗ · araştırma ✓ · yeniden dağıtım ✗ · ağırlık dağıtımı ✗ · atıf ✓
- Kanıt: Lisans dosyası / model kartı okundu.
- Neden / sonra nasıl eklenir: Ticari olmayan ve türev/yeniden dağıtım kısıtlı lisans; ayrıca tek başına bulgu üretmez (öznitelik çıkarıcıdır, üstüne eğitilmiş görev başlığı gerekir).
- Denetlenen kaynaklar: Resmi depo / model kartı; Hugging Face (kapılı; bu ortamdan erişilemedi); Makale (Nature Medicine / ilgili yayın) · erişilemeyen: huggingface.co

### OpenMedLab koleksiyonu (STU-Net, MedLSAM, PULSE …)

- Kimlik: `openmedlab` · durum **PARTIALLY_AVAILABLE** (Kısmen erişilebilir) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/openmedlab
- Ağırlık: — · sürüm: çeşitli · özet: —
- Girdi → çıktı: modele göre → modele göre
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch; ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: Depoya göre değişiyor (Apache-2.0 … yalnızca araştırma) — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: Koleksiyondaki depoların bir kısmı ağırlığı Hugging Face / Google Drive / Baidu'da yayımlıyor; bazıları yalnızca kod.
- Neden / sonra nasıl eklenir: Tek bir model değil; her depo ayrı denetlenmeli. Ağırlık bağlantıları bu ortamdan erişilemedi. STU-Net (nnU-Net tabanlı) TotalSegmentator ile aynı dönüştürücüye uygun ilk aday.
- Denetlenen kaynaklar: GitHub kuruluş sayfası; STU-Net deposu; Hugging Face; Google Drive / Baidu bağlantıları · erişilemeyen: huggingface.co, drive.google.com
- Eski kayıt: "OpenMedLab model koleksiyonu (çeşitli bölütleme/sınıflandırma)" — Ağırlıklar Hugging Face / Google Drive / Baidu bağlantılarında; erişilemedi.

### RETFound — retina (fundus/OCT) temel modeli

- Kimlik: `retfound` · durum **RESEARCH_ONLY** (Yalnızca araştırma lisansı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/rmaphoh/RETFound_MAE
- Ağırlık: — · sürüm: RETFound_mae_natureCFP / natureOCT · özet: —
- Girdi → çıktı: 224 × 224 RGB → öznitelik vektörü (görev için ince ayar gerekir)
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ViT-L ~1,2 GB
- Lisans: CC BY-NC 4.0 (LICENSE okundu); ağırlıklar kapılı Hugging Face — ticari ✗ · araştırma ✓ · yeniden dağıtım ✓ · ağırlık dağıtımı ? · atıf ✓
- Kanıt: LICENSE dosyası (CC BY-NC 4.0) raw.githubusercontent.com'dan okundu.
- Neden / sonra nasıl eklenir: Ticari olmayan lisans ve tek başına tanı/konum üretmez; bir görev başlığıyla ince ayar gerekir.
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE); Hugging Face (kapılı); Nature 2023 makalesi · erişilemeyen: huggingface.co
- Eski kayıt: "Damar, optik disk, diyabetik retinopati, retina katmanları" — RETFound ticari olmayan lisanslı ve kapılı; diğerleri yalnızca makale kodu ya da erişilemeyen bağlantılarda.

### ECG-FM — EKG temel modeli (wav2vec 2.0 tarzı)

- Kimlik: `ecg-fm` · durum **AVAILABLE** (Ağırlık mevcut (henüz doğrulanmadı)) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: github.com/bowang-lab/ECG-FM
- Ağırlık: huggingface.co/wanglab/ecg-fm · sürüm: mimic_iv_ecg_pretrained / mimic_iv_ecg_finetuned · özet: —
- Girdi → çıktı: Ham 12 derivasyon EKG sinyali (sayısal) → Çok etiketli tanı skorları (ince ayarlı model)
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 1D · kişisel 3B ✗
- Çalışma ortamı: PyTorch (fairseq-signals); ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ~90 M parametre
- Lisans: Kod MIT (LICENSE okundu); ağırlık lisansı model sayfasında belirtilmemiş — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: Depo ağırlıkların Hugging Face'te yayımlandığını belirtiyor (wanglab/ecg-fm).
- Neden / sonra nasıl eklenir: Hugging Face bu ortamdan erişilemiyor ve ağırlık lisansı belirsiz. Ayrıca uygulamaya EKG kâğıt fotoğrafı geliyor: modelin istediği sayısal 12 derivasyon sinyali için önce güvenilir sayısallaştırma gerekir (şu an yalnızca RR/kalp hızı ölçülüyor).
- Denetlenen kaynaklar: GitHub deposu (README, LICENSE); Hugging Face wanglab/ecg-fm (erişilemedi); HuBERT-ECG (CC BY-NC 4.0); ECGFounder (lisans/ağırlık bulunamadı) · erişilemeyen: huggingface.co
- Eski kayıt: "Ritim, aralıklar, morfoloji" — Kâğıt EKG fotoğrafı için doğrulanmış açık model yok.

### PET/BT lezyon bölütleme (autoPET modelleri)

- Kimlik: `pet-lesion` · durum **UNAVAILABLE** (Ağırlık bulunamadı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: autopet.grand-challenge.org
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: SUV hacmi + BT → lezyon maskesi, metabolik tümör hacmi
- Yetenek: sınıflandırma ✗ · tespit ✗ · bölütleme ✓ · konum: voxel · 3D · kişisel 3B ✓
- Çalışma ortamı: PyTorch (nnU-Net v2); ONNX ✓ · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: — — ticari ? · araştırma ✓ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✓
- Kanıt: MONAI kataloğunda PET modeli yok; TotalSegmentator'da PET görevi yok.
- Neden / sonra nasıl eklenir: Bu araştırmada sürümlü, lisansı açık ve bu ortamdan indirilebilir PET ağırlığı bulunamadı (yarışma takımlarının ağırlıkları Zenodo/Drive'da ve erişilemedi). Ayrıca SUV hesabı için DICOM radyofarmasötik alanları okunmalı.
- Denetlenen kaynaklar: MONAI Model Zoo kataloğu; TotalSegmentator görev listesi; autoPET yarışma sayfası ve takım depoları; Zenodo (erişilemedi) · erişilemeyen: zenodo.org, drive.google.com
- Eski kayıt: "Lezyon, SUV, kemik yoğunluğu" — Açık ve yeniden dağıtılabilir ağırlık bulunamadı; SUV için radyofarmasötik bilgisi gerekir.

### DEXA kemik yoğunluğu / vücut kompozisyonu

- Kimlik: `dexa` · durum **UNAVAILABLE** (Ağırlık bulunamadı)
- Resmi depo: —
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: DEXA görüntüsü / raporu → —
- Yetenek: sınıflandırma ✓ · tespit ✗ · bölütleme ✗ · konum: none · 2D · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: — — ticari ? · araştırma ✗ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✗
- Kanıt: Uygulama rapordaki T-skoru / Z-skoru değerlerini okur (model değil).
- Neden / sonra nasıl eklenir: Açık ağırlıklı, doğrulanabilir bir DEXA modeli bulunamadı; DEXA ölçümleri cihazın kendi yazılımında üretilir ve rapordan okunması daha güvenilirdir.
- Denetlenen kaynaklar: MONAI Model Zoo kataloğu; TotalSegmentator görev listesi; GitHub arama; Hugging Face (erişilemedi) · erişilemeyen: huggingface.co

### Koroner anjiyografi damar / darlık modelleri

- Kimlik: `angio` · durum **UNAVAILABLE** (Ağırlık bulunamadı) · RECHECKED (önceki: UNAVAILABLE)
- Resmi depo: —
- Ağırlık: — · sürüm: — · özet: —
- Girdi → çıktı: XA (anjiyografi) dizisi → damar maskesi / darlık kutusu
- Yetenek: sınıflandırma ✗ · tespit ✓ · bölütleme ✓ · konum: pixel · video · kişisel 3B ✗
- Çalışma ortamı: PyTorch; ONNX ? · ORT Web ✗ · web ✗ · Android ✗ · CPU ✓ · GPU ✓ · bellek: ölçülmedi
- Lisans: — — ticari ? · araştırma ✗ · yeniden dağıtım ? · ağırlık dağıtımı ? · atıf ✗
- Kanıt: BT koroner arter modeli (TotalSegmentator coronary_arteries) lisanslı; XA anjiyografi için katalogda model yok.
- Neden / sonra nasıl eklenir: Lisansı açık ve ağırlığı yayımlanmış bir XA anjiyografi modeli bulunamadı (ARCADE/CADICA çalışmaları ağırlık yayımlamıyor ya da erişilemeyen bağlantılarda).
- Denetlenen kaynaklar: MONAI Model Zoo kataloğu; TotalSegmentator lisanslı görevler; ARCADE yarışma sayfası; GitHub arama
- Eski kayıt: "Damar ağacı, darlık, cihaz takibi" — Açık lisanslı, doğrulanabilir ağırlıklı model bulunamadı.
