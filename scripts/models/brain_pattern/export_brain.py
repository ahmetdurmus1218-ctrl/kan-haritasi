"""
Eğitilmiş beyin MR örüntü modelini doğrular, kalibre eder ve ONNX'e çevirir.

  1. Gömme uzayı (192-b): sağlıklı (normal) eğitim kesitlerinin ortalaması + PCA-64 beyazlatma → "sağlıklı
     referansa uzaklık" = ||W(e − μ)||² / k. Doğrulama kümesindeki sağlıklı kesitlerin uzaklık yüzdelikleri
     (refQuantiles) uygulamada "sağlıklı kesitlerin %X'inden farklı" diye çevrilir.
  2. Eğitim dağılımı dışı (OOD): sınıf merkezleri + ortak (havuzlanmış) kovaryans → en yakın merkeze uzaklık;
     eşik doğrulama kümesinde %99,5'lik. Beyin MR olmayan gerçek görüntülerde (göğüs röntgeni, BT kesitleri,
     belge fotoğrafı) eşiği aşması denetlenir.
  3. Hasta bazlı ayrık TEST kümesinde başarım (artırmasız ve fotoğraf benzetimli), sekans kırılımı.
  4. ONNX (opset 17): logits, mask (sigmoid), ref, ood; PyTorch ↔ ONNX Runtime çıktı karşılaştırması.
"""
import os, sys, json, glob, hashlib
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(__file__))
from train_brain import Net, load, predict, metrics, CLASSES, OUT, S, to_t, center  # noqa: E402

torch.set_num_threads(int(os.environ.get('THREADS', '4')))
K = 64


class Exported(nn.Module):
    def __init__(self, net, mu, W, means, Wp, gate=None):
        super().__init__()
        self.net = net
        self.gate = gate
        self.register_buffer('mu', torch.tensor(mu, dtype=torch.float32))
        self.register_buffer('W', torch.tensor(W, dtype=torch.float32))
        self.register_buffer('means', torch.tensor(means, dtype=torch.float32))
        self.register_buffer('Wp', torch.tensor(Wp, dtype=torch.float32))

    def forward(self, x):
        logits, seg, emb = self.net(x)
        z = (emb - self.mu) @ self.W.T
        ref = (z * z).mean(1)
        d = emb.unsqueeze(1) - self.means.unsqueeze(0)  # [B, C, 192]
        zp = d @ self.Wp.T  # [B, C, k]
        ood = (zp * zp).mean(2).min(1).values
        if self.gate is None:
            return logits, torch.sigmoid(seg), ref, ood
        from train_gate import features
        g = torch.sigmoid(self.gate(features(self.net, x)))
        return logits, torch.sigmoid(seg), ref, ood, g


def whiten(E, k):
    mu = E.mean(0)
    X = E - mu
    U, Sv, Vt = np.linalg.svd(X, full_matrices=False)
    var = (Sv ** 2) / (len(E) - 1)
    W = Vt[:k] / np.sqrt(var[:k] + 1e-6)[:, None]
    return mu, W


