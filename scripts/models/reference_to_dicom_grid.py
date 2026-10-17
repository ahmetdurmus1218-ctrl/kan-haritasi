"""Resmi maske (eksene hizalı NIfTI ızgarasında) → DICOM voksel ızgarası (dosya adı sırasına göre [k][j][i]) RLE JSON."""
import sys, glob, json, numpy as np, pydicom, nibabel as nib
src, ref_path, out = sys.argv[1:4]
files = sorted(glob.glob(src + '/*.dcm'))
ds = [pydicom.dcmread(f, stop_before_pixels=True) for f in files]
o = np.array([float(x) for x in ds[0].ImageOrientationPatient]); row, col = o[:3], o[3:]
dy, dx = [float(x) for x in ds[0].PixelSpacing]
R, C = int(ds[0].Rows), int(ds[0].Columns)
ref = nib.load(ref_path); m = np.asarray(ref.dataobj) > 0; inv = np.linalg.inv(ref.affine)
jj, ii = np.meshgrid(np.arange(R), np.arange(C), indexing='ij')
out_arr = np.zeros((len(ds), R, C), np.uint8)
for k, d in enumerate(ds):
    P = np.array([float(x) for x in d.ImagePositionPatient])
    lps = P[None, None, :] + ii[..., None] * row * dx + jj[..., None] * col * dy
    ras = lps * np.array([-1, -1, 1])
    v = np.rint(np.c_[ras.reshape(-1, 3), np.ones(R * C)] @ inv.T)[:, :3].astype(int)
    ok = np.all((v >= 0) & (v < np.array(m.shape)), 1)
    sl = np.zeros(R * C, bool); sl[ok] = m[v[ok, 0], v[ok, 1], v[ok, 2]]
    out_arr[k] = sl.reshape(R, C)
flat = out_arr.ravel(); change = np.flatnonzero(np.diff(flat)) + 1; starts = np.r_[0, change]; ends = np.r_[change, flat.size]
rle = [x for s, e in zip(starts, ends) for x in (int(flat[s]), int(e - s))]
json.dump({'source': 'TotalSegmentator -ta cerebral_bleed (Dataset150), resmi; eksene hizalı ızgaradan DICOM ızgarasına en yakın komşu', 'shape': [len(ds), R, C], 'order': 'file,row,col', 'voxels': int(out_arr.sum()), 'rle': rle}, open(out, 'w'))
print(out, int(out_arr.sum()), 'voxels')
