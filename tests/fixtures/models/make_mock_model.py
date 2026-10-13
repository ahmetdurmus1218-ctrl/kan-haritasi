"""TEST AMAÇLI SAHTE MODEL üretir — tıbbi DEĞİLDİR, hiçbir şey öğrenmemiştir.

Uygulamaya paketlenmez; yalnızca uçtan uca testlerde "gerçek bir yerel model kurulursa bulgu →
kutu → görüntü üzerinde gösterim → anatomi → organ sayfası zinciri çalışıyor mu?" sorusunu
gerçek ONNX Runtime ile sınamak için kullanılır. Çıktısı sabit bir kutudur; skoru girdinin
ortalama parlaklığına bağlıdır (gerçekten çıkarım yapıldığını göstermek için).

Kullanım: python3 tests/fixtures/models/make_mock_model.py
"""
import hashlib
import json
from pathlib import Path

import onnx
from onnx import TensorProto, helper

OUT = Path(__file__).resolve().parent / "mock-detector"
OUT.mkdir(parents=True, exist_ok=True)

inp = helper.make_tensor_value_info("image", TensorProto.FLOAT, [1, 1, 64, 64])
boxes = helper.make_tensor_value_info("boxes", TensorProto.FLOAT, [1, 4])
scores = helper.make_tensor_value_info("scores", TensorProto.FLOAT, [1])
labels = helper.make_tensor_value_info("labels", TensorProto.INT64, [1])

nodes = [
    helper.make_node("ReduceMean", ["image"], ["m"], keepdims=0),  # skaler: ortalama parlaklık
    helper.make_node("Constant", [], ["k"], value=helper.make_tensor("k", TensorProto.FLOAT, [], [1.5])),
    helper.make_node("Add", ["m", "k"], ["z"]),
    helper.make_node("Sigmoid", ["z"], ["s"]),
    helper.make_node("Constant", [], ["shape1"], value=helper.make_tensor("shape1", TensorProto.INT64, [1], [1])),
    helper.make_node("Reshape", ["s", "shape1"], ["scores"]),
    helper.make_node("Constant", [], ["boxes"], value=helper.make_tensor("b", TensorProto.FLOAT, [1, 4], [0.22, 0.18, 0.2, 0.2])),
    helper.make_node("Constant", [], ["labels"], value=helper.make_tensor("l", TensorProto.INT64, [1], [0])),
]
graph = helper.make_graph(nodes, "kh_mock_detector", [inp], [boxes, scores, labels])
model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], producer_name="kan-haritasi-test")
model.ir_version = 8
onnx.checker.check_model(model)
data = model.SerializeToString()
(OUT / "model.onnx").write_bytes(data)
manifest = {
    "schema": "kh-model-manifest/1",
    "id": "kh-test-mock-detector",
    "name": "TEST — sahte bulgu modeli (tıbbi değil)",
    "version": "0.0.1-test",
    "modalities": ["MRI", "CT"],
    "task": "detection",
    "format": "onnx",
    "file": "model.onnx",
    "sha256": hashlib.sha256(data).hexdigest(),
    "license": "Test verisi (CC0)",
    "source": "tests/fixtures/models/make_mock_model.py",
    "intendedUse": "Yalnızca yazılım testi. Tıbbi kullanım için DEĞİLDİR; çıktısı sabit bir kutudur.",
    "input": {"name": "image", "layout": "NCHW", "channels": 1, "width": 64, "height": 64, "scale": 255, "mean": [0], "std": [1]},
    "output": {"boxes": "boxes", "scores": "scores", "labels": "labels", "boxFormat": "xywh-normalized"},
    "labels": [{"id": 0, "finding": "Test bulgusu (sahte model)", "structure": "brain.frontal"}],
    "scoreThreshold": 0.5,
    "limitations": ["Sahte test modelidir; hiçbir tıbbi anlamı yoktur."],
}
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(OUT, len(data), manifest["sha256"])
