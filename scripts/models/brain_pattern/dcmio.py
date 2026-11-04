"""DICOM serisi / SEG / RTSTRUCT → (hacim, affine) okuma yardımcıları."""
import os, glob
import numpy as np
import pydicom

def load_series(folder):
    files = [pydicom.dcmread(f) for f in glob.glob(os.path.join(folder, '*')) if not f.endswith('.json')]
    files = [d for d in files if hasattr(d, 'ImagePositionPatient') and hasattr(d, 'pixel_array')]
    iop = np.array(files[0].ImageOrientationPatient, float)
    r, c = iop[:3], iop[3:]
    nrm = np.cross(r, c)
    files.sort(key=lambda d: float(np.dot(np.array(d.ImagePositionPatient, float), nrm)))
    arr = np.stack([d.pixel_array.astype(np.float32) * float(getattr(d, 'RescaleSlope', 1)) + float(getattr(d, 'RescaleIntercept', 0)) for d in files], axis=-1)  # rows, cols, slices
    ps = [float(x) for x in files[0].PixelSpacing]
    p0 = np.array(files[0].ImagePositionPatient, float)
    if len(files) > 1:
        p1 = np.array(files[-1].ImagePositionPatient, float)
        dz = (p1 - p0) / (len(files) - 1)
    else:
        dz = nrm * float(getattr(files[0], 'SliceThickness', 1))
    # LPS affine for index (row i, col j, slice k): pos = p0 + j*ps[1]*r + i*ps[0]*c + k*dz
    A = np.eye(4)
    A[:3, 0] = c * ps[0]
    A[:3, 1] = r * ps[1]
    A[:3, 2] = dz
    A[:3, 3] = p0
    sop = [d.SOPInstanceUID for d in files]
    return arr, A, sop, files[0]

def lps_to_ras(A):
    F = np.diag([-1, -1, 1, 1])
    return F @ A
