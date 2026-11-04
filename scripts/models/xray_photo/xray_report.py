"""xray_eval.py'nin ham skorlarından (xray_scores.npz) uygulamadaki kalibre skorlarla özet: AUC (pnömoni), orijinale göre
ortalama sapma, %60 eşiğinde karar değişimi, en yüksek bulgunun aynı kalması; koşul × ön işleme."""
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xray_eval import HERE, KEYS, MAN, PNEU, auc, boot_ci, calib  # noqa: E402
z = np.load(os.path.join(HERE, 'xray_scores.npz'))
y = z['y'].astype(bool)
conds = ['orijinal', 'ekran_goruntusu', 'monitor_foto', 'film_foto']
variants = ['A', 'B', 'C']
thr = MAN['scoreThreshold']
ref = calib(z['orijinal_A'])
out = {'n': int(len(y)), 'positives': int(y.sum()), 'negatives': int((~y).sum()), 'threshold': thr, 'results': {}}
for c in conds:
    for v in variants:
        s = calib(z[f'{c}_{v}'])
        pn = s[:, PNEU]
        flag_ref = ref >= thr
        flag = s >= thr
        out['results'][f'{c}/{v}'] = dict(
            pneumonia_auc=round(auc(pn, y), 4),
            pneumonia_auc_ci95=boot_ci(pn, y),
            mean_abs_diff=round(float(np.abs(s - ref).mean()), 4),
            flags_changed=round(float((flag != flag_ref).mean()), 4),
            any_flag_changed_per_image=round(float((flag != flag_ref).any(1).mean()), 4),
            top_same=round(float((s.argmax(1) == ref.argmax(1)).mean()), 4),
            flags_per_image=round(float(flag.sum(1).mean()), 3),
        )
        print(f'{c:16s} {v}', out['results'][f'{c}/{v}'])
json.dump(out, open(os.path.join(HERE, 'xray_report.json'), 'w'), indent=1, ensure_ascii=False)
