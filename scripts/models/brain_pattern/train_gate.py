"""
Eğitim dışı kapısı: "bu görüntü beyin MR kesiti mi?" (omurga dondurulmuş; 4 örüntü başarımı değişmez).

Özellikler: omurganın 3 katmanının (40×40, 20×20, 10×10) global ortalama ve standart sapma havuzlaması
(2 × (64 + 128 + 192) = 768). Küçük MLP → "beyin MR kesiti değil" olasılığı. Pozitifler beyin MR eğitim
kesitleri, negatifler gerçek röntgen/BT/beyin dışı MR + sentetik belge/çizim/doku. Hepsi fotoğraf artırmasından
geçer. Eşik: beyin doğrulama kesitlerinin %99,5'i kapıdan geçecek biçimde (en az 0,5).
"""
import os, sys, glob, json, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(__file__))
from train_brain import Net, load, augment, center, OUT, ROOT  # noqa: E402

torch.set_num_threads(int(os.environ.get('THREADS', '4')))
torch.manual_seed(11)
rng = np.random.default_rng(11)


class Gate(nn.Module):
    def __init__(self):
        super().__init__()
        self.mlp = nn.Sequential(nn.Linear(768, 128), nn.ReLU(), nn.Dropout(0.2), nn.Linear(128, 1))

    def forward(self, f):
        return self.mlp(f).squeeze(1)


def features(net, x):
    x = net.stem(x)
    x = net.l1(x)
    f2 = net.l2(x)
    f3 = net.l3(f2)
    f4 = net.l4(f3)
    return torch.cat([t for f in (f2, f3, f4) for t in (f.mean((2, 3)), f.flatten(2).std(2))], 1)


def load_neg():
    X, split, kind = [], [], []
    for f in sorted(glob.glob(os.path.join(ROOT, 'neg_ds', '*', '*.npz'))):
        z = np.load(f)
        X.append(z['imgs'])
        split += [str(z['split'])] * len(z['imgs'])
        kind += [str(z['kind'])] * len(z['imgs'])
    return np.concatenate(X), np.array(split), np.array(kind)


def tens(X, ids):
    return torch.from_numpy(X[ids]).float().div(255).unsqueeze(1)


@torch.no_grad()
def score(net, gate, imgs, photo=False, bs=256):
    out = []
    gen = torch.Generator().manual_seed(5)
    for i in range(0, len(imgs), bs):
        x = imgs[i:i + bs]
        z = torch.zeros_like(x)
        xx, _ = augment(x, z, strong=True, gen=gen) if photo else center(x, z)
        out.append(torch.sigmoid(gate(features(net, xx))))
    return torch.cat(out).numpy()


def main():
    X, Y, M, split, seq, src, subj = load()
    NX, nsplit, nkind = load_neg()
    print('negatif', len(NX), {k: int((nkind == k).sum()) for k in sorted(set(nkind))}, {s: int((nsplit == s).sum()) for s in ('train', 'val', 'test')}, flush=True)
    net = Net()
    net.load_state_dict(torch.load(os.path.join(OUT, 'best.pt')))
    net.eval()
    for p in net.parameters():
        p.requires_grad_(False)
    gate = Gate()
    opt = torch.optim.AdamW(gate.parameters(), lr=2e-3, weight_decay=1e-4)
    ptr = np.where(split == 'train')[0]
    ntr = np.where(nsplit == 'train')[0]
    # Negatif türleri dengeli örneklensin (belge/çizim çok, beyin BT az olmasın)
    kinds = sorted(set(nkind[ntr]))
    by_kind = {k: ntr[nkind[ntr] == k] for k in kinds}
    epochs, steps, half = int(os.environ.get('EPOCHS', '6')), 120, 48
    for ep in range(epochs):
        gate.train()
        t0 = time.time()
        tot = 0.0
        for st in range(steps):
            pi = rng.choice(ptr, half)
            ni = np.concatenate([rng.choice(by_kind[k], max(1, half // len(kinds))) for k in kinds])
            x = torch.cat([torch.from_numpy(X[pi]).float().div(255).unsqueeze(1), tens(NX, ni)])
            y = torch.cat([torch.zeros(len(pi)), torch.ones(len(ni))])
            with torch.no_grad():
                xx, _ = augment(x, torch.zeros_like(x), strong=True)
                f = features(net, xx)
            loss = F.binary_cross_entropy_with_logits(gate(f), y)
            opt.zero_grad()
            loss.backward()
            opt.step()
            tot += float(loss.detach())
        print(f'ep{ep} kayıp {tot / steps:.4f} {time.time() - t0:.0f}s', flush=True)
    gate.eval()
    torch.save(gate.state_dict(), os.path.join(OUT, 'gate.pt'))
    # Eşik: beyin doğrulama kesitlerinin %99,5'i geçsin (fotoğraf benzetimli dahil)
    pva = np.where(split == 'val')[0]
    sv = np.concatenate([score(net, gate, torch.from_numpy(X[pva]).float().div(255).unsqueeze(1)), score(net, gate, torch.from_numpy(X[pva]).float().div(255).unsqueeze(1), photo=True)])
    thr = float(max(0.5, np.percentile(sv, 99.5)))
    pte = np.where(split == 'test')[0]
    st_clean = score(net, gate, torch.from_numpy(X[pte]).float().div(255).unsqueeze(1))
    st_photo = score(net, gate, torch.from_numpy(X[pte]).float().div(255).unsqueeze(1), photo=True)
    nte = np.where(nsplit == 'test')[0]
    sn = score(net, gate, tens(NX, nte))
    snp = score(net, gate, tens(NX, nte), photo=True)
    rep = {
        'threshold': thr,
        'brain_test_pass_clean': round(float((st_clean <= thr).mean()), 4),
        'brain_test_pass_photo': round(float((st_photo <= thr).mean()), 4),
        'negatives_test_rejected': {k: round(float((sn[nkind[nte] == k] > thr).mean()), 4) for k in sorted(set(nkind[nte]))},
        'negatives_test_rejected_photo': {k: round(float((snp[nkind[nte] == k] > thr).mean()), 4) for k in sorted(set(nkind[nte]))},
        'negatives_test_n': {k: int((nkind[nte] == k).sum()) for k in sorted(set(nkind[nte]))},
        'negatives_total': {k: int((nkind == k).sum()) for k in sorted(set(nkind))},
    }
    json.dump(rep, open(os.path.join(OUT, 'gate.json'), 'w'), indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
