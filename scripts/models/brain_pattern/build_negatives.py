"""
"Beyin MR kesiti DEĞİL" örnekleri (eğitim dışı kapısı için): gerçek göğüs röntgenleri, gerçek beyin/gövde BT
kesitleri (farklı pencerelerle), beyin dışı MR kesitleri, sentetik belge/ekran görüntüleri ve çizimler.

Her örnek, uygulamadaki kırpmayla aynı biçimde (kafa/içerik kutusu → %8 paylı kare) 192×192'ye getirilir;
eğitimde beyin kesitleriyle aynı fotoğraf artırmasından geçer. Bölme kaynağa/hastaya göredir.
"""
import os, sys, glob, json, hashlib, random, shutil, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import pydicom

sys.path.insert(0, os.path.dirname(__file__))
from dcmio import load_series, lps_to_ras  # noqa: E402

ROOT = os.environ.get('KH_BRAIN_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
OUT = os.path.join(ROOT, 'neg_ds')
TMP = os.path.join(ROOT, 'tmp_neg')
S5 = shutil.which('s5cmd') or os.path.join(ROOT, 'venv/bin/s5cmd')
SIZE = 192


def split_of(key):
    h = int(hashlib.sha1(key.encode()).hexdigest(), 16) % 100
    return 'train' if h < 70 else 'val' if h < 85 else 'test'


def box_crop(g):
    """Uygulamadaki headBox + squareAround (TS ile aynı kural) → 192×192, 0–255."""
    g = g.astype(np.float32)
    s = np.sort(g.ravel()[:: max(1, g.size // 60000)])
    lo, hi = s[int(0.01 * (len(s) - 1))], s[int(0.995 * (len(s) - 1))]
    g = np.clip((g - lo) / max(hi - lo, 1e-6), 0, 1)
    H, W = g.shape
    s = np.sort(g.ravel())
    p05, p99 = s[int(round(0.05 * (len(s) - 1)))], s[int(round(0.99 * (len(s) - 1)))]
    on = g > p05 + 0.15 * (p99 - p05)
    col, row = on.sum(0) / H, on.sum(1) / W

    def span(a, n):
        a0, a1 = 0, n - 1
        while a0 < n and a[a0] < 0.06:
            a0 += 1
        while a1 > a0 and a[a1] < 0.06:
            a1 -= 1
        return (0, n - 1) if a1 - a0 < n * 0.2 else (a0, a1)

    x0, x1 = span(col, W)
    y0, y1 = span(row, H)
    side = max(x1 - x0 + 1, y1 - y0 + 1) * 1.08
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    im = Image.fromarray((g * 255).astype(np.uint8))
    crop = im.transform((SIZE, SIZE), Image.EXTENT, (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2), Image.BILINEAR, fillcolor=0)
    return np.asarray(crop, np.uint8)


def save(kind, key, imgs):
    if not imgs:
        return 0
    os.makedirs(os.path.join(OUT, kind), exist_ok=True)
    np.savez_compressed(os.path.join(OUT, kind, f'{key}.npz'), imgs=np.stack(imgs), split=split_of(key), kind=kind)
    return len(imgs)


def s3cp(url, dst):
    os.makedirs(dst, exist_ok=True)
    subprocess.run([S5, '--no-sign-request', '--endpoint-url', 'https://s3.amazonaws.com', '--numworkers', '16', 'cp', url, dst + '/'], capture_output=True)


WINDOWS = [(40, 80), (40, 400), (-600, 1500), (400, 1800), (50, 350), (35, 120)]


def ct_window(hu, rng):
    c, w = WINDOWS[rng.integers(len(WINDOWS))]
    return np.clip((hu - (c - w / 2)) / w, 0, 1) * 255


def volume_slices(arr, A, rng, n, ct):
    import nibabel as nib
    v = np.asarray(nib.as_closest_canonical(nib.Nifti1Image(arr, lps_to_ras(A))).dataobj, dtype=np.float32)
    out = []
    planes = ['ax'] * 6 + ['cor', 'sag']
    for _ in range(n):
        pl = planes[rng.integers(len(planes))]
        if pl == 'ax':
            k = rng.integers(int(v.shape[2] * 0.1), int(v.shape[2] * 0.9))
            sl = v[::-1, ::-1, k].T
        elif pl == 'cor':
            k = rng.integers(int(v.shape[1] * 0.2), int(v.shape[1] * 0.8))
            sl = v[::-1, k, ::-1].T
        else:
            k = rng.integers(int(v.shape[0] * 0.2), int(v.shape[0] * 0.8))
            sl = v[k, ::-1, ::-1].T
        if ct:
            sl = ct_window(sl, rng)
        if sl.std() < 1e-3:
            continue
        out.append(box_crop(sl))
    return out


def do_idc(kind, query, per_series, limit, ct, rng):
    from idc_index import IDCClient
    c = IDCClient()
    df = c.sql_query(query)
    pats = sorted(df.PatientID.unique())
    rng.shuffle(pats)
    n = 0
    for p in pats[:limit]:
        r = df[df.PatientID == p].iloc[0]
        tmp = os.path.join(TMP, f'{kind}_{p}')
        try:
            s3cp(r.series_aws_url, tmp)
            if kind == 'xray':
                imgs = []
                for f in glob.glob(tmp + '/*')[:3]:
                    d = pydicom.dcmread(f)
                    a = d.pixel_array.astype(np.float32)
                    if a.ndim == 3:
                        a = a[..., 0] if a.shape[-1] in (3, 4) else a[0]
                    if getattr(d, 'PhotometricInterpretation', '') == 'MONOCHROME1':
                        a = a.max() - a
                    imgs.append(box_crop(a))
            else:
                arr, A, _, _ = load_series(tmp)
                if arr.shape[2] < 8:
                    continue
                imgs = volume_slices(arr, A, rng, per_series, ct)
            n += save(kind, f'{kind}_{p}', imgs)
        except Exception as e:  # noqa: BLE001
            print('hata', kind, p, e, file=sys.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print(kind, p, n, flush=True)


def do_local_ct(rng):
    # İsteğe bağlı: tomografi atlasının kaynak BT'si (scripts/atlas/build_ct_atlas.py ile indirilmişse)
    src = os.path.join(ROOT, 'ct/MSB-03203')
    if not os.path.isdir(src):
        print('ct-local yok, atlandı:', src)
        return
    arr, A, _, _ = load_series(src)
    print('ct-local', save('ct', 'ct_MSB-03203', volume_slices(arr, A, rng, 220, True)))


def doc_image(rng):
    W, H = int(rng.integers(500, 900)), int(rng.integers(600, 1000))
    dark = rng.random() < 0.25
    bg = int(rng.integers(20, 50)) if dark else int(rng.integers(215, 255))
    fg = 230 if dark else int(rng.integers(0, 60))
    im = Image.new('L', (W, H), bg)
    d = ImageDraw.Draw(im)
    y = int(rng.integers(20, 60))
    while y < H - 30:
        if rng.random() < 0.15:
            d.line([(20, y), (W - 20, y)], fill=fg, width=1)
        x = int(rng.integers(20, 50))
        for _ in range(int(rng.integers(3, 12))):
            w = int(rng.integers(15, 90))
            if x + w > W - 20:
                break
            d.rectangle([x, y, x + w, y + int(rng.integers(6, 11))], fill=fg if rng.random() < 0.9 else 160)
            x += w + int(rng.integers(6, 14))
        y += int(rng.integers(16, 30))
    if rng.random() < 0.3:  # tablo ızgarası
        for xx in np.linspace(20, W - 20, int(rng.integers(3, 6))):
            d.line([(xx, 40), (xx, H - 40)], fill=fg, width=1)
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(float(rng.uniform(0, 1.2)))), np.float32)
    a = a * np.linspace(float(rng.uniform(0.75, 1)), 1, W)[None, :] + rng.normal(0, 4, a.shape)
    return box_crop(a)


def phantom_image(rng):
    """Basit çizim "kafa" (elips, iç elips, rastgele lekeler) — gerçek MR değildir."""
    S = 300
    im = Image.new('L', (S, S), int(rng.integers(0, 30)))
    d = ImageDraw.Draw(im)
    cx, cy = S / 2 + rng.normal(0, 10), S / 2 + rng.normal(0, 10)
    rx, ry = rng.uniform(80, 120), rng.uniform(100, 135)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=int(rng.integers(150, 240)))
    d.ellipse([cx - rx * 0.88, cy - ry * 0.88, cx + rx * 0.88, cy + ry * 0.88], fill=int(rng.integers(60, 150)))
    if rng.random() < 0.7:
        d.line([(cx, cy - ry * 0.8), (cx, cy + ry * 0.8)], fill=int(rng.integers(20, 90)), width=2)
    for _ in range(int(rng.integers(0, 4))):
        bx, by, br = cx + rng.normal(0, rx * 0.4), cy + rng.normal(0, ry * 0.4), rng.uniform(6, 30)
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=int(rng.integers(0, 255)))
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(float(rng.uniform(0.5, 3)))), np.float32) + rng.normal(0, 6, (S, S))
    return box_crop(a)


