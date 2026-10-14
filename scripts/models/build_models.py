"""Gerçek, açık lisanslı tıbbi görüntü modellerini uygulama için hazırlar (tekrar üretilebilir).

Her model için: kaynak ağırlık dosyası sabit URL'den indirilir ve SHA-256 ile doğrulanır → ONNX'e çevrilir
(PyTorch ile çıktı karşılaştırması) → ağırlıklar dosyada float16 saklanır (hesap float32) → manifest yazılır
(lisans, kaynak, sürüm, SHA-256, giriş/çıkış, sınırlar, doğrulama sonuçları).

  python scripts/models/build_models.py <çalışma_klasörü> [--bundle apps/web/public/ai-models] [--packs <klasör>]

Gerekenler: torch, dynamic_network_architectures, torchxrayvision, onnx, onnxruntime, nibabel, scipy.
Ağ erişimi YALNIZCA bu derleme betiğinde (geliştirici makinesi / CI) gerekir; uygulama hiçbir zaman ağa çıkmaz.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from totalseg_labels import label_info  # noqa: E402

TS_URL = "https://github.com/wasserth/TotalSegmentator/releases/download"
XRV_URL = "https://github.com/mlmed/torchxrayvision/releases/download/v1"

TS_CITATION = "Wasserthal J. et al. TotalSegmentator: Robust Segmentation of 104 Anatomic Structures in CT Images. Radiology: AI 2023; D'Antonoli T.A. et al. TotalSegmentator MRI. Radiology 2025."
XRV_CITATION = "Cohen J.P. et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022."

# Ölçülen doğrulama (bu betikteki dönüşümle, resmi TotalSegmentator `--fast` çıktısına karşı; scripts/models/reference_pipeline.py)
TS_CT_VALIDATION = "Resmi TotalSegmentator --fast çıktısıyla karşılaştırma (aynı ağırlıklar): örnek BT (1 karo) ortalama Dice 1,000; 9 karolu birleştirilmiş BT ortalama Dice 0,999 (en düşük yapı 0,981), voksel uyumu %99,97."
TS_MR_VALIDATION = "Resmi TotalSegmentator --fast (total_mr) çıktısıyla karşılaştırma (aynı ağırlıklar): örnek MR ortalama Dice 1,000, voksel uyumu %99,98."
XRV_VALIDATION = "Kütüphanenin kendi çıktısıyla karşılaştırma (çalışma noktası normalizasyonu dahil): en büyük mutlak fark 3,4e-5; float16 saklama farkı ≤ 3,4e-4."

MODELS = {
    "totalseg-ct": {
        "zip": f"{TS_URL}/v2.0.0-weights/Dataset297_TotalSegmentator_total_3mm_1559subj.zip",
        "zip_sha256": "0baa2c8de2975600eb31801dd5c1825cd2b356f794498659cf3348714c073394",
        "folder": "Dataset297_TotalSegmentator_total_3mm_1559subj",
        "manifest": {
            "id": "totalseg-ct-total-3mm",
            "name": "TotalSegmentator — BT anatomi (117 yapı)",
            "version": "2.0.0-weights · Dataset297 (3 mm, fast)",
            "modalities": ["CT"],
            "license": "Apache-2.0 (TotalSegmentator kodu ve 'total' görevinin ağırlıkları; eğitim verisi CC BY 4.0)",
            "source": "https://github.com/wasserth/TotalSegmentator",
            "intendedUse": "BT serisinde organ, kemik, damar ve kasların otomatik bölütlenmesi (3 mm). Tanı aracı değildir.",
            "citation": TS_CITATION,
            "validation": TS_CT_VALIDATION,
            "compatibleDevice": "Masaüstü tarayıcı ya da ≥ 6 GB RAM'li telefon; karo başına ~40–50 sn (tek çekirdek WASM), bellek ~1,5–2 GB.",
            "limitations": [
                "3 mm çözünürlükte çalışır (TotalSegmentator --fast); küçük yapılar (ör. böbreküstü bezleri) kaba bölütlenir.",
                "Bölütleme normal anatomiyi gösterir; bir organın bölütlenmesi o organın sağlıklı olduğu anlamına gelmez.",
                "Böbrek kisti sınıfı 'total' görevinin parçasıdır; ayrı ve daha doğru 'kidney_cysts' modeli değildir.",
                "Kayan pencere birleştirmesi bellek için her karonun en yüksek 4 sınıfıyla yapılır (resmi çıktıyla uyum: doğrulama alanı).",
                "Klinik kullanım için onaylı tıbbi cihaz değildir.",
            ],
        },
    },
    "totalseg-mr": {
        "zip": f"{TS_URL}/v2.5.0-weights/Dataset852_TotalSegMRI_total_3mm_1088subj.zip",
        "zip_sha256": "6d0d0691e5b09c9faf3a70198ce0d0ccbb8ee1271a72af8f9452565c8df6461b",
        "folder": "Dataset852_TotalSegMRI_total_3mm_1088subj",
        "manifest": {
            "id": "totalseg-mr-total-3mm",
            "name": "TotalSegmentator MRI — MR anatomi (50 yapı)",
            "version": "2.5.0-weights · Dataset852 (3 mm, fast)",
            "modalities": ["MRI"],
            "license": "Apache-2.0 (TotalSegmentator kodu ve 'total_mr' görevinin ağırlıkları)",
            "source": "https://github.com/wasserth/TotalSegmentator",
            "intendedUse": "MR serisinde (sekanstan bağımsız) organ, kemik, damar ve kasların bölütlenmesi (3 mm). Tanı aracı değildir.",
            "citation": TS_CITATION,
            "validation": TS_MR_VALIDATION,
            "compatibleDevice": "Masaüstü tarayıcı ya da ≥ 6 GB RAM'li telefon; karo başına ~30 sn (tek çekirdek WASM).",
            "limitations": [
                "3 mm çözünürlükte çalışır; küçük yapılar kaba bölütlenir.",
                "Beyin içi yapıları ayırmaz (beyin tek yapı).",
                "Bölütleme normal anatomiyi gösterir; patoloji tespiti yapmaz.",
                "Klinik kullanım için onaylı tıbbi cihaz değildir.",
            ],
        },
    },
}

# Patoloji (basamaklı) modelleri: TotalSegmentator'ın açık lisanslı ayrı görevleri. Uygulamada önce BT anatomi modeli
# çalışır; onun ilgili yapılarının kutusu + pay ile özgün seri kırpılır, model yalnızca orada 1,5 mm'de çalışır.
# Doğrulama metinleri ölçüm sonuçlarından (--validation JSON) gelir; ölçülmediyse "ölçülmedi" yazar.
TS_KIDNEY_VALIDATION = "{kidney_real}"
TS_EFFUSION_VALIDATION = "{effusion_real}"
PATHOLOGY = {
    "kidney-cysts": {
        "zip": f"{TS_URL}/v2.5.0-weights/Dataset789_kidney_cyst_501subj.zip",
        "zip_sha256": "fd528187b1526135894ac03e15861ae4de9b39ed317fbfce06ab9066e9817425",
        "folder": "Dataset789_kidney_cyst_501subj",
        "labels": {1: ("kidney_cyst_left", "Sol böbrekte kist (patoloji modeli)", "kidneys", "kidneys", "finding"), 2: ("kidney_cyst_right", "Sağ böbrekte kist (patoloji modeli)", "kidneys", "kidneys", "finding"), 3: ("kidney_left_aux", "Sol böbrek (yardımcı sınıf)", "kidneys", "kidneys", "anatomy"), 4: ("kidney_right_aux", "Sağ böbrek (yardımcı sınıf)", "kidneys", "kidneys", "anatomy")},
        "drop": [3, 4],
        # ~6 mm çaplı kist ≈ 0,1 mL; daha küçüğü 1,5 mm ızgarada güvenilir değil
        "thresholds": {1: {"minMl": 0.1}, 2: {"minMl": 0.1}},
        "cascade": {"model": "totalseg-ct-total-3mm", "labels": ["kidney_left", "kidney_right", "liver", "spleen", "colon"], "addonMm": 10},
        "manifest": {
            "id": "totalseg-ct-kidney-cysts",
            "name": "TotalSegmentator — böbrek kisti (BT patoloji)",
            "version": "2.5.0-weights · Dataset789 (1,5 mm)",
            "modalities": ["CT"],
            "license": "Apache-2.0 (TotalSegmentator 'kidney_cysts' görevi; açık görevler listesinde)",
            "source": "https://github.com/wasserth/TotalSegmentator",
            "intendedUse": "BT serisinde böbrek kistlerinin bölütlenmesi (sol/sağ). Önce BT anatomi modeli çalışır; böbrek, karaciğer, dalak ve kalın bağırsak çevresi kırpılır. Tanı aracı değildir.",
            "validation_key": "kidney",
            "compatibleDevice": "Masaüstü tarayıcı ya da ≥ 8 GB RAM'li telefon; 1,5 mm ızgarada karo başına ~60–90 sn (tek çekirdek WASM), tipik BT'de 4–12 karo.",
            "limitations": [
                "Yalnızca kisti bölütler; kistin türünü (basit/karmaşık, Bosniak) ayırmaz, solid kitleyi tanımaz.",
                "Çok küçük kistler (birkaç mm) 1,5 mm ızgarada kaçabilir; bulunmaması kist olmadığını kesinleştirmez.",
                "Önce BT anatomi modeli çalışmalıdır; böbrekler bölütlenemediyse model çalıştırılmaz.",
                "Klinik kullanım için onaylı tıbbi cihaz değildir.",
            ],
        },
    },
    "effusion": {
        "zip": f"{TS_URL}/v2.0.0-weights/Dataset315_thoraxCT.zip",
        "zip_sha256": "974fd151df6b6755e86b34e3c7a9a11dfcee7351393f09d8621278c0aa2a5a75",
        "folder": "Dataset315_thoraxCT",
        "labels": {1: ("lung_pleural", "Akciğer (yardımcı sınıf)", "lungs", "lungs", "anatomy"), 2: ("pleural_effusion", "Plevral efüzyon — akciğer zarı arasında sıvı (patoloji modeli)", "lungs", "lungs", "finding"), 3: ("pericardial_effusion", "Perikardiyal efüzyon — kalp zarında sıvı (patoloji modeli)", "heart", "heart", "finding")},
        "drop": [1],
        # 1 mL altı: ızgara/yeniden örnekleme kaynaklı küçük alanlar (gerçek göğüs BT'sinde resmi çıktıda olmayan 0,26 mL gibi)
        "thresholds": {2: {"minMl": 1.0}, 3: {"minMl": 1.0, "normalMaxMl": 50, "normalNote": "kalp zarı yaprakları arasında normalde 15–50 mL kaydırıcı sıvı bulunur"}},
        "cascade": {"model": "totalseg-ct-total-3mm", "labels": ["lung_upper_lobe_left", "lung_lower_lobe_left", "lung_upper_lobe_right", "lung_middle_lobe_right", "lung_lower_lobe_right"], "addonMm": 50},
        "manifest": {
            "id": "totalseg-ct-effusion",
            "name": "TotalSegmentator — plevral ve perikardiyal efüzyon (BT patoloji)",
            "version": "2.0.0-weights · Dataset315 (1,5 mm)",
            "modalities": ["CT"],
            "license": "Apache-2.0 (TotalSegmentator 'pleural_pericard_effusion' görevi; açık görevler listesinde)",
            "source": "https://github.com/wasserth/TotalSegmentator",
            "intendedUse": "Göğüs BT'sinde akciğer zarları arasındaki (plevral) ve kalp zarındaki (perikardiyal) sıvının bölütlenmesi. Önce BT anatomi modeli çalışır; akciğerler + 5 cm çevresi kırpılır. Tanı aracı değildir.",
            "validation_key": "effusion",
            "compatibleDevice": "Masaüstü tarayıcı ya da ≥ 8 GB RAM'li telefon; 1,5 mm ızgarada karo başına ~45–60 sn (tek çekirdek WASM), tam göğüs BT'sinde 12–20 karo (10–20 dk).",
            "limitations": [
                "Sıvının türünü (transüda/eksüda/kan) ayırmaz; yalnızca hacmini ve yerini verir.",
                "Akciğerlerin yalnızca bir kısmını içeren kesitlerde (ör. üst batın BT'sinin akciğer tabanları) sonuç güvenilir değildir.",
                "Önce BT anatomi modeli çalışmalıdır; akciğerler bölütlenemediyse model çalıştırılmaz.",
                "Klinik kullanım için onaylı tıbbi cihaz değildir.",
            ],
        },
    },
}

TS_LIVER_LESION_VALIDATION = "{liver_lesions_real}"
TS_LIVER_SEGMENTS_VALIDATION = "{liver_segments_real}"
PATHOLOGY["liver-lesions"] = {
    "zip": f"{TS_URL}/v2.5.0-weights/Dataset591_ct_liver_lesions_842subj.zip",
    "zip_sha256": "b3bdd53de65dc64a46264edfdeb491b18e8f95973a691eeccfa530d1da1678a0",
    "folder": "Dataset591_ct_liver_lesions_842subj",
    "labels": {1: ("liver_lesion", "Karaciğerde lezyon (patoloji modeli)", "liver", "liver", "finding")},
    "drop": [],
    "topk": 2,
    # ~5 mm çaplı odak ≈ 0,07 mL; daha küçüğü bu ızgarada güvenilir değil
    "thresholds": {1: {"minMl": 0.1}},
    "cascade": {"model": "totalseg-ct-total-3mm", "labels": ["liver"], "addonMm": 10},
    "manifest": {
        "id": "totalseg-ct-liver-lesions",
        "name": "TotalSegmentator — karaciğer lezyonu (BT patoloji)",
        "version": "2.5.0-weights · Dataset591 (0,75 × 0,75 × 1 mm)",
        "modalities": ["CT"],
        "license": "Apache-2.0 (TotalSegmentator 'liver_lesions' görevi; açık görevler listesinde)",
        "source": "https://github.com/wasserth/TotalSegmentator",
        "intendedUse": "BT serisinde karaciğer içindeki odak lezyonların (kist, tümör, metastaz ayrımı yapmadan) bölütlenmesi. Önce BT anatomi modeli çalışır; karaciğer + 1 cm kırpılır. Tanı aracı değildir.",
        "validation_key": "liver_lesions",
        "compatibleDevice": "Masaüstü tarayıcı; 0,75 mm ızgarada karo başına ~60–120 sn (tek çekirdek WASM), tipik karaciğerde 8–20 karo (10–40 dk). Telefonda önerilmez.",
        "limitations": [
            "Lezyonun türünü (kist, hemanjiyom, tümör, metastaz) AYIRMAZ; yalnızca karaciğer dokusundan farklı odakları bölütler.",
            "Kontrastsız ya da kalın kesitli BT'de küçük lezyonlar kaçabilir; bulunmaması lezyon olmadığını kesinleştirmez.",
            "Önce BT anatomi modeli çalışmalıdır; karaciğer bölütlenemediyse model çalıştırılmaz.",
            "Klinik kullanım için onaylı tıbbi cihaz değildir.",
        ],
    },
}
PATHOLOGY["liver-segments"] = {
    "zip": f"{TS_URL}/v2.5.0-weights/Dataset570_ct_liver_segments.zip",
    "zip_sha256": "76f3bf368cbae7756729bf2971cb1b25a1ee8993a18495f2d563d5edfead8aac",
    "folder": "Dataset570_ct_liver_segments",
    "labels": {i: (f"liver_segment_{i}", f"Karaciğer segment {r}", "liver", f"liver.segment-{i}", "anatomy") for i, r in zip(range(1, 9), ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"])},
    "parts": {1: "caudate", 2: "left-lobe", 3: "left-lobe", 4: "left-lobe", 5: "right-lobe", 6: "right-lobe", 7: "right-lobe", 8: "right-lobe"},
    "drop": [],
    "topk": 4,
    "thresholds": {},
    "cascade": {"model": "totalseg-ct-total-3mm", "labels": ["liver"], "addonMm": 10},
    "manifest": {
        "id": "totalseg-ct-liver-segments",
        "name": "TotalSegmentator — karaciğer segmentleri (Couinaud I–VIII)",
        "version": "2.5.0-weights · Dataset570 (0,8 × 0,8 × 1,5 mm)",
        "modalities": ["CT"],
        "license": "Apache-2.0 (TotalSegmentator 'liver_segments' görevi; açık görevler listesinde)",
        "source": "https://github.com/wasserth/TotalSegmentator",
        "intendedUse": "BT serisinde karaciğerin 8 Couinaud segmentine ayrılması (ayrıntılı anatomi; bir lezyonun hangi segmentte olduğunu göstermek için). Bulgu değildir.",
        "validation_key": "liver_segments",
        "compatibleDevice": "Masaüstü tarayıcı; karo başına ~60–120 sn, tipik karaciğerde 4–12 karo.",
        "limitations": [
            "Normal anatomi bölütlemesidir; hastalık tespiti yapmaz.",
            "Segment sınırları damar dallanmasına göre tanımlıdır ve kişiden kişiye değişir; model yaklaşık sınır çizer.",
            "Klinik kullanım için onaylı tıbbi cihaz değildir.",
        ],
    },
}

XRV_CLS_TARGETS_TR = {
    "Atelectasis": ("Atelektazi (akciğer sönmesi) bulgusu", "lungs"),
    "Consolidation": ("Konsolidasyon bulgusu", "lungs"),
    "Infiltration": ("İnfiltrasyon bulgusu", "lungs"),
    "Pneumothorax": ("Pnömotoraks bulgusu", "lungs"),
    "Edema": ("Ödem bulgusu", "lungs"),
    "Emphysema": ("Amfizem bulgusu", "lungs"),
    "Fibrosis": ("Fibrozis bulgusu", "lungs"),
    "Effusion": ("Plevral efüzyon (sıvı) bulgusu", "lungs"),
    "Pneumonia": ("Pnömoni bulgusu", "lungs"),
    "Pleural_Thickening": ("Plevral kalınlaşma bulgusu", "lungs"),
    "Cardiomegaly": ("Kalp gölgesinde büyüme (kardiyomegali) bulgusu", "heart"),
    "Nodule": ("Nodül bulgusu", "lungs"),
    "Mass": ("Kitle bulgusu", "lungs"),
    "Hernia": ("Herni (fıtık) bulgusu", "diaphragm"),
}

XRV_SEG_TARGETS_TR = [
    ("Left Clavicle", "Sol köprücük kemiği", "bones", "shoulder-l", "bones"),
    ("Right Clavicle", "Sağ köprücük kemiği", "bones", "shoulder-r", "bones"),
    ("Left Scapula", "Sol kürek kemiği", "bones", "shoulder-l", "bones"),
    ("Right Scapula", "Sağ kürek kemiği", "bones", "shoulder-r", "bones"),
    ("Left Lung", "Sol akciğer", "lungs", None, "lungs"),
    ("Right Lung", "Sağ akciğer", "lungs", None, "lungs"),
    ("Left Hilus Pulmonis", "Sol akciğer kökü (hilus)", "lungs", None, "lungs"),
    ("Right Hilus Pulmonis", "Sağ akciğer kökü (hilus)", "lungs", None, "lungs"),
    ("Heart", "Kalp gölgesi", "heart", None, "heart"),
    ("Aorta", "Aort", "aorta", None, None),
    ("Facies Diaphragmatica", "Diyafram yüzü", "diaphragm", None, None),
    ("Mediastinum", "Mediasten", "heart", None, None),
    ("Weasand", "Nefes borusu (trakea)", "airways", None, None),
    ("Spine", "Omurga", "bones", "spine", "bones"),
]


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dst: Path, expect: str | None) -> Path:
    if not dst.exists():
        print(f"indiriliyor: {url}")
        with urllib.request.urlopen(url) as r, open(dst, "wb") as f:
            shutil.copyfileobj(r, f)
    got = sha256(dst)
    if expect and got != expect:
        raise SystemExit(f"SHA-256 uyuşmuyor: {dst.name} {got} ≠ {expect}")
    return dst


def run(*args: str) -> str:
    out = subprocess.run([sys.executable, *args], check=True, capture_output=True, text=True).stdout
    return out


def write_model(out_dir: Path, onnx_path: Path, manifest: dict, notice: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    dst = out_dir / "model.onnx"
    shutil.copyfile(onnx_path, dst)
    manifest = {**manifest, "file": "model.onnx", "sha256": sha256(dst), "size": dst.stat().st_size}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    (out_dir / "NOTICE.txt").write_text(notice)
    print(f"yazıldı: {out_dir} ({dst.stat().st_size / 1e6:.1f} MB)")


def build_totalseg(work: Path, key: str, out_dir: Path) -> None:
    spec = MODELS[key]
    z = download(spec["zip"], work / (spec["folder"] + ".zip"), spec["zip_sha256"])
    unpack = work / spec["folder"]
    if not unpack.exists():
        with zipfile.ZipFile(z) as f:
            f.extractall(unpack)
    trained = next((unpack / spec["folder"]).glob("*__3d_fullres"))
    plans = json.loads((trained / "plans.json").read_text())
    ds = json.loads((trained / "dataset.json").read_text())
    fp = json.loads((trained / "dataset_fingerprint.json").read_text())["foreground_intensity_properties_per_channel"]["0"]
    cfg = plans["configurations"]["3d_fullres"]
    raw = work / f"{key}.fp32.onnx"
    fp16 = work / f"{key}.fp16.onnx"
    topk = work / f"{key}.onnx"
    print(run(str(HERE / "export_nnunet_onnx.py"), str(trained), str(raw)).strip())
    run(str(HERE / "fp16_storage.py"), str(raw), str(fp16))
    run(str(HERE / "add_topk.py"), str(fp16), str(topk), "4")
    ct = cfg["normalization_schemes"][0] == "CTNormalization"
    labels = [{"id": v, **label_info(k), "kind": "finding" if k.startswith("kidney_cyst") else "anatomy"} for k, v in ds["labels"].items() if v]
    manifest = {
        "schema": "kh-model-manifest/2",
        **spec["manifest"],
        "task": "segmentation-3d",
        "format": "onnx",
        "input": {"name": "input", "layout": "NCDHW", "channels": 1, "width": cfg["patch_size"][2], "height": cfg["patch_size"][1], "scale": 1, "mean": [0], "std": [1]},
        "output": {"topkValues": "topk_values", "topkIndices": "topk_indices"},
        "volume": {
            "spacing": cfg["spacing"][0],
            "patch": cfg["patch_size"],
            "axisOrder": "SAR",
            "normalization": {"scheme": "ct", "clip": [fp["percentile_00_5"], fp["percentile_99_5"]], "mean": fp["mean"], "std": fp["std"]} if ct else {"scheme": "zscore"},
            "tileStep": 0.8,
            "topK": 4,
            "cropNonzero": True,
            "minSlices": 10,
        },
        "labels": labels,
        "scoreThreshold": 0.5,
        "upstream": {"weights": spec["zip"], "weightsSha256": spec["zip_sha256"]},
    }
    notice = (
        f"{manifest['name']}\nKaynak: {manifest['source']}\nAğırlıklar: {spec['zip']} (SHA-256 {spec['zip_sha256']})\n"
        f"Lisans: {manifest['license']}\nAtıf: {TS_CITATION}\nDeğişiklik: PyTorch → ONNX (opset 17), ağırlıklar float16 saklanır, çıktıya TopK(4) eklendi.\n"
    )
    write_model(out_dir, topk, manifest, notice)


def build_pathology(work: Path, key: str, out_dir: Path, validation: dict) -> None:
    spec = PATHOLOGY[key]
    z = download(spec["zip"], work / (spec["folder"] + ".zip"), spec["zip_sha256"])
    unpack = work / spec["folder"]
    if not unpack.exists():
        with zipfile.ZipFile(z) as f:
            f.extractall(unpack)
    trained = next((unpack / spec["folder"]).glob("*__3d_fullres*"))
    plans = json.loads((trained / "plans.json").read_text())
    ds = json.loads((trained / "dataset.json").read_text())
    fp = json.loads((trained / "dataset_fingerprint.json").read_text())["foreground_intensity_properties_per_channel"]["0"]
    conf = trained.name.split("__")[-1]
    cfg = plans["configurations"][conf]
    if "inherits_from" in cfg:
        cfg = {**plans["configurations"][cfg["inherits_from"]], **cfg}
    # nnU-Net aralığı [S, A, R]; manifest [R, A, S] ya da izotropikse tek sayı
    sp_sar = [round(float(x), 6) for x in cfg["spacing"]]
    spacing = sp_sar[0] if len(set(sp_sar)) == 1 else [sp_sar[2], sp_sar[1], sp_sar[0]]
    if sorted(int(v) for v in ds["labels"].values() if v) != sorted(spec["labels"]):
        raise SystemExit(f"{key}: etiketler beklenenle uyuşmuyor: {ds['labels']}")
    raw, fp16, topk = work / f"{key}.fp32.onnx", work / f"{key}.fp16.onnx", work / f"{key}.onnx"
    print(run(str(HERE / "export_nnunet_onnx.py"), str(trained), str(raw)).strip())
    run(str(HERE / "fp16_storage.py"), str(raw), str(fp16))
    k = spec.get("topk", 4)
    run(str(HERE / "add_topk.py"), str(fp16), str(topk), str(k))
    labels = [{"id": i, "key": key, "finding": tr, "structure": st, **({"part": spec["parts"][i]} if spec.get("parts") else {}), "node": nd, "kind": kind, **spec.get("thresholds", {}).get(i, {})} for i, (key, tr, st, nd, kind) in spec["labels"].items()]
    m = dict(spec["manifest"])
    vkey = m.pop("validation_key")
    m["validation"] = {"kidney": TS_KIDNEY_VALIDATION, "effusion": TS_EFFUSION_VALIDATION, "liver_lesions": TS_LIVER_LESION_VALIDATION, "liver_segments": TS_LIVER_SEGMENTS_VALIDATION}[vkey].format(**validation)
    manifest = {
        "schema": "kh-model-manifest/2",
        **m,
        "task": "segmentation-3d",
        "format": "onnx",
        "citation": TS_CITATION,
        "input": {"name": "input", "layout": "NCDHW", "channels": 1, "width": cfg["patch_size"][2], "height": cfg["patch_size"][1], "scale": 1, "mean": [0], "std": [1]},
        "output": {"topkValues": "topk_values", "topkIndices": "topk_indices"},
        "volume": {
            "spacing": spacing,
            "patch": cfg["patch_size"],
            "axisOrder": "SAR",
            "normalization": {"scheme": "ct", "clip": [fp["percentile_00_5"], fp["percentile_99_5"]], "mean": fp["mean"], "std": fp["std"]},
            # Patoloji/basamaklı modellerde resmi TotalSegmentator ile aynı karo adımı (0,5). 0,8 ile karaciğer lezyonu
            # modelinde büyük tümör kaçtı (resmi 9,8 mL ↔ 1,7 mL): hız uğruna doğruluk bozulmaz.
            "tileStep": 0.5,
            "topK": k,
            "cropNonzero": True,
            "minSlices": 10,
            "cascade": spec["cascade"],
            "dropLabels": spec["drop"],
        },
        "labels": labels,
        "scoreThreshold": 0.5,
        "upstream": {"weights": spec["zip"], "weightsSha256": spec["zip_sha256"]},
    }
    notice = (
        f"{manifest['name']}\nKaynak: {manifest['source']}\nAğırlıklar: {spec['zip']} (SHA-256 {spec['zip_sha256']})\n"
        f"Lisans: {manifest['license']}\nAtıf: {TS_CITATION}\nDeğişiklik: PyTorch → ONNX (opset 17), ağırlıklar float16 saklanır, çıktıya TopK({k}) eklendi.\n"
    )
    write_model(out_dir, topk, manifest, notice)


def build_xrv(work: Path, sample: Path, cls_dir: Path | None, seg_dir: Path | None) -> None:
    wdir = work / "xrv"
    wdir.mkdir(exist_ok=True)
    download(f"{XRV_URL}/nih-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt", wdir / "nih-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt", "31a5475c6b1383a7edbfcaf96af9ce302eb9969cfe28b6b8b5859afc6f274fdf")
    download(f"{XRV_URL}/pspnet_chestxray_best_model_4.pth", wdir / "pspnet_chestxray_best_model_4.pth", "019b167eac6b729fc1bb92bbbc185fc1730aaa65819f4e3fe718186cadc044fc")
    lines = [json.loads(l) for l in run(str(HERE / "export_xrv_onnx.py"), str(wdir), str(work), str(sample)).splitlines() if l.startswith("{")]
    cls_info = lines[0]
    if cls_dir:
        run(str(HERE / "fp16_storage.py"), str(work / "xrv-densenet121-nih.onnx"), str(work / "xrv-cls.fp16.onnx"))
        labels = [{"id": i, "key": t, "finding": XRV_CLS_TARGETS_TR[t][0], "structure": XRV_CLS_TARGETS_TR[t][1], "kind": "finding"} for i, t in enumerate(cls_info["targets"])]
        manifest = {
            "schema": "kh-model-manifest/2",
            "id": "xrv-densenet121-nih",
            "name": "TorchXRayVision — göğüs röntgeni sınıflandırıcı (NIH, 14 bulgu)",
            "version": "densenet121-res224-nih (v1)",
            "modalities": ["XRAY"],
            "task": "multilabel",
            "format": "onnx",
            "license": "Apache-2.0 (TorchXRayVision kodu ve ağırlıkları); eğitim verisi NIH ChestX-ray14 (kısıtlamasız kullanım, NIH Clinical Center'a atıfla)",
            "source": "https://github.com/mlmed/torchxrayvision",
            "intendedUse": "Ön-arka/arka-ön göğüs röntgeninde 14 bulgu için olasılık skoru (görüntü düzeyinde; konum vermez). Tanı aracı değildir.",
            "citation": XRV_CITATION + " Wang X. et al. ChestX-ray8, CVPR 2017 (NIH Clinical Center).",
            "validation": XRV_VALIDATION,
            "compatibleDevice": "Tüm cihazlar (~1–3 sn).",
            "input": {"name": "input", "layout": "NCHW", "channels": 1, "width": 224, "height": 224, "scale": 1, "mean": [127.5], "std": [0.12451171875], "crop": "center-square", "antialias": True},
            "output": {"probs": "probs"},
            "calibration": {"kind": "xrv-op-norm", "thresholds": cls_info["op_threshs"]},
            "labels": labels,
            "scoreThreshold": 0.6,
            "limitations": [
                "Görüntü düzeyinde sınıflandırmadır: bulgunun görüntüdeki yerini VERMEZ; konum yalnızca ilgili organ/bölge olarak gösterilir.",
                "Skorlar modelin çalışma noktasına göre ölçeklenir (0,5 ≈ çalışma noktası); uygulama ≥ 0,6'yı 'modelin işaret ettiği' diye gösterir, bu bir tanı eşiği değildir.",
                "Yalnızca NIH ChestX-ray14 ile eğitildi; farklı cihaz/ülke/hasta grubunda başarımı düşebilir. Yan (lateral) grafilerde kullanılmamalı.",
                "Klinik kullanım için onaylı tıbbi cihaz değildir.",
            ],
            "upstream": {"weights": f"{XRV_URL}/nih-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt", "weightsSha256": "31a5475c6b1383a7edbfcaf96af9ce302eb9969cfe28b6b8b5859afc6f274fdf"},
        }
        notice = f"{manifest['name']}\nKaynak: {manifest['source']}\nLisans: {manifest['license']}\nAtıf: {manifest['citation']}\nDeğişiklik: PyTorch → ONNX; sigmoid çıktısı (çalışma noktası normalizasyonu uygulamada aynı formülle), ağırlıklar float16 saklanır.\n"
        write_model(cls_dir, work / "xrv-cls.fp16.onnx", manifest, notice)
    if seg_dir:
        run(str(HERE / "fp16_storage.py"), str(work / "xrv-pspnet-chestxdet.onnx"), str(work / "xrv-seg.fp16.onnx"))
        labels = [{"id": i, "key": k, "finding": tr, "structure": st, **({"part": pt} if pt else {}), **({"node": nd} if nd else {}), "kind": "anatomy"} for i, (k, tr, st, pt, nd) in enumerate(XRV_SEG_TARGETS_TR)]
        manifest = {
            "schema": "kh-model-manifest/2",
            "id": "xrv-pspnet-chestxdet",
            "name": "ChestX-Det PSPNet — göğüs röntgeni anatomi (14 yapı)",
            "version": "pspnet_chestxray_best_model_4",
            "modalities": ["XRAY"],
            "task": "segmentation",
            "format": "onnx",
            "license": "Apache-2.0 (ChestX-Det veri kümesi ve önceden eğitilmiş PSPNet, Deepwise AI Lab; TorchXRayVision aynası)",
            "source": "https://github.com/Deepwise-AILab/ChestX-Det-Dataset",
            "intendedUse": "Göğüs röntgeninde akciğer, kalp, aort, köprücük, kürek kemiği, diyafram, mediasten, trakea ve omurga bölütlemesi. Tanı aracı değildir.",
            "citation": "Lian J. et al. A Structure-Aware Relation Network for Thoracic Diseases Detection and Segmentation. IEEE TMI 2021. " + XRV_CITATION,
            "validation": "Kütüphanenin kendi çıktısıyla karşılaştırma: maske uyumu %100, en büyük fark 1,4e-6 (float32); float16 saklama ayrıca karşılaştırılır.",
            "compatibleDevice": "Masaüstü tarayıcı ya da ≥ 8 GB RAM'li telefon (ResNet-101 omurga, 512×512); ~10–30 sn.",
            "input": {"name": "input", "layout": "NCHW", "channels": 1, "width": 512, "height": 512, "scale": 1, "mean": [127.5], "std": [0.12451171875], "crop": "center-square", "antialias": True},
            "output": {"mask": "masks"},
            "labels": labels,
            "scoreThreshold": 0.5,
            "limitations": [
                "Anatomik yapı bölütlemesidir; hastalık tespiti yapmaz.",
                "Ön-arka/arka-ön göğüs grafisi içindir; yan grafide ve çocuk grafilerinde başarımı bilinmiyor.",
                "Klinik kullanım için onaylı tıbbi cihaz değildir.",
            ],
            "upstream": {"weights": f"{XRV_URL}/pspnet_chestxray_best_model_4.pth", "weightsSha256": "019b167eac6b729fc1bb92bbbc185fc1730aaa65819f4e3fe718186cadc044fc"},
        }
        notice = f"{manifest['name']}\nKaynak: {manifest['source']}\nLisans: {manifest['license']}\nAtıf: {manifest['citation']}\nDeğişiklik: PyTorch → ONNX; sigmoid eklendi, ağırlıklar float16 saklanır.\n"
        write_model(seg_dir, work / "xrv-seg.fp16.onnx", manifest, notice)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("work")
    ap.add_argument("--bundle", help="uygulamaya gömülecek modellerin klasörü (apps/web/public/ai-models)")
    ap.add_argument("--packs", help="isteğe bağlı model paketlerinin yazılacağı klasör")
    ap.add_argument("--xray-sample", required=True, help="doğrulama için örnek göğüs röntgeni (PNG)")
    ap.add_argument("--only", help="yalnızca bu modeller (virgülle: totalseg-ct, totalseg-mr, xrv, kidney-cysts, effusion; paketler: liver-lesions, liver-segments, xrv-seg)")
    ap.add_argument("--validation", help="patoloji modellerinin ölçülmüş doğrulama sonuçları (JSON: kidney_real, effusion_real)")
    a = ap.parse_args()
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    if a.bundle:
        b = Path(a.bundle)
        want = set(a.only.split(",")) if a.only else {"totalseg-ct", "totalseg-mr", "xrv", "kidney-cysts", "effusion"}
        if "totalseg-ct" in want:
            build_totalseg(work, "totalseg-ct", b / "totalseg-ct-total-3mm")
        if "totalseg-mr" in want:
            build_totalseg(work, "totalseg-mr", b / "totalseg-mr-total-3mm")
        if "xrv" in want:
            build_xrv(work, Path(a.xray_sample), b / "xrv-densenet121-nih", None)
        validation = {"kidney_real": "ölçülmedi", "effusion_real": "ölçülmedi", "liver_lesions_real": "ölçülmedi", "liver_segments_real": "ölçülmedi"}
        if a.validation:
            validation.update(json.loads(Path(a.validation).read_text()))
        if "kidney-cysts" in want:
            build_pathology(work, "kidney-cysts", b / "totalseg-ct-kidney-cysts", validation)
        if "effusion" in want:
            build_pathology(work, "effusion", b / "totalseg-ct-effusion", validation)
        index = sorted(x.name for x in b.iterdir() if (x / "manifest.json").exists())
        (b / "index.json").write_text(json.dumps({"schema": "kh-model-index/1", "models": index}, indent=1))
    if a.packs:
        p = Path(a.packs)
        validation = {"kidney_real": "ölçülmedi", "effusion_real": "ölçülmedi", "liver_lesions_real": "ölçülmedi", "liver_segments_real": "ölçülmedi"}
        if a.validation:
            validation.update(json.loads(Path(a.validation).read_text()))
        # liver-lesions varsayılan pakette YOK: gerçek LiTS vakasında sonucu kırpma/karo yerleşimine aşırı duyarlı çıktı
        # (uzman etiketine göre Dice 0,14–0,71 arasında değişti); güvenilir bulgu üretmediği için dağıtılmıyor.
        want = set(a.only.split(",")) if a.only else {"liver-segments", "xrv-seg"}
        if "liver-lesions" in want:
            build_pathology(work, "liver-lesions", p / "totalseg-ct-liver-lesions", validation)
        if "liver-segments" in want:
            build_pathology(work, "liver-segments", p / "totalseg-ct-liver-segments", validation)
        if "xrv-seg" in want:
            build_xrv(work, Path(a.xray_sample), None, p / "xrv-pspnet-chestxdet")
        # Uygulama isteğe bağlı paketleri tanısın diye: yalnızca manifestler (model dosyası değil)
        packs = [json.loads((x / "manifest.json").read_text()) for x in sorted(p.iterdir()) if (x / "manifest.json").exists()]
        doc = json.dumps({"schema": "kh-model-packs/1", "folder": "model-packs", "packs": packs}, ensure_ascii=False, indent=1)
        (p / "packs.json").write_text(doc)
        if a.bundle:
            (Path(a.bundle) / "packs.json").write_text(doc)


if __name__ == "__main__":
    main()
