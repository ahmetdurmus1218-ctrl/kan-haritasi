"""Sentetik (tamamen uydurma) test raporları üretir. Gerçek kişi, gerçek kurum veya
gerçek TC kimlik numarası içermez; CI'daki fixture taraması bunu denetler.

Her rapor farklı bir laboratuvar düzenini taklit eder (sütun sırası, bayrak biçimi, çok satırlı
ve etiketli referans aralıkları, cinsiyete özgü aralıklar, ok işaretleri, e-Nabız kartları,
telefonla çekilmiş fotoğraf). Beklenen sonuçlar `reports/expected.json` dosyasına yazılır;
birim testleri (PDF) ve uçtan uca testler (görüntü/OCR) bu dosyayı kullanır.

Kullanım: python3 fixtures/make_fixtures.py
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = Path(__file__).parent / "reports"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
EXPECTED: dict = {}

# ---------------------------------------------------------------------------------------------
# Satır tanımı: (rapordaki ad, değer metni, birim, referans (str veya satır listesi), bayrak,
#                test anahtarı, beklenen durum)
# Beklenen durum None ise satır "okunmalı" ama durumu doğrulama ister (ör. evreye göre aralık).
# ---------------------------------------------------------------------------------------------

ROWS = [
    ("Hemoglobin", "13,9", "g/dL", "13,5 - 17,5", "", "hemoglobin", "normal"),
    ("Lökosit (WBC)", "7,20", "10^3/µL", "4,0 - 10,0", "", "wbc", "normal"),
    ("Trombosit", "251", "10^3/µL", "150 - 400", "", "platelet", "normal"),
    ("Glukoz (açlık)", "94", "mg/dL", "70 - 100", "", "glucose", "normal"),
    ("Kreatinin", "0,92", "mg/dL", "0,70 - 1,20", "", "creatinine", "normal"),
    ("ALT", "68", "U/L", "0 - 41", "H", "alt", "high"),
    ("AST", "35", "U/L", "0 - 40", "", "ast", "normal"),
    ("Total Kolesterol", "241", "mg/dL", "< 200", "H", "cholesterol-total", "high"),
    ("LDL Kolesterol", "178", "mg/dL", "0 - 130", "H", "ldl", "high"),
    ("HDL Kolesterol", "44", "mg/dL", "> 40", "", "hdl", "normal"),
    ("Trigliserid", "162", "mg/dL", "< 150", "H", "triglyceride", "high"),
    ("TSH", "2,10", "mIU/L", "0,27 - 4,20", "", "tsh", "normal"),
    ("Ferritin", "19", "ng/mL", "30 - 400", "L", "ferritin", "low"),
    ("Vitamin B12", "312", "pg/mL", "197 - 771", "", "b12", "normal"),
]

HEMOGRAM = [
    ("WBC (Lökosit)", "6,84", "10^3/µL", "4,0 - 10,0", "", "wbc", "normal"),
    ("RBC (Eritrosit)", "4,21", "10^6/µL", "3,9 - 5,2", "", "rbc", "normal"),
    ("HGB (Hemoglobin)", "9,8", "g/dL", "12,0 - 15,5", "L", "hemoglobin", "low"),
    ("HCT (Hematokrit)", "31,2", "%", "36 - 46", "L", "hematocrit", "low"),
    ("MCV", "74,1", "fL", "80 - 100", "L", "mcv", "low"),
    ("MCH", "23,3", "pg", "27 - 33", "L", "mch", "low"),
    ("MCHC", "31,4", "g/dL", "32 - 36", "L", "mchc", "low"),
    ("RDW-CV", "17,9", "%", "11,5 - 14,5", "H", "rdw", "high"),
    ("PLT (Trombosit)", "438", "10^3/µL", "150 - 400", "H", "platelet", "high"),
    ("MPV", "8,9", "fL", "7,4 - 10,4", "", "mpv", "normal"),
    ("Nötrofil #", "4,05", "10^3/µL", "2,0 - 7,0", "", "neutrophil-abs", "normal"),
    ("Lenfosit #", "2,01", "10^3/µL", "1,0 - 3,5", "", "lymphocyte-abs", "normal"),
    ("Monosit #", "0,52", "10^3/µL", "0,2 - 0,9", "", "monocyte-abs", "normal"),
    ("Eozinofil #", "0,21", "10^3/µL", "0,0 - 0,5", "", "eosinophil-abs", "normal"),
    ("Bazofil #", "0,05", "10^3/µL", "0,0 - 0,1", "", "basophil-abs", "normal"),
    ("Nötrofil %", "59,2", "%", "40 - 74", "", "neutrophil-pct", "normal"),
    ("Lenfosit %", "29,4", "%", "19 - 48", "", "lymphocyte-pct", "normal"),
    ("Monosit %", "7,6", "%", "3,4 - 9,0", "", "monocyte-pct", "normal"),
    ("Eozinofil %", "3,1", "%", "0 - 7", "", "eosinophil-pct", "normal"),
    ("Bazofil %", "0,7", "%", "0 - 1,5", "", "basophil-pct", "normal"),
]

BIOCHEM = [
    ("Glukoz", "112", "mg/dL", "74 - 100", "Yüksek", "glucose", "high"),
    ("Üre", "64", "mg/dL", "17 - 43", "Yüksek", "urea", "high"),
    ("Kreatinin", "1,68", "mg/dL", "0,67 - 1,17", "Yüksek", "creatinine", "high"),
    ("eGFR (CKD-EPI)", "46", "mL/dk/1,73m²", "> 90", "Düşük", "egfr", "low"),
    ("Ürik Asit", "8,1", "mg/dL", "3,5 - 7,2", "Yüksek", "uric-acid", "high"),
    ("Sodyum (Na)", "138", "mmol/L", "136 - 145", "", "sodium", "normal"),
    ("Potasyum (K)", "5,7", "mmol/L", "3,5 - 5,1", "Yüksek", "potassium", "high"),
    ("Klor (Cl)", "103", "mmol/L", "98 - 107", "", "chloride", "normal"),
    ("Kalsiyum (Ca)", "9,3", "mg/dL", "8,6 - 10,2", "", "calcium", "normal"),
    ("Fosfor", "4,9", "mg/dL", "2,5 - 4,5", "Yüksek", "phosphorus", "high"),
    ("ALT (SGPT)", "24", "U/L", "0 - 41", "", "alt", "normal"),
    ("AST (SGOT)", "21", "U/L", "0 - 40", "", "ast", "normal"),
    ("GGT", "31", "U/L", "10 - 71", "", "ggt", "normal"),
    ("ALP", "88", "U/L", "40 - 129", "", "alp", "normal"),
    ("Total Bilirubin", "0,64", "mg/dL", "0 - 1,2", "", "bilirubin-total", "normal"),
    ("Direkt Bilirubin", "0,18", "mg/dL", "0 - 0,3", "", "bilirubin-direct", "normal"),
    ("Total Protein", "7,0", "g/dL", "6,4 - 8,3", "", "total-protein", "normal"),
    ("Albümin", "4,1", "g/dL", "3,5 - 5,2", "", "albumin", "normal"),
    ("CRP", "14,2", "mg/L", "0 - 5", "Yüksek", "crp", "high"),
]

PHASE_E2 = ["Foliküler: 12,5 - 166", "Ovulasyon: 85,8 - 498", "Luteal: 43,8 - 211", "Postmenopoz: < 54,7"]
PHASE_P4 = ["Foliküler: 0,06 - 0,89", "Ovulasyon: 0,12 - 12", "Luteal: 1,83 - 23,9", "Postmenopoz: < 0,13"]
PHASE_FSH = ["Foliküler: 3,5 - 12,5", "Ovulasyon: 4,7 - 21,5", "Luteal: 1,7 - 7,7", "Postmenopoz: 25,8 - 134,8"]
PHASE_LH = ["Foliküler: 2,4 - 12,6", "Ovulasyon: 14 - 95,6", "Luteal: 1,0 - 11,4", "Postmenopoz: 7,7 - 58,5"]

HORMONE_F = [
    ("TSH", "7,85", "µIU/mL", "0,27 - 4,20", "H", "tsh", "high"),
    ("Serbest T4", "0,82", "ng/dL", "0,93 - 1,70", "L", "ft4", "low"),
    ("Serbest T3", "2,71", "pg/mL", "2,0 - 4,4", "", "ft3", "normal"),
    ("Anti-TPO", "186", "IU/mL", "< 34", "H", "anti-tpo", "high"),
    ("Prolaktin", "41,6", "ng/mL", "4,79 - 23,3", "H", "prolactin", "high"),
    ("Kortizol (sabah)", "13,8", "µg/dL", "6,2 - 19,4", "", "cortisol", "normal"),
    ("İnsülin (açlık)", "17,2", "µIU/mL", "2,6 - 24,9", "", "insulin", "normal"),
    ("Estradiol (E2)", "96,4", "pg/mL", PHASE_E2, "", "estradiol", None),
    ("Progesteron", "0,62", "ng/mL", PHASE_P4, "", "progesterone", None),
    ("FSH", "6,1", "mIU/mL", PHASE_FSH, "", "fsh", None),
    ("LH", "7,4", "mIU/mL", PHASE_LH, "", "lh", None),
    ("DHEA-S", "212", "µg/dL", "98,8 - 340", "", "dhea-s", "normal"),
    ("Testosteron (total)", "0,31", "ng/mL", "0,08 - 0,48", "", "testosterone", "normal"),
    ("Beta-hCG", "< 1,2", "mIU/mL", "< 5", "", "bhcg", "normal"),
]

HORMONE_M = [
    ("Total Testosteron", "182", "ng/dL", "249 - 836", "L", "testosterone", "low"),
    ("LH", "2,1", "mIU/mL", "1,7 - 8,6", "", "lh", "normal"),
    ("FSH", "3,0", "mIU/mL", "1,5 - 12,4", "", "fsh", "normal"),
    ("Prolaktin", "11,2", "ng/mL", "4,04 - 15,2", "", "prolactin", "normal"),
    ("Estradiol", "28", "pg/mL", "11 - 44", "", "estradiol", "normal"),
    ("Kortizol", "22,4", "µg/dL", "6,2 - 19,4", "H", "cortisol", "high"),
    ("TSH", "1,94", "mIU/L", "0,27 - 4,20", "", "tsh", "normal"),
    ("PSA (Total)", "1,1", "ng/mL", "0 - 4", "", "psa", "normal"),
]

VITAMIN = [
    ("25-OH Vitamin D", "11,8", "ng/mL", ["Eksiklik: < 20", "Yetersizlik: 20 - 30", "Yeterli: 30 - 100"], "", "vitamin-d", "low"),
    ("Vitamin B12", "168", "pg/mL", "197 - 771", "L", "b12", "low"),
    ("Folat", "4,6", "ng/mL", "3,1 - 20,5", "", "folate", "normal"),
    ("Ferritin", "8,2", "ng/mL", "13 - 150", "L", "ferritin", "low"),
    ("Demir (Fe)", "41", "µg/dL", "50 - 170", "L", "iron", "low"),
    ("TDBK", "468", "µg/dL", "250 - 450", "H", "tibc", "high"),
    ("Transferrin Satürasyonu", "8,8", "%", "20 - 50", "L", "transferrin-saturation", "low"),
    ("Magnezyum", "1,92", "mg/dL", "1,6 - 2,6", "", "magnesium", "normal"),
    ("Kalsiyum", "9,1", "mg/dL", "8,6 - 10,2", "", "calcium", "normal"),
    ("Fosfor", "3,6", "mg/dL", "2,5 - 4,5", "", "phosphorus", "normal"),
    ("Homosistein", "17,8", "µmol/L", "5 - 15", "H", "homocysteine", "high"),
]

LIPID = [
    ("Total Kolesterol", "262", "mg/dL", "İstenen: < 200 · Sınırda: 200 - 239 · Yüksek: ≥ 240", "", "cholesterol-total", "high"),
    ("LDL Kolesterol", "181", "mg/dL", ["Optimal: < 100 · Optimale yakın: 100 - 129", "Sınırda yüksek: 130 - 159 · Yüksek: 160 - 189"], "", "ldl", "high"),
    ("HDL Kolesterol", "37", "mg/dL", ["Düşük: < 40", "Yüksek: ≥ 60"], "", "hdl", "low"),
    ("Trigliserid", "231", "mg/dL", "Normal: < 150 · Sınırda: 150 - 199 · Yüksek: 200 - 499", "", "triglyceride", "high"),
    ("VLDL Kolesterol", "46", "mg/dL", "< 30", "", "vldl", "high"),
    ("Non-HDL Kolesterol", "225", "mg/dL", "< 130", "", "non-hdl", "high"),
]

MULTI_P1 = [
    ("Hemoglobin", "11,4↓", "g/dL", "Erkek: 13,5-17,5  Kadın: 12,0-15,5", "", "hemoglobin", "low"),
    ("Lökosit", "14,6↑", "10^3/µL", "4,0-10,0", "", "wbc", "high"),
    ("Nötrofil %", "83,1↑", "%", "40-74", "", "neutrophil-pct", "high"),
    ("Lenfosit %", "10,2↓", "%", "19-48", "", "lymphocyte-pct", "low"),
    ("Trombosit", "118↓", "10^3/µL", "150-400", "", "platelet", "low"),
    ("MCV", "86", "fL", "80-100", "", "mcv", "normal"),
    ("Sedimantasyon", "46↑", "mm/saat", "0-20", "", "esr", "high"),
]
MULTI_P2 = [
    ("Glukoz (açlık)", "186↑", "mg/dL", "70-100", "", "glucose", "high"),
    ("HbA1c", "8,2↑", "%", "4,0-6,0", "", "hba1c", "high"),
    ("ALT", "142↑", "U/L", "0-41", "", "alt", "high"),
    ("AST", "96↑", "U/L", "0-40", "", "ast", "high"),
    ("GGT", "188↑", "U/L", "10-71", "", "ggt", "high"),
    ("ALP", "162↑", "U/L", "40-129", "", "alp", "high"),
    ("Total Bilirubin", "2,3↑", "mg/dL", "0,3-1,2", "", "bilirubin-total", "high"),
    ("Direkt Bilirubin", "1,1↑", "mg/dL", "0-0,3", "", "bilirubin-direct", "high"),
    ("Albümin", "3,2↓", "g/dL", "3,5-5,2", "", "albumin", "low"),
    ("Kreatinin", "1,34↑", "mg/dL", "0,67-1,17", "", "creatinine", "high"),
    ("CRP", "52,4↑", "mg/L", "0-5", "", "crp", "high"),
    ("LDL Kolesterol", "176↑", "mg/dL", "< 130", "", "ldl", "high"),
    ("HDL Kolesterol", "34↓", "mg/dL", "> 40", "", "hdl", "low"),
    ("Trigliserid", "318↑", "mg/dL", "< 150", "", "triglyceride", "high"),
    ("TSH", "0,05↓", "mIU/L", "0,27-4,20", "", "tsh", "low"),
    ("Serbest T4", "2,41↑", "ng/dL", "0,93-1,70", "", "ft4", "high"),
    ("Vitamin D (25-OH)", "13,1↓", "ng/mL", "30-100", "", "vitamin-d", "low"),
    ("Ferritin", "612↑", "ng/mL", "30-400", "", "ferritin", "high"),
    ("Lipaz", "188↑", "U/L", "13-60", "", "lipase", "high"),
    ("CK", "540↑", "U/L", "0-190", "", "ck", "high"),
]

# e-Nabız benzeri kartlar: (ad, referans, değer, birim, anahtar, durum)
ENABIZ = [
    ("WBC", "3,91-8,77", "11,2", "10^9/L", "wbc", "high"),
    ("NE%", "40,3-74,8", "71,3", "%", "neutrophil-pct", "normal"),
    ("LY%", "20-40", "18,4", "%", "lymphocyte-pct", "low"),
    ("HGB", "13,6-17,2", "13,1", "g/dL", "hemoglobin", "low"),
    ("PLT", "150-400", "262", "10^9/L", "platelet", "normal"),
    ("Glukoz", "70-100", "97", "mg/dL", "glucose", "normal"),
]
ENABIZ_TSH = ("TSH", "0,27-4,2", "3,1", "uIU/mL", "tsh", "normal")


def value_number(text: str) -> float:
    t = text.replace("↑", "").replace("↓", "").replace("<", "").strip().replace(",", ".")
    return float(t)


def expect(name: str, rows, *, kind: str, sex: str, patterns: list[str], date: str | None, extra: dict | None = None) -> None:
    EXPECTED[name] = {
        "kind": kind,
        "sex": sex,
        "date": date,
        "rows": [{"key": r[-2], "value": value_number(r[1]), "status": r[-1]} for r in rows],
        "patterns": patterns,
        **(extra or {}),
    }


# ------------------------------------------------------------------------------------ PDF ----


def pdf_fonts() -> None:
    pdfmetrics.registerFont(TTFont("DejaVu", FONT))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))


def pdf_header(c, lab: str, lines: list[str]) -> float:
    w, h = A4
    y = h - 22 * mm
    c.setFont("DejaVu-Bold", 13)
    c.drawString(20 * mm, y, lab)
    c.setFont("DejaVu", 8.5)
    for line in lines:
        y -= 5.5 * mm
        c.drawString(20 * mm, y, line)
    return y - 9 * mm


def pdf_table(c, y: float, cols: list[tuple[float, str, str]], rows, *, size: float = 9.5, step: float = 7) -> float:
    """cols: (x_mm, başlık, alan) — alan: name|value|unit|ref|flag."""
    c.setFont("DejaVu-Bold", size)
    for x, title, _ in cols:
        c.drawString(x * mm, y, title)
    y -= 3 * mm
    c.line(20 * mm, y, 190 * mm, y)
    y -= 6 * mm
    for name, value, unit, ref, flag, *_ in rows:
        fields = {"name": name, "value": value, "unit": unit, "flag": flag}
        refs = ref if isinstance(ref, list) else [ref]
        c.setFont("DejaVu", size)
        for x, _, field in cols:
            if field == "ref":
                c.setFont("DejaVu", size - 1.5 if len(refs) > 1 else size)
                for i, r in enumerate(refs):
                    c.drawString(x * mm, y - i * 4 * mm, r)
                c.setFont("DejaVu", size)
            else:
                c.drawString(x * mm, y, fields[field])
        y -= (step + (len(refs) - 1) * 4) * mm
    return y


def footer(c) -> None:
    c.setFont("DejaVu", 7.5)
    c.drawString(20 * mm, 15 * mm, "Bu belge yazılım testi için üretilmiştir; kişi ve kurum adları uydurmadır, tıbbi geçerliliği yoktur.")


def make_basic_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Sentetik Kan Tahlili")
    w, h = A4
    y = h - 25 * mm
    c.setFont("DejaVu-Bold", 14)
    c.drawString(20 * mm, y, "ÖRNEK LABORATUVARI — SENTETİK TEST RAPORU")
    y -= 8 * mm
    c.setFont("DejaVu", 9)
    c.drawString(20 * mm, y, "Hasta: ÖRNEK HASTA   Protokol: TEST-0001   Numune: 12.09.2026 08:40   (uydurma veri)")
    y -= 12 * mm
    y = pdf_table(c, y, [(20, "Test", "name"), (85, "Sonuç", "value"), (110, "Birim", "unit"), (135, "Referans Aralığı", "ref"), (175, "", "flag")], ROWS)
    y -= 6 * mm
    c.setFont("DejaVu", 8)
    c.drawString(20 * mm, y, "Bu belge yazılım testi için üretilmiştir; tıbbi geçerliliği yoktur.")
    c.showPage()
    c.setFont("DejaVu", 9.5)
    c.drawString(20 * mm, h - 25 * mm, "Sayfa 2 — Açıklamalar: LDL için hedef değerler risk durumuna göre değişir.")
    c.save()


def make_hemogram_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Hemogram")
    y = pdf_header(c, "DENEME TIP LABORATUVARI", ["Hasta Adı: DENEME KİŞİ   Cinsiyet: Kadın   Protokol No: H-2211", "Numune Alınma Tarihi: 03.09.2026 08:12   Onay: 03.09.2026 11:40"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "TAM KAN SAYIMI (HEMOGRAM)")
    y -= 9 * mm
    pdf_table(c, y, [(20, "Test", "name"), (82, "Sonuç", "value"), (104, "Birim", "unit"), (132, "Referans Aralığı", "ref"), (176, "", "flag")], HEMOGRAM, step=6.4)
    footer(c)
    c.save()


def make_biochem_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Biyokimya")
    y = pdf_header(c, "KURMACA SAĞLIK MERKEZİ LABORATUVARI", ["Hasta: KURMACA HASTA   Cinsiyet: Erkek", "Kabul Tarihi: 15.08.2026   Sonuç Tarihi: 15.08.2026"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "KLİNİK BİYOKİMYA")
    y -= 9 * mm
    # Bu laboratuvarda sütun sırası: ad | sonuç | referans | birim | durum
    pdf_table(c, y, [(20, "Tetkik Adı", "name"), (78, "Sonuç", "value"), (100, "Referans Değerleri", "ref"), (140, "Birim", "unit"), (170, "Durum", "flag")], BIOCHEM, size=9, step=6.2)
    footer(c)
    c.save()


def make_hormone_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Hormon")
    y = pdf_header(c, "UYDURMA ENDOKRİN LABORATUVARI", ["Hasta: UYDURMA KİŞİ   Cinsiyet: Kadın", "Numune Tarihi: 22.07.2026"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "HORMON TESTLERİ")
    y -= 9 * mm
    pdf_table(c, y, [(20, "Parametre", "name"), (70, "Sonuç", "value"), (92, "Birim", "unit"), (118, "Referans Aralığı", "ref"), (178, "", "flag")], HORMONE_F, size=9, step=6.6)
    footer(c)
    c.save()


def make_vitamin_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Vitamin ve mineral")
    y = pdf_header(c, "ÖRNEKKÖY TIP MERKEZİ LABORATUVARI", ["Hasta: ÖRNEK KİŞİ   Cinsiyet: Kadın", "Kan Alma Tarihi: 30.06.2026"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "VİTAMİN - MİNERAL - DEMİR PROFİLİ")
    y -= 9 * mm
    pdf_table(c, y, [(20, "Test", "name"), (78, "Sonuç", "value"), (98, "Birim", "unit"), (122, "Referans", "ref"), (178, "", "flag")], VITAMIN, size=9, step=6.6)
    footer(c)
    c.save()


def make_lipid_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Lipid profili")
    y = pdf_header(c, "DENEME LABORATUVARI", ["Hasta: DENEME KİŞİ   Cinsiyet: Erkek", "Numune Tarihi: 04.05.2026"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "LİPİD PROFİLİ")
    y -= 9 * mm
    pdf_table(c, y, [(20, "Test", "name"), (70, "Sonuç", "value"), (88, "Birim", "unit"), (108, "Referans Değerleri", "ref")], LIPID, size=8.6, step=7.4)
    footer(c)
    c.save()


def make_multi_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Kapsamlı check-up")
    cols = [(20, "Test", "name"), (76, "Sonuç", "value"), (98, "Birim", "unit"), (122, "Referans Aralığı", "ref")]
    y = pdf_header(c, "KURMACA HASTANESİ MERKEZ LABORATUVARI", ["Hasta: KURMACA KİŞİ   Protokol: CK-7781", "Numune Tarihi: 18.09.2026 07:55", "Sayfa 1/2"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "HEMATOLOJİ")
    y -= 9 * mm
    pdf_table(c, y, cols, MULTI_P1, size=9, step=6.6)
    footer(c)
    c.showPage()
    y = pdf_header(c, "KURMACA HASTANESİ MERKEZ LABORATUVARI", ["Numune Tarihi: 18.09.2026 07:55", "Sayfa 2/2"])
    c.setFont("DejaVu-Bold", 11)
    c.drawString(20 * mm, y, "BİYOKİMYA - HORMON - VİTAMİN")
    y -= 9 * mm
    pdf_table(c, y, cols, MULTI_P2, size=9, step=6.2)
    footer(c)
    c.save()


# ------------------------------------------------------------------------------ görüntüler ----


def draw_table_image(rows, *, title: str, sub: str, width: int = 1240, height: int = 1754, font_size: int = 26, cols=(80, 560, 700, 900, 1150), step: int = 56):
    img = Image.new("RGB", (width, height), "white")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, font_size)
    fb = ImageFont.truetype(FONT_BOLD, font_size + 6)
    d.text((cols[0], 90), title, font=fb, fill="black")
    d.text((cols[0], 150), sub, font=ImageFont.truetype(FONT, font_size - 6), fill="black")
    y = 240
    for x, head in zip(cols, ["Test", "Sonuç", "Birim", "Referans Aralığı", ""]):
        d.text((x, y), head, font=ImageFont.truetype(FONT_BOLD, font_size), fill="black")
    y += step
    d.line((cols[0], y - 14, width - 80, y - 14), fill="black", width=2)
    for name, value, unit, ref, flag, *_ in rows:
        for x, text in zip(cols, [name, value, unit, ref if isinstance(ref, str) else ref[0], flag]):
            d.text((x, y), text, font=f, fill="black")
        y += step
    return img


def make_basic_png(path: Path) -> None:
    img = Image.new("RGB", (1240, 1754), "white")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 26)
    fb = ImageFont.truetype(FONT_BOLD, 32)
    d.text((80, 90), "ÖRNEK LABORATUVARI — SENTETİK RAPOR", font=fb, fill="black")
    y = 200
    for name, value, unit, ref, flag, *_ in ROWS[:9]:
        d.text((80, y), name, font=f, fill="black")
        d.text((560, y), value, font=f, fill="black")
        d.text((700, y), unit, font=f, fill="black")
        d.text((900, y), ref, font=f, fill="black")
        d.text((1150, y), flag, font=f, fill="black")
        y += 56
    img.save(path, optimize=True)


def make_photo_jpg(path: Path) -> None:
    """Telefonla çekilmiş kâğıt: hafif eğim, bulanıklık, kenar gölgesi, kâğıt dokusu, JPEG kaybı."""
    page = draw_table_image(HEMOGRAM, title="DENEME TIP LABORATUVARI — HEMOGRAM", sub="Numune Alınma Tarihi: 03.09.2026   Cinsiyet: Kadın", font_size=25, cols=(70, 520, 660, 860, 1130), step=62)
    rnd = random.Random(7)
    # Kâğıt dokusu
    px = page.load()
    for _ in range(26000):
        x, y = rnd.randrange(page.width), rnd.randrange(page.height)
        g = rnd.randrange(200, 250)
        px[x, y] = (g, g, g)
    page = page.rotate(1.3, resample=Image.BICUBIC, expand=True, fillcolor=(88, 80, 70))
    # Masa üstü arka plan + kenar gölgesi
    bg = Image.new("RGB", (page.width + 160, page.height + 160), (74, 66, 58))
    bg.paste(page, (80, 80))
    # Yumuşak vinyet + sol üstten gelen ışık: kenarlar ve sağ alt köşe biraz daha karanlık
    mask = Image.new("L", bg.size, 0)
    ImageDraw.Draw(mask).ellipse((-bg.width * 0.25, -bg.height * 0.3, bg.width * 1.05, bg.height * 1.05), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(bg.width // 5)).point(lambda v: 150 + v * 105 // 255)
    bg = Image.composite(bg, Image.new("RGB", bg.size, (40, 36, 30)), mask)
    bg = bg.filter(ImageFilter.GaussianBlur(0.9)).resize((1500, int(1500 * bg.height / bg.width)), Image.LANCZOS)
    bg.save(path, quality=78)


def make_scan_png(path: Path) -> None:
    """Gri tonlu tarayıcı çıktısı: hafif gürültü, düşük kontrast."""
    img = draw_table_image(HORMONE_M, title="KURMACA ANDROLOJİ LABORATUVARI", sub="Numune Tarihi: 09.08.2026   Cinsiyet: Erkek", font_size=27, cols=(80, 560, 720, 900, 1150), step=64).convert("L")
    rnd = random.Random(11)
    px = img.load()
    for _ in range(30000):
        x, y = rnd.randrange(img.width), rnd.randrange(img.height)
        px[x, y] = max(0, min(255, px[x, y] + rnd.randrange(-70, 40)))
    img = img.point(lambda v: 40 + v * 200 // 255)
    img.save(path, optimize=True)


def make_enabiz_png(path: Path) -> None:
    """e-Nabız benzeri telefon ekran görüntüsü (resmi arayüz değildir; yalnızca düzeni taklit eder)."""
    W = 1080
    img = Image.new("RGB", (W, 2200), (244, 246, 250))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 34)
    fs = ImageFont.truetype(FONT, 28)
    fb = ImageFont.truetype(FONT_BOLD, 36)
    d.rectangle((0, 0, W, 150), fill=(28, 96, 160))
    d.text((40, 55), "Tahlillerim", font=fb, fill="white")
    d.rounded_rectangle((30, 190, W - 30, 330), 24, fill="white")
    d.text((60, 215), "KURMACA DEVLET HASTANESİ", font=fb, fill=(30, 30, 30))
    d.text((60, 270), "25 AĞUSTOS 2026", font=fs, fill=(90, 90, 90))
    top = 370
    d.rounded_rectangle((30, top, W - 30, top + 180 + 110 * len(ENABIZ)), 24, fill="white")
    d.text((60, top + 30), "Tam Kan (Hemogram)", font=fb, fill=(30, 30, 30))
    d.text((60, top + 85), "3 Değer Referans Dışı", font=fs, fill=(200, 60, 60))
    y = top + 150
    d.text((60, y), "İşlem Adı", font=fs, fill=(120, 120, 120))
    d.text((420, y), "Referans Aralığı", font=fs, fill=(120, 120, 120))
    d.text((760, y), "Değer", font=fs, fill=(120, 120, 120))
    y += 70
    for name, ref, val, unit, *_ in ENABIZ:
        d.text((60, y), name, font=f, fill=(30, 30, 30))
        d.text((420, y), ref, font=f, fill=(60, 60, 60))
        d.text((760, y), f"{val} {unit}", font=f, fill=(30, 30, 30))
        d.line((60, y + 70, W - 60, y + 70), fill=(230, 230, 235), width=2)
        y += 110
    top = y + 60
    d.rounded_rectangle((30, top, W - 30, top + 330), 24, fill="white")
    name, ref, val, unit, *_ = ENABIZ_TSH
    d.text((60, top + 30), name, font=fb, fill=(30, 30, 30))
    d.text((60, top + 90), "Değer Normal", font=fs, fill=(40, 150, 90))
    d.text((60, top + 160), "Referans Aralığı", font=fs, fill=(120, 120, 120))
    d.text((520, top + 160), "Değer", font=fs, fill=(120, 120, 120))
    d.text((60, top + 230), ref, font=f, fill=(60, 60, 60))
    d.text((520, top + 230), f"{val} {unit}", font=f, fill=(30, 30, 30))
    img = img.crop((0, 0, W, top + 380))
    img.save(path, optimize=True)


# e-Nabız "Tahlillerim" tablosunun telefondan alınmış dört ekran görüntüsünün 2×2 birleştirilmiş hâli (resmi
# arayüz değildir; yalnızca düzeni taklit eder). Zorluklar: yan yana iki tablo, ~13 px yazı, satır başında
# onay/ünlem simgeleri, referans dışı satırların pembe zemini, kan gazı ve spot idrar testleri,
# "Ca++" (iyonize kalsiyum), "Spot Kreatinin (İdrar)" (serum kreatinini değildir).
# Satır: (ad, değer, birim, referans, test anahtarı ya da None, beklenen durum) · bölüm: ("#", tarih, saat, başlık)
KOLAJ = [
    [
        ("#", "14.04.2026", "09:12", ""),
        ("ALT", "96", "U/L", "0 - 50", "alt", "high"),
        ("AST", "71", "U/L", "0 - 50", "ast", "high"),
        ("CK", "133.4", "U/L", "0 - 190", "ck", "normal"),
        ("CRP", "3.48", "mg/L", "0 - 5", "crp", "normal"),
        ("Glukoz", "88", "mg/dL", "74 - 106", "glucose", "normal"),
        ("Hemoliz", "12", "", "0 - 100", None, None),
        ("İkterik", "2", "", "", None, None),
        ("Kreatinin", "0.91", "mg/dL", "0.70 - 1.20", "creatinine", "normal"),
        ("Lipemi", "14", "", "0 - 400", None, None),
        ("t GFH (CKD-EPİ formülü ile)", "104", "ml/dk/1.73m²", ">60", "egfr", "normal"),
        ("#", "14.04.2026", "10:05", ""),
        ("Spot Kreatinin (İdrar)", "132.6", "mg/dL", "39 - 259", "urine-creatinine", "normal"),
        ("Spot Mikroalbumin (İdrar)", "0.41", "mg/dL", "0 - 2", "urine-microalbumin", "normal"),
        ("Spot Protein (İdrar)", "9.7", "mg/dL", "0 - 15", "urine-protein", "normal"),
        ("#", "14.04.2026", "14:40", "Kan Gazi Ve Kooksimetre"),
        # Raporda aralık yok; genel aralığın (−2…3) dışında ama satırda yeşil onay var → "normal".
        ("Base(Ecf)", "4.1", "mmol/L", "", "base-excess", "normal"),
        ("Ca++", "1.09", "mmol/L", "1.15 - 1.29", "calcium-ionized", "low"),
        ("COHb", "1.1", "%", "0 - 1.5", "cohb", "normal"),
    ],
    [
        ("HCO3-(p,st)", "27.4", "mmol/L", "21.8 - 26.9", "hco3", "high"),
        ("Lac", "1.2", "mmol/L", "0.5 - 1.6", "lactate", "normal"),
        ("MetHb", "0.6", "%", "", "methb", "normal"),
        ("O2Hb", "81.2", "%", "94 - 98", "o2hb", "low"),
        ("pCO2", "47.9", "mmHg", "32 - 48", "pco2", "normal"),
        ("pH", "7.380", "", "7.32 - 7.42", "ph", "normal"),
        ("pO2", "52.1", "mmHg", "80 - 108", "po2", "low"),
        ("sO2", "83.5", "%", "95 - 99", "so2", "low"),
        ("tHb", "15.8", "g/dL", "11.5 - 17.4", None, None),
        ("#", "14.04.2026", "14:40", "Tam Kan (Hemogram)"),
        ("BASO#", "0.04", "10^3/µL", "0.01 - 0.07", "basophil-abs", "normal"),
        ("BASO%", "0.5", "%", "0.01 - 1.2", "basophil-pct", "normal"),
        ("EOS#", "0.18", "10^3/µL", "0.01 - 0.82", "eosinophil-abs", "normal"),
        ("EOS%", "2.1", "%", "0.02 - 7.6", "eosinophil-pct", "normal"),
        ("HCT", "43.8", "%", "35 - 55", "hematocrit", "normal"),
        ("HGB", "14.7", "g/dL", "11.7 - 18", "hemoglobin", "normal"),
    ],
    [
        ("IG#", "0.03", "", "", "ig-abs", "normal"),
        ("LYMPH#", "2.21", "10^3/µL", "1 - 4.5", "lymphocyte-abs", "normal"),
        ("LYMPH%", "27.9", "%", "10 - 47.4", "lymphocyte-pct", "normal"),
        ("MCH", "30.2", "pg", "24.5 - 34", "mch", "normal"),
        ("MCHC", "33.6", "g/dL", "30 - 37", "mchc", "normal"),
        ("MCV", "89.7", "fL", "78 - 101", "mcv", "normal"),
        ("MONO#", "0.71", "10^3/µL", "0.19 - 0.94", "monocyte-abs", "normal"),
        ("MONO%", "9.4", "%", "4.3 - 18.3", "monocyte-pct", "normal"),
        ("MPV", "9.8", "fL", "8.1 - 13.1", "mpv", "normal"),
        ("NEU#", "4.87", "10^3/µL", "2.0 - 7.7", "neutrophil-abs", "normal"),
        ("NEU%", "61.3", "%", "14 - 54.6", "neutrophil-pct", "high"),
        ("PDW", "11.6", "", "", "pdw", "normal"),
        ("PLT", "233", "10^3/µL", "150 - 450", "platelet", "normal"),
        ("RBC", "4.97", "10^6/µL", "4.0 - 6.2", "rbc", "normal"),
        ("RDW-SD", "39.4", "fL", "35 - 50", "rdw-sd", "normal"),
        ("WBC", "7.96", "10^3/µL", "4.0 - 11", "wbc", "normal"),
        ("#", "14.04.2026", "16:22", ""),
        ("Alkalen Fosfataz", "104", "U/L", "40 - 129", "alp", "normal"),
        ("Amilaz", "58", "U/L", "20 - 131", "amylase", "normal"),
        ("Bilirubin, Direkt", "0.21", "mg/dL", "0 - 0.4", "bilirubin-direct", "normal"),
        ("Bilirubin,Total", "0.64", "mg/dL", "0 - 1.2", "bilirubin-total", "normal"),
    ],
    [
        ("Fosfor", "3.41", "mg/dL", "2.3 - 4.5", "phosphorus", "normal"),
        ("K (Potasyum)", "4.12", "mmol/L", "3.5 - 5.5", "potassium", "normal"),
        ("Kalsiyum", "9.38", "mg/dL", "8.6 - 10.5", "calcium", "normal"),
        ("Klor", "102.3", "mmol/L", "95 - 110", "chloride", "normal"),
        ("LDH", "284", "U/L", "135 - 225", "ldh", "high"),
        ("Magnezyum", "2.04", "mg/dL", "1.6 - 2.6", "magnesium", "normal"),
        ("Na (Sodyum)", "139.2", "mmol/L", "135 - 145", "sodium", "normal"),
        ("Üre", "31.6", "mg/dL", "10 - 50", "urea", "normal"),
    ],
]


def out_of_range(value: str, ref: str) -> bool:
    v = float(value)
    if " - " in ref:
        lo, hi = (float(x) for x in ref.split(" - "))
        return v < lo or v > hi
    if ref.startswith(">"):
        return v <= float(ref[1:])
    return False


def draw_kolaj_panel(rows, *, header: bool = True) -> Image.Image:
    f = ImageFont.truetype(FONT, 13)
    fh = ImageFont.truetype(FONT, 16)
    cols = [(0, 104), (110, 384), (390, 490), (496, 600), (606, 694)]
    head_h, row_h, sec_h, gap = (52 if header else 0), 25, 40, 4
    height = head_h + gap + sum((sec_h if r[0] == "#" else row_h) + gap for r in rows)
    img = Image.new("RGB", (694, height), "white")
    d = ImageDraw.Draw(img)
    y = 0
    if header:
        for (x0, x1), title in zip(cols, ["Tarih", "Tahlil", "Sonuç", "Sonuç\nBirimi", "Referans\nDeğeri"]):
            d.rectangle((x0, 0, x1, head_h), fill=(98, 120, 176))
            lines = title.split("\n")
            for i, t in enumerate(lines):
                d.text((x0 + 10 if x0 else 34, head_h / 2 - 9 * len(lines) + 18 * i), t, font=fh, fill="white")
        y = head_h + gap
    for r in rows:
        if r[0] == "#":
            _, date, time, title = r
            d.rectangle((0, y, cols[0][1], y + sec_h), fill=(226, 230, 240))
            d.rectangle((cols[1][0], y, cols[4][1], y + sec_h), fill=(226, 230, 240))
            d.text((18, y + 4), date, font=f, fill=(40, 40, 40))
            d.text((36, y + 21), time, font=f, fill=(40, 40, 40))
            if title:
                d.text((cols[1][0] + 10, y + 4), title, font=f, fill=(40, 40, 40))
            y += sec_h + gap
            continue
        name, value, unit, ref, *_ = r
        bad = bool(ref) and out_of_range(value, ref)
        bg = (242, 202, 212) if bad else (242, 242, 242)
        for x0, x1 in cols:
            d.rectangle((x0, y, x1, y + row_h), fill=(255, 255, 255) if x0 == 0 and not bad else bg)
        cx, cy = 52, y + row_h // 2
        d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(214, 48, 49) if bad else (52, 168, 120))
        if bad:
            d.line((cx, cy - 4, cx, cy + 1), fill="white", width=2)
            d.point([(cx, cy + 4), (cx + 1, cy + 4)], fill="white")
        else:
            d.line((cx - 4, cy, cx - 1, cy + 3, cx + 4, cy - 3), fill="white", width=2)
        for (x0, _), text in zip(cols[1:], [name, value, unit, ref]):
            d.text((x0 + 10, y + 5), text, font=f, fill=(30, 30, 30))
        y += row_h + gap
    return img


def make_enabiz_kolaj_jpg(path: Path) -> None:
    """Dört ekran görüntüsü 2×2; sağdaki ve alttaki görüntüler biraz kaymış (elle birleştirilmiş kolaj)."""
    img = Image.new("RGB", (1500, 2000), "white")
    for (x, y), rows in zip([(42, 116), (776, 116), (40, 1102), (766, 1060)], KOLAJ):
        img.paste(draw_kolaj_panel(rows), (x, y))
    img.save(path, quality=88)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    pdf_fonts()
    make_basic_pdf(OUT / "sentetik-kan-tahlili.pdf")
    make_basic_png(OUT / "sentetik-kan-tahlili.png")
    expect("sentetik-kan-tahlili.pdf", ROWS, kind="pdf", sex="male", patterns=["lipids", "liver-cells"], date="2026-09-12")
    expect("sentetik-kan-tahlili.png", ROWS[:9], kind="image", sex="male", patterns=[], date=None)

    make_hemogram_pdf(OUT / "hemogram.pdf")
    expect("hemogram.pdf", HEMOGRAM, kind="pdf", sex="female", patterns=["anemia", "platelets"], date="2026-09-03")
    make_photo_jpg(OUT / "hemogram-foto.jpg")
    expect("hemogram-foto.jpg", HEMOGRAM, kind="image", sex="female", patterns=["anemia"], date="2026-09-03")

    make_biochem_pdf(OUT / "biyokimya.pdf")
    expect("biyokimya.pdf", BIOCHEM, kind="pdf", sex="male", patterns=["kidney-filtration", "electrolytes", "uric-acid", "inflammation", "glucose"], date="2026-08-15")

    make_hormone_pdf(OUT / "hormon-kadin.pdf")
    expect("hormon-kadin.pdf", HORMONE_F, kind="pdf", sex="female", patterns=["thyroid", "prolactin-high"], date="2026-07-22",
           extra={"phaseSpecific": ["estradiol", "progesterone", "fsh", "lh"]})
    make_scan_png(OUT / "hormon-erkek.png")
    expect("hormon-erkek.png", HORMONE_M, kind="image", sex="male", patterns=["testosterone-low", "cortisol"], date="2026-08-09")

    make_vitamin_pdf(OUT / "vitamin-mineral.pdf")
    expect("vitamin-mineral.pdf", VITAMIN, kind="pdf", sex="female", patterns=["vitamin-d", "b12-folate", "iron-deficiency", "homocysteine"], date="2026-06-30")

    make_lipid_pdf(OUT / "lipid.pdf")
    expect("lipid.pdf", LIPID, kind="pdf", sex="male", patterns=["lipids"], date="2026-05-04")

    make_multi_pdf(OUT / "coklu-anormallik.pdf")
    expect("coklu-anormallik.pdf", MULTI_P1 + MULTI_P2, kind="pdf", sex="male",
           patterns=["anemia", "inflammation", "platelets", "glucose", "liver-cells", "cholestasis", "bilirubin", "kidney-filtration", "lipids", "thyroid", "vitamin-d", "pancreas", "muscle"],
           date="2026-09-18")

    make_enabiz_png(OUT / "enabiz-ekran.png")
    EXPECTED["enabiz-ekran.png"] = {
        "kind": "image", "sex": "male", "date": "2026-08-25", "patterns": [],
        "rows": [{"key": r[4], "value": value_number(r[2]), "status": r[5]} for r in ENABIZ + [ENABIZ_TSH]],
    }

    make_enabiz_kolaj_jpg(OUT / "enabiz-kolaj.jpg")
    expect("enabiz-kolaj.jpg", [r for panel in KOLAJ for r in panel if r[0] != "#" and r[4]], kind="image", sex="male", patterns=[], date=None)

    (OUT / "expected.json").write_text(json.dumps(EXPECTED, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("ok", len(EXPECTED), "rapor")
