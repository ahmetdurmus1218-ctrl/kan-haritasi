"""Sentetik (tamamen uydurma) görüntüleme test dosyaları üretir: MR serisi ve BT kesiti (DICOM),
radyoloji raporu (PDF). Gerçek kişi, gerçek kurum, gerçek görüntü veya kimlik numarası içermez.

 - imaging/beyin-mr/IM000001 … IM000008   8 kesitlik "beyin MR" serisi (uzantısız, açık VR),
                                          şekiller elipslerden çizilir; yanında DICOMDIR ve BENIOKU.TXT
                                          (klasörden içe aktarmada atlanmalı)
 - imaging/toraks-bt.dcm                  tek BT kesiti (örtük VR, işaretli, Hounsfield eğim/kesişim)
 - imaging/beyin-mr-raporu.pdf            başlıklı radyoloji raporu (Klinik bilgi, Teknik, Bulgular, Sonuç)
 - imaging/rontgen-film-foto.jpg          telefonla çekilmiş gibi röntgen filmi fotoğrafı (koyu, gri)
 - imaging/toraks-bt-raporu-foto.png      kâğıt BT raporunun fotoğrafı (OCR ile okunur)
 - imaging/batin-usg-raporu.pdf           ölçümlü batın ultrason raporu (dalak, karaciğer, böbrek, koledok…)

Kullanım: python3 fixtures/make_imaging_fixtures.py
"""
import math
import struct
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).parent / "imaging"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

EXPLICIT_LE = "1.2.840.10008.1.2.1"
IMPLICIT_LE = "1.2.840.10008.1.2"
LONG_VR = {"OB", "OD", "OF", "OL", "OV", "OW", "SQ", "SV", "UC", "UN", "UR", "UT", "UV"}


def pad(b: bytes, vr: str) -> bytes:
    if len(b) % 2:
        b += b"\0" if vr in ("UI", "OB") else b" "
    return b


def element(group: int, elem: int, vr: str, value, explicit: bool) -> bytes:
    if isinstance(value, int):
        data = struct.pack("<H", value)
    elif isinstance(value, str):
        data = pad(value.encode("utf-8"), vr)
    else:
        data = pad(bytes(value), vr)
    head = struct.pack("<HH", group, elem)
    if not explicit:
        return head + struct.pack("<I", len(data)) + data
    if vr in LONG_VR:
        return head + vr.encode() + b"\0\0" + struct.pack("<I", len(data)) + data
    return head + vr.encode() + struct.pack("<H", len(data)) + data


def dicom(elements: list, ts: str, sop_class: str) -> bytes:
    meta = b"".join(
        [
            element(0x0002, 0x0001, "OB", b"\0\1", True),
            element(0x0002, 0x0002, "UI", sop_class, True),
            element(0x0002, 0x0003, "UI", "2.25.1234567", True),
            element(0x0002, 0x0010, "UI", ts, True),
        ]
    )
    group_len = struct.pack("<HH", 2, 0) + b"UL" + struct.pack("<HI", 4, len(meta))
    explicit = ts != IMPLICIT_LE
    body = b"".join(element(g, e, vr, v, explicit) for g, e, vr, v in sorted(elements, key=lambda x: (x[0], x[1])))
    return b"\0" * 128 + b"DICM" + group_len + meta + body


def phantom(size: int, z: float) -> list:
    """Kafa benzeri şekil: kafatası halkası, beyin dokusu, iki karıncık. z: -1…1 kesit konumu."""
    out = []
    scale = math.sqrt(max(0.0, 1 - z * z * 0.7))
    for y in range(size):
        for x in range(size):
            u = (x - size / 2) / (size * 0.42)
            v = (y - size / 2) / (size * 0.48)
            r = u * u + v * v
            val = 0
            if r < scale * scale:
                val = 700  # kafatası
                if r < (scale * 0.9) ** 2:
                    val = 420 + int(40 * math.sin(x * 0.4) * math.cos(y * 0.3))  # beyin dokusu
                    for cx in (-0.18, 0.18):
                        du = (u - cx) / 0.1
                        dv = (v + 0.05) / (0.28 * scale)
                        if du * du + dv * dv < 1 and abs(z) < 0.6:
                            val = 1100  # sıvı (T2'de parlak)
            out.append(val)
    return out


