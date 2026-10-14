"""TotalSegmentator (nnU-Net v2, PlainConvUNet) kontrol noktasını ONNX'e çevirir ve doğrular.

Kullanım:
  python scripts/models/export_nnunet_onnx.py <eğitilmiş_model_klasörü> <çıktı.onnx>

<eğitilmiş_model_klasörü>: plans.json, dataset.json, dataset_fingerprint.json ve fold_0/checkpoint_final.pth içerir
(TotalSegmentator'ın GitHub sürümlerinden indirilen zip'in içi). Ağırlıklar değiştirilmez; yalnızca biçim değişir.
Doğrulama: aynı rastgele girdide PyTorch ve ONNX Runtime çıktıları karşılaştırılır (en büyük mutlak fark yazılır).
"""
import json
import sys
from pathlib import Path

import numpy as np
import torch
from torch import nn
from dynamic_network_architectures.architectures.unet import PlainConvUNet


def build(cfg: dict, n_classes: int) -> nn.Module:
    n_stages = len(cfg["conv_kernel_sizes"])
    feats = [min(cfg["UNet_base_num_features"] * 2**i, cfg["unet_max_num_features"]) for i in range(n_stages)]
    return PlainConvUNet(
        input_channels=1,
        n_stages=n_stages,
        features_per_stage=feats,
        conv_op=nn.Conv3d,
        kernel_sizes=cfg["conv_kernel_sizes"],
        strides=cfg["pool_op_kernel_sizes"],
        n_conv_per_stage=cfg["n_conv_per_stage_encoder"],
        num_classes=n_classes,
        n_conv_per_stage_decoder=cfg["n_conv_per_stage_decoder"],
        conv_bias=True,
        norm_op=nn.InstanceNorm3d,
        norm_op_kwargs={"eps": 1e-5, "affine": True},
        dropout_op=None,
        nonlin=nn.LeakyReLU,
        nonlin_kwargs={"inplace": True},
        deep_supervision=False,
    )


def main(folder: str, out: str) -> None:
    f = Path(folder)
    plans = json.loads((f / "plans.json").read_text())
    ds = json.loads((f / "dataset.json").read_text())
    # Klasör adı "<Trainer>__<Plans>__<yapılandırma>" (ör. 3d_fullres_high); yoksa 3d_fullres
    conf = f.name.split("__")[-1] if f.name.count("__") >= 2 else "3d_fullres"
    cfg = plans["configurations"][conf]
    if "inherits_from" in cfg:
        cfg = {**plans["configurations"][cfg["inherits_from"]], **cfg}
    n_classes = len(ds["labels"])
    net = build(cfg, n_classes)
    ck = torch.load(f / "fold_0" / "checkpoint_final.pth", map_location="cpu", weights_only=False)
    missing, unexpected = net.load_state_dict(ck["network_weights"], strict=False)
    # Derin denetim (deep supervision) başlıkları çıkarımda kullanılmaz; başka eksik olmamalı.
    bad = [k for k in missing if "seg_layers" not in k] + [k for k in unexpected if "seg_layers" not in k]
    if bad:
        raise SystemExit(f"Ağırlıklar ağla uyuşmuyor: {bad[:5]}")
    net.eval()
    patch = cfg["patch_size"]
    x = torch.randn(1, 1, *patch)
    with torch.no_grad():
        ref = net(x).numpy()
    torch.onnx.export(net, x, out, input_names=["input"], output_names=["logits"], opset_version=17, dynamo=False)
    import onnxruntime as ort

    sess = ort.InferenceSession(out, providers=["CPUExecutionProvider"])
    got = sess.run(None, {"input": x.numpy()})[0]
    diff = float(np.abs(got - ref).max())
    agree = float((got.argmax(1) == ref.argmax(1)).mean())
    print(json.dumps({"out": out, "patch": patch, "classes": n_classes, "max_abs_diff": diff, "argmax_agreement": agree, "missing_ds_heads": len(missing)}))
    if agree < 0.999:
        raise SystemExit("ONNX çıktısı PyTorch ile uyuşmuyor")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
