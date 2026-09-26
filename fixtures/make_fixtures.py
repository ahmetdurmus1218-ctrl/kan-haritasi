"""Sentetik (tamamen uydurma) test raporları üretir. Gerçek kişi, gerçek kurum veya
gerçek TC kimlik numarası içermez; CI'daki fixture taraması bunu denetler.

Kullanım: python3 fixtures/make_fixtures.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = Path(__file__).parent / "reports"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ROWS = [
    ("Hemoglobin", "13,9", "g/dL", "13,5 - 17,5", ""),
    ("Lökosit (WBC)", "7,20", "10^3/µL", "4,0 - 10,0", ""),
    ("Trombosit", "251", "10^3/µL", "150 - 400", ""),
    ("Glukoz (açlık)", "94", "mg/dL", "70 - 100", ""),
    ("Kreatinin", "0,92", "mg/dL", "0,70 - 1,20", ""),
    ("ALT", "68", "U/L", "0 - 41", "H"),
    ("AST", "35", "U/L", "0 - 40", ""),
    ("Total Kolesterol", "241", "mg/dL", "< 200", "H"),
    ("LDL Kolesterol", "178", "mg/dL", "0 - 130", "H"),
    ("HDL Kolesterol", "44", "mg/dL", "> 40", ""),
    ("Trigliserid", "162", "mg/dL", "< 150", "H"),
    ("TSH", "2,10", "mIU/L", "0,27 - 4,20", ""),
    ("Ferritin", "19", "ng/mL", "30 - 400", "L"),
    ("Vitamin B12", "312", "pg/mL", "197 - 771", ""),
]


def make_pdf(path: Path) -> None:
    pdfmetrics.registerFont(TTFont("DejaVu", FONT))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))
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
    c.setFont("DejaVu-Bold", 9.5)
    for x, label in [(20, "Test"), (85, "Sonuç"), (110, "Birim"), (135, "Referans Aralığı"), (175, "")]:
        c.drawString(x * mm, y, label)
    y -= 3 * mm
    c.line(20 * mm, y, 190 * mm, y)
    y -= 6 * mm
    c.setFont("DejaVu", 9.5)
    for name, value, unit, ref, flag in ROWS:
        c.drawString(20 * mm, y, name)
        c.drawString(85 * mm, y, value)
        c.drawString(110 * mm, y, unit)
        c.drawString(135 * mm, y, ref)
        c.drawString(175 * mm, y, flag)
        y -= 7 * mm
    y -= 6 * mm
    c.setFont("DejaVu", 8)
    c.drawString(20 * mm, y, "Bu belge yazılım testi için üretilmiştir; tıbbi geçerliliği yoktur.")
    c.showPage()
    c.setFont("DejaVu", 9.5)
    c.drawString(20 * mm, h - 25 * mm, "Sayfa 2 — Açıklamalar: LDL için hedef değerler risk durumuna göre değişir.")
    c.save()


def make_png(path: Path) -> None:
    img = Image.new("RGB", (1240, 1754), "white")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 26)
    fb = ImageFont.truetype(FONT_BOLD, 32)
    d.text((80, 90), "ÖRNEK LABORATUVARI — SENTETİK RAPOR", font=fb, fill="black")
    y = 200
    for name, value, unit, ref, flag in ROWS[:9]:
        d.text((80, y), name, font=f, fill="black")
        d.text((560, y), value, font=f, fill="black")
        d.text((700, y), unit, font=f, fill="black")
        d.text((900, y), ref, font=f, fill="black")
        d.text((1150, y), flag, font=f, fill="black")
        y += 56
    img.save(path, optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    make_pdf(OUT / "sentetik-kan-tahlili.pdf")
    make_png(OUT / "sentetik-kan-tahlili.png")
    print("ok")
