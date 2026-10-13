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
    a = ap.parse_args()
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    if a.bundle:
        b = Path(a.bundle)
        build_totalseg(work, "totalseg-ct", b / "totalseg-ct-total-3mm")
        build_totalseg(work, "totalseg-mr", b / "totalseg-mr-total-3mm")
        build_xrv(work, Path(a.xray_sample), b / "xrv-densenet121-nih", None)
        index = sorted(p.name for p in b.iterdir() if (p / "manifest.json").exists())
        (b / "index.json").write_text(json.dumps({"schema": "kh-model-index/1", "models": index}, indent=1))
    if a.packs:
        p = Path(a.packs)
        build_xrv(work, Path(a.xray_sample), None, p / "xrv-pspnet-chestxdet")


if __name__ == "__main__":
    main()
