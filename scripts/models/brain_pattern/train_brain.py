"""
Beyin MR kesiti örüntü modeli: sınıf (normal / glial tümör / iç kulak yolu-KPA tümörü / kronik lezyon)
+ lezyon olasılık haritası + sağlıklı referansa uzaklık + eğitim dışı (OOD) uzaklığı.

Eğitim gerçek, açık lisanslı veriyle yapılır (build_brain_dataset.py). Bölmeler hasta bazlıdır.
Fotoğraf koşullarına dayanıklılık için toplu (GPU'suz) artırma: afin, perspektif, gama, kontrast,
bulanıklık, gürültü, düşük çözünürlük, aydınlatma eğimi, moiré, kenar yazıları, film çerçevesi.

Çıktılar (ONNX, opset 17):
  input  [1,1,160,160]  (piksel 0–1, görüntü başına %1–%99,5 yüzdelik normalizasyon)
  logits [1,4]
  mask   [1,1,40,40]    lezyon olasılığı (sigmoid)
  ref    [1]            sağlıklı referans dağılımına (PCA-beyazlatılmış) uzaklık²/k
  ood    [1]            en yakın sınıf merkezine (ortak kovaryans) uzaklık²/k
"""
import os, sys, glob, json, time, math, random
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.set_num_threads(int(os.environ.get('THREADS', '4')))
ROOT = os.environ.get('KH_BRAIN_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
DS = os.path.join(ROOT, 'brain_ds')
OUT = os.path.join(ROOT, 'brain_model')
os.makedirs(OUT, exist_ok=True)
CLASSES = ['normal', 'glial_tumor', 'cpa_tumor', 'chronic_lesion']
S = 160
SEED = 7
rng = np.random.default_rng(SEED)
torch.manual_seed(SEED)
random.seed(SEED)


def load():
    X, Y, M, split, seq, src, subj = [], [], [], [], [], [], []
    for f in sorted(glob.glob(os.path.join(DS, '*', '*.npz'))):
        z = np.load(f)
        n = len(z['labels'])
        X.append(z['imgs'])
        Y.append(z['labels'].astype(np.int64))
        M.append(z['lesion'])
        split += [str(z['split'])] * n
        seq += list(z['seq'])
        src += [str(z['source'])] * n
        subj += [str(z['subject'])] * n
    return np.concatenate(X), np.concatenate(Y), np.concatenate(M), np.array(split), np.array(seq), np.array(src), np.array(subj)


# ------------------------------------------------------------------ model

class Block(nn.Module):
    def __init__(self, a, b, s):
        super().__init__()
        self.c1 = nn.Conv2d(a, b, 3, s, 1, bias=False)
        self.b1 = nn.BatchNorm2d(b)
        self.c2 = nn.Conv2d(b, b, 3, 1, 1, bias=False)
        self.b2 = nn.BatchNorm2d(b)
        self.sk = None if (a == b and s == 1) else nn.Sequential(nn.Conv2d(a, b, 1, s, bias=False), nn.BatchNorm2d(b))

    def forward(self, x):
        y = F.relu(self.b1(self.c1(x)))
        y = self.b2(self.c2(y))
        return F.relu(y + (x if self.sk is None else self.sk(x)))


class Net(nn.Module):
    def __init__(self, nc=4):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(1, 24, 3, 2, 1, bias=False), nn.BatchNorm2d(24), nn.ReLU())  # 80
        self.l1 = nn.Sequential(Block(24, 32, 1))  # 80
        self.l2 = nn.Sequential(Block(32, 64, 2), Block(64, 64, 1))  # 40
        self.l3 = nn.Sequential(Block(64, 128, 2), Block(128, 128, 1))  # 20
        self.l4 = nn.Sequential(Block(128, 192, 2), Block(192, 192, 1))  # 10
        self.drop = nn.Dropout(0.25)
        self.fc = nn.Linear(192, nc)
        self.lat2 = nn.Conv2d(64, 64, 1)
        self.lat3 = nn.Conv2d(128, 64, 1)
        self.lat4 = nn.Conv2d(192, 64, 1)
        self.head = nn.Sequential(nn.Conv2d(64, 64, 3, 1, 1), nn.ReLU(), nn.Conv2d(64, 1, 1))

    def forward(self, x):
        x = self.stem(x)
        x = self.l1(x)
        f2 = self.l2(x)
        f3 = self.l3(f2)
        f4 = self.l4(f3)
        emb = f4.mean((2, 3))
        logits = self.fc(self.drop(emb))
        p = self.lat4(f4)
        p = F.interpolate(p, scale_factor=2, mode='bilinear', align_corners=False) + self.lat3(f3)
        p = F.interpolate(p, scale_factor=2, mode='bilinear', align_corners=False) + self.lat2(f2)
        seg = self.head(p)  # 40×40 logit
        return logits, seg, emb


