"""Uygulamadaki basamaklı hattın Python eşleniği: BT anatomi (3 mm ONNX) → beyin kutusu + 3 mm → kanama modeli (ONNX)
→ resmi TotalSegmentator cerebral_bleed çıktısıyla Dice ve hacim. Kullanım: validate_cascade_bleed.py repo bleed_dir girdi.nii.gz [resmi_maske.nii.gz]"""
import json, sys
import numpy as np, nibabel as nib
repo, bleed_dir, inp = sys.argv[1:4]
sys.path.insert(0, repo + '/scripts/models')
from reference_pipeline import run  # noqa: E402
img = nib.load(inp)
tot = repo + '/apps/web/public/ai-models/totalseg-ct-total-3mm'
man_t = json.load(open(tot + '/manifest.json'))
anat = run(tot + '/model.onnx', man_t, img)
brain_id = next(l['id'] for l in man_t['labels'] if l['key'] == 'brain')
nz = np.argwhere(anat == brain_id)
zooms = np.array(img.header.get_zooms()[:3])
add = np.floor(float(__import__("os").environ.get("KH_ADDON_MM", "3")) / zooms).astype(int)
lo = np.maximum(nz.min(0) - add, 0); hi = np.minimum(nz.max(0) + 1 + add, img.shape)
crop = img.slicer[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
man_b = json.load(open(bleed_dir + '/manifest.json'))
seg = run(bleed_dir + '/model.onnx', man_b, crop)
full = np.zeros(img.shape, np.uint8); full[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]] = seg
vox = float(np.prod(zooms)) / 1000
res = {'case': inp.split('/')[-1], 'brain_ml': round(float((anat == brain_id).sum() * vox), 1), 'app_bleed_ml': round(float((full == 1).sum() * vox), 2)}
if len(sys.argv) > 4:
    ref = np.asarray(nib.load(sys.argv[4]).dataobj) > 0
    a = full == 1
    res['official_bleed_ml'] = round(float(ref.sum() * vox), 2)
    res['dice'] = round(float(2 * (a & ref).sum() / max(1, a.sum() + ref.sum())), 3) if (a.sum() + ref.sum()) else None
nib.save(nib.Nifti1Image(full, img.affine), inp.replace('.nii.gz', '.appbleed.nii.gz'))
print(json.dumps(res))
