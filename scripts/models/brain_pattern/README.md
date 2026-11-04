# Beyin MR örüntü modeli — veri, eğitim, doğrulama, dışa aktarma

Uygulamaya gömülü `kh-brain-mri-pattern` modelini sıfırdan yeniden üretir. Tüm veri açık lisanslıdır ve
herkese açık kovalardan (Imaging Data Commons S3, OpenNeuro S3) indirilir.

```bash
pip install torch onnx onnxruntime numpy scipy nibabel pydicom highdicom idc-index pillow scikit-image pandas pyarrow
export KH_BRAIN_WORK=/büyük/disk/brain   # veri (~0,9 GB kesit), geçici indirmeler (~20 GB akış hâlinde silinir)

# 1. Kesit veri kümesi (hasta bazlı train/val/test bölmesi denek kimliğinin özetinden)
python build_brain_dataset.py upenn 300     # glioblastom (UPENN-GBM, CC BY 4.0) + uzman/AI tümör SEG
python build_brain_dataset.py vs 242        # vestibüler schwannom (Vestibular-Schwannoma-SEG, CC BY 4.0) + RTSTRUCT
python build_brain_dataset.py arc 230       # kronik inme (ARC ds004884, CC0) + lezyon maskesi
python build_brain_dataset.py ccnrp 204     # kronik odak lezyon (ds007212, CC0) + maske
python build_brain_dataset.py fcdhc 85      # sağlıklı kontroller (ds004199, CC0)
python build_brain_dataset.py mshc 8        # sağlıklı kontroller (ds007908, CC0)
python build_brain_dataset.py lemon 170     # sağlıklı gönüllüler (MPI-LEMON ds000221, CC0)

# 2. Eğitim (CPU'da ~1,5 saat; fotoğraf benzetimli artırma, sınıf dengeli örnekleme)
EPOCHS=16 python train_brain.py
#   kesilirse: RESUME=work/brain_model/best.pt EPOCHS=6 python train_brain.py

# 3. Eğitim dışı kapısı: "beyin MR kesiti değil" örnekleri (gerçek röntgen/BT/beyin dışı MR, IDC; sentetik
#    belge/ekran, çizim, doku) ve dondurulmuş omurganın öznitelikleri üzerinde küçük MLP
for k in xray headct bodyct bodymr drawing synthetic; do python build_negatives.py $k; done
python train_gate.py

# 4. Kalibrasyon (sağlıklı referans uzaklığı, eğitim dışı eşikleri), hasta bazlı test, ONNX (logits, mask, ref, ood, gate)
python export_brain.py

# 5. Uygulamaya göm (bulgu eşiği, kapı başarımı ve test metrikleri manifeste yazılır) + doğrulama fikstürleri
#    (fixtures/imaging/beyin-mr-gercek)
python make_app_model.py
```

Ön işleme uygulamadakiyle (packages/analysis/src/patternModel.ts) birebir aynıdır; `make_app_model.py`
Python eşini kullanır ve `apps/web/src/__tests__/brainPattern.test.ts` iki uygulamanın aynı çıktıyı verdiğini denetler.