# ------------------------------------------------------------------ artırma (toplu, tensör)

def gauss_kernel(sigma):
    r = max(1, int(3 * sigma))
    x = torch.arange(-r, r + 1, dtype=torch.float32)
    k = torch.exp(-0.5 * (x / sigma) ** 2)
    return k / k.sum()


def blur(x, sigma):
    k = gauss_kernel(sigma)
    r = (len(k) - 1) // 2
    x = F.conv2d(F.pad(x, (r, r, 0, 0), mode='replicate'), k.view(1, 1, 1, -1))
    return F.conv2d(F.pad(x, (0, 0, r, r), mode='replicate'), k.view(1, 1, -1, 1))


def pnorm(x):
    """Görüntü başına %1–%99,5 yüzdelik normalizasyon (uygulamadaki ön işlemeyle aynı)."""
    B = x.shape[0]
    flat = x.view(B, -1)
    lo = torch.quantile(flat, 0.01, dim=1, keepdim=True)
    hi = torch.quantile(flat, 0.995, dim=1, keepdim=True)
    return ((flat - lo) / (hi - lo).clamp_min(1e-3)).clamp(0, 1).view_as(x)


def augment(img, msk, strong=True, gen=None):
    """img [B,1,192,192] 0–1, msk [B,1,192,192] → [B,1,160,160], [B,1,40,40]."""
    B = img.shape[0]
    g = gen or torch.Generator().manual_seed(random.randint(0, 2 ** 31))
    U = lambda *s, a=0.0, b=1.0: torch.rand(*s, generator=g) * (b - a) + a  # noqa: E731
    ang = U(B, a=-15, b=15) * math.pi / 180
    sc = U(B, a=0.86, b=1.14)
    tx, ty = U(B, a=-0.07, b=0.07), U(B, a=-0.07, b=0.07)
    flip = (U(B) < 0.5).float() * 2 - 1
    cos, sin = torch.cos(ang) / sc, torch.sin(ang) / sc
    theta = torch.zeros(B, 2, 3)
    theta[:, 0, 0] = cos * flip
    theta[:, 0, 1] = -sin
    theta[:, 1, 0] = sin * flip
    theta[:, 1, 1] = cos
    theta[:, 0, 2] = tx
    theta[:, 1, 2] = ty
    grid = F.affine_grid(theta, (B, 1, S, S), align_corners=False)
    if strong:
        # hafif perspektif (telefonla eğik çekim)
        px, py = U(B, a=-0.08, b=0.08), U(B, a=-0.08, b=0.08)
        on = (U(B) < 0.4).float()
        gx, gy = grid[..., 0], grid[..., 1]
        den = 1 + on.view(B, 1, 1) * (px.view(B, 1, 1) * gx + py.view(B, 1, 1) * gy)
        grid = torch.stack([gx / den, gy / den], -1)
    x = F.grid_sample(img, grid, mode='bilinear', padding_mode='zeros', align_corners=False)
    m = F.grid_sample(msk, grid, mode='bilinear', padding_mode='zeros', align_corners=False)
    if strong:
        # gama ve kontrast
        x = x.clamp(0, 1) ** U(B, 1, 1, 1, a=0.6, b=1.6)
        x = x * U(B, 1, 1, 1, a=0.75, b=1.25) + U(B, 1, 1, 1, a=-0.08, b=0.08)
        # düşük çözünürlük
        lo = U(B) < 0.35
        if lo.any():
            f = float(U(1, a=0.3, b=0.7))
            sm = F.interpolate(x[lo], scale_factor=f, mode='bilinear', align_corners=False)
            x[lo] = F.interpolate(sm, size=(S, S), mode='bilinear', align_corners=False)
        # bulanıklık
        bl = U(B) < 0.3
        if bl.any():
            x[bl] = blur(x[bl], float(U(1, a=0.6, b=1.6)))
        # aydınlatma eğimi ve vinyet (ekran/film fotoğrafı)
        yy, xx = torch.meshgrid(torch.linspace(-1, 1, S), torch.linspace(-1, 1, S), indexing='ij')
        il = U(B) < 0.5
        if il.any():
            gxx, gyy = U(int(il.sum()), 1, 1, a=-0.25, b=0.25), U(int(il.sum()), 1, 1, a=-0.25, b=0.25)
            vig = 1 - U(int(il.sum()), 1, 1, a=0, b=0.35) * (xx ** 2 + yy ** 2) / 2
            x[il] = x[il] * (1 + gxx * xx + gyy * yy).unsqueeze(1) * vig.unsqueeze(1) + U(int(il.sum()), 1, 1, 1, a=0, b=0.12)
        # moiré (ekran fotoğrafı)
        mo = U(B) < 0.15
        if mo.any():
            fr = float(U(1, a=20, b=60))
            a2 = float(U(1, a=0, b=math.pi))
            pat = torch.sin(fr * (xx * math.cos(a2) + yy * math.sin(a2)))
            x[mo] = x[mo] + 0.04 * pat
        # gürültü
        x = x + torch.randn(x.shape, generator=g) * U(B, 1, 1, 1, a=0, b=0.05)
        # film/ekran yazıları ve ızgara çizgileri (kenarlarda)
        tx_on = (U(B) < 0.3).nonzero().flatten().tolist()
        for i in tx_on:
            for _ in range(random.randint(1, 4)):
                h, w = random.randint(3, 8), random.randint(10, 50)
                yy0 = random.choice([random.randint(0, 18), random.randint(S - 20, S - h)])
                xx0 = random.randint(0, S - w)
                x[i, 0, yy0:yy0 + h, xx0:xx0 + w] = torch.rand(h, w) * 0.5 + 0.5
        fr_on = (U(B) < 0.12).nonzero().flatten().tolist()
        for i in fr_on:
            t = random.randint(1, 3)
            v = random.choice([0.0, 1.0])
            x[i, 0, :t, :] = v
            x[i, 0, -t:, :] = v
            x[i, 0, :, :t] = v
            x[i, 0, :, -t:] = v
    x = pnorm(x.clamp(-0.5, 2))
    m = F.adaptive_avg_pool2d(m, (40, 40))
    return x, (m > 0.5).float()