def drawing_image(rng):
    """Çeşitli çizimler: yaylar, çizgiler, çubuklar, elipsler, ızgaralar (şema, karikatür, çizim röntgen)."""
    W, H = int(rng.integers(300, 700)), int(rng.integers(300, 800))
    bg = int(rng.integers(0, 60)) if rng.random() < 0.7 else int(rng.integers(180, 255))
    im = Image.new('L', (W, H), bg)
    d = ImageDraw.Draw(im)
    if rng.random() < 0.6:
        cx, cy = W / 2 + rng.normal(0, 20), H / 2 + rng.normal(0, 20)
        d.ellipse([cx - W * 0.4, cy - H * 0.42, cx + W * 0.4, cy + H * 0.42], fill=int(rng.integers(30, 120)))
    for _ in range(int(rng.integers(3, 25))):
        t = rng.random()
        col = int(rng.integers(100, 255))
        wdt = int(rng.integers(2, 14))
        x0, y0 = float(rng.uniform(0, W)), float(rng.uniform(0, H))
        if t < 0.4:
            r = float(rng.uniform(20, W / 2))
            a0 = float(rng.uniform(0, 360))
            d.arc([x0 - r, y0 - r / 2, x0 + r, y0 + r / 2], a0, a0 + float(rng.uniform(40, 200)), fill=col, width=wdt)
        elif t < 0.6:
            d.rectangle([x0, y0, x0 + float(rng.uniform(5, 60)), y0 + float(rng.uniform(40, H * 0.8))], fill=col)
        elif t < 0.8:
            d.line([(x0, y0), (float(rng.uniform(0, W)), float(rng.uniform(0, H)))], fill=col, width=wdt)
        else:
            r = float(rng.uniform(10, 90))
            d.ellipse([x0 - r, y0 - r * 1.3, x0 + r, y0 + r * 1.3], fill=col)
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(float(rng.uniform(0.5, 4)))), np.float32) + rng.normal(0, float(rng.uniform(1, 8)), (H, W))
    return box_crop(a)