def main() -> None:
    mr_dir = OUT / "beyin-mr"
    mr_dir.mkdir(parents=True, exist_ok=True)
    size = 96
    series = "2.25.9001.1"
    for i in range(8):
        z = -0.9 + i * (1.8 / 7)
        pixels = struct.pack(f"<{size * size}H", *phantom(size, z))
        els = [
            (0x0008, 0x0005, "CS", "ISO_IR 192"),
            (0x0008, 0x0016, "UI", "1.2.840.10008.5.1.4.1.1.4"),
            (0x0008, 0x0020, "DA", "20260315"),
            (0x0008, 0x0060, "CS", "MR"),
            (0x0008, 0x1030, "LO", "BEYİN MR (SENTETİK)"),
            (0x0008, 0x103E, "LO", "AX T2"),
            (0x0010, 0x0010, "PN", "SENTETIK^HASTA"),
            (0x0018, 0x0015, "CS", "BRAIN"),
            (0x0018, 0x0050, "DS", "5"),
            (0x0020, 0x000E, "UI", series),
            (0x0020, 0x0013, "IS", str(i + 1)),
            (0x0028, 0x0002, "US", 1),
            (0x0028, 0x0004, "CS", "MONOCHROME2"),
            (0x0028, 0x0010, "US", size),
            (0x0028, 0x0011, "US", size),
            (0x0028, 0x0030, "DS", "2.4\\2.4"),
            (0x0028, 0x0100, "US", 16),
            (0x0028, 0x0101, "US", 12),
            (0x0028, 0x0102, "US", 11),
            (0x0028, 0x0103, "US", 0),
            (0x0028, 0x1050, "DS", "600"),
            (0x0028, 0x1051, "DS", "1200"),
            (0x7FE0, 0x0010, "OW", pixels),
        ]
        (mr_dir / f"IM{i + 1:06d}").write_bytes(dicom(els, EXPLICIT_LE, "1.2.840.10008.5.1.4.1.1.4"))
    # Klasörden içe aktarmada atlanması gerekenler
    (mr_dir / "DICOMDIR").write_bytes(dicom([(0x0004, 0x1130, "CS", "SENTETIK")], EXPLICIT_LE, "1.2.840.10008.1.3.10"))
    (mr_dir / "BENIOKU.TXT").write_text("Sentetik test verisi. Gerçek hasta verisi değildir.\n", encoding="utf-8")

    # BT: -1000 (hava) … +1000 (kemik) arası halka, örtük VR, işaretli 16 bit
    size = 128
    hu = []
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - size / 2, y - size / 2) / (size / 2)
            v = -1000 if r > 0.9 else 900 if r > 0.8 else -750 if abs(x - size / 2) > 10 and r < 0.7 else 40
            hu.append(v + 1024)
    ct = [
        (0x0008, 0x0016, "UI", "1.2.840.10008.5.1.4.1.1.2"),
        (0x0008, 0x0020, "DA", "20251201"),
        (0x0008, 0x0060, "CS", "CT"),
        (0x0008, 0x1030, "LO", "TORAKS BT (SENTETIK)"),
        (0x0018, 0x0015, "CS", "CHEST"),
        (0x0028, 0x0002, "US", 1),
        (0x0028, 0x0004, "CS", "MONOCHROME2"),
        (0x0028, 0x0010, "US", size),
        (0x0028, 0x0011, "US", size),
        (0x0028, 0x0100, "US", 16),
        (0x0028, 0x0101, "US", 16),
        (0x0028, 0x0102, "US", 15),
        (0x0028, 0x0103, "US", 1),
        (0x0028, 0x1052, "DS", "-1024"),
        (0x0028, 0x1053, "DS", "1"),
        (0x7FE0, 0x0010, "OW", struct.pack(f"<{size * size}h", *hu)),
    ]
    (OUT / "toraks-bt.dcm").write_bytes(dicom(ct, IMPLICIT_LE, "1.2.840.10008.5.1.4.1.1.2"))

    # Radyoloji raporu (PDF, metin katmanlı)
    pdfmetrics.registerFont(TTFont("DejaVu", FONT))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))
    c = canvas.Canvas(str(OUT / "beyin-mr-raporu.pdf"), pagesize=A4)
    c.setTitle("Sentetik radyoloji raporu")
    y = 280 * mm
    c.setFont("DejaVu-Bold", 13)
    c.drawString(20 * mm, y, "ÖRNEK GÖRÜNTÜLEME MERKEZİ (SENTETİK)")
    y -= 8 * mm
    c.setFont("DejaVu", 10)
    c.drawString(20 * mm, y, "Hasta: Sentetik Hasta          Tetkik tarihi: 15.03.2026")
    y -= 10 * mm
    c.setFont("DejaVu-Bold", 12)
    c.drawString(20 * mm, y, "KRANİAL MR İNCELEMESİ")
    blocks = [
        ("KLİNİK BİLGİ:", ["Baş ağrısı."]),
        ("TEKNİK:", ["Aksiyel T2, FLAIR, difüzyon ağırlıklı ve sagittal T1 sekanslar kontrastsız alınmıştır."]),
        (
            "BULGULAR:",
            [
                "Her iki frontal lob subkortikal beyaz cevherde birkaç adet milimetrik T2/FLAIR hiperintens odak izlendi.",
                "Difüzyon ağırlıklı incelemede kısıtlanma saptanmadı.",
                "Lateral ventriküller ve sulkuslar olağan genişliktedir.",
                "Sağ maksiller sinüste mukozal kalınlaşma mevcuttur.",
            ],
        ),
        ("SONUÇ:", ["Frontal beyaz cevherde nonspesifik milimetrik hiperintens odaklar.", "Klinik korelasyon önerilir."]),
    ]
    y -= 10 * mm
    for head, lines in blocks:
        c.setFont("DejaVu-Bold", 10.5)
        c.drawString(20 * mm, y, head)
        y -= 6 * mm
        c.setFont("DejaVu", 10)
        for line in lines:
            c.drawString(24 * mm, y, line)
            y -= 5.5 * mm
        y -= 4 * mm
    c.setFont("DejaVu", 8)
    c.drawString(20 * mm, 15 * mm, "Bu belge test amaçlı üretilmiş sentetik bir örnektir; gerçek bir kişiye ait değildir.")
    c.save()
    film_photo()
    report_photo()
    abdomen_report()
    mr_collage()


