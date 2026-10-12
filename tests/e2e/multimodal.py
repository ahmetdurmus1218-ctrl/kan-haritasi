"""Uçtan uca: rapordan bağımsız ham görüntü analizi ve vücut merkezli ekranlar.

Kabul senaryoları (yalnızca sentetik görüntülerle):
  A. Yalnızca MR fotoğrafı (rapor yok) → tür/bölge tahmini, kalite, gözlem, beyin hiyerarşisi, "rapor yok"
  E. Yalnızca EKG fotoğrafı → ızgara kalibrasyonu, kalp hızı; PR/QRS/QT uydurulmaz
  F. Yalnızca pankreas ultrason görüntüsü → ultrason tanınır, organ tanıma "yok", pankreas bağlamı
  G. Yalnızca patoloji görüntüsü → doku/çekirdek ölçümü, tanı yok
  Vücudum → organ sayfası (Normal / Benim durumum / Karşılaştır), "Neden?" zinciri

Kullanım: pnpm build && (cd apps/web && npx vite preview --port 4173), sonra
  python3 tests/e2e/multimodal.py [ekran-görüntüsü-klasörü]
"""
import io
import math
import os
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
IMG = ROOT / "fixtures/imaging"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def png(img: Image.Image) -> bytes:
    b = io.BytesIO()
    img.save(b, "PNG")
    return b.getvalue()


def ecg_png(mm=8, bpm=75, width=1200) -> bytes:
    h = mm * 40
    img = Image.new("RGB", (width, h), (253, 240, 240))
    d = ImageDraw.Draw(img)
    for x in range(0, width, mm):
        d.line([(x, 0), (x, h)], fill=(235, 120, 130) if x % (mm * 5) == 0 else (245, 190, 195))
    for y in range(0, h, mm):
        d.line([(0, y), (width, y)], fill=(235, 120, 130) if y % (mm * 5) == 0 else (245, 190, 195))
    base = h * 0.65
    beat = 60 / bpm * 25 * mm
    beats = [mm * 6 + k * beat for k in range(int(width / beat) + 1)]
    pts = []
    for x in range(width):
        v = 0.0
        for b in beats:
            dd = x - b
            v += 1.5 * mm * math.exp(-(((dd + 4 * mm) / (0.9 * mm)) ** 2))
            if abs(dd) <= mm:
                v += 12 * mm * (1 - abs(dd) / mm)
            v += 3 * mm * math.exp(-(((dd - 8 * mm) / (1.6 * mm)) ** 2))
        pts.append((x, base - v))
    d.line(pts, fill=(25, 25, 30), width=2)
    return png(img)


def ultrasound_png(w=480, h=400) -> bytes:
    img = Image.new("L", (w, h), 0)
    px = img.load()
    rnd = random.Random(7)
    for y in range(h):
        for x in range(w):
            dx, dy = x - w / 2, y - 20
            r = math.hypot(dx, dy)
            if dy <= 0 or r > h - 40 or abs(math.atan2(dx, dy)) > 0.62:
                continue
            v = 70 + 90 * rnd.random() * (1 - r / h)
            if (x - w / 2 - 30) ** 2 / 900 + (y - 200) ** 2 / 400 < 1:
                v *= 0.2
            px[x, y] = int(v)
    return png(img.convert("RGB"))


def pathology_png(w=400, h=300) -> bytes:
    img = Image.new("RGB", (w, h), (245, 243, 247))
    d = ImageDraw.Draw(img)
    d.ellipse([30, 30, 370, 270], fill=(220, 145, 185))
    rnd = random.Random(3)
    for _ in range(160):
        cx, cy = 60 + rnd.random() * 280, 50 + rnd.random() * 200
        if (cx - 200) ** 2 / 165**2 + (cy - 150) ** 2 / 115**2 >= 1:
            continue
        r = 3 + rnd.random() * 2
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(85, 50, 140))
    return png(img)