def center(img, msk):
    """Değerlendirme: artırmasız, 192 → 160 yeniden boyut."""
    x = F.interpolate(img, size=(S, S), mode='bilinear', align_corners=False)
    m = F.adaptive_avg_pool2d(F.interpolate(msk, size=(S, S), mode='bilinear', align_corners=False), (40, 40))
    return pnorm(x), (m > 0.5).float()


# ------------------------------------------------------------------ eğitim

def batches(idx, bs, shuffle):
    idx = np.array(idx)
    if shuffle:
        idx = idx[rng.permutation(len(idx))]
    for i in range(0, len(idx), bs):
        yield idx[i:i + bs]


def to_t(X, M, ids):
    img = torch.from_numpy(X[ids]).float().div(255).unsqueeze(1)
    les = np.unpackbits(M[ids], axis=-1)[..., :192].astype(np.float32)
    return img, torch.from_numpy(les).unsqueeze(1)


def dice_loss(logit, target):
    p = torch.sigmoid(logit)
    inter = (p * target).sum((1, 2, 3))
    den = p.sum((1, 2, 3)) + target.sum((1, 2, 3))
    return (1 - (2 * inter + 1) / (den + 1)).mean()


@torch.no_grad()
def predict(net, X, M, ids, photo=False, bs=256):
    net.eval()
    P, E, SEG = [], [], []
    gen = torch.Generator().manual_seed(123)
    for b in batches(ids, bs, False):
        img, les = to_t(X, M, b)
        x, _ = augment(img, les, strong=True, gen=gen) if photo else center(img, les)
        lo, sg, em = net(x)
        P.append(F.softmax(lo, 1))
        E.append(em)
        SEG.append(torch.sigmoid(sg))
    return torch.cat(P).numpy(), torch.cat(E).numpy(), torch.cat(SEG).numpy()


def metrics(prob, y):
    pred = prob.argmax(1)
    cm = np.zeros((4, 4), int)
    for a, b in zip(y, pred):
        cm[a, b] += 1
    per = {}
    for c in range(4):
        tp = cm[c, c]
        fn = cm[c].sum() - tp
        fp = cm[:, c].sum() - tp
        tn = cm.sum() - tp - fn - fp
        sens = tp / max(1, tp + fn)
        spec = tn / max(1, tn + fp)
        prec = tp / max(1, tp + fp)
        f1 = 2 * prec * sens / max(1e-9, prec + sens)
        per[CLASSES[c]] = dict(n=int(cm[c].sum()), sensitivity=round(float(sens), 4), specificity=round(float(spec), 4), precision=round(float(prec), 4), f1=round(float(f1), 4), auc=round(float(auc(prob[:, c], y == c)), 4))
    # lezyon var/yok (normal dışı) ikili
    ab = 1 - prob[:, 0]
    yb = y != 0
    return dict(accuracy=round(float((pred == y).mean()), 4), macro_f1=round(float(np.mean([per[c]['f1'] for c in CLASSES])), 4), per_class=per, confusion=cm.tolist(),
                abnormal_auc=round(float(auc(ab, yb)), 4), abnormal_sens_at_0_5=round(float(((ab >= 0.5) & yb).sum() / max(1, yb.sum())), 4), abnormal_spec_at_0_5=round(float(((ab < 0.5) & ~yb).sum() / max(1, (~yb).sum())), 4))


