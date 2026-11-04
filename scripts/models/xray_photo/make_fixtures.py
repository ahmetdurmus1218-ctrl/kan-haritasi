"""
Röntgen fotoğrafı / ekran görüntüsü doğrulama fikstürleri (fixtures/imaging/rontgen-foto).

Kaynak: fixtures/imaging/nih-cxr-00000001_000.png (NIH ChestX-ray14; kısıtlamasız kullanım, atıfla).
Aynı röntgenden dört benzetim üretilir ve uygulamadaki ön işlemenin Python eşiyle (xray_eval.py) röntgen alanı kutusu
ve model skorları yazılır (A: tüm görüntünün merkez karesi, B: röntgen alanı + merkez kare). TypeScript testi
(apps/web/src/__tests__/xrayPhoto.test.ts) aynı kutuyu ve skorları bulmalıdır.
"""
import io, json, os, sys
import numpy as np
from PIL import Image
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xray_eval import MODEL, KEYS, calib, app_tensor, gray_of, lightbox, photograph, variant_input, viewer, xray_region  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(REPO, 'fixtures/imaging/nih-cxr-00000001_000.png')
DST = os.path.join(REPO, 'fixtures/imaging/rontgen-foto')


def jpeg(im, q):
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=q)
    return buf.getvalue()


def main():
    os.makedirs(DST, exist_ok=True)
    base = Image.open(SRC)
    base.load()
    items = {
        'ekran-goruntusu.jpg': jpeg(viewer(base, np.random.default_rng(11), portrait=False).convert('RGB'), 90),
        'telefon-ekran-goruntusu.jpg': jpeg(viewer(base, np.random.default_rng(12), portrait=True).convert('RGB'), 90),
        'monitor-foto.jpg': jpeg(photograph(viewer(base, np.random.default_rng(13), portrait=False), np.random.default_rng(13), 'monitor'), 85),
        'film-foto.jpg': jpeg(photograph(lightbox(base, np.random.default_rng(14)), np.random.default_rng(14), 'film'), 85),
    }
    sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    inp = sess.get_inputs()[0].name
    g0 = gray_of(base.convert('RGB'))
    ref = calib(sess.run(None, {inp: app_tensor(g0)})[0][0])
    exp = {'source': 'nih-cxr-00000001_000.png', 'keys': KEYS, 'original': [round(float(v), 4) for v in ref], 'images': {}}
    for name, data in items.items():
        open(os.path.join(DST, name), 'wb').write(data)
        im = Image.open(io.BytesIO(data)).convert('RGB')
        g = gray_of(im)
        box = xray_region(g)
        a = calib(sess.run(None, {inp: variant_input(g, 'A')})[0][0])
        b = calib(sess.run(None, {inp: variant_input(g, 'B')})[0][0])
        exp['images'][name] = {'size': [im.width, im.height], 'region': list(box), 'scoresA': [round(float(v), 4) for v in a], 'scoresB': [round(float(v), 4) for v in b],
                               'meanAbsDiffA': round(float(np.abs(a - ref).mean()), 4), 'meanAbsDiffB': round(float(np.abs(b - ref).mean()), 4)}
        print(name, box, 'A', exp['images'][name]['meanAbsDiffA'], 'B', exp['images'][name]['meanAbsDiffB'])
    json.dump(exp, open(os.path.join(DST, 'expected.json'), 'w'), indent=1, ensure_ascii=False)
    open(os.path.join(DST, 'BENIOKU.txt'), 'w').write(
        'Röntgen fotoğrafı / ekran görüntüsü fikstürleri (benzetim) — kaynak: nih-cxr-00000001_000.png (NIH ChestX-ray14, kısıtlamasız, atıfla).\n'
        'ekran-goruntusu.jpg: bilgisayardaki görüntüleyici (koyu arayüz, araç çubuğu, küçük resimler, yazılar).\n'
        'telefon-ekran-goruntusu.jpg: telefonda dikey e-Nabız benzeri ekran görüntüsü.\n'
        'monitor-foto.jpg: ekranın telefonla fotoğrafı (eğik, moiré, parlama, siyah seviyesi, bulanıklık, JPEG).\n'
        'film-foto.jpg: negatoskoptaki filmin fotoğrafı.\n'
        'expected.json: uygulamadaki ön işlemenin Python eşiyle röntgen alanı kutusu ve model skorları (A: tüm görüntü, B: röntgen alanı).\n'
        'Üretim: scripts/models/xray_photo/make_fixtures.py\n')


if __name__ == '__main__':
    main()
