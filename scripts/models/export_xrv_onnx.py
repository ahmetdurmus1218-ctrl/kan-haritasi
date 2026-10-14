"""TorchXRayVision modellerini ONNX'e çevirir ve gerçek bir göğüs röntgeninde PyTorch ile karşılaştırır.

  python scripts/models/export_xrv_onnx.py <ağırlık_klasörü> <çıktı_klasörü> <örnek_röntgen.png>

- densenet121-res224-nih: yalnızca NIH ChestX-ray14 ile eğitilmiş sınıflandırıcı (14 bulgu). ONNX çıktısı sigmoid
  olasılığıdır; kütüphanenin çalışma noktası normalizasyonu (op_norm, veriye bağlı maskeleme içerdiği için ONNX'e
  doğru izlenemez) uygulamada manifestteki eşiklerle aynı formülle yapılır ve burada sayısal olarak karşılaştırılır.
- chestx_det PSPNet: 14 anatomik yapı segmentasyonu (ChestX-Det, Apache-2.0), 512×512, sigmoid.
Ön işleme (uygulamada TypeScript ile aynı): gri 8 bit → x/255*2048-1024, merkezden kare kırp, yeniden boyutlandır.
"""
import json
import sys

import numpy as np
import onnxruntime as ort
import skimage.io
import torch
import torchvision
import torchxrayvision as xrv


def prep(path, size):
    img = skimage.io.imread(path)
    if img.ndim == 3:
        img = img[..., :3].mean(2)
    img = xrv.datasets.normalize(img.astype(np.float32), 255)
    img = img[None]
    t = torchvision.transforms.Compose([xrv.datasets.XRayCenterCrop(), xrv.datasets.XRayResizer(size)])
    return torch.from_numpy(t(img)[None].astype(np.float32))


class Cls(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x):
        return torch.sigmoid(self.m.classifier(self.m.features2(x)))[:, :14]


def op_norm(p, t):
    """xrv.models.op_norm ile aynı formül (numpy)."""
    return np.where(p < t, p / (t * 2), 1.0 - (1.0 - p) / ((1 - t) * 2))


class Seg(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x):
        return torch.sigmoid(self.m(x))


def export(net, x, out, outname):
    net.eval()
    with torch.no_grad():
        ref = net(x).numpy()
    torch.onnx.export(net, x, out, input_names=["input"], output_names=[outname], opset_version=17, dynamo=False)
    got = ort.InferenceSession(out, providers=["CPUExecutionProvider"]).run(None, {"input": x.numpy()})[0]
    return ref, got


def main(wdir, odir, sample):
    cls = xrv.models.DenseNet(weights="densenet121-res224-nih", cache_dir=wdir)
    x = prep(sample, 224)
    ref, got = export(Cls(cls), x, f"{odir}/xrv-densenet121-nih.onnx", "probs")
    th = cls.op_threshs.numpy()[:14]
    sess = ort.InferenceSession(f"{odir}/xrv-densenet121-nih.onnx", providers=["CPUExecutionProvider"])
    worst = 0.0
    for xi in [x] + [torch.rand(1, 1, 224, 224) * 2048 - 1024 for _ in range(4)]:
        with torch.no_grad():
            lib = cls(xi).numpy()[0, :14]
        mine = op_norm(sess.run(None, {"input": xi.numpy()})[0][0], th)
        worst = max(worst, float(np.abs(lib - mine).max()))
    calibrated = op_norm(got[0], th)
    print(json.dumps({"model": "densenet121-res224-nih", "targets": cls.targets[:14], "op_threshs": [float(v) for v in th], "max_abs_diff_vs_library_incl_op_norm": worst, "calibrated": [round(float(v), 3) for v in calibrated]}))
    seg = xrv.baseline_models.chestx_det.PSPNet(cache_dir=wdir)
    # PSPNet kendi ileri geçişinde 512'ye ölçekler ve [-1024,1024] → ImageNet normalizasyonu yapar; aynısını dışa aktar.
    xs = prep(sample, 512)
    ref, got = export(Seg(seg), xs, f"{odir}/xrv-pspnet-chestxdet.onnx", "masks")
    area = (got[0] > 0.5).mean(axis=(1, 2))
    rnd = torch.rand(1, 1, 512, 512) * 2048 - 1024
    with torch.no_grad():
        r2 = torch.sigmoid(seg(rnd)).numpy()
    g2 = ort.InferenceSession(f"{odir}/xrv-pspnet-chestxdet.onnx", providers=["CPUExecutionProvider"]).run(None, {"input": rnd.numpy()})[0]
    assert float(np.abs(r2 - g2).max()) < 1e-3, "PSPNet rastgele girdide uyuşmuyor"
    print(json.dumps({"model": "chestx_det PSPNet", "targets": seg.targets, "max_abs_diff": float(np.abs(ref - got).max()), "mask_agreement": float(((ref > 0.5) == (got > 0.5)).mean()), "area_fraction": [round(float(a), 3) for a in area]}))


if __name__ == "__main__":
    main(*sys.argv[1:4])
