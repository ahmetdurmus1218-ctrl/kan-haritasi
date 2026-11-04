"""
Röntgen modeli (TorchXRayVision NIH, uygulamadaki ONNX) — telefon fotoğrafı / ekran görüntüsü dayanıklılığı.

Koşullar (görüntü başına sabit tohumlu):
  orijinal   : görüntünün kendisi
  ekran_goruntusu : PACS / e-Nabız benzeri görüntüleyici ekran görüntüsü (koyu arayüz, araç çubuğu, yazılar, 16:9 ya da telefon dikey)
  monitor_foto    : aynı ekranın telefonla fotoğrafı (eğik, moiré, parlama, bulanıklık, siyah seviyesi yükselmiş, JPEG; çevre görünür)
  film_foto       : ışıklı negatoskopta film fotoğrafı (parlak çevre, eğik, parlama, JPEG)

Ön işleme seçenekleri:
  A  eski uygulama: tüm görüntünün merkez karesi
  B  röntgen alanı bulunur (yerel doku haritası), görüntünün %80'inden küçükse o alana kırpılır, sonra merkez kare
     — uygulamaya alınan (packages/analysis/src/xrayRegion.ts, manifest input.region = 'xray')
  C  B + kırpılan alanda yüzdelik kontrast germe (yalnızca kırpma yapıldıysa) — ek kazanç göstermedi, alınmadı

Kullanım: python fetch_data.py && python xray_eval.py 440 && python xray_report.py && python make_fixtures.py
Sonuç: work/xray_report.json → photo_metrics.json (build_models.py manifeste yazar).
"""
import os, sys, io, json, math
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage
import onnxruntime as ort

SCRIPT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPT)))
HERE = os.environ.get('KH_XRAY_WORK', os.path.join(SCRIPT, 'work'))  # veri ve çıktılar (fetch_data.py)
MODEL = os.path.join(REPO, 'apps/web/public/ai-models/xrv-densenet121-nih/model.onnx')
MAN = json.load(open(os.path.join(REPO, 'apps/web/public/ai-models/xrv-densenet121-nih/manifest.json')))
KEYS = [l['key'] for l in MAN['labels']]
PNEU = KEYS.index('Pneumonia')
THR = [MAN.get('calibration', {}).get('thresholds', [None] * len(KEYS))[l['id']] for l in MAN['labels']]


def calib(raw):
    """Uygulamadaki multilabelScores ile aynı: TorchXRayVision op_norm (çalışma noktası 0,5), 3 basamağa yuvarlama."""
    raw = np.asarray(raw, np.float64)
    out = raw.copy()
    for i, t in enumerate(THR):
        if t is None:
            continue
        p = raw[..., i]
        out[..., i] = np.where(p < t, p / (t * 2), 1 - (1 - p) / ((1 - t) * 2))
    return np.round(out * 1000) / 1000


# ------------------------------------------------------------------ uygulamadaki ön işlemenin eşi (localModel.ts preprocess)

def gray_of(img: Image.Image) -> np.ndarray:
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def blur1d(p, sigma, axis):
    if not sigma > 0:
        return p
    r = math.floor(4 * sigma + 0.5)
    x = np.arange(-r, r + 1)
    k = np.exp(-0.5 * x * x / (sigma * sigma))
    k /= k.sum()
    return ndimage.convolve1d(p, k, axis=axis, mode='constant', cval=0.0)


def app_tensor(g: np.ndarray, box=None) -> np.ndarray:
    H0, W0 = g.shape
    x0, y0, w, h = box if box else (0, 0, W0, H0)
    size = min(w, h)
    x0 = x0 + w // 2 - size // 2
    y0 = y0 + h // 2 - size // 2
    p = (g[y0:y0 + size, x0:x0 + size] - 127.5) / 0.12451171875
    s = size / 224
    p = blur1d(blur1d(p, max(0, (s - 1) / 2), 1), max(0, (s - 1) / 2), 0)
    f = np.clip((np.arange(224) + 0.5) * s - 0.5, 0, size - 1)
    a = np.floor(f).astype(int)
    b = np.minimum(size - 1, a + 1)
    t = f - a
    fx, fy = np.meshgrid(t, t)
    xa, ya = np.meshgrid(a, a)
    xb, yb = np.meshgrid(b, b)
    out = (p[ya, xa] * (1 - fx) + p[ya, xb] * fx) * (1 - fy) + (p[yb, xa] * (1 - fx) + p[yb, xb] * fx) * fy
    return out.astype(np.float32)[None, None]


# ------------------------------------------------------------------ röntgen alanı bulma (TypeScript'e taşınacak)

