"""Sıkıştırılmış (JPEG 2000 / JPEG Lossless) DICOM serisini pydicom + pylibjpeg ile sıkıştırmasız kopyaya çevirir.
Uygulama JPEG Lossless'u kendisi çözer; JPEG 2000 için (henüz) bu kopya gerekir. Kullanım: dicom_decompress.py <kaynak> <hedef>"""
import sys, glob, os, pydicom
src, dst = sys.argv[1:3]; os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(src + '/*.dcm')):
    d = pydicom.dcmread(f); d.decompress(); d.save_as(os.path.join(dst, os.path.basename(f)), enforce_file_format=True)
print(dst, len(os.listdir(dst)))
