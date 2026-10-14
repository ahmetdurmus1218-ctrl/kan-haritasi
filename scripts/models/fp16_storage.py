"""ONNX ağırlıklarını DOSYADA float16 saklar, hesaplama float32 kalır.

Her büyük float32 ağırlık float16 olarak saklanır ve önüne bir Cast(→float32) düğümü eklenir. ONNX Runtime
oturum açılışında bu Cast'leri sabit katlama (constant folding) ile bir kez çözer; çıkarım float32'dir.
Dosya boyutu yarıya iner; doğruluk etkisi ayrı bir doğrulama adımıyla ölçülür (aynı girdide float32 ile karşılaştırma).

  python scripts/models/fp16_storage.py girdi.onnx çıktı.onnx
"""
import sys

import numpy as np
import onnx
from onnx import helper, numpy_helper


def convert(src: str, dst: str, min_elems: int = 1024) -> None:
    m = onnx.load(src)
    g = m.graph
    new_inits, casts = [], []
    for init in g.initializer:
        arr = numpy_helper.to_array(init)
        if arr.dtype == np.float32 and arr.size >= min_elems:
            h = numpy_helper.from_array(arr.astype(np.float16), init.name + "__fp16")
            new_inits.append(h)
            casts.append(helper.make_node("Cast", [h.name], [init.name], to=onnx.TensorProto.FLOAT, name=init.name + "__cast"))
        else:
            new_inits.append(init)
    del g.initializer[:]
    g.initializer.extend(new_inits)
    nodes = list(g.node)
    del g.node[:]
    g.node.extend(casts + nodes)
    onnx.checker.check_model(m)
    onnx.save(m, dst)


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
