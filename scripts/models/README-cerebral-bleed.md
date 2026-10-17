# Beyin içi kanama modeli (TotalSegmentator `cerebral_bleed`) — doğrulama

Model `build_models.py --only cerebral-bleed` ile resmi ağırlıktan (Dataset150, SHA-256 doğrulanır) üretilir:
nnU-Net → ONNX (opset 17; PyTorch ile aynı rastgele girdide argmax uyumu %100), float16 saklama, TopK(2).

Doğrulama verisi: **CQ500** (qure.ai, 3 radyoloğun okuması ile; CC BY-NC-SA 4.0). Lisansı nedeniyle depoya
**konmaz**; ölçüm yerelde yapılır:

```bash
# 1) Seri indir (ör. CQ500-CT-80; okumalar: reads.csv) ve aç
curl -O https://s3.ap-south-1.amazonaws.com/qure.headct.study/CQ500-CT-80.zip && unzip CQ500-CT-80.zip
# 2) JPEG 2000 → sıkıştırmasız (uygulama JPEG Lossless'u kendisi çözer, JPEG 2000'i henüz çözmez)
python scripts/models/dicom_decompress.py "<seri klasörü>" headct/cq80
# 3) Resmi TotalSegmentator: gantri eğimli seri önce eksene hizalı NIfTI'ye (eğik afinle) çevrilir
python scripts/models/dicom_to_nifti_tilt.py headct/cq80 cq80.shear.nii.gz cq80.nii.gz
TotalSegmentator -i cq80.nii.gz -o cq80_bleed -ta cerebral_bleed --device cpu
# 4) Resmi maskeyi DICOM ızgarasına (dosya adı sırası) taşı
python scripts/models/reference_to_dicom_grid.py headct/cq80 cq80_bleed/intracerebral_hemorrhage.nii.gz headct/cq80.reference.json
# 5) Uygulamanın kendi hattı (TypeScript + ONNX Runtime): DICOM → BT anatomi → beyin kutusu → kanama modeli
KH_HEAD_CT_DIR=headct pnpm vitest run apps/web/src/__tests__/realModelsHeadCT.test.ts
```

`validate_cascade_bleed.py` aynı basamaklı hattın Python eşleniğidir (reference_pipeline.py ile).

Ölçülen sonuçlar `packages/analysis/src/modelRegistry/records.ts` içindeki `totalseg-ct-cerebral-bleed` kaydında ve
`docs/MODEL_RESEARCH.md`'de yazılıdır.
