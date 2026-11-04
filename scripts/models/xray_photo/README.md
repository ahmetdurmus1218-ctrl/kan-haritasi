# Röntgen modeli — telefon fotoğrafı ve ekran görüntüsü ölçümü

Uygulamaya gömülü TorchXRayVision NIH sınıflandırıcısının (14 bulgu) fotoğraf ve ekran görüntüsündeki davranışını
ölçer ve uygulamadaki "röntgen alanı" ön işlemesini (packages/analysis/src/xrayRegion.ts) doğrular.

```bash
pip install numpy scipy pandas pillow onnxruntime
export KH_XRAY_WORK=/disk/xray        # etiketli görüntüler (~1,4 GB; yalnızca ölçüm için, depoya konmaz)
python fetch_data.py                  # ieee8023/covid-chestxray-dataset + Actualmed (GitHub): pnömoni ↔ bulgusuz
python xray_eval.py 440               # 145 bulgusuz + 295 pnömoni; 4 koşul × 3 ön işleme (ham skorlar)
python xray_report.py                 # uygulamadaki kalibre skorlarla özet → work/xray_report.json
python make_fixtures.py               # fixtures/imaging/rontgen-foto (NIH örneğinden benzetimler + beklenen değerler)
```

Koşullar: orijinal dosya · görüntüleyici / e-Nabız ekran görüntüsü · ekranın telefonla fotoğrafı (eğik, moiré,
parlama, siyah seviyesi, bulanıklık, JPEG) · negatoskoptaki filmin fotoğrafı. Özet `photo_metrics.json`'a yazılır;
`scripts/models/build_models.py` bunu modelin manifestine (`photoMetrics`) koyar ve uygulama gösterir.
TypeScript ↔ Python eşdeğerliği: `apps/web/src/__tests__/xrayPhoto.test.ts`.