def longest_run(a, thr):
    best, cur, b0, s0 = (0, 0, -1), 0, 0, 0
    for i, v in enumerate(a):
        if v >= thr:
            if cur == 0:
                s0 = i
            cur += 1
            if cur > best[0]:
                best = (cur, s0, i)
        else:
            cur = 0
    return best


def xray_region(g: np.ndarray):
    """Görüntüde röntgenin kapladığı dikdörtgen. Görüntü ~128 piksele alan ortalamasıyla küçültülür (moiré, gürültü
    ve küçük yazılar söner); 5×5 pencerede yerel standart sapma = orta ölçekli doku (akciğer/kaburga/mediasten).
    Düz arayüz, ışıklı kutu ve çerçeve dokusuz. Dokulu maske açılır (ince kenar çizgileri silinir); satırlarda ve
    sütunlarda dokulu oranın ≥ %15 olduğu en uzun kesintisiz aralık = kutu. Dönüş (x, y, w, h), özgün piksellerde."""
    H, W = g.shape
    B = max(1, int(np.ceil(max(H, W) / 128)))
    hb, wb = H // B, W // B
    if hb < 16 or wb < 16:
        return (0, 0, W, H)
    small = g[: hb * B, : wb * B].reshape(hb, B, wb, B).mean((1, 3))
    m1 = ndimage.uniform_filter(small, 5, mode='nearest')
    m2 = ndimage.uniform_filter(small * small, 5, mode='nearest')
    sd = np.sqrt(np.maximum(0, m2 - m1 * m1))
    thr = max(2.5, 0.3 * np.percentile(sd, 75))
    m = ndimage.binary_opening(sd > thr, iterations=1)
    n, r0, r1 = longest_run(m.mean(1), 0.15)
    if n < 8:
        return (0, 0, W, H)
    n2, c0, c1 = longest_run(m[r0:r1 + 1].mean(0), 0.15)
    if n2 < 8:
        return (0, 0, W, H)
    return (int(c0 * B), int(r0 * B), int((c1 - c0 + 1) * B), int((r1 - r0 + 1) * B))


def stretch(g, box):
    x0, y0, w, h = box
    r = g[y0:y0 + h, x0:x0 + w]
    lo, hi = np.percentile(r, 0.5), np.percentile(r, 99.5)
    out = g.copy()
    out[y0:y0 + h, x0:x0 + w] = np.clip((r - lo) / max(1, hi - lo) * 255, 0, 255)
    return out


def variant_input(g, v):
    H, W = g.shape
    if v == 'A':
        return app_tensor(g)
    box = xray_region(g)
    crop = box[2] * box[3] < 0.8 * W * H
    if not crop:
        return app_tensor(g)
    pad = 0.03
    x0 = max(0, int(box[0] - pad * box[2])); y0 = max(0, int(box[1] - pad * box[3]))
    x1 = min(W, int(box[0] + box[2] * (1 + pad))); y1 = min(H, int(box[1] + box[3] * (1 + pad)))
    b2 = (x0, y0, x1 - x0, y1 - y0)
    if v == 'C':
        g = stretch(g, b2)
    return app_tensor(g, b2)


# ------------------------------------------------------------------ benzetimler

