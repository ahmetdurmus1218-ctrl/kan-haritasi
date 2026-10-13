"""Uçtan uca: rapordan bağımsız ham görüntü analizi ve vücut merkezli ekranlar.

Kabul senaryoları (yalnızca sentetik görüntülerle):
  A. Yalnızca MR fotoğrafı (rapor yok) → tür/bölge tahmini, kalite, gözlem, beyin hiyerarşisi, "rapor yok"
  E. Yalnızca EKG fotoğrafı → ızgara kalibrasyonu, kalp hızı; PR/QRS/QT uydurulmaz
  F. Yalnızca pankreas ultrason görüntüsü → ultrason tanınır, organ tanıma "yok", pankreas bağlamı
  G. Yalnızca patoloji görüntüsü → doku/çekirdek ölçümü, tanı yok
  Vücudum → organ sayfası (Normal / Benimki, "Daha fazla göster"), "Neden?" zinciri
  UI kabul: "Veri ekle" ilk ekranda, alt gezinme ≤5, sonuçta az seçenek, arama, telefonda taşma yok

Kullanım: pnpm build && (cd apps/web && npx vite preview --port 4173), sonra
  python3 tests/e2e/multimodal.py [ekran-görüntüsü-klasörü]
"""
import io
import math
import os
import random
import re
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
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    # Tür seçimi isteğe bağlı ve varsayılan olarak gizli (sistem kendisi anlar).
    toggle = page.get_by_role("button", name=re.compile("Türünü kendim seçeyim|Tür: "))
    if toggle.count():
        toggle.click()
    radio = page.get_by_role("radio", name=category, exact=True)
    if radio.count():
        radio.click()
    else:
        page.get_by_label("Diğer belge türleri").select_option(label=category)
    page.set_input_files("input[type=file][multiple]", [{"name": name, "mimeType": mime, "buffer": data}])
    page.get_by_role("button", name="Aç ve oku").click()


def expand(page):
    """Organ sayfasında "Daha fazla göster" (sekme değişince açık kalabilir)."""
    b = page.get_by_role("button", name="Daha fazla göster")
    if b.count():
        b.click()


def card_text(card) -> str:
    """Kartın tamamı (kapalı "Teknik detaylar" dahil)."""
    return card.evaluate("e => e.textContent")