def film_photo() -> None:
    """Göğüs filmi benzeri: koyu zemin, açık kaburga yayları, omurga; hafif bulanık ve gürültülü."""
    w, h = 900, 1100
    im = Image.new("L", (w, h), 18)
    d = ImageDraw.Draw(im)
    d.ellipse((120, 160, 780, 1000), fill=45)  # göğüs kafesi gölgesi
    d.rectangle((425, 80, 475, 1050), fill=170)  # omurga
    for i in range(10):
        y = 250 + i * 70
        for side in (-1, 1):
            x0, x1 = (160, 440) if side < 0 else (460, 740)
            d.arc((x0, y - 60, x1, y + 80), 200 if side < 0 else 280, 340 if side < 0 else 60, fill=190, width=14)
    d.ellipse((380, 560, 560, 820), fill=120)  # kalp gölgesi
    im = im.filter(ImageFilter.GaussianBlur(3))
    im = im.convert("RGB")
    im.save(OUT / "rontgen-film-foto.jpg", quality=88)


def report_photo() -> None:
    """Kâğıt raporun fotoğrafı: açık zemin, koyu yazı."""
    w, h = 1400, 1500
    im = Image.new("RGB", (w, h), (238, 236, 230))
    d = ImageDraw.Draw(im)
    bold = ImageFont.truetype(FONT_BOLD, 38)
    reg = ImageFont.truetype(FONT, 34)
    y = 90
    lines = [
        (bold, "TORAKS BT RAPORU (SENTETİK)"),
        (reg, "Tetkik tarihi: 01.12.2025"),
        (reg, ""),
        (bold, "KLİNİK BİLGİ:"),
        (reg, "Öksürük."),
        (bold, "BULGULAR:"),
        (reg, "Sağ akciğer alt lobda milimetrik nodül izlendi."),
        (reg, "Plevral efüzyon saptanmadı."),
        (reg, "Mediastinal lenf nodları olağan boyutlardadır."),
        (bold, "SONUÇ:"),
        (reg, "Sağ alt lobda milimetrik nodül."),
        (reg, "Klinik korelasyon önerilir."),
    ]
    for font, text in lines:
        d.text((110, y), text, font=font, fill=(25, 25, 25))
        y += 72
    im.save(OUT / "toraks-bt-raporu-foto.png")