def upload(page, category: str, name: str, mime: str, data: bytes):
    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    radio = page.get_by_role("radio", name=category, exact=True)
    if radio.count():
        radio.click()
    else:
        page.get_by_label("Diğer belge türleri").select_option(label=category)
    page.set_input_files("input[type=file][multiple]", [{"name": name, "mimeType": mime, "buffer": data}])
    page.get_by_role("button", name="Aç ve oku").click()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, device_scale_factor=1)
    ctx.set_default_timeout(60000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)
    page.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for(timeout=20000)
    check(page.get_by_role("link", name="Vücudum").count() >= 1, "ana gezinmede 'Vücudum' var")

    # --- A: yalnızca MR fotoğrafı, rapor yok
    upload(page, "MR", "brain_mri.jpg", "image/jpeg", (IMG / "mr-kolaj-foto.jpg").read_bytes())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Görüntüden çıkan gözlemler", exact=False).wait_for(timeout=60000)
    t = card.inner_text()
    check("Rapor yok" in t, "A: rapor olmadığı açıkça yazıyor")
    check("yalnızca görüntünün kendisine dayanıyor" in t, "A: analizin yalnızca görüntüye dayandığı yazıyor")
    check("KISMİ" in t, "A: IMAGE_ANALYSIS_STATUS = KISMİ")
    check("parlama, kesilme ya da düşük çözünürlük saptanmadı" in t or "bulanık" in t, "A: kalite kontrolü yapıldı")
    check("MR" in t and "Beyin" in t, "A: modalite ve bölge (beyin) tahmini")
    check("GÖRÜNTÜ ANALİZİ" in t and "güven" in t, "A: gözlem kaynaklı ve güvenli")
    check("yarıküre" in t, "A: beyin → yarıküre → lob hiyerarşisi")
    check("Lezyon / kitle tespiti" in t, "A: uygulanmayan yetenek (lezyon tespiti) açıkça listeleniyor")
    check("gerçek görüntü üzerinde piksel konumu var" in t, "A: gerçek görüntüde konum var")
    card.get_by_role("button", name="Neden? / Neyi etkiler?").first.click()
    check(card.get_by_text("Normalde ne yapar").count() >= 1, "A: 'Neden?' zinciri açılıyor (normal işlev)")
    card.screenshot(path=SHOTS / "90-ham-goruntu-analizi-mr.png")
    page.wait_for_timeout(800)

    # Vücudum → beyin → Benim durumum (görüntü gözlemi kaydedildi)
    page.goto(URL + "#/vucudum")
    page.get_by_text("Vücudumda ne var, ne oluyor?").wait_for()
    page.get_by_role("button", name="Beyin", exact=False).first.wait_for()
    check("görüntü gözlemi" in page.locator("main").inner_text(), "Vücudum: beyinde görüntü gözlemi sayılıyor")
    page.screenshot(path=SHOTS / "91-vucudum.png", full_page=True)
    page.goto(URL + "#/organ/brain/benim")
    page.get_by_text("Görüntülerimden çıkan gözlemler").wait_for()
    check(page.get_by_text("radyolog raporu değildir", exact=False).count() >= 1, "Organ sayfası: görüntü gözlemi rapor değil diye işaretli")
    page.screenshot(path=SHOTS / "92-organ-beyin-benim.png", full_page=True)
    page.get_by_role("tab", name="Normal").click()
    page.get_by_text("Normalde ne işe yarar?").wait_for()
    check(page.get_by_text("Planlama, karar verme, dikkat").count() >= 1, "Normal: beyin işlevleri")
    page.get_by_role("button", name="Detaylandır ↓").first.click()
    page.screenshot(path=SHOTS / "93-organ-beyin-normal.png", full_page=True)
    page.get_by_role("tab", name="Karşılaştır").click()
    page.get_by_text("Bende (fark)").wait_for()
    check(page.get_by_text("Görüntü analizinden (doğrulanmamış)").count() >= 1, "Karşılaştır: fark kaynağıyla")
    page.goto(URL + "#/organ/pancreas")
    page.get_by_text("Normal fizyoloji · neyi ne etkiler?").wait_for()
    check("İnsülin" in page.locator("main").inner_text() and "Hücrelerin glukoz kullanımı" in page.locator("main").inner_text(), "Pankreas: insülin → glukoz kullanımı zinciri")
    page.screenshot(path=SHOTS / "94-organ-pankreas-normal.png", full_page=True)

    # --- E: yalnızca EKG fotoğrafı
    upload(page, "EKG", "ECG_photo.png", "image/png", ecg_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Kalp hızı yaklaşık", exact=False).wait_for(timeout=60000)
    t = card.inner_text()
    check("Kalp hızı yaklaşık 7" in t, "E: kalp hızı ölçüldü (~75/dk)")
    check("QT / QTc" in t and "ölçülmedi" in t, "E: QT ölçülmedi, uydurulmadı")
    check("Kalp" in t, "E: bölge kalp")
    card.screenshot(path=SHOTS / "95-ekg-analizi.png")

    # --- F: yalnızca pankreas ultrasonu
    upload(page, "Ultrason", "pancreas_ultrasound.png", "image/png", ultrasound_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("✓ çalıştı", exact=False).wait_for(timeout=60000)
    t = card.inner_text()
    check("Ultrason" in t, "F: ultrason tanındı")
    check("Organı görüntüden tanıma (ör. pankreas)" in t, "F: organ tanıma modeli olmadığı açık")
    check("Pankreas" in t, "F: pankreas bağlamı (dosya adı) gösteriliyor")
    card.screenshot(path=SHOTS / "96-ultrason-analizi.png")

    # --- G: yalnızca patoloji görüntüsü
    upload(page, "Patoloji / biyopsi", "pathology_slide.png", "image/png", pathology_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("✓ çalıştı", exact=False).wait_for(timeout=60000)
    t = card.inner_text()
    check("çekirdek" in t, "G: çekirdek ölçümü yapıldı")
    check("Patolojik tanı" in t and "tanı üretilmedi" in t, "G: tanı üretilmedi")
    card.screenshot(path=SHOTS / "97-patoloji-analizi.png")

    # --- Telefon genişliği: Vücudum yatay kaydırma yok
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(URL + "#/vucudum")
    page.get_by_text("Vücudumda ne var, ne oluyor?").wait_for()
    sw = page.evaluate("() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth")
    check(sw <= 1, "telefon: Vücudum yatay taşma yok")
    page.screenshot(path=SHOTS / "98-telefon-vucudum.png", full_page=True)

    csp = page.evaluate("window.__csp")
    check(not csp, f"CSP ihlali yok {csp}")
    errs = [c for c in console if "error" in c.lower()]
    check(not errs, f"konsol hatası yok {errs[:3]}")
    check(not external, f"dışarıya istek yok {external[:3]}")
    browser.close()

print(f"\n{len(problems)} sorun" if problems else "\nTümü geçti")
sys.exit(1 if problems else 0)