def font(sz):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def viewer(img: Image.Image, rng, portrait=False):
    """Görüntüleyici ekranı: koyu arayüz, üst araç çubuğu, sol küçük resim şeridi ya da telefon dikey düzeni, yazılar."""
    g = img.convert('L')
    if portrait:
        W, H = 1080, 2340
        canvas = Image.new('L', (W, H), int(rng.integers(10, 40)))
        d = ImageDraw.Draw(canvas)
        d.rectangle([0, 0, W, 220], fill=int(rng.integers(40, 70)))
        d.text((40, 90), 'e-Nabız · Radyoloji Görüntüleri', fill=230, font=font(44))
        d.rectangle([0, H - 260, W, H], fill=int(rng.integers(40, 70)))
        for i in range(4):
            d.text((60 + i * 250, H - 170), ['Geri', 'Paylaş', 'İndir', 'Rapor'][i], fill=200, font=font(40))
        tw = W - int(rng.integers(0, 80))
        th = int(g.height * tw / g.width)
        th = min(th, H - 600)
        tw = int(g.width * th / g.height)
        x = (W - tw) // 2
        y = 300 + (H - 600 - th) // 2
    else:
        W, H = 1920, 1080
        canvas = Image.new('L', (W, H), int(rng.integers(15, 45)))
        d = ImageDraw.Draw(canvas)
        d.rectangle([0, 0, W, 64], fill=int(rng.integers(50, 80)))
        for i, t in enumerate(['Dosya', 'Görünüm', 'Ölçüm', 'Pencere', 'Yardım']):
            d.text((20 + i * 140, 18), t, fill=220, font=font(26))
        side = int(rng.integers(0, 2))
        if side:
            for i in range(5):
                d.rectangle([20, 100 + i * 180, 200, 260 + i * 180], outline=120, fill=int(rng.integers(30, 70)))
        th = int(H * rng.uniform(0.78, 0.9))
        tw = int(g.width * th / g.height)
        x = (260 if side else 0) + (W - (260 if side else 0) - tw) // 2 + int(rng.integers(-60, 60))
        y = 64 + (H - 64 - th) // 2
        d.text((x + 10, y + 10), f'HASTA: ******  {int(rng.integers(20, 90))}Y', fill=235, font=font(28))
        d.text((x + 10, y + th - 50), 'PA  W:2048 L:1024', fill=235, font=font(28))
        d.text((W - 360, H - 50), 'Kan Haritası test', fill=150, font=font(24))
    canvas.paste(g.resize((tw, th), Image.BILINEAR), (x, y))
    d = ImageDraw.Draw(canvas)
    if portrait:
        d.text((x + 20, y + 20), 'AKCİĞER GRAFİSİ PA', fill=235, font=font(36))
    return canvas


def perspective_coeffs(src, dst):
    A, Bv = [], []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); Bv.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); Bv.append(v)
    return np.linalg.solve(np.array(A, float), np.array(Bv, float)).tolist()


def photograph(screen: Image.Image, rng, kind='monitor'):
    """Ekranı/filmi telefonla çekmek: çevre, eğiklik, moiré, parlama, siyah seviyesi, bulanıklık, gürültü, JPEG."""
    sw, sh = screen.size
    Wp, Hp = (1600, 1200) if sw >= sh else (1200, 1600)
    sc = min(Wp / sw, Hp / sh) * rng.uniform(0.72, 0.88)
    tw, th = sw * sc, sh * sc
    cx, cy = Wp / 2 + rng.normal(0, 30), Hp / 2 + rng.normal(0, 30)
    j = lambda: rng.uniform(-0.05, 0.05) * max(tw, th)  # noqa: E731
    dst = [(cx - tw / 2 + j(), cy - th / 2 + j()), (cx + tw / 2 + j(), cy - th / 2 + j()), (cx + tw / 2 + j(), cy + th / 2 + j()), (cx - tw / 2 + j(), cy + th / 2 + j())]
    coeffs = perspective_coeffs(dst, [(0, 0), (sw, 0), (sw, sh), (0, sh)])
    if kind == 'monitor':
        s = np.asarray(screen, np.float32)
        s = 18 + s * rng.uniform(0.8, 0.92)  # siyah seviyesi yükselir, kontrast azalır
        yy, xx = np.mgrid[0:sh, 0:sw]
        f = rng.uniform(0.25, 0.45)
        s = s + 6 * np.sin(f * xx + 0.3 * f * yy) * np.sin(0.9 * f * yy)  # moiré
        screen2 = Image.fromarray(np.clip(s, 0, 255).astype(np.uint8))
        bg = int(rng.integers(40, 110))
    else:
        s = np.asarray(screen, np.float32)
        s = 30 + s * 0.85
        screen2 = Image.fromarray(np.clip(s, 0, 255).astype(np.uint8))
        bg = int(rng.integers(20, 60))
    rgb = Image.merge('RGB', [screen2] * 3)
    photo = rgb.transform((Wp, Hp), Image.PERSPECTIVE, coeffs, Image.BILINEAR, fillcolor=(bg, int(bg * 0.95), int(bg * 0.88)))
    a = np.asarray(photo, np.float32)
    yy, xx = np.mgrid[0:Hp, 0:Wp]
    gx, gy = rng.uniform(0.2, 0.8) * Wp, rng.uniform(0.15, 0.6) * Hp
    a += rng.uniform(15, 45) * np.exp(-(((xx - gx) / rng.uniform(150, 300)) ** 2 + ((yy - gy) / rng.uniform(120, 250)) ** 2))[..., None]
    a *= np.array([1.0, rng.uniform(0.95, 1.02), rng.uniform(0.85, 1.0)])
    a += rng.normal(0, rng.uniform(2, 5), a.shape)
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rng.uniform(0.6, 1.4)))
    buf = io.BytesIO()
    out.save(buf, 'JPEG', quality=int(rng.integers(60, 85)))
    return Image.open(io.BytesIO(buf.getvalue())).convert('RGB')