def abdomen_report() -> None:
    """Ölçümleri tahlil gibi değerlendirilecek batın ultrason raporu (değerler uydurmadır)."""
    c = canvas.Canvas(str(OUT / "batin-usg-raporu.pdf"), pagesize=A4)
    c.setTitle("Sentetik batın ultrason raporu")
    y = 280 * mm
    c.setFont("DejaVu-Bold", 13)
    c.drawString(20 * mm, y, "TÜM BATIN ULTRASONOGRAFİ RAPORU (SENTETİK)")
    y -= 8 * mm
    c.setFont("DejaVu", 10)
    c.drawString(20 * mm, y, "Tetkik tarihi: 02.09.2026")
    blocks = [
        ("BULGULAR:", [
            "Karaciğer boyutu 172 mm olup parankim ekojenitesi artmıştır (grade 1 hepatosteatoz).",
            "Safra kesesi duvar kalınlığı 2 mm, lümeni doğaldır. Koledok çapı 4 mm.",
            "Dalak boyutu 14,5 cm ile artmıştır.",
            "Sağ böbrek 108x45 mm, sol böbrek 104x44 mm; parankim kalınlığı sağda 16 mm, solda 17 mm.",
            "Abdominal aorta çapı 2,1 cm. Mesane doğaldır.",
        ]),
        ("SONUÇ:", ["Hepatomegali ve grade 1 hepatosteatoz. Splenomegali."]),
    ]
    y -= 12 * mm
    for head, lines in blocks:
        c.setFont("DejaVu-Bold", 10.5)
        c.drawString(20 * mm, y, head)
        y -= 6 * mm
        c.setFont("DejaVu", 10)
        for line in lines:
            c.drawString(24 * mm, y, line)
            y -= 5.5 * mm
        y -= 4 * mm
    c.setFont("DejaVu", 8)
    c.drawString(20 * mm, 15 * mm, "Bu belge test amaçlı üretilmiş sentetik bir örnektir; gerçek bir kişiye ait değildir.")
    c.save()


def mr_collage() -> None:
    """Yazısız MR kolajı (sentetik): solda simetrik eksenel kesit, ortada sol yarıda parlak odak,
    sağda yandan (sagital) benzeri simetrik olmayan kesit. Görüntü incelemesi e2e testi için."""
    w, h, gap = 300, 360, 14
    im = Image.new("L", (w * 3 + gap * 2, h), 0)

    def head(ox: int, lesion: bool = False, profile: bool = False) -> None:
        d = ImageDraw.Draw(im)
        cx, cy = ox + w // 2, h // 2
        if profile:
            d.ellipse((cx - 110, cy - 150, cx + 110, cy + 120), fill=200)
            d.rectangle((cx - 140, cy + 20, cx - 20, cy + 170), fill=170)  # yüz/boyun
            d.ellipse((cx - 96, cy - 136, cx + 96, cy + 106), fill=110)
            return
        d.ellipse((cx - 110, cy - 150, cx + 110, cy + 150), fill=210)  # cilt/kafatası
        d.ellipse((cx - 98, cy - 138, cx + 98, cy + 138), fill=40)
        d.ellipse((cx - 92, cy - 132, cx + 92, cy + 132), fill=120)  # beyin
        for k in range(-3, 4):  # simetrik girus benzeri doku
            for side in (-1, 1):
                x = cx + side * (40 + abs(k) * 6)
                d.ellipse((x - 14, cy + k * 34 - 10, x + 14, cy + k * 34 + 10), fill=135)
        d.ellipse((cx - 30, cy - 50, cx - 6, cy + 30), fill=225)  # ventriküller
        d.ellipse((cx + 6, cy - 50, cx + 30, cy + 30), fill=225)
        if lesion:
            d.ellipse((cx - 78, cy - 70, cx - 42, cy - 34), fill=240)  # tek taraflı parlak odak

    head(0)
    head(w + gap, lesion=True)
    head(2 * (w + gap), profile=True)
    im = im.filter(ImageFilter.GaussianBlur(1.2)).convert("RGB")
    im.save(OUT / "mr-kolaj-foto.jpg", quality=90)


if __name__ == "__main__":
    main()
