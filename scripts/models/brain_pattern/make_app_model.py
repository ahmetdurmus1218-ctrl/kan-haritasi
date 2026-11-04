"""Eğitilmiş beyin MR örüntü modelini uygulamaya gömer ve doğrulama fikstürlerini üretir.

  - apps/web/public/ai-models/kh-brain-mri-pattern/{model.onnx, manifest.json, NOTICE.txt}; index.json'a eklenir
  - fixtures/imaging/beyin-mr-gercek/<sınıf>.png: her sınıftan, HASTA BAZLI TEST kümesindeki (eğitimde görülmemiş)
    lezyon alanı en büyük eksenel kesit (seçim kurala dayalı; modelin tahminine bakılmaz)
  - fixtures/imaging/beyin-mr-gercek/kolaj-foto.jpg: bu dört kesitten film kolajı, telefonla eğik çekilmiş gibi
  - fixtures/imaging/beyin-mr-gercek/expected.json: uygulamadaki ön işlemenin (TypeScript) Python eşiyle aynı
    girdilerde modelin çıktıları — TS ↔ Python eşdeğerlik testi için
"""
import os, sys, json, glob, shutil, hashlib
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from train_brain import CLASSES, OUT  # noqa: E402

ROOT = os.environ.get('KH_BRAIN_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MID = 'kh-brain-mri-pattern'
DST = os.path.join(REPO, 'apps/web/public/ai-models', MID)
FIX = os.path.join(REPO, 'fixtures/imaging/beyin-mr-gercek')

LABELS = [
    {'id': 0, 'key': 'normal', 'finding': 'Sağlıklı referans kesitlerine benzer (belirgin lezyon örüntüsü yok)', 'kind': 'finding'},
    {'id': 1, 'key': 'glial_tumor', 'finding': 'Beyin içi kitle örüntüsü (glioma / glioblastom benzeri)', 'kind': 'finding', 'structure': 'brain', 'node': 'brain'},
    {'id': 2, 'key': 'cpa_tumor', 'finding': 'İç kulak yolu – serebellopontin köşe kitlesi örüntüsü (vestibüler schwannom benzeri)', 'kind': 'finding', 'structure': 'brain', 'node': 'brain'},
    {'id': 3, 'key': 'chronic_lesion', 'finding': 'Eski doku kaybı alanı örüntüsü (kronik inme / ameliyat boşluğu benzeri)', 'kind': 'finding', 'structure': 'brain', 'node': 'brain'},
]

SOURCES = {
    'upenn': ('UPENN-GBM (Imaging Data Commons / TCIA)', 'CC BY 4.0', 'glioblastom kesitleri + uzak sağlıklı görünümlü kesitler', 'https://doi.org/10.7937/TCIA.709X-DN49'),
    'vs': ('Vestibular-Schwannoma-SEG (Imaging Data Commons / TCIA)', 'CC BY 4.0', 'iç kulak yolu tümörü kesitleri + tümörsüz kesitler', 'https://doi.org/10.7937/TCIA.9YTJ-5Q73'),
    'arc': ('Aphasia Recovery Cohort, OpenNeuro ds004884', 'CC0', 'kronik inme kesitleri + lezyonsuz kesitler', 'https://doi.org/10.18112/openneuro.ds004884'),
    'ccnrp': ('CCNRP kronik lezyon, OpenNeuro ds007212', 'CC0', 'kronik odak lezyon (inme, ameliyat) kesitleri + lezyonsuz kesitler', 'https://openneuro.org/datasets/ds007212'),
    'healthy_ds000221': ('MPI-Leipzig Mind-Brain-Body (LEMON), OpenNeuro ds000221', 'CC0', 'sağlıklı gönüllüler (T2, FLAIR)', 'https://doi.org/10.18112/openneuro.ds000221'),
    'healthy_ds004199': ('FCD presurgery veri seti sağlıklı kontrolleri, OpenNeuro ds004199', 'CC0', 'sağlıklı kontroller (T1, FLAIR)', 'https://doi.org/10.18112/openneuro.ds004199'),
    'healthy_ds007908': ('MS bilişsel bozulma çalışması sağlıklı kontrolleri, OpenNeuro ds007908', 'CC0', 'sağlıklı kontroller (T1, FLAIR)', 'https://openneuro.org/datasets/ds007908'),
}


# ------------------------------------------------------------------ uygulamadaki ön işlemenin Python eşi

def ts_normalize(g):
    step = max(1, len(g.ravel()) // 60000)
    s = np.sort(g.ravel()[::step])
    lo = s[int(np.floor(0.01 * (len(s) - 1)))]
    hi = s[int(np.floor(0.995 * (len(s) - 1)))]
    k = 1 / (hi - lo) if hi > lo else 1
    return np.clip((g - lo) * k, 0, 1).astype(np.float32)


def ts_headbox(g, box):
    x0, y0, w, h = [int(np.floor(v)) for v in box]
    vals = g[y0:y0 + h, x0:x0 + w]
    s = np.sort(vals.ravel())
    pct = lambda q: s[min(len(s) - 1, max(0, int(round(q * (len(s) - 1)))))]  # noqa: E731
    lo, hi = pct(0.05), pct(0.99)
    thr = lo + 0.15 * (hi - lo)
    on = vals > thr
    col = on.sum(0) / h
    row = on.sum(1) / w

    def span(a, n):
        a0, a1 = 0, n - 1
        while a0 < n and a[a0] < 0.06:
            a0 += 1
        while a1 > a0 and a[a1] < 0.06:
            a1 -= 1
        return (0, n - 1) if a1 - a0 < n * 0.2 else (a0, a1)

    cx0, cx1 = span(col, w)
    cy0, cy1 = span(row, h)
    return (x0 + cx0, y0 + cy0, cx1 - cx0 + 1, cy1 - cy0 + 1)


def ts_square(b):
    s = max(b[2], b[3]) * 1.08
    return (b[0] + b[2] / 2 - s / 2, b[1] + b[3] / 2 - s / 2, s)


def ts_tensor(g, sq, N=160):
    H, W = g.shape
    k = sq[2] / N
    xs = sq[0] + (np.arange(N) + 0.5) * k - 0.5
    ys = sq[1] + (np.arange(N) + 0.5) * k - 0.5
    fx, fy = np.meshgrid(xs, ys)
    xa, ya = np.floor(fx).astype(int), np.floor(fy).astype(int)
    ax, ay = fx - xa, fy - ya

    def v(xx, yy):
        ok = (xx >= 0) & (yy >= 0) & (xx < W) & (yy < H)
        out = np.zeros_like(fx, dtype=np.float32)
        out[ok] = g[yy[ok], xx[ok]]
        return out

    out = (v(xa, ya) * (1 - ax) + v(xa + 1, ya) * ax) * (1 - ay) + (v(xa, ya + 1) * (1 - ax) + v(xa + 1, ya + 1) * ax) * ay
    s = np.sort(out.ravel())
    pct = lambda q: s[min(len(s) - 1, max(0, int(round(q * (len(s) - 1)))))]  # noqa: E731
    lo, hi = pct(0.01), pct(0.995)
    return np.clip((out - lo) / max(1e-3, hi - lo), 0, 1).astype(np.float32)[None, None]


def embed(img192, size=320, off=(48, 70)):
    """192'lik kırpmayı DICOM kesiti gibi daha büyük siyah tuvale yerleştir (yükleme benzetimi)."""
    big = Image.fromarray(img192).resize((240, 240), Image.BILINEAR)
    c = np.zeros((size, size), np.uint8)
    a = np.asarray(big)
    c[off[1]:off[1] + 240, off[0]:off[0] + 240] = a
    return c


def collage_photo(imgs):
    """2×2 film kolajı (beyaz ızgara çizgileri, köşe yazıları) → telefonla eğik, parlamalı, JPEG fotoğraf."""
    tile = 300
    pad = 6
    W = 2 * tile + 3 * pad
    film = Image.new('L', (W, W), 235)
    d = ImageDraw.Draw(film)
    for i, a in enumerate(imgs):
        x = pad + (i % 2) * (tile + pad)
        y = pad + (i // 2) * (tile + pad)
        t = Image.fromarray(a).resize((tile, tile), Image.BILINEAR)
        film.paste(t, (x, y))
        d.text((x + 6, y + 4), f'{i + 1}', fill=230)
        d.text((x + tile - 40, y + tile - 14), 'R  L', fill=200)
    rgb = Image.merge('RGB', [film, film, film]).resize((W, W))
    # eğik çekim (perspektif) ve hafif döndürme
    Wd, Hd = 760, 720
    coeffs = perspective_coeffs([(40, 30), (Wd - 20, 10), (Wd - 45, Hd - 25), (15, Hd - 40)], [(0, 0), (W, 0), (W, W), (0, W)])
    photo = rgb.transform((Wd, Hd), Image.PERSPECTIVE, coeffs, Image.BILINEAR, fillcolor=(60, 58, 52))
    arr = np.asarray(photo).astype(np.float32)
    yy, xx = np.mgrid[0:Hd, 0:Wd]
    glare = 38 * np.exp(-(((xx - 520) / 180) ** 2 + ((yy - 200) / 140) ** 2))
    arr = arr * np.array([1.0, 0.98, 0.93]) + glare[..., None]
    arr += np.random.default_rng(3).normal(0, 4, arr.shape)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    return out


def perspective_coeffs(src, dst):
    A, B = [], []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def main():
    import onnxruntime as ort
    rep = json.load(open(os.path.join(OUT, 'report.json')))
    gate = json.load(open(os.path.join(OUT, 'gate.json')))
    ft = json.load(open(os.path.join(OUT, 'finding_thresholds.json')))
    onx = json.load(open(os.path.join(OUT, 'onnx.json')))
    os.makedirs(DST, exist_ok=True)
    shutil.copy(os.path.join(OUT, 'model.onnx'), os.path.join(DST, 'model.onnx'))
    sha = hashlib.sha256(open(os.path.join(DST, 'model.onnx'), 'rb').read()).hexdigest()
    assert sha == onx['sha256']
    # kaynak başına hasta/kesit sayıları
    per = {}
    for f in glob.glob(os.path.join(ROOT, 'brain_ds', '*', '*.npz')):
        z = np.load(f)
        s = str(z['source'])
        p = per.setdefault(s, {'subjects': set(), 'slices': 0})
        p['subjects'].add(str(z['subject']))
        p['slices'] += len(z['labels'])
    data = [{'name': SOURCES[s][0], 'license': SOURCES[s][1], 'role': SOURCES[s][2], 'url': SOURCES[s][3], 'patients': len(v['subjects']), 'slices': v['slices']} for s, v in sorted(per.items())]
    tc, tp = rep['test_clean'], rep['test_photo_simulated']
    metrics = {
        'test': {k: tc[k] for k in ('accuracy', 'macro_f1', 'abnormal_auc', 'abnormal_sens_at_0_5', 'abnormal_spec_at_0_5')} | {'per_class': {c: {k: tc['per_class'][c][k] for k in ('n', 'sensitivity', 'specificity', 'precision', 'f1', 'auc')} for c in CLASSES}},
        'photo': {k: tp[k] for k in ('accuracy', 'macro_f1', 'abnormal_auc', 'abnormal_sens_at_0_5', 'abnormal_spec_at_0_5')},
        'refAuc': rep['ref_distance_auc_normal_vs_lesion'],
        'lesionMapDice': rep['lesion_map_median_dice'],
        'patients': rep['n']['patients'],
        'finding': {'threshold': 0.7, 'lesionReported': ft['clean']['0.7']['lesion_reported'], 'correctPattern': ft['clean']['0.7']['lesion_reported_correct_pattern'], 'normalFalse': ft['clean']['0.7']['normal_false_finding'], 'lesionReportedPhoto': ft['photo']['0.7']['lesion_reported'], 'normalFalsePhoto': ft['photo']['0.7']['normal_false_finding'], 'oodRate': ft['clean']['ood_rate']},
        'gate': {'brainPass': gate['brain_test_pass_clean'], 'brainPassPhoto': gate['brain_test_pass_photo'], 'rejected': gate['negatives_test_rejected'], 'rejectedPhoto': gate['negatives_test_rejected_photo'], 'negatives': gate['negatives_total']},
        'slices': {k: rep['n'][k] for k in ('train', 'val', 'test')},
    }
    pc = tc['per_class']
    manifest = {
        'schema': 'kh-model-manifest/2',
        'id': MID,
        'name': 'Beyin MR örüntü benzerliği (Kan Haritası, gerçek hasta verisiyle eğitildi)',
        'version': '1.0.0',
        'modalities': ['MRI'],
        'task': 'pattern-2d',
        'format': 'onnx',
        'file': 'model.onnx',
        'sha256': sha,
        'license': 'CC BY 4.0 (model ağırlıkları, Kan Haritası); eğitim verisi CC BY 4.0 ve CC0 — atıflar NOTICE.txt',
        'source': 'Kan Haritası — scripts/models/brain_pattern (veri indirme, eğitim, doğrulama ve dışa aktarma betikleri)',
        'intendedUse': 'Beyin MR kesitini (fotoğraf, ekran görüntüsü ya da DICOM kesiti) sağlıklı referans kesitleriyle karşılaştırmak ve dört örüntüden hangisine benzediğini olasılıkla göstermek. Ön bilgi ve eğitim amaçlıdır; tanı koymaz.',
        'citation': '; '.join(f"{d['name']} ({d['license']}) {d['url']}" for d in data),
        'validation': (
            f"Hasta bazlı ayrık test ({metrics['patients']['test']} hasta, {metrics['slices']['test']} kesit): normal ↔ lezyonlu AUC {tc['abnormal_auc']}, "
            f"duyarlılık {tc['abnormal_sens_at_0_5']}, özgüllük {tc['abnormal_spec_at_0_5']}; 4 örüntü doğruluğu {tc['accuracy']} (makro F1 {tc['macro_f1']}). "
            f"Telefon fotoğrafı benzetimi: doğruluk {tp['accuracy']}, AUC {tp['abnormal_auc']}. PyTorch ↔ ONNX en büyük fark {onx['max_diff']:.1e}."
        ),
        'compatibleDevice': 'Tüm cihazlar (kesit başına < 1 sn, WASM).',
        'input': {'name': 'input', 'layout': 'NCHW', 'channels': 1, 'width': 160, 'height': 160, 'scale': 1, 'mean': [0], 'std': [1]},
        'output': {'logits': 'logits', 'mask': 'mask', 'refDist': 'ref', 'oodDist': 'ood', 'gate': 'gate'},
        'pattern': {
            'refQuantiles': rep['ref_quantiles'],
            'oodThreshold': rep['ood_threshold'],
            'gateThreshold': gate['threshold'],
            'maskThreshold': 0.5,
            'maxPanels': 16,
            'regions': ['brain'],
            'metrics': metrics,
            'data': data,
        },
        'labels': LABELS,
        'scoreThreshold': 0.7,
        'limitations': [
            'Yalnızca dört örüntüyü tanır: sağlıklı referansa benzer, beyin içi kitle (glioma/glioblastom), iç kulak yolu kitlesi (vestibüler schwannom), eski doku kaybı alanı (kronik inme / ameliyat boşluğu).',
            'Multipl skleroz ve diğer beyaz cevher lezyonları, metastaz, menenjiyom, hipofiz tümörü, kanama, akut inme, enfeksiyon/apse, hidrosefali, atrofi/demans, damar anomalileri ve çocukluk çağı hastalıklarını TANIMAZ; bu durumlarda "sağlıklıya benzer" ya da yanlış bir örüntü söyleyebilir.',
            'T1, kontrastlı T1, T2 ve FLAIR kesitleriyle eğitildi; difüzyon (DWI/ADC), SWI, perfüzyon ve BT görüntülerinde kullanılmamalıdır (eğitim dışı kapısı bunların çoğunu yakalar, hepsini değil).',
            f"Kesit düzeyindedir: tek bir kesite bakar, tüm seriyi ve önceki çekimleri değerlendirmez. Lezyonun görünmediği kesit sağlıklıya benzer çıkabilir. Testte örüntü başına duyarlılık: glioma {pc['glial_tumor']['sensitivity']}, iç kulak yolu {pc['cpa_tumor']['sensitivity']}, kronik lezyon {pc['chronic_lesion']['sensitivity']}; sağlıklı kesitte özgüllük {pc['normal']['specificity']}.",
            'Eğitim verisi ABD ve Avrupa merkezlerinden (çoğunlukla Siemens/GE cihazları); Türkiye\'deki cihaz ve çekim protokollerinde başarımı ayrıca ölçülmedi.',
            'İç kulak yolu örüntüsünün verisi tek bir merkezden (Londra, Gamma Knife planlama MR\'ı); testteki çok yüksek başarı bu merkeze özgü olabilir, başka cihazlarda daha düşük olabilir.',
            'Telefon fotoğrafı koşulları benzetimle test edildi (eğik çekim, bulanıklık, ekran deseni, yazılar); gerçek film/ekran fotoğraflarında başarım daha düşük olabilir.',
            'Sağlıklı referansa uzaklık kesitin düzeyine (kafa tabanı, tepe) ve sekansa göre de değişir; tek başına hastalık göstermez.',
            'Katkı haritası modelin örüntüye en çok katkı veren alanıdır; lezyon sınırı ya da ölçümü değildir.',
            f"Bir örüntü ancak olasılığı %70 ve üzerindeyse bildirilir. Hasta bazlı testte lezyonlu kesitlerin %{round(ft['clean']['0.7']['lesion_reported'] * 100)}'inde örüntü bildirildi (kaçırma %{round((1 - ft['clean']['0.7']['lesion_reported']) * 100)}); lezyonsuz kesitlerin %{round(ft['clean']['0.7']['normal_false_finding'] * 100)}'unda yanlışlıkla örüntü bildirildi.",
            'Çizim ya da karikatür gibi gerçek olmayan "beyin" görüntülerini kapı her zaman yakalayamaz; bunlarda olasılıklar anlamsızdır.',
            'Eğitim dışı kapısı gerçek röntgen, BT, beyin dışı MR, belge ve çizim görüntüleriyle eğitildi; bunların çoğunu yakalar ama her türlü görüntüyü yakalayamaz (ör. DWI/SWI beyin MR, çocuk beyni, olağan dışı ekran düzenleri).',
            'Klinik kullanım için onaylı tıbbi cihaz değildir; radyolog değerlendirmesinin yerini tutmaz.',
        ],
        'size': os.path.getsize(os.path.join(DST, 'model.onnx')),
    }
    json.dump(manifest, open(os.path.join(DST, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    notice = [manifest['name'], f"Sürüm {manifest['version']} · SHA-256 {sha}", 'Lisans: ' + manifest['license'], '',
              'Model: Kan Haritası tarafından gerçek, açık lisanslı beyin MR verisiyle eğitildi (2B evrişimli ağ, ~2 milyon parametre).',
              'Eğitim verisi ve atıflar:']
    notice += [f"  - {d['name']} — {d['license']} — {d['url']} ({d['patients']} kişi, {d['slices']} kesit; {d['role']})" for d in data]
    notice += ['', 'Eğitim dışı kapısı negatif örnekleri (beyin MR kesiti olmayan gerçek görüntüler, Imaging Data Commons):',
               '  - COVID-19-NY-SBU, COVID-19-AR (CC BY 4.0), LIDC-IDRI (CC BY 3.0) — göğüs röntgenleri ve göğüs BT',
               '  - Cancer Moonshot Biobank (CMB, CC BY 4.0) — beyin ve gövde BT; C4KC-KiTS (CC BY 3.0) — karın BT',
               '  - ProstateX (CC BY 3.0), ACRIN-Contralateral-Breast-MR, CPTAC-UCEC (CC BY 4.0), TCGA-KIRC, TCGA-LIHC (CC BY 3.0), Prostate-MRI-US-Biopsy (CC BY 4.0) — beyin dışı MR',
               '  - Sentetik belge/ekran görüntüleri, çizim "kafa" fantomları ve dokular (betikle üretildi)']
    notice += ['', 'UPENN-GBM: Bakas S. ve ark., Sci Data 2022. Vestibular-Schwannoma-SEG: Shapey J. ve ark., Sci Data 2021.',
               'ARC: Gibson M. ve ark., Sci Data 2024. MPI-LEMON: Babayan A. ve ark., Sci Data 2019. FCD: Schuch F. ve ark., Sci Data 2023.',
               'Imaging Data Commons: Fedorov A. ve ark., RadioGraphics 2023.', '', 'Doğrulama: ' + manifest['validation']]
    open(os.path.join(DST, 'NOTICE.txt'), 'w').write('\n'.join(notice) + '\n')
    idx_path = os.path.join(REPO, 'apps/web/public/ai-models/index.json')
    idx = json.load(open(idx_path))
    if MID not in idx['models']:
        idx['models'] = sorted(idx['models'] + [MID])
    json.dump(idx, open(idx_path, 'w'), indent=1)
    open(idx_path, 'a').write('\n')

    # ------------------------------------------------------------ fikstürler
    os.makedirs(FIX, exist_ok=True)
    picks = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'brain_ds', '*', '*.npz'))):
        z = np.load(f)
        if str(z['split']) != 'test':
            continue
        for i, (lab, pl, area) in enumerate(zip(z['labels'], z['plane'], z['area'])):
            c = CLASSES[int(lab)]
            if pl != 'ax':
                continue
            score = float(area) if lab else (1.0 if str(z['source']).startswith('healthy') and str(z['seq'][i]) == 'FLAIR' else 0.0)
            if c not in picks or score > picks[c][0]:
                picks[c] = (score, z['imgs'][i], str(z['source']), str(z['seq'][i]), str(z['subject']))
    sess = ort.InferenceSession(os.path.join(DST, 'model.onnx'), providers=['CPUExecutionProvider'])
    exp = {'model': MID, 'sha256': sha, 'images': {}}
    embedded = []
    for c in CLASSES:
        _, img, src, sq, subj = picks[c]
        e = embed(img)
        embedded.append(e)
        Image.fromarray(e).save(os.path.join(FIX, f'{c}.png'))
        g = ts_normalize(e.astype(np.float32))
        H, W = g.shape
        hb = ts_headbox(g, (0, 0, W, H))
        sq3 = ts_square(hb)
        x = ts_tensor(g, sq3)
        lo, mk, rf, od, gt = sess.run(None, {'input': x})
        p = np.exp(lo[0] - lo[0].max()); p /= p.sum()
        exp['images'][c] = {'file': f'{c}.png', 'source': SOURCES[src][0], 'license': SOURCES[src][1], 'sequence': sq, 'headBox': [int(v) for v in hb], 'probs': [round(float(v), 4) for v in p], 'ref': round(float(rf[0]), 4), 'ood': round(float(od[0]), 4), 'gate': round(float(gt[0]), 4)}
        print(c, src, sq, [round(float(v), 3) for v in p], 'ref', round(float(rf[0]), 2), 'ood', round(float(od[0]), 2), '/', round(rep['ood_threshold'], 2), 'kapı', round(float(gt[0]), 3), '/', round(gate['threshold'], 3))
    collage_photo(embedded).save(os.path.join(FIX, 'kolaj-foto.jpg'), quality=82)
    json.dump(exp, open(os.path.join(FIX, 'expected.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(FIX, 'BENIOKU.txt'), 'w').write(
        'Gerçek beyin MR kesitleri (anonim, açık lisanslı) — model doğrulama fikstürleri.\n'
        'Her sınıftan, HASTA BAZLI TEST kümesinden (eğitimde görülmemiş) lezyon alanı en büyük eksenel kesit; seçim kurala dayalıdır.\n'
        'Kaynaklar: UPENN-GBM ve Vestibular-Schwannoma-SEG (TCIA/IDC, CC BY 4.0); ARC ds004884, MPI-LEMON ds000221, FCD ds004199 (OpenNeuro, CC0).\n'
        'kolaj-foto.jpg: aynı dört kesitten oluşturulmuş film kolajının telefon fotoğrafı benzetimi (perspektif, parlama, gürültü, JPEG).\n'
        'expected.json: uygulamadaki ön işlemenin Python eşiyle modelin çıktıları (TypeScript ↔ Python eşdeğerlik testi).\n')


if __name__ == '__main__':
    main()