def lightbox(img: Image.Image, rng):
    g = img.convert('L')
    W = int(g.width * 1.25)
    H = int(g.height * 1.2)
    box = Image.new('L', (W, H), int(rng.integers(235, 252)))
    box.paste(g, ((W - g.width) // 2, (H - g.height) // 2))
    return box


def condition(img: Image.Image, cond: str, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    if cond == 'orijinal':
        return img.convert('RGB')
    if cond == 'ekran_goruntusu':
        sc = viewer(img, rng, portrait=bool(rng.integers(0, 2)))
        buf = io.BytesIO()
        sc.save(buf, 'JPEG', quality=90)
        return Image.open(io.BytesIO(buf.getvalue())).convert('RGB')
    if cond == 'monitor_foto':
        return photograph(viewer(img, rng, portrait=bool(rng.integers(0, 2))), rng, 'monitor')
    if cond == 'film_foto':
        return photograph(lightbox(img, rng), rng, 'film')
    raise ValueError(cond)


# ------------------------------------------------------------------ değerlendirme

def auc(score, pos):
    pos = np.asarray(pos, bool)
    order = np.argsort(score)
    ranks = np.empty(len(score))
    ranks[order] = np.arange(1, len(score) + 1)
    return float((ranks[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * (~pos).sum()))


def boot_ci(score, pos, n=500, seed=0):
    r = np.random.default_rng(seed)
    v = []
    idx = np.arange(len(score))
    for _ in range(n):
        s = r.choice(idx, len(idx))
        if pos[s].all() or (~pos[s]).all():
            continue
        v.append(auc(score[s], pos[s]))
    return [round(float(np.percentile(v, 2.5)), 3), round(float(np.percentile(v, 97.5)), 3)]


def main():
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else 10 ** 9
    df = pd.read_csv(os.path.join(HERE, 'labeled.csv'))
    df = df[[os.path.exists(os.path.join(HERE, p)) for p in df.path]].reset_index(drop=True)
    if lim < len(df):
        df = pd.concat([df[df.label == 0].head(lim // 4), df[df.label == 1].head(lim - lim // 4)]).reset_index(drop=True)
    sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    inp = sess.get_inputs()[0].name
    conds = ['orijinal', 'ekran_goruntusu', 'monitor_foto', 'film_foto']
    variants = ['A', 'B', 'C']
    S = {(c, v): np.zeros((len(df), len(KEYS)), np.float32) for c in conds for v in variants}
    os.makedirs(os.path.join(HERE, 'samples'), exist_ok=True)
    for i, r in df.iterrows():
        base = Image.open(os.path.join(HERE, r.path))
        base.load()
        for ci, c in enumerate(conds):
            im = condition(base, c, 1000 * i + ci)
            if i < 3:
                im.save(os.path.join(HERE, 'samples', f'{i}_{c}.jpg'), quality=80)
            g = gray_of(im)
            for v in variants:
                S[(c, v)][i] = sess.run(None, {inp: variant_input(g, v)})[0][0]
        if i % 50 == 0:
            print(i, '/', len(df), flush=True)
    y = df.label.values.astype(bool)
    res = {'n': int(len(df)), 'positives': int(y.sum()), 'negatives': int((~y).sum()), 'sources': df.groupby(['src', 'label']).size().to_dict().__repr__(), 'results': {}}
    ref = S[('orijinal', 'A')]
    for c in conds:
        for v in variants:
            s = S[(c, v)]
            pn = s[:, PNEU]
            d = np.abs(s - ref)
            flips = ((s >= MAN['scoreThreshold']) != (ref >= MAN['scoreThreshold'])).mean()
            res['results'][f'{c}/{v}'] = dict(pneumonia_auc=round(auc(pn, y), 4), pneumonia_auc_ci95=boot_ci(pn, y), mean_abs_diff_vs_original=round(float(d.mean()), 4),
                                              decision_flip_rate=round(float(flips), 4), top_finding_same=round(float((s.argmax(1) == ref.argmax(1)).mean()), 4),
                                              pneumonia_corr=round(float(np.corrcoef(pn, ref[:, PNEU])[0, 1]), 4))
            print(c, v, res['results'][f'{c}/{v}'], flush=True)
    json.dump(res, open(os.path.join(HERE, 'xray_eval.json'), 'w'), indent=1, ensure_ascii=False)
    np.savez_compressed(os.path.join(HERE, 'xray_scores.npz'), **{f'{c}_{v}': S[(c, v)] for c in conds for v in variants}, y=y)


if __name__ == '__main__':
    main()
