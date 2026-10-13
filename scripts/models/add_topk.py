"""ONNX segmentasyon modelinin çıktısına TopK(K) ekler: her voksel için en yüksek K sınıf (değer + indeks).

Neden: 118 sınıflı bir 3B modelin ham çıktısı karo başına ~760 MB'tır; telefonda kayan pencere birleştirmesi
için tüm sınıfları tutmak belleğe sığmaz. En yüksek K sınıf ile Gauss ağırlıklı birleştirme yapılır; bir karonun
K'ya girmeyen sınıfı için o karonun K'ıncı değeri (üst sınır) kullanılır. Doğruluk, resmi çıktıyla Dice ile ölçülür.

  python scripts/models/add_topk.py girdi.onnx çıktı.onnx K
"""
import sys

import onnx
from onnx import TensorProto, helper


def add_topk(src: str, dst: str, k: int) -> None:
    m = onnx.load(src)
    g = m.graph
    out = g.output[0]
    kname = "topk_k"
    g.initializer.append(helper.make_tensor(kname, TensorProto.INT64, [1], [k]))
    g.node.append(helper.make_node("TopK", [out.name, kname], ["topk_values", "topk_indices"], axis=1, largest=1, sorted=1, name="topk"))
    del g.output[:]
    g.output.extend([
        helper.make_tensor_value_info("topk_values", TensorProto.FLOAT, [1, k, None, None, None]),
        helper.make_tensor_value_info("topk_indices", TensorProto.INT64, [1, k, None, None, None]),
    ])
    onnx.checker.check_model(m)
    onnx.save(m, dst)


if __name__ == "__main__":
    add_topk(sys.argv[1], sys.argv[2], int(sys.argv[3]))
