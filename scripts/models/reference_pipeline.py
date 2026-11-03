"""Uygulamadaki 3B hacim çıkarımının (packages/analysis/src/volumeModel.ts) Python başvuru uygulaması.

Aynı adımlar: dünya (RAS) eksenine hizalı 3 mm ızgara → doğrusal yeniden örnekleme → CT kırp + z-skor
(veri kümesi parmak izi) / MR görüntü başına z-skor → kayan pencere (adım 0,8, Gauss ağırlığı) → argmax →
özgün ızgaraya en yakın komşu. Amaç: ONNX modelini TotalSegmentator'ın kendi çıktısıyla (Dice) doğrulamak.

Kullanım: python reference_pipeline.py model.onnx manifest.json girdi.nii.gz [başvuru_seg.nii.gz]
"""
import json
import sys
import time

import nibabel as nib
import numpy as np
import onnxruntime as ort
from scipy.ndimage import map_coordinates


def gaussian(patch, sigma_scale=1 / 8, value_scaling=10):
    tmp = np.zeros(patch)
    tmp[tuple(p // 2 for p in patch)] = 1
    from scipy.ndimage import gaussian_filter

    g = gaussian_filter(tmp, [p * sigma_scale for p in patch], 0, mode="constant", cval=0)
    g = g / g.max() * value_scaling
    g[g == 0] = g[g != 0].min()
    return g.astype(np.float32)


def steps(size, patch, step=0.8):
    if size <= patch:
        return [0]
    n = int(np.ceil((size - patch) / (patch * step))) + 1
    actual = (size - patch) / (n - 1)
    return [int(round(actual * i)) for i in range(n)]


def run(model, man, img, return_grid=False):
    """return_grid=True: özgün ızgaraya taşımadan RAS'a hizalı ızgaradaki etiketler, ızgara başlangıcı (mm) ve aralık."""
    data = np.asarray(img.dataobj, dtype=np.float32)
    aff = img.affine  # voksel (i,j,k) → RAS mm
    sp = man["volume"]["spacing"]
    sp = np.array([sp, sp, sp] if np.isscalar(sp) else sp, dtype=float)  # [R, A, S] mm
    # RAS'a hizalı ızgara: köşelerin dünya koordinatlarından sınırlar
    corners = np.array([[i, j, k, 1] for i in (0, data.shape[0] - 1) for j in (0, data.shape[1] - 1) for k in (0, data.shape[2] - 1)]) @ aff.T
    lo, hi = corners[:, :3].min(0), corners[:, :3].max(0)
    shape = [int(np.floor((hi[a] - lo[a]) / sp[a] + 1e-6) + 1) for a in range(3)]
    gx, gy, gz = [lo[a] + np.arange(shape[a]) * sp[a] for a in range(3)]
    W = np.stack(np.meshgrid(gx, gy, gz, indexing="ij"), -1).reshape(-1, 3)
    inv = np.linalg.inv(aff)
    vox = (np.c_[W, np.ones(len(W))] @ inv.T)[:, :3].T
    pad = man["volume"]["normalization"].get("padValue", float(data.min()))
    vol = map_coordinates(data, vox, order=1, mode="constant", cval=pad).reshape(shape)  # (R, A, S)
    n = man["volume"]["normalization"]
    # nnU-Net: önce sıfır olmayan bölgenin sınırlayıcı kutusuna kırpılır (normalizasyon ve pencereler bu kutuda)
    nz = np.argwhere(vol != 0)
    b0, b1 = (nz.min(0), nz.max(0) + 1) if len(nz) else (np.zeros(3, int), np.array(vol.shape))
    full_shape = vol.shape
    vol = vol[b0[0] : b1[0], b0[1] : b1[1], b0[2] : b1[2]]
    if n["scheme"] == "ct":
        vol = (np.clip(vol, n["clip"][0], n["clip"][1]) - n["mean"]) / n["std"]
    else:
        vol = (vol - vol.mean()) / max(vol.std(), 1e-8)
    # nnU-Net dizi sırası (SimpleITK): [S, A, R]
    arr = np.transpose(vol, (2, 1, 0)).astype(np.float32)
    patch = man["volume"]["patch"]
    padded = [max(arr.shape[a], patch[a]) for a in range(3)]
    off = [(padded[a] - arr.shape[a]) // 2 for a in range(3)]
    big = np.zeros(padded, np.float32)
    big[off[0] : off[0] + arr.shape[0], off[1] : off[1] + arr.shape[1], off[2] : off[2] + arr.shape[2]] = arr
    K = man["volume"].get("topK")
    g = gaussian(patch)
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    t = time.time()
    tiles = [(a, b, c) for a in steps(padded[0], patch[0]) for b in steps(padded[1], patch[1]) for c in steps(padded[2], patch[2])]
    if K:
        # Bellek dostu birleştirme: voksel başına en fazla M aday sınıf ve birikmiş ağırlıklı değerleri.
        M = 2 * K
        lab = np.full([M] + padded, -1, np.int32)
        val = np.zeros([M] + padded, np.float32)
        floor = np.zeros(padded, np.float32)  # henüz aday olmayan sınıfların birikmiş üst sınırı
        for a, b, c in tiles:
            sl = (slice(a, a + patch[0]), slice(b, b + patch[1]), slice(c, c + patch[2]))
            x = big[sl][None, None]
            tv, ti = sess.run(None, {"input": x})
            tv, ti = tv[0] * g, ti[0].astype(np.int32)  # [K,...]
            kth = tv[K - 1]
            L, V, F = lab[(slice(None),) + sl], val[(slice(None),) + sl], floor[sl]
            # mevcut adaylar: bu karoda K içindeyse kendi değeri, değilse K'ıncı değer (üst sınır)
            add = np.repeat(kth[None], M, 0)
            for k in range(K):
                hit = L == ti[k][None]
                add = np.where(hit, tv[k][None], add)
            V += np.where(L >= 0, add, 0)
            # bu karonun K sınıfından aday listesinde olmayanları boş yuvalara ekle (önceki karolar için taban değerle)
            for k in range(K):
                present = (L == ti[k][None]).any(0)
                free = (L < 0)
                first_free = np.argmax(free, 0)
                can = ~present & free.any(0)
                idx = np.where(can)
                L[first_free[idx], idx[0], idx[1], idx[2]] = ti[k][idx]
                V[first_free[idx], idx[0], idx[1], idx[2]] = F[idx] + tv[k][idx]
            F += kth
            lab[(slice(None),) + sl], val[(slice(None),) + sl], floor[sl] = L, V, F
        best = np.argmax(np.where(lab >= 0, val, -np.inf), 0)
        segfull = np.take_along_axis(lab, best[None], 0)[0]
        seg = segfull[off[0] : off[0] + arr.shape[0], off[1] : off[1] + arr.shape[1], off[2] : off[2] + arr.shape[2]]
    else:
        C = len(man["labels"]) + 1
        acc = np.zeros([C] + padded, np.float32)
        for a, b, c in tiles:
            x = big[a : a + patch[0], b : b + patch[1], c : c + patch[2]][None, None]
            y = sess.run(None, {"input": x})[0][0]
            acc[:, a : a + patch[0], b : b + patch[1], c : c + patch[2]] += y * g
        seg = acc.argmax(0)[off[0] : off[0] + arr.shape[0], off[1] : off[1] + arr.shape[1], off[2] : off[2] + arr.shape[2]]
    seg_ras = np.zeros(full_shape, np.uint8)
    seg_ras[b0[0] : b1[0], b0[1] : b1[1], b0[2] : b1[2]] = np.transpose(seg, (2, 1, 0))
    print(json.dumps({"grid": shape, "tiles": len(tiles), "seconds": round(time.time() - t, 1)}))
    if return_grid:
        return seg_ras, lo, sp
    # Özgün ızgaraya en yakın komşu
    I = np.stack(np.meshgrid(*[np.arange(s) for s in data.shape], indexing="ij"), -1).reshape(-1, 3)
    w = (np.c_[I, np.ones(len(I))] @ aff.T)[:, :3]
    idx = np.rint((w - lo) / sp).astype(int)
    ok = np.all((idx >= 0) & (idx < np.array(shape)), 1)
    out = np.zeros(len(I), np.uint8)
    out[ok] = seg_ras[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
    return out.reshape(data.shape)


if __name__ == "__main__":
    model, manp, inp = sys.argv[1:4]
    man = json.loads(open(manp).read())
    img = nib.load(inp)
    seg = run(model, man, img)
    if len(sys.argv) > 4:
        ref = np.asarray(nib.load(sys.argv[4]).dataobj).astype(np.uint8)
        names = {l["id"]: l["key"] for l in man["labels"]}
        dices = {}
        for lid in np.unique(ref):
            if lid == 0:
                continue
            a, b = seg == lid, ref == lid
            dices[names.get(int(lid), str(lid))] = round(2 * (a & b).sum() / (a.sum() + b.sum()), 3)
        vals = list(dices.values())
        print(json.dumps({"classes_in_ref": len(vals), "mean_dice": round(float(np.mean(vals)), 3), "median_dice": round(float(np.median(vals)), 3), "voxel_agreement": round(float((seg == ref).mean()), 4)}))
        worst = sorted(dices.items(), key=lambda kv: kv[1])[:8]
        print("worst:", worst)