def open_technical(card):
    det = card.locator("details", has_text="Teknik detaylar").first
    if det.count() and not det.evaluate("d => d.open"):
        det.locator("summary").first.click()


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
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for(timeout=20000)

    # --- UI kabul: ana sayfa "Vücudum nasıl?" sorusunu yanıtlar; "Veri ekle" ve "Vücudum" hemen görünür
    check(page.get_by_role("link", name="Veri ekle").first.is_visible(), "UI: 'Veri ekle' ilk ekranda görünür")
    check(page.get_by_role("link", name="Vücudum").first.is_visible(), "UI: ana gezinmede 'Vücudum' görünür")
    labels = [x.strip() for x in page.locator("nav[aria-label] a, nav[aria-label] button").all_inner_texts() if x.strip()]
    check(not any(w in " ".join(labels) for w in ("Kapsam", "Simülasyon", "Hakkında", "DICOM")), f"UI: gezinmede teknik öğe yok {labels}")

    # --- A: yalnızca MR fotoğrafı, rapor yok
    upload(page, "MR", "brain_mri.jpg", "image/jpeg", (IMG / "mr-kolaj-foto.jpg").read_bytes())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Analiz tamamlandı").wait_for(timeout=60000)
    card.get_by_role("list", name="Görüntüden çıkan gözlemler").wait_for()
    vis = card.inner_text()
    check("Rapor yok" in vis and "yalnızca görüntünün kendisine dayanıyor" in vis, "A: rapor olmadığı ve analizin yalnızca görüntüye dayandığı özette")
    check("KISMİ" in vis, "A: IMAGE_ANALYSIS_STATUS = KISMİ")
    check("Bu bir MR görüntüsü gibi görünüyor" in vis and "Beyin" in vis, "A: modalite ve bölge (beyin) tahmini sade cümleyle")
    check("yarıküre" in vis, "A: bulgu kartı konumu (beyin → yarıküre → lob)")
    check("Görüntüde dikkat çeken alan" in vis and "Kaynak:" in vis, "A: basit bulgu kartı (ne, kaynak)")
    check("Lezyon / kitle tespiti" not in vis, "UI: yetenek listesi ilk bakışta gizli (Teknik detaylar)")
    nbtn = card.locator("button:visible").count()
    check(nbtn <= 8, f"UI: MR sonucunda az sayıda seçenek ({nbtn} düğme)")
    check(card.get_by_role("button", name="Bulguları gör").count() == 1 and card.get_by_role("button", name="Vücudumda göster").count() >= 1, "UI: sonuç ekranında 'Bulguları gör' / 'Vücudumda göster'")
    card.screenshot(path=SHOTS / "90-ham-goruntu-analizi-mr.png")
    open_technical(card)
    t = card.inner_text()
    check("Lezyon / kitle tespiti" in t, "A: uygulanmayan yetenek (lezyon tespiti) Teknik detaylar'da açıkça listeleniyor")
    check("parlama, kesilme ya da düşük çözünürlük saptanmadı" in t or "bulanık" in t, "A: kalite kontrolü yapıldı")
    card.get_by_role("button", name="İncele").first.click()
    t = card.inner_text()
    check("GÖRÜNTÜ ANALİZİ" in t and "güven" in t, "A: gözlem kaynaklı ve güvenli (İncele)")
    check("gerçek görüntü üzerinde piksel konumu var" in t, "A: gerçek görüntüde konum var")
    card.get_by_role("button", name="Neden? / Neyi etkiler?").first.click()
    check(card.get_by_text("Normalde ne yapar").count() >= 1, "A: 'Neden?' zinciri açılıyor (normal işlev)")
    card.screenshot(path=SHOTS / "90b-ham-goruntu-analizi-mr-acik.png")
    page.wait_for_timeout(800)

    # Ana sayfa artık özet gösteriyor
    page.goto(URL + "#/")
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for()
    check(page.get_by_text("Son durum").count() >= 1, "UI: ana sayfada 'Son durum' özeti")
    page.screenshot(path=SHOTS / "90c-ana-sayfa.png", full_page=True)

    # Vücudum → beyin → Benimki (görüntü gözlemi kaydedildi)
    page.goto(URL + "#/vucudum")
    page.get_by_role("heading", name="Vücudum", exact=True).wait_for()
    page.get_by_role("button", name="Beyin", exact=False).first.wait_for()
    check("görüntü gözlemi" in page.locator("main").inner_text(), "Vücudum: beyinde görüntü gözlemi sayılıyor")
    page.screenshot(path=SHOTS / "91-vucudum.png", full_page=True)
    page.get_by_role("button", name="Beyin", exact=False).first.click()
    sheet = page.locator("dialog[open]")
    sheet.get_by_text("Detaylı incele").wait_for()
    check(sheet.get_by_role("button", name="Normalde nasıl çalışır?").count() == 1, "UI: organa dokununca alt sayfa (özet + yollar)")
    sheet.get_by_role("button", name="Kapat").click()

    page.goto(URL + "#/organ/brain/benim")
    page.get_by_role("tab", name="Benimki").wait_for()
    check(page.get_by_role("tab").count() == 2, "UI: organ sayfasında yalnızca Normal / Benimki")
    expand(page)
    page.get_by_text("Görüntülerimden çıkan gözlemler").wait_for()
    check(page.get_by_text("radyolog raporu değildir", exact=False).count() >= 1, "Organ sayfası: görüntü gözlemi rapor değil diye işaretli")
    check(page.get_by_text("Bende (fark)").count() >= 1 and page.get_by_text("Görüntü analizinden (doğrulanmamış)").count() >= 1, "Benimki: fark kaynağıyla")
    page.screenshot(path=SHOTS / "92-organ-beyin-benim.png", full_page=True)
    page.get_by_role("tab", name="Normal").click()
    page.get_by_text("Normalde ne işe yarar?").first.wait_for()
    expand(page)
    check(page.get_by_text("Planlama, karar verme, dikkat").count() >= 1, "Normal: beyin işlevleri")
    page.get_by_role("button", name="Detaylandır ↓").first.click()
    page.screenshot(path=SHOTS / "93-organ-beyin-normal.png", full_page=True)

    # UI kabul: önce basit açıklama, sonra fizyoloji, sonra anatomi → doku → hücre → molekül
    page.goto(URL + "#/organ/brain.white-matter/normal")
    page.get_by_text("Normalde ne işe yarar?").first.wait_for()
    expand(page)
    main = page.locator("main")
    for _ in range(4):
        b = main.get_by_role("button", name="Detaylandır ↓")
        if not b.count():
            break
        b.first.click()
        page.wait_for_timeout(150)
    mt = main.inner_text()
    check("Oligodendrosit" in mt and "Miyelin" in mt, "UI: anatomi → doku → hücre → molekül iniş (Oligodendrosit → Miyelin)")

    page.goto(URL + "#/organ/pancreas")
    page.get_by_role("heading", name="Pankreas", exact=True).wait_for()
    page.get_by_text("Normalde ne işe yarar?").first.wait_for()
    expand(page)
    page.get_by_text("Normal fizyoloji · neyi ne etkiler?").wait_for()
    check("İnsülin" in main.inner_text() and "Hücrelerin glukoz kullanımı" in main.inner_text(), "Pankreas: insülin → glukoz kullanımı zinciri")
    page.screenshot(path=SHOTS / "94-organ-pankreas-normal.png", full_page=True)

    # UI kabul: genel arama
    page.keyboard.press("Control+k")
    page.get_by_role("searchbox").or_(page.locator("dialog[open] input")).first.fill("pankreas")
    dlg = page.locator("dialog[open]")
    dlg.get_by_text("Pankreas", exact=True).first.wait_for()
    check(dlg.get_by_role("button", name="Normalde nasıl çalışır?").count() + dlg.get_by_role("link", name="Normalde nasıl çalışır?").count() >= 1, "UI: arama 'pankreas' → organ ve alt bağlantılar")
    page.keyboard.press("Escape")

    # --- E: yalnızca EKG fotoğrafı
    upload(page, "EKG", "ECG_photo.png", "image/png", ecg_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Kalp hızı yaklaşık", exact=False).wait_for(timeout=60000)
    t = card_text(card)
    check("Kalp hızı yaklaşık 7" in t, "E: kalp hızı ölçüldü (~75/dk)")
    check("QT / QTc" in t and "ölçülmedi" in t, "E: QT ölçülmedi, uydurulmadı")
    check("Kalp" in t, "E: bölge kalp")
    open_technical(card)
    card.screenshot(path=SHOTS / "95-ekg-analizi.png")

    # --- F: yalnızca pankreas ultrasonu
    upload(page, "Ultrason", "pancreas_ultrasound.png", "image/png", ultrasound_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Analiz tamamlandı").wait_for(timeout=60000)
    t = card_text(card)
    check("Ultrason" in t, "F: ultrason tanındı")
    check("Organı görüntüden tanıma (ör. pankreas)" in t, "F: organ tanıma modeli olmadığı açık")
    check("Pankreas" in t, "F: pankreas bağlamı (dosya adı) gösteriliyor")
    open_technical(card)
    card.screenshot(path=SHOTS / "96-ultrason-analizi.png")

    # --- G: yalnızca patoloji görüntüsü
    upload(page, "Patoloji / biyopsi", "pathology_slide.png", "image/png", pathology_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Analiz tamamlandı").wait_for(timeout=60000)
    t = card_text(card)
    check("çekirdek" in t, "G: çekirdek ölçümü yapıldı")
    check("Patolojik tanı" in t and "tanı üretilmedi" in t, "G: tanı üretilmedi")
    open_technical(card)
    card.screenshot(path=SHOTS / "97-patoloji-analizi.png")

    # --- Telefon genişliği: alt gezinme ≤5 öğe, Vücudum yatay kaydırma yok
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(URL + "#/")
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for()
    bottom = page.get_by_role("navigation", name="Ana gezinme")
    n_items = bottom.locator("a:visible, button:visible").count()
    check(1 <= n_items <= 5, f"telefon: alt gezinmede en fazla 5 öğe ({n_items})")
    check(bottom.get_by_role("link", name="Ekle").is_visible(), "telefon: ortada 'Ekle'")
    bottom.get_by_role("button", name="Daha").click()
    page.locator("dialog[open]").get_by_text("Tüm sonuçlarım").wait_for()
    check(True, "telefon: 'Daha' alt sayfasından tüm sonuçlara erişim")
    page.keyboard.press("Escape")
    page.goto(URL + "#/vucudum")
    page.get_by_role("heading", name="Vücudum", exact=True).wait_for()
    sw = page.evaluate("() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth")
    dw = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(sw <= 1 and dw <= 1, f"telefon: Vücudum yatay taşma yok ({sw}, {dw})")
    page.screenshot(path=SHOTS / "98-telefon-vucudum.png", full_page=True)
    page.goto(URL + "#/organ/brain/benim")
    page.get_by_role("tab", name="Benimki").wait_for()
    dw = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(dw <= 1, f"telefon: organ sayfası yatay taşma yok ({dw})")
    page.screenshot(path=SHOTS / "99-telefon-organ.png", full_page=True)

    csp = page.evaluate("window.__csp")
    check(not csp, f"CSP ihlali yok {csp}")
    errs = [c for c in console if "error" in c.lower()]
    check(not errs, f"konsol hatası yok {errs[:3]}")
    check(not external, f"dışarıya istek yok {external[:3]}")
    browser.close()

print(f"\n{len(problems)} sorun" if problems else "\nTümü geçti")
sys.exit(1 if problems else 0)