def auc(score, pos):
    pos = np.asarray(pos, bool)
    if pos.all() or (~pos).all():
        return float('nan')
    order = np.argsort(score)
    ranks = np.empty(len(score))
    ranks[order] = np.arange(1, len(score) + 1)
    return (ranks[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * (~pos).sum())


def main():
    X, Y, M, split, seq, src, subj = load()
    print('toplam', len(Y), {c: int((Y == i).sum()) for i, c in enumerate(CLASSES)}, flush=True)
    tr = np.where(split == 'train')[0]
    va = np.where(split == 'val')[0]
    te = np.where(split == 'test')[0]
    for nm, ids in [('train', tr), ('val', va), ('test', te)]:
        print(nm, len(ids), {c: int((Y[ids] == i).sum()) for i, c in enumerate(CLASSES)}, 'hasta', len(set(subj[ids])), flush=True)
    assert not (set(subj[tr]) & set(subj[te])), 'hasta sızıntısı'
    net = Net()
    print('parametre', sum(p.numel() for p in net.parameters()), flush=True)
    epochs = int(os.environ.get('EPOCHS', '14'))
    bs = 64
    # sınıf dengeli örnekleme: her dönemde her sınıftan eşit sayıda
    per_class = [tr[Y[tr] == c] for c in range(4)]
    n_ep = int(os.environ.get('PER_CLASS', '3000'))
    steps = 4 * n_ep // bs
    resume = os.environ.get('RESUME')
    best = (-1, None)
    if resume:
        # Kesilen eğitime devam: en iyi kontrol noktasından azalan (kosinüs) öğrenme hızıyla
        net.load_state_dict(torch.load(resume))
        pv, _, _ = predict(net, X, M, va)
        best = (metrics(pv, Y[va])['macro_f1'], {k: v.clone() for k, v in net.state_dict().items()})
        print('devam: başlangıç val macroF1', best[0], flush=True)
        opt = torch.optim.AdamW(net.parameters(), lr=8e-4, weight_decay=1e-4)
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs * steps, eta_min=1e-5)
    else:
        opt = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-4)
        sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=epochs * steps, pct_start=0.15)
    hist = []
    for ep in range(epochs):
        net.train()
        ids = np.concatenate([rng.choice(pc, n_ep, replace=len(pc) < n_ep) for pc in per_class])
        t0 = time.time()
        tot = 0.0
        for k, b in enumerate(batches(ids, bs, True)):
            img, les = to_t(X, M, b)
            x, m = augment(img, les, strong=True)
            lo, sg, _ = net(x)
            y = torch.from_numpy(Y[b])
            loss = F.cross_entropy(lo, y, label_smoothing=0.05) + 0.5 * (F.binary_cross_entropy_with_logits(sg, m, pos_weight=torch.tensor(4.0)) + dice_loss(sg, m))
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            tot += float(loss.detach())
            if k % 50 == 0:
                print(f'  ep{ep} adım {k}/{steps} kayıp {tot / (k + 1):.4f} {time.time() - t0:.0f}s', flush=True)
        pv, _, _ = predict(net, X, M, va)
        mv = metrics(pv, Y[va])
        hist.append(dict(epoch=ep, loss=tot / steps, val=mv))
        print(f'ep{ep} kayıp {tot / steps:.4f} val acc {mv["accuracy"]} macroF1 {mv["macro_f1"]} abnormalAUC {mv["abnormal_auc"]} ({time.time() - t0:.0f}s)', flush=True)
        torch.save(net.state_dict(), os.path.join(OUT, 'last.pt'))
        json.dump(hist, open(os.path.join(OUT, 'history_run.json'), 'w'), indent=1)
        if mv['macro_f1'] > best[0]:
            best = (mv['macro_f1'], {k: v.clone() for k, v in net.state_dict().items()})
            torch.save(best[1], os.path.join(OUT, 'best.pt'))
    net.load_state_dict(best[1])
    json.dump(hist, open(os.path.join(OUT, 'history.json'), 'w'), indent=1)
    print('en iyi val macroF1', best[0], flush=True)


if __name__ == '__main__':
    main()