def main():
    X, Y, M, split, seq, src, subj = load()
    net = Net()
    net.load_state_dict(torch.load(os.path.join(OUT, 'best.pt')))
    net.eval()
    tr, va, te = [np.where(split == s)[0] for s in ('train', 'val', 'test')]
    # eğitim gömmeleri (artırmasız)
    _, Etr, _ = predict(net, X, M, tr)
    mu, W = whiten(Etr[Y[tr] == 0], K)
    means = np.stack([Etr[Y[tr] == c].mean(0) for c in range(4)])
    Wc = np.concatenate([Etr[Y[tr] == c] - means[c] for c in range(4)])
    _, Wp = whiten(Wc + 0, K)  # ortak kovaryans (merkezler çıkarılmış)
    from train_gate import Gate
    gate = Gate()
    gate.load_state_dict(torch.load(os.path.join(OUT, 'gate.pt')))
    gate.eval()
    exp = Exported(net, mu, W, means, Wp, gate).eval()

    def run(ids, photo=False):
        P, R, O, SEG = [], [], [], []
        gen = torch.Generator().manual_seed(321)
        from train_brain import augment
        for i in range(0, len(ids), 256):
            b = ids[i:i + 256]
            img, les = to_t(X, M, b)
            x, _ = augment(img, les, strong=True, gen=gen) if photo else center(img, les)
            with torch.no_grad():
                lo, sg, r, o, _g = exp(x)
            P.append(F.softmax(lo, 1).numpy()); R.append(r.numpy()); O.append(o.numpy()); SEG.append(sg.numpy())
        return np.concatenate(P), np.concatenate(R), np.concatenate(O), np.concatenate(SEG)

    Pv, Rv, Ov, _ = run(va)
    qs = [0, 5, 10, 25, 50, 75, 90, 95, 97.5, 99, 99.5, 100]
    ref_q = [[q, float(np.percentile(Rv[Y[va] == 0], q))] for q in qs]
    ood_thr = float(np.percentile(Ov, 99.5))
    Pt, Rt, Ot, SEGt = run(te)
    Ptp, Rtp, Otp, _ = run(te, photo=True)
    m_clean = metrics(Pt, Y[te])
    m_photo = metrics(Ptp, Y[te])
    # sekans kırılımı (test, artırmasız)
    by_seq = {}
    for sq in sorted(set(seq[te])):
        idx = seq[te] == sq
        yy = Y[te][idx]
        pp = Pt[idx]
        by_seq[str(sq)] = dict(n=int(idx.sum()), accuracy=round(float((pp.argmax(1) == yy).mean()), 4))
    # sağlıklı referans uzaklığının ayırıcılığı (test): normal ↔ lezyonlu
    from train_brain import auc
    ref_auc = float(auc(Rt, Y[te] != 0))
    # lezyon haritası: lezyonlu test kesitlerinde Dice (40×40)
    les_t = np.unpackbits(M[te], axis=-1)[..., :192].astype(np.float32)
    tgt = F.adaptive_avg_pool2d(F.interpolate(torch.from_numpy(les_t).unsqueeze(1), size=(S, S), mode='bilinear'), (40, 40)).numpy()[:, 0] > 0.5
    pred = SEGt[:, 0] > 0.5
    pos = Y[te] != 0
    inter = (pred & tgt)[pos].sum((1, 2))
    dice = (2 * inter + 1e-6) / (pred[pos].sum((1, 2)) + tgt[pos].sum((1, 2)) + 1e-6)
    seg_dice = float(np.median(dice))
    ood_rate_val = float((Ov > ood_thr).mean())
    ood_rate_test = float((Ot > ood_thr).mean())
    report = dict(test_clean=m_clean, test_photo_simulated=m_photo, by_sequence=by_seq, ref_distance_auc_normal_vs_lesion=round(ref_auc, 4), lesion_map_median_dice=round(seg_dice, 4),
                  ood_threshold=ood_thr, ood_rate_val=round(ood_rate_val, 4), ood_rate_test=round(ood_rate_test, 4), ref_quantiles=ref_q,
                  n=dict(train=int(len(tr)), val=int(len(va)), test=int(len(te)), patients=dict(train=len(set(subj[tr])), val=len(set(subj[va])), test=len(set(subj[te])))),
                  per_source={s: int((src == s).sum()) for s in sorted(set(src))})
    json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1, ensure_ascii=False)
    print(json.dumps({k: report[k] for k in ('ref_distance_auc_normal_vs_lesion', 'lesion_map_median_dice', 'ood_threshold', 'ood_rate_test')}, indent=1))
    print('TEST (artırmasız):', json.dumps({k: m_clean[k] for k in ('accuracy', 'macro_f1', 'abnormal_auc', 'abnormal_sens_at_0_5', 'abnormal_spec_at_0_5')}))
    print('TEST (fotoğraf benzetimli):', json.dumps({k: m_photo[k] for k in ('accuracy', 'macro_f1', 'abnormal_auc', 'abnormal_sens_at_0_5', 'abnormal_spec_at_0_5')}))
    for c in CLASSES:
        print(' ', c, m_clean['per_class'][c])

    # ONNX
    path = os.path.join(OUT, 'model.onnx')
    dummy = torch.zeros(1, 1, S, S)
    torch.onnx.export(exp, dummy, path, input_names=['input'], output_names=['logits', 'mask', 'ref', 'ood', 'gate'], opset_version=17, dynamo=False, do_constant_folding=True)
    import onnxruntime as ort
    sess = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    img, les = to_t(X, M, te[:16])
    x, _ = center(img, les)
    with torch.no_grad():
        ref_out = [t.numpy() for t in exp(x[:1])]
    onx = sess.run(None, {'input': x[:1].numpy()})
    diff = max(float(np.abs(a - b).max()) for a, b in zip(ref_out, onx))
    sha = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    print('onnx en büyük fark', diff, 'boyut', os.path.getsize(path), 'sha256', sha)
    json.dump(dict(max_diff=diff, sha256=sha, bytes=os.path.getsize(path)), open(os.path.join(OUT, 'onnx.json'), 'w'))


if __name__ == '__main__':
    main()
