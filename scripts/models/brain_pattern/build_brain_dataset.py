"""
Beyin MR örüntü modeli için gerçek, açık lisanslı veriden kesit veri kümesi üretir.

Kaynaklar (hepsi açık lisans):
  - UPENN-GBM (IDC, CC BY 4.0): glioblastom; T1, T1-kontrast, T2, FLAIR + uzman düzeltmeli/AI tümör SEG'leri
  - REMIND (IDC, CC BY 4.0): glioma ameliyat öncesi T1-kontrast + tümör SEG
  - Vestibular-Schwannoma-SEG (IDC, CC BY 4.0): iç kulak yolu tümörü; T1-kontrast, T2 + RTSTRUCT
  - ARC ds004884 (OpenNeuro, CC0): kronik inme; T2 + lezyon maskesi
  - CCNRP ds007212 (OpenNeuro, CC0): kronik odak lezyon (inme, ameliyat); T1 + maske
  - Sağlıklı: MPI-LEMON ds000221 (T2, FLAIR), FCD ds004199 sağlıklı kontroller (T1, FLAIR),
    MS ds007908 sağlıklı kontroller (T1, FLAIR) — OpenNeuro, CC0

Çıktı: out/<kaynak>/<denek>_<seri>.npz → imgs uint8 [n,192,192], labels int8, plane, seq, area_mm2.
Hasta bazlı bölme (train/val/test) denek kimliğinin özetinden belirlenir (aynı hasta iki bölmeye düşmez).
"""
import os, sys, glob, json, shutil, hashlib, subprocess, random, traceback
import numpy as np
import nibabel as nib
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from dcmio import load_series, lps_to_ras  # noqa: E402

ROOT = os.environ.get('KH_BRAIN_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
OUT = os.path.join(ROOT, 'brain_ds')
TMP = os.path.join(ROOT, 'tmp_dl')
S5 = shutil.which('s5cmd') or 's5cmd'
SIZE = 192
CLASSES = ['normal', 'glial_tumor', 'cpa_tumor', 'chronic_lesion']


def split_of(subject: str) -> str:
    h = int(hashlib.sha1(subject.encode()).hexdigest(), 16) % 100
    return 'train' if h < 70 else 'val' if h < 85 else 'test'


def s3cp(url: str, dst: str):
    os.makedirs(dst, exist_ok=True)
    subprocess.run([S5, '--no-sign-request', '--endpoint-url', 'https://s3.amazonaws.com', '--numworkers', '16', 'cp', url, dst + '/'], capture_output=True, check=False)


def on_get(key: str, dst: str) -> str:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['curl', '-s', '-f', '-o', dst, f'https://s3.amazonaws.com/openneuro.org/{key}'], check=True)
    return dst


# ------------------------------------------------------------------ geometri

def canonical(arr, affine_ras, mask=None):
    img = nib.as_closest_canonical(nib.Nifti1Image(arr.astype(np.float32), affine_ras))
    data = np.asarray(img.dataobj, dtype=np.float32)
    sp = np.array(img.header.get_zooms()[:3], float)
    m = None
    if mask is not None:
        mi = nib.as_closest_canonical(nib.Nifti1Image(mask.astype(np.uint8), affine_ras))
        m = np.asarray(mi.dataobj).astype(np.uint8)
    return data, sp, m


def plane_slices(data, sp, plane):
    """(2B dilim üreteci, dilim aralığı mm, dilim sayısı). Radyolojik görünüm: hasta sağı görüntünün solunda, ön/üst yukarıda."""
    if plane == 'ax':
        return (lambda k: data[::-1, ::-1, k].T), (sp[0], sp[1]), sp[2], data.shape[2]
    if plane == 'cor':
        return (lambda k: data[::-1, k, ::-1].T), (sp[0], sp[2]), sp[1], data.shape[1]
    return (lambda k: data[k, ::-1, ::-1].T), (sp[1], sp[2]), sp[0], data.shape[0]


def to_1mm(sl, spacing, order):
    # sl: rows × cols; spacing (col_sp, row_sp) çünkü .T sonrası satır = ikinci eksen
    zoom = (spacing[1], spacing[0])
    return ndimage.zoom(sl, zoom, order=order) if order else ndimage.zoom(sl, zoom, order=0)


