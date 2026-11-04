"""
Etiketli göğüs röntgenleri (yalnızca ölçüm için indirilir; depoya konmaz):
  - ieee8023/covid-chestxray-dataset (GitHub; görüntü başına lisans, çoğu CC BY / CC BY-NC-SA): PA/AP, "Pneumonia/*" → 1,
    "No Finding" → 0
  - agchung/Actualmed-COVID-chestxray-dataset (GitHub): "COVID-19" → 1, "No finding" → 0
Çıktı: $KH_XRAY_WORK/labeled.csv ve $KH_XRAY_WORK/img/
"""
import os, subprocess
from concurrent.futures import ThreadPoolExecutor
import pandas as pd

W = os.environ.get('KH_XRAY_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
RAW = 'https://raw.githubusercontent.com'


def get(url, dst):
    if not os.path.exists(dst):
        subprocess.run(['curl', '-s', '-f', '-o', dst, url], check=False)
    return os.path.exists(dst)


def main():
    os.makedirs(os.path.join(W, 'img'), exist_ok=True)
    get(f'{RAW}/ieee8023/covid-chestxray-dataset/master/metadata.csv', os.path.join(W, 'ieee_meta.csv'))
    get(f'{RAW}/agchung/Actualmed-COVID-chestxray-dataset/master/metadata.csv', os.path.join(W, 'actualmed_meta.csv'))
    rows = []
    d = pd.read_csv(os.path.join(W, 'ieee_meta.csv'))
    d = d[d.view.isin(['PA', 'AP', 'AP Supine', 'AP Erect']) & (d.modality == 'X-ray') & (d.folder == 'images')]
    for _, r in d.iterrows():
        f = str(r.finding)
        lab = 1 if f.startswith('Pneumonia') else 0 if f == 'No Finding' else None
        if lab is not None:
            rows.append(('ieee', str(r.patientid), r.filename, f'{RAW}/ieee8023/covid-chestxray-dataset/master/images/{r.filename}', lab, str(r.view), str(r.license)))
    a = pd.read_csv(os.path.join(W, 'actualmed_meta.csv'), encoding='latin1')
    for _, r in a.iterrows():
        f = str(r.finding)
        lab = 1 if f == 'COVID-19' else 0 if f.lower() == 'no finding' else None
        if lab is not None and not pd.isna(r.imagename):
            rows.append(('actualmed', str(r.patientid), str(r.imagename), f'{RAW}/agchung/Actualmed-COVID-chestxray-dataset/master/images/{r.imagename}', lab, str(r.view), 'repo'))
    o = pd.DataFrame(rows, columns=['src', 'patient', 'file', 'url', 'label', 'view', 'license'])
    o['path'] = ['img/' + s + '__' + f.replace('/', '_') for s, f in zip(o.src, o.file)]
    o.to_csv(os.path.join(W, 'labeled.csv'), index=False)
    with ThreadPoolExecutor(16) as ex:
        ok = list(ex.map(lambda t: get(t[0], os.path.join(W, t[1])), zip(o.url, o.path)))
    print(o.groupby(['src', 'label']).size(), '\nindirildi', sum(ok), '/', len(ok))


if __name__ == '__main__':
    main()
