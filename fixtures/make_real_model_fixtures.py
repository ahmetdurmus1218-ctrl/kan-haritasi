"""Gerçek modeller için gerçek görüntü fikstürleri (kimliksiz, açık lisanslı).

- totalseg-ct-sm/: TotalSegmentator deposundaki tests/reference_files/example_ct_sm.nii.gz (TotalSegmentator veri
  kümesinden, CC BY 4.0) → DICOM BT serisi (hasta bilgisi YOK; kimlik alanları boş).
- totalseg-mr-sm/: example_mr_sm.nii.gz → DICOM MR serisi.
- *.reference.json: resmi TotalSegmentator `--fast --ml` çıktısı (aynı ağırlıklarla) özgün ızgarada, RLE.
  Uygulamanın TypeScript hattı bununla Dice/voksel uyumu üzerinden karşılaştırılır.
- nih-cxr-00000001_000.png: NIH ChestX-ray14 görüntüsü (NIH Clinical Center; kısıtlamasız kullanım, atıfla).

Kullanım:
  python fixtures/make_real_model_fixtures.py <example_ct_sm.nii.gz> <ct_ref.nii.gz> <example_mr_sm.nii.gz> <mr_ref.nii.gz>
"""
import json
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

OUT = Path(__file__).resolve().parent / "imaging"


def rle(flat: np.ndarray) -> list[int]:
    """[değer, tekrar, değer, tekrar, ...]"""
    out: list[int] = []
    if flat.size == 0:
        return out
    change = np.flatnonzero(np.diff(flat)) + 1
    starts = np.r_[0, change]
    ends = np.r_[change, flat.size]
    for s, e in zip(starts, ends):
        out += [int(flat[s]), int(e - s)]
    return out


def to_dicom(nii: Path, out_dir: Path, modality: str, desc: str, body: str, slope: float = 1.0, intercept: float = 0.0) -> None:
    img = nib.load(nii)
    data = np.asarray(img.dataobj).astype(np.float64)
    aff = img.affine
    lps = np.diag([-1, -1, 1])
    row_dir = lps @ aff[:3, 0] / np.linalg.norm(aff[:3, 0])  # artan sütun indeksi (i)
    col_dir = lps @ aff[:3, 1] / np.linalg.norm(aff[:3, 1])  # artan satır indeksi (j)
    ps = [float(np.linalg.norm(aff[:3, 1])), float(np.linalg.norm(aff[:3, 0]))]
    study, series = generate_uid(), generate_uid()
    out_dir.mkdir(parents=True, exist_ok=True)
    stored = np.round((data - intercept) / slope).astype(np.int32)
    signed = stored.min() < 0
    for k in range(data.shape[2]):
        meta = FileMetaDataset()
        meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2" if modality == "CT" else "1.2.840.10008.5.1.4.1.1.4"
        meta.MediaStorageSOPInstanceUID = generate_uid()
        meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds = FileDataset(None, {}, file_meta=meta, preamble=b"\0" * 128)
        ds.SOPClassUID = meta.MediaStorageSOPClassUID
        ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
        ds.StudyInstanceUID, ds.SeriesInstanceUID = study, series
        ds.Modality = modality
        ds.StudyDescription = desc
        ds.SeriesDescription = desc
        ds.BodyPartExamined = body
        ds.StudyDate = "20260101"
        ds.PatientName = ""
        ds.PatientID = ""
        ds.SeriesNumber = 1
        ds.InstanceNumber = k + 1
        pos = lps @ (aff @ np.array([0, 0, k, 1]))[:3]
        ds.ImagePositionPatient = [f"{v:.4f}" for v in pos]
        ds.ImageOrientationPatient = [f"{v:.6f}" for v in list(row_dir) + list(col_dir)]
        ds.PixelSpacing = [f"{v:.4f}" for v in ps]
        ds.SliceThickness = f"{float(np.linalg.norm(aff[:3, 2])):.4f}"
        ds.ImageType = ["ORIGINAL", "PRIMARY", "AXIAL"]
        ds.BurnedInAnnotation = "NO"
        sl = stored[:, :, k].T  # [satır=j][sütun=i]
        ds.Rows, ds.Columns = sl.shape
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 1 if signed else 0
        ds.RescaleSlope = f"{slope:g}"
        ds.RescaleIntercept = f"{intercept:g}"
        ds.PixelData = sl.astype(np.int16 if signed else np.uint16).tobytes()
        ds.save_as(out_dir / f"IM{k + 1:04d}", enforce_file_format=True)


def reference(seg: Path, dst: Path, labels_from: str) -> None:
    s = np.asarray(nib.load(seg).dataobj).astype(np.uint8)
    # özgün ızgara, dizi sırası [k][j][i] (kesit, satır, sütun) — DICOM ile aynı
    flat = np.transpose(s, (2, 1, 0)).ravel()
    dst.write_text(json.dumps({"source": labels_from, "shape": [int(s.shape[2]), int(s.shape[1]), int(s.shape[0])], "order": "slice,row,col", "rle": rle(flat)}))


if __name__ == "__main__":
    ct, ct_ref, mr, mr_ref = map(Path, sys.argv[1:5])
    to_dicom(ct, OUT / "totalseg-ct-sm", "CT", "BT TORAKS-BATIN (örnek, TotalSegmentator)", "ABDOMEN")
    reference(ct_ref, OUT / "totalseg-ct-sm.reference.json", "TotalSegmentator --fast --ml (Dataset297), resmi")
    to_dicom(mr, OUT / "totalseg-mr-sm", "MR", "MR BATIN (örnek, TotalSegmentator)", "ABDOMEN")
    reference(mr_ref, OUT / "totalseg-mr-sm.reference.json", "TotalSegmentator -ta total_mr --fast --ml (Dataset852), resmi")
    print("ok")