def head_mask(sl, thr):
    m = sl > thr
    m = ndimage.binary_opening(m, iterations=2)
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    m = lab == (1 + int(np.argmax(sizes)))
    return ndimage.binary_fill_holes(m)


def crop_square(sl, hm, lesion=None):
    ys, xs = np.where(hm)
    if len(ys) < 50:
        return None, None
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = y1 - y0 + 1, x1 - x0 + 1
    s = int(max(h, w) * 1.08)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    pad = s
    P = np.pad(sl, pad)
    c = P[cy - s // 2 + pad: cy - s // 2 + pad + s, cx - s // 2 + pad: cx - s // 2 + pad + s]
    out = ndimage.zoom(c, SIZE / s, order=1)[:SIZE, :SIZE]
    lm = None
    if lesion is not None:
        L = np.pad(lesion, pad)[cy - s // 2 + pad: cy - s // 2 + pad + s, cx - s // 2 + pad: cx - s // 2 + pad + s]
        lm = ndimage.zoom(L.astype(np.float32), SIZE / s, order=1)[:SIZE, :SIZE] > 0.5
    if out.shape != (SIZE, SIZE):
        o = np.zeros((SIZE, SIZE), out.dtype)
        o[: out.shape[0], : out.shape[1]] = out
        out = o
        if lm is not None:
            q = np.zeros((SIZE, SIZE), bool)
            q[: lm.shape[0], : lm.shape[1]] = lm
            lm = q
    return out, lm


def extract(data, sp, mask, *, lesion_class, seq, min_area, margin_mm, n_lesion, n_normal, planes, rng):
    """Bir hacimden etiketli kesitler. mask None → yalnızca normal."""
    vals = data[data > 0]
    if vals.size < 1000:
        return []
    lo, hi = np.percentile(vals, 0.5), np.percentile(vals, 99.5)
    thr = lo + 0.12 * (hi - lo)
    norm = np.clip((data - lo) / max(hi - lo, 1e-6), 0, 1)
    out = []
    for plane in planes:
        get, ins, step, n = plane_slices(norm, sp, plane)
        getm = plane_slices(mask, sp, plane)[0] if mask is not None else None
        areas, heads = np.zeros(n), np.zeros(n)
        for k in range(n):
            sl = get(k)
            heads[k] = (sl > (thr - lo) / max(hi - lo, 1e-6)).sum() * ins[0] * ins[1]
            if getm is not None:
                areas[k] = (getm(k) > 0).sum() * ins[0] * ins[1]
        if heads.max() <= 0:
            continue
        okhead = heads >= 0.35 * heads.max()
        if plane == 'ax':
            # Tepe (verteks) görüş alanındaysa yalnızca beyin düzeyleri: tepeden 8–125 mm aşağısı (boyun/omuz kesitleri alınmaz).
            present = np.where(heads >= 0.10 * heads.max())[0]
            top = present.max()
            if heads[-1] < 0.25 * heads.max() or top < n - 1:
                depth = (top - np.arange(n)) * step
                okhead &= (depth >= 8) & (depth <= 115)
        les_idx = [k for k in range(n) if okhead[k] and areas[k] >= min_area]
        if getm is not None and areas.sum() > 0:
            lk = np.where(areas > 0)[0]
            far = [k for k in range(n) if okhead[k] and areas[k] == 0 and min(abs(k - lk)) * step >= margin_mm]
        else:
            far = [k for k in range(n) if okhead[k]]
        share = 1.0 if plane == 'ax' else 0.25
        pick_l = les_idx if len(les_idx) <= n_lesion * share else list(np.array(les_idx)[np.linspace(0, len(les_idx) - 1, max(1, int(n_lesion * share))).astype(int)])
        nn = max(1, int(n_normal * share))
        pick_n = far if len(far) <= nn else sorted(rng.sample(far, nn))
        for k, lab in [(k, lesion_class) for k in pick_l] + [(k, 0) for k in pick_n]:
            sl = to_1mm(get(k), ins, 1)
            lm = to_1mm((getm(k) > 0).astype(np.uint8), ins, 0) if getm is not None else None
            hm = head_mask(sl, (thr - lo) / max(hi - lo, 1e-6))
            img, lmc = crop_square(sl, hm, lm)
            if img is None:
                continue
            out.append(dict(img=(np.clip(img, 0, 1) * 255).astype(np.uint8), label=lab, plane=plane, seq=seq, area=float(areas[k]),
                            lesion=(lmc.astype(np.uint8) if lmc is not None else None)))
    return out


def save(src, subject, series, items):
    if not items:
        return 0
    d = os.path.join(OUT, src)
    os.makedirs(d, exist_ok=True)
    les = np.stack([it['lesion'] if it['lesion'] is not None else np.zeros((SIZE, SIZE), np.uint8) for it in items])
    np.savez_compressed(os.path.join(d, f'{subject}__{series}.npz'), imgs=np.stack([it['img'] for it in items]), labels=np.array([it['label'] for it in items], np.int8),
                        plane=np.array([it['plane'] for it in items]), seq=np.array([it['seq'] for it in items]), area=np.array([it['area'] for it in items], np.float32),
                        lesion=np.packbits(les, axis=-1), subject=subject, split=split_of(subject), source=src)
    return len(items)


def planes_for(sp):
    return ['ax', 'cor', 'sag'] if max(sp) <= 1.6 else ['ax']


# ------------------------------------------------------------------ kaynaklar

def seq_of(desc: str) -> str:
    d = desc.lower()
    if 'flair' in d:
        return 'FLAIR'
    if 'post' in d or 'gad' in d or 'gd' in d or '+c' in d or 'gk' in d:
        return 'T1C'
    if 't2' in d:
        return 'T2'
    if 't1' in d:
        return 'T1'
    return 'OTHER'


def idc_frame():
    from idc_index import IDCClient
    return IDCClient()


def do_upenn(limit, rng):
    import highdicom as hd
    c = idc_frame()
    df = c.sql_query("""SELECT PatientID, StudyInstanceUID, SeriesInstanceUID, Modality, SeriesDescription, series_aws_url FROM index
      WHERE collection_id='upenn_gbm' AND StudyInstanceUID IN (SELECT StudyInstanceUID FROM index WHERE collection_id='upenn_gbm' AND Modality='SEG')""")
    pats = sorted(df.PatientID.unique())
    rng.shuffle(pats)
    n = 0
    for p in pats[:limit]:
        sub = df[df.PatientID == p]
        for st, g in sub.groupby('StudyInstanceUID'):
            mr = g[g.Modality == 'MR']
            sg = g[g.Modality == 'SEG']
            if mr.empty or sg.empty:
                continue
            r = mr.iloc[0]
            desc = str(r.SeriesDescription)
            if 'SAG' in desc.upper() or 'DTI' in desc.upper() or 'perf' in desc.lower():
                continue
            seq = seq_of(desc)
            if seq == 'OTHER':
                continue
            if os.path.exists(os.path.join(OUT, 'upenn', f'{p}__{st[-8:]}.npz')):
                continue
            tmp = os.path.join(TMP, f'up_{st[-8:]}')
            try:
                s3cp(r.series_aws_url, tmp + '/mr')
                # Uzman düzeltmeli SEG varsa onu, yoksa AI SEG'i kullan
                sgs = sg.sort_values('SeriesDescription', key=lambda s: s.str.contains('radiologist').map({True: 0, False: 1}))
                s3cp(sgs.iloc[0].series_aws_url, tmp + '/seg')
                arr, A, sop, _ = load_series(tmp + '/mr')
                seg = hd.seg.segread(glob.glob(tmp + '/seg/*')[0])
                px = seg.get_pixels_by_source_instance(source_sop_instance_uids=sop, combine_segments=True, ignore_spatial_locations=True, assert_missing_frames_are_empty=True)
                mask = (np.moveaxis(px, 0, -1) > 0).astype(np.uint8)  # rows, cols, slices
                data, sp, m = canonical(arr, lps_to_ras(A), mask)
                items = extract(data, sp, m, lesion_class=1, seq=seq, min_area=100, margin_mm=20, n_lesion=10, n_normal=4, planes=planes_for(sp), rng=rng)
                n += save('upenn', p, st[-8:], items)
            except Exception as e:  # noqa: BLE001
                print('upenn hata', p, desc, e, file=sys.stderr)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        print('upenn', p, n, flush=True)
    return n


def do_remind(limit, rng):
    import highdicom as hd
    c = idc_frame()
    df = c.sql_query("""SELECT PatientID, StudyInstanceUID, SeriesInstanceUID, Modality, SeriesDescription, series_aws_url FROM index WHERE collection_id='remind' AND Modality IN ('MR','SEG')""")
    pats = sorted(df.PatientID.unique())
    rng.shuffle(pats)
    n = 0
    for p in pats[:limit]:
        sub = df[df.PatientID == p]
        segs = sub[(sub.Modality == 'SEG') & sub.SeriesDescription.str.startswith('tumor seg - MR ref: 3D_AX_T1_postcontrast')]
        mrs = sub[(sub.Modality == 'MR') & (sub.SeriesDescription == '3D_AX_T1_postcontrast')]
        if segs.empty or mrs.empty:
            continue
        tmp = os.path.join(TMP, f'rm_{p}')
        try:
            s3cp(segs.iloc[0].series_aws_url, tmp + '/seg')
            seg = hd.seg.segread(glob.glob(tmp + '/seg/*')[0])
            ref = seg.get_source_image_uids()[0][1]
            mr = mrs[mrs.SeriesInstanceUID == ref]
            if mr.empty:
                continue
            s3cp(mr.iloc[0].series_aws_url, tmp + '/mr')
            arr, A, sop, _ = load_series(tmp + '/mr')
            px = seg.get_pixels_by_source_instance(source_sop_instance_uids=sop, combine_segments=True, ignore_spatial_locations=True, assert_missing_frames_are_empty=True)
            mask = (np.moveaxis(px, 0, -1) > 0).astype(np.uint8)
            data, sp, m = canonical(arr, lps_to_ras(A), mask)
            items = extract(data, sp, m, lesion_class=1, seq='T1C', min_area=100, margin_mm=20, n_lesion=10, n_normal=4, planes=planes_for(sp), rng=rng)
            n += save('remind', p, 't1c', items)
        except Exception as e:  # noqa: BLE001
            print('remind hata', p, e, file=sys.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print('remind', p, n, flush=True)
    return n


def rtstruct_mask(rt_path, sop_uids, A_lps, shape, names=('tv', 'tumor', 'tumour', 'vs', 'schwannoma', 'gtv')):
    import pydicom
    from skimage.draw import polygon
    ds = pydicom.dcmread(rt_path)
    roi = {r.ROINumber: r.ROIName for r in ds.StructureSetROISequence}
    inv = np.linalg.inv(A_lps)
    mask = np.zeros(shape, np.uint8)
    used = []
    for rc in ds.ROIContourSequence:
        name = roi.get(rc.ReferencedROINumber, '').lower()
        if not any(k == name or name.startswith(k) for k in names):
            continue
        used.append(name)
        for cont in getattr(rc, 'ContourSequence', []):
            pts = np.array(cont.ContourData, float).reshape(-1, 3)
            ijk = (inv @ np.c_[pts, np.ones(len(pts))].T).T[:, :3]
            k = int(round(np.median(ijk[:, 2])))
            if 0 <= k < shape[2]:
                rr, cc = polygon(ijk[:, 0], ijk[:, 1], shape=shape[:2])
                mask[rr, cc, k] = 1
    return mask, used


def do_vs(limit, rng):
    c = idc_frame()
    df = c.sql_query("""SELECT PatientID, StudyInstanceUID, SeriesInstanceUID, Modality, SeriesDescription, series_aws_url FROM index WHERE collection_id='vestibular_schwannoma_seg' AND Modality IN ('MR','RTSTRUCT')""")
    pats = sorted(df.PatientID.unique())
    rng.shuffle(pats)
    n = 0
    for p in pats[:limit]:
        sub = df[df.PatientID == p]
        tmp = os.path.join(TMP, f'vs_{p}')
        try:
            rts = sub[sub.Modality == 'RTSTRUCT']
            for _, rt in rts.iterrows():
                s3cp(rt.series_aws_url, tmp + '/rt_' + rt.SeriesInstanceUID[-6:])
            rtfiles = glob.glob(tmp + '/rt_*/*')
            for _, mr in sub[sub.Modality == 'MR'].iterrows():
                desc = str(mr.SeriesDescription).lower()
                seq = 'T1C' if desc.startswith('t1') else 'T2' if desc.startswith('t2') else None
                if not seq:
                    continue
                s3cp(mr.series_aws_url, tmp + '/mr_' + mr.SeriesInstanceUID[-6:])
                arr, A, sop, d0 = load_series(tmp + '/mr_' + mr.SeriesInstanceUID[-6:])
                mask = None
                import pydicom
                for f in rtfiles:
                    ds = pydicom.dcmread(f, stop_before_pixels=True)
                    try:
                        refser = ds.ReferencedFrameOfReferenceSequence[0].RTReferencedStudySequence[0].RTReferencedSeriesSequence[0].SeriesInstanceUID
                    except Exception:  # noqa: BLE001
                        refser = None
                    if refser == mr.SeriesInstanceUID:
                        mask, used = rtstruct_mask(f, sop, A, arr.shape)
                        break
                if mask is None or mask.sum() == 0:
                    continue
                data, sp, m = canonical(arr, lps_to_ras(A), mask)
                items = extract(data, sp, m, lesion_class=2, seq=seq, min_area=30, margin_mm=10, n_lesion=14, n_normal=(5 if seq == 'T1C' else 0), planes=planes_for(sp), rng=rng)
                n += save('vs', p, seq.lower(), items)
        except Exception as e:  # noqa: BLE001
            print('vs hata', p, e, traceback.format_exc()[-300:], file=sys.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print('vs', p, n, flush=True)
    return n


def nifti(path):
    img = nib.load(path)
    return np.asarray(img.dataobj, dtype=np.float32), img.affine


def do_arc(limit, rng):
    keys = []
    tok = ''
    import urllib.parse, re
    while True:
        url = 'https://s3.amazonaws.com/openneuro.org/?list-type=2&prefix=ds004884/derivatives/lesion_masks/&max-keys=1000' + (f'&continuation-token={urllib.parse.quote(tok, safe="")}' if tok else '')
        r = subprocess.run(['curl', '-s', url], capture_output=True, text=True).stdout
        keys += re.findall(r'<Key>([^<]*_desc-lesion_mask\.nii\.gz)</Key>', r)
        m = re.search(r'<NextContinuationToken>([^<]*)', r)
        if not m:
            break
        tok = m.group(1)
    # Denek başına bir maske
    by = {}
    for k in keys:
        s = k.split('/')[3]
        by.setdefault(s, k)
    subs = sorted(by)
    rng.shuffle(subs)
    n = 0
    for s in subs[:limit]:
        k = by[s]
        img_key = k.replace('derivatives/lesion_masks/', '').replace('_desc-lesion_mask', '')
        tmp = os.path.join(TMP, f'arc_{s}')
        try:
            on_get(k, tmp + '/m.nii.gz')
            on_get(img_key, tmp + '/i.nii.gz')
            arr, aff = nifti(tmp + '/i.nii.gz')
            msk, _ = nifti(tmp + '/m.nii.gz')
            data, sp, m = canonical(arr, aff, (msk > 0.5).astype(np.uint8))
            items = extract(data, sp, m, lesion_class=3, seq='T2', min_area=100, margin_mm=10, n_lesion=10, n_normal=5, planes=planes_for(sp), rng=rng)
            n += save('arc', s, 't2', items)
        except Exception as e:  # noqa: BLE001
            print('arc hata', s, e, file=sys.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print('arc', s, n, flush=True)
    return n


def list_subjects(ds):
    import re
    r = subprocess.run(['curl', '-s', f'https://s3.amazonaws.com/openneuro.org/?prefix={ds}/&delimiter=/&max-keys=1000'], capture_output=True, text=True).stdout
    return re.findall(rf'<Prefix>{ds}/(sub-[^/<]*)/</Prefix>', r)


def do_ccnrp(limit, rng):
    subs = list_subjects('ds007212')
    rng.shuffle(subs)
    n = 0
    for s in subs[:limit]:
        tmp = os.path.join(TMP, f'cc_{s}')
        try:
            on_get(f'ds007212/derivatives/{s}/anat/{s}_label-lesion_roi.nii.gz', tmp + '/m.nii.gz')
            on_get(f'ds007212/{s}/anat/{s}_T1w.nii.gz', tmp + '/i.nii.gz')
            arr, aff = nifti(tmp + '/i.nii.gz')
            msk, _ = nifti(tmp + '/m.nii.gz')
            if arr.ndim == 4:
                arr = arr[..., 0]
            if msk.ndim == 4:
                msk = msk[..., 0]
            data, sp, m = canonical(arr, aff, (msk > 0.5).astype(np.uint8))
            items = extract(data, sp, m, lesion_class=3, seq='T1', min_area=100, margin_mm=10, n_lesion=10, n_normal=5, planes=planes_for(sp), rng=rng)
            n += save('ccnrp', s, 't1', items)
        except Exception as e:  # noqa: BLE001
            print('ccnrp hata', s, e, file=sys.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print('ccnrp', s, n, flush=True)
    return n


def do_healthy(ds, files, limit, rng, subjects=None):
    subs = subjects if subjects is not None else list_subjects(ds)
    rng.shuffle(subs)
    n = 0
    for s in subs[:limit]:
        tmp = os.path.join(TMP, f'h_{ds}_{s}')
        for fpat, seq in files:
            key = f'{ds}/{s}/' + fpat.format(s=s)
            try:
                on_get(key, tmp + '/i.nii.gz')
                arr, aff = nifti(tmp + '/i.nii.gz')
                if arr.ndim == 4:
                    arr = arr[..., 0]
                data, sp, _ = canonical(arr, aff)
                items = extract(data, sp, None, lesion_class=0, seq=seq, min_area=0, margin_mm=0, n_lesion=0, n_normal=12, planes=planes_for(sp), rng=rng)
                n += save(f'healthy_{ds}', s, seq.lower(), items)
            except Exception as e:  # noqa: BLE001
                print('healthy hata', ds, s, seq, e, file=sys.stderr)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        print('healthy', ds, s, n, flush=True)
    return n


if __name__ == '__main__':
    which = sys.argv[1]
    lim = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    rng = random.Random(1234 + hash(which) % 1000)
    os.makedirs(OUT, exist_ok=True)
    if which == 'upenn':
        do_upenn(lim, rng)
    elif which == 'remind':
        do_remind(lim, rng)
    elif which == 'vs':
        do_vs(lim, rng)
    elif which == 'arc':
        do_arc(lim, rng)
    elif which == 'ccnrp':
        do_ccnrp(lim, rng)
    elif which == 'lemon':
        do_healthy('ds000221', [('ses-01/anat/{s}_ses-01_T2w.nii.gz', 'T2'), ('ses-01/anat/{s}_ses-01_acq-lowres_FLAIR.nii.gz', 'FLAIR')], lim, rng)
    elif which == 'fcdhc':
        import csv, io
        txt = subprocess.run(['curl', '-s', 'https://s3.amazonaws.com/openneuro.org/ds004199/participants.tsv'], capture_output=True, text=True).stdout.lstrip('﻿')
        hc = [r['participant_id'] for r in csv.DictReader(io.StringIO(txt), delimiter='\t') if r.get('group') == 'hc']
        do_healthy('ds004199', [('anat/{s}_acq-iso08_T1w.nii.gz', 'T1'), ('anat/{s}_acq-T2sel_FLAIR.nii.gz', 'FLAIR')], lim, rng, subjects=hc)
    elif which == 'mshc':
        import csv, io
        txt = subprocess.run(['curl', '-s', 'https://s3.amazonaws.com/openneuro.org/ds007908/participants.tsv'], capture_output=True, text=True).stdout.lstrip('﻿')
        hc = [r['participant_id'] for r in csv.DictReader(io.StringIO(txt), delimiter='\t') if r.get('group') == 'control']
        do_healthy('ds007908', [('ses-1/anat/{s}_ses-1_T1w.nii.gz', 'T1'), ('ses-1/anat/{s}_ses-1_FLAIR.nii.gz', 'FLAIR')], lim, rng, subjects=hc)