def texture_image(rng):
    S = 256
    base = rng.normal(0, 1, (S // 8, S // 8))
    a = np.asarray(Image.fromarray(((base - base.min()) / np.ptp(base) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC), np.float32)
    a += rng.normal(0, float(rng.uniform(2, 20)), a.shape)
    return box_crop(a)


if __name__ == '__main__':
    which = sys.argv[1]
    rng = np.random.default_rng(int(hashlib.sha1(which.encode()).hexdigest(), 16) % 2 ** 32)  # tekrarlanabilir tohum
    if which == 'xray':
        do_idc('xray', "SELECT PatientID, series_aws_url FROM index WHERE collection_id IN ('covid_19_ny_sbu','lidc_idri','covid_19_ar') AND Modality IN ('CR','DX') AND series_size_MB < 40", 1, 160, False, rng)
    elif which == 'headct':
        do_idc('headct', "SELECT PatientID, series_aws_url FROM index WHERE collection_id LIKE 'cmb_%' AND Modality='CT' AND upper(BodyPartExamined)='HEAD' AND instanceCount BETWEEN 20 AND 400", 40, 40, True, rng)
    elif which == 'bodyct':
        do_local_ct(rng)
        do_idc('ct', "SELECT PatientID, series_aws_url FROM index WHERE collection_id IN ('covid_19_ar','lidc_idri','c4kc_kits') AND Modality='CT' AND instanceCount BETWEEN 60 AND 400", 25, 40, True, rng)
    elif which == 'bodymr':
        do_idc('bodymr', "SELECT PatientID, series_aws_url FROM index WHERE collection_id IN ('prostatex','acrin_contralateral_breast_mr','tcga_kirc','cptac_ucec','tcga_lihc','prostate_mri_us_biopsy') AND Modality='MR' AND instanceCount BETWEEN 20 AND 200 AND series_size_MB < 60", 25, 60, False, rng)
    elif which == 'drawing':
        for b in range(0, 800, 50):
            save('drawing', f'drawing_{b // 50:03d}', [drawing_image(rng) for _ in range(50)])
        print('drawing', 800, flush=True)
    elif which == 'synthetic':
        for kind, fn, nn in (('doc', doc_image, 900), ('phantom', phantom_image, 700), ('texture', texture_image, 300)):
            for b in range(0, nn, 50):
                save(kind, f'{kind}_{b // 50:03d}', [fn(rng) for _ in range(50)])
            print(kind, nn, flush=True)
