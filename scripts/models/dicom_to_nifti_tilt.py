"""DICOM serisi -> (1) uygulamadaki gibi kesit konumlarından kurulan eğik (shear) afinli NIfTI, (2) eksene hizalı yeniden örneklenmiş NIfTI."""
import sys, glob, numpy as np, pydicom, nibabel as nib
from scipy.ndimage import map_coordinates
src, out_shear, out_aligned = sys.argv[1:4]
ds = [pydicom.dcmread(f) for f in glob.glob(src + '/*.dcm')]
o = np.array([float(x) for x in ds[0].ImageOrientationPatient]); row, col = o[:3], o[3:]
n = np.cross(row, col)
ds.sort(key=lambda d: float(np.dot(n, [float(x) for x in d.ImagePositionPatient])))
P = np.array([[float(x) for x in d.ImagePositionPatient] for d in ds])
dy, dx = [float(x) for x in ds[0].PixelSpacing]  # satır aralığı, sütun aralığı
kvec = (P[-1] - P[0]) / (len(ds) - 1)
vol = np.stack([d.pixel_array.astype(np.float32) * float(d.RescaleSlope) + float(d.RescaleIntercept) for d in ds])  # k, j, i
data = np.transpose(vol, (2, 1, 0))  # i, j, k
A = np.eye(4); A[:3, 0] = row * dx; A[:3, 1] = col * dy; A[:3, 2] = kvec; A[:3, 3] = P[0]
L2R = np.diag([-1, -1, 1, 1]); aff = L2R @ A
nib.save(nib.Nifti1Image(data.astype(np.int16), aff), out_shear)
# eksene hizalı ızgara
sp = np.array([dx, dy, abs(np.dot(kvec, n))])
corners = np.array([[i, j, k, 1] for i in (0, data.shape[0]-1) for j in (0, data.shape[1]-1) for k in (0, data.shape[2]-1)]) @ aff.T
lo, hi = corners[:, :3].min(0), corners[:, :3].max(0)
shape = [int(np.floor((hi[a]-lo[a])/sp[a]))+1 for a in range(3)]
g = np.stack(np.meshgrid(*[lo[a] + np.arange(shape[a]) * sp[a] for a in range(3)], indexing='ij'), -1).reshape(-1, 3)
v = (np.c_[g, np.ones(len(g))] @ np.linalg.inv(aff).T)[:, :3].T
res = map_coordinates(data, v, order=1, mode='constant', cval=-1024).reshape(shape)
aff2 = np.diag([sp[0], sp[1], sp[2], 1.0]); aff2[:3, 3] = lo
nib.save(nib.Nifti1Image(res.astype(np.int16), aff2), out_aligned)
print(out_aligned, data.shape, '->', shape, 'tilt_deg', round(float(np.degrees(np.arccos(abs(np.dot(kvec/np.linalg.norm(kvec), n))))), 1))
