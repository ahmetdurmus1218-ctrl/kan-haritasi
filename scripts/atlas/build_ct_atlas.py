"""Gerçek BT atlası ("tomografi görünümü") üretimi — tekrarlanabilir.

Kaynak: NCI Imaging Data Commons, Cancer Moonshot Biobank – Colorectal Cancer (CMB-CRC), hasta MSB-03203,
seri "CHEST ABD PELVIS 1.25" (kontrastlı göğüs–karın–pelvis BT, 0,75 × 0,75 × 0,97 mm). Lisans CC BY 4.0.
Anonimleştirilmiş, gerçek bir yetişkin taraması: KULLANICININ vücudu DEĞİLDİR; "sağlıklı referans" olarak
seçilmemiştir (kanser tarama kohortundan), yalnızca anatomiyi gerçek BT yoğunluklarıyla göstermek içindir.

Adımlar:
  1. DICOM serisi → RAS hacmi (HU)
  2. Uygulamayla gelen TotalSegmentator ONNX modeli (totalseg-ct-total-3mm) ile 117 yapı bölütlemesi
     (scripts/models/reference_pipeline.py — uygulamadaki hattın Python eşi)
  3. Gövde maskesi (HU > −500 en büyük bileşen, dilim dilim doldurulmuş): masa, kablo ve dış nesneler silinir
  4. Gövde sınırlayıcı kutusuna kırpma, 1,5 mm izotropik RAS ızgarasına yeniden örnekleme
  5. Hafif Gauss yumuşatma (σ 0,6 voksel), HU → 8 bit parçalı doğrusal eşleme (yumuşak dokuda ~3,3 HU/adım), etiketler en yakın komşu
  6. gzip ile volume.bin, labels.bin ve manifest.json (boyut, aralık, HU eşlemesi, etiket adları, SHA-256)

Kullanım: python build_ct_atlas.py <dicom_klasörü> <çıktı_klasörü>
"""
import gzip
import hashlib
import json
import os
import sys

import nibabel as nib
import numpy as np
from scipy import ndimage
from scipy.ndimage import map_coordinates

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, 'scripts', 'models'))
from reference_pipeline import run as ts_run  # noqa: E402

SPACING = 1.5
# HU → 8 bit: (HU, değer) kırılma noktaları
HU_MAP = [(-1024, 0), (-900, 10), (-200, 60), (300, 210), (1500, 255)]


def load_series(folder):
    import pydicom
    ds = [pydicom.dcmread(os.path.join(folder, f)) for f in os.listdir(folder)]
    ds = [d for d in ds if hasattr(d, 'ImagePositionPatient')]
    iop = np.array(ds[0].ImageOrientationPatient, float)
    r, c = iop[:3], iop[3:]
    n = np.cross(r, c)
    ds.sort(key=lambda d: float(np.dot(np.array(d.ImagePositionPatient, float), n)))
    arr = np.stack([d.pixel_array.astype(np.float32) * float(d.RescaleSlope) + float(d.RescaleIntercept) for d in ds], -1)
    ps = [float(x) for x in ds[0].PixelSpacing]
    p0 = np.array(ds[0].ImagePositionPatient, float)
    dz = (np.array(ds[-1].ImagePositionPatient, float) - p0) / (len(ds) - 1)
    A = np.eye(4)
    A[:3, 0] = c * ps[0]
    A[:3, 1] = r * ps[1]
    A[:3, 2] = dz
    A[:3, 3] = p0
    return arr, np.diag([-1, -1, 1, 1]) @ A  # LPS → RAS


def hu_to_u8(hu):
    xs = np.array([p[0] for p in HU_MAP], float)
    ys = np.array([p[1] for p in HU_MAP], float)
    return np.clip(np.interp(hu, xs, ys), 0, 255).round().astype(np.uint8)


def body_mask(vol):
    m = vol > -500
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    m = lab == (1 + int(np.argmax(sizes)))
    m = ndimage.binary_closing(m, iterations=2)
    for k in range(m.shape[2]):
        m[:, :, k] = ndimage.binary_fill_holes(m[:, :, k])
    return m


def main(src, out):
    arr, aff = load_series(src)
    img = nib.as_closest_canonical(nib.Nifti1Image(arr, aff))
    man = json.load(open(os.path.join(REPO, 'apps/web/public/ai-models/totalseg-ct-total-3mm/manifest.json')))
    model = os.path.join(REPO, 'apps/web/public/ai-models/totalseg-ct-total-3mm/model.onnx')
    seg3, seg_lo, seg_sp = ts_run(model, man, img, return_grid=True)
    data = np.asarray(img.dataobj, dtype=np.float32)
    A = img.affine
    body = body_mask(data)
    data[~body] = -1024
    idx = np.argwhere(body)
    i0, i1 = idx.min(0), idx.max(0) + 1
    # RAS ızgarası: gövde kutusunun dünya sınırları
    corners = np.array([[a, b, c, 1] for a in (i0[0], i1[0] - 1) for b in (i0[1], i1[1] - 1) for c in (i0[2], i1[2] - 1)]) @ A.T
    lo, hi = corners[:, :3].min(0) - 3, corners[:, :3].max(0) + 3
    shape = [int(np.floor((hi[a] - lo[a]) / SPACING)) + 1 for a in range(3)]
    g = [lo[a] + np.arange(shape[a]) * SPACING for a in range(3)]
    W = np.stack(np.meshgrid(*g, indexing='ij'), -1).reshape(-1, 3)
    vox = (np.c_[W, np.ones(len(W))] @ np.linalg.inv(A).T)[:, :3].T
    vol = map_coordinates(data, vox, order=1, mode='constant', cval=-1024).reshape(shape)
    # Etiketler: 3 mm bölütleme ızgarasından doğrudan (en yakın komşu); gövde dışı sıfır
    sv = ((W - seg_lo) / seg_sp).T
    lab = map_coordinates(seg3.astype(np.float32), sv, order=0, mode='constant', cval=0).reshape(shape).astype(np.uint8)
    inside = map_coordinates(body.astype(np.float32), vox, order=0, mode='constant', cval=0).reshape(shape) > 0.5
    lab[~inside] = 0
    del vox, sv
    # Kuantum gürültüsünü hafifçe azalt (σ = 0,6 voksel, yalnızca gövde içinde): hacim görüntüsünde benek azalır
    sm = ndimage.gaussian_filter(vol, 0.6)
    vol = np.where(vol > -1000, sm, vol)
    u8 = hu_to_u8(vol)
    os.makedirs(out, exist_ok=True)
    # Dizi sırası: x (R) en hızlı → bellekte [S][A][R] (WebGL Data3DTexture: width=R, height=A, depth=S)
    vb = np.ascontiguousarray(np.transpose(u8, (2, 1, 0))).tobytes()
    lb = np.ascontiguousarray(np.transpose(lab, (2, 1, 0))).tobytes()
    files = {}
    # .bin uzantısı: sunucular .gz dosyasını "Content-Encoding: gzip" ile gönderip tarayıcıda açabiliyor;
    # içerik yine gzip'tir, uygulama kendisi açar. Hem sıkıştırılmış hem ham SHA-256 saklanır.
    for name, b in (('volume.bin', vb), ('labels.bin', lb)):
        gz = gzip.compress(b, compresslevel=9, mtime=0)
        open(os.path.join(out, name), 'wb').write(gz)
        files[name] = {'bytes': len(gz), 'raw': len(b), 'sha256': hashlib.sha256(gz).hexdigest(), 'rawSha256': hashlib.sha256(b).hexdigest()}
    present = sorted(int(x) for x in np.unique(lab) if x)
    counts = np.bincount(lab.ravel(), minlength=256)
    labs = [
        {**{k: l[k] for k in ('id', 'key', 'finding') if k in l}, **({'structure': l['structure']} if 'structure' in l else {}), **({'node': l['node']} if 'node' in l else {}), 'ml': round(float(counts[l['id']]) * SPACING ** 3 / 1000, 1)}
        for l in man['labels']
        if l['id'] in present
    ]
    manifest = {
        'schema': 'kh-ct-atlas/1',
        'id': 'ct-body-msb03203',
        'name': 'Gerçek BT atlası (kontrastlı göğüs–karın–pelvis)',
        'shape': [int(s) for s in shape],
        'spacing': SPACING,
        'origin': [float(x) for x in lo],
        'axes': 'RAS (x = sağ, y = ön, z = üst); veri sırası x en hızlı',
        'huMap': HU_MAP,
        'files': files,
        'labels': labs,
        'segmentation': f"{man['name']} {man['version']} (uygulamayla gelen model; cihaz dışında, bu betikle çalıştırıldı)",
        'source': 'NCI Imaging Data Commons · Cancer Moonshot Biobank – Colorectal Cancer (CMB-CRC) · MSB-03203 · "CHEST ABD PELVIS 1.25"',
        'doi': 'https://doi.org/10.7937/DJG7-GZ87',
        'license': 'CC BY 4.0',
        'attribution': 'Cancer Moonshot Biobank (CMB) — National Cancer Institute; Imaging Data Commons (Fedorov ve ark., RadioGraphics 2023).',
        'notes': [
            'Gerçek, anonim bir yetişkin BT taraması; kullanıcının vücudu değildir.',
            'Sağlıklı referans olarak seçilmemiştir (kanser tarama kohortu); tanı ya da karşılaştırma amacıyla kullanılmaz.',
            'Masa, kablolar ve vücut dışı nesneler gövde maskesiyle silindi; 1,5 mm izotropik yeniden örneklendi.',
            'Organ etiketleri 3 mm TotalSegmentator bölütlemesinden en yakın komşuyla taşındı (sınırlar 3 mm keskinliğindedir).',
        ],
    }
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({'shape': shape, 'files': files, 'labels': len(labs)}))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
