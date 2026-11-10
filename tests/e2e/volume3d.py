"""Uçtan uca: gerçek BT serisinden 3B hacim görüntüleme (volume rendering) — telefon ve masaüstü.

Denetlenen: seri cihazda hacme dönüştürülüyor, WebGL2 ışın izleme tuvali gerçekten çiziyor (boş değil), kipler
(MIP / yarı saydam hacim), BT pencereleri (HU), "kesit al", açık kesitin hacimdeki çerçevesi (2B ↔ 3B), fiziksel
boyut (mm) ve "senin görüntünden · tanı değildir" notu; kesitlere dönüş; telefonda yatay taşma yok; ağ/CSP/konsol.

Kullanım: pnpm build && pnpm preview --port 4173, sonra: python3 tests/e2e/volume3d.py [ekran-görüntüsü-klasörü]
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
IMG = ROOT / "fixtures/imaging"
URL = "http://localhost:4173/"
PASS = "cok-gizli-parola-2026"

problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def lit_fraction(page):
    """3B tuvalin ekran görüntüsünde siyah olmayan piksellerin oranı (GPU çizimi gerçekten var mı?)."""
    from io import BytesIO

    from PIL import Image

    png = page.locator("[data-testid=volume-view] canvas").screenshot()
    im = Image.open(BytesIO(png)).convert("L").resize((96, 96))
    px = list(im.getdata())
    return sum(1 for v in px if v > 24) / len(px)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    ctx.set_default_timeout(120000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)
    page.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for(timeout=30000)

    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    page.set_input_files("input[aria-label='DICOM klasörü']", str(IMG / "totalseg-ct-sm"))
    page.get_by_text("30 dosya şifrelendi ve kaydedildi").wait_for(timeout=120000)
    page.get_by_role("button", name="Aç", exact=True).click()
    opener = page.get_by_test_id("vr-open")
    opener.wait_for(timeout=60000)
    check(page.get_by_test_id("volume-view").count() == 0, "3B hacim kendiliğinden açılmaz (yalnızca istenince hesaplanır)")
    opener.click()
    view = page.get_by_test_id("volume-view")
    view.wait_for(timeout=120000)
    check(view.get_attribute("data-webgl") == "1", "WebGL2 ile ışın izleme (GPU)")
    dims = [int(x) for x in view.get_attribute("data-dims").split("x")]
    check(max(dims) <= 160 and dims[2] == 30, f"hacim GPU dokusuna sığacak boyutta, 30 kesit korunuyor ({dims})")
    size = [int(x) for x in view.get_attribute("data-size-mm").split("x")]
    check(all(s > 50 for s in size), f"fiziksel boyut (mm) voksel aralığından hesaplanıyor ({size})")
    note = page.get_by_test_id("vr-note").inner_text()
    check("Senin görüntünden" in note and "30 kesit" in note and "tanı içermez" in note and "HU" in note, "not: 'Senin görüntünden · 30 kesit … bölütleme, bulgu ya da tanı içermez' ve HU penceresi")
    page.locator("[data-testid=volume-view] canvas").wait_for()
    page.wait_for_timeout(2500)
    bone = lit_fraction(page)
    check(bone > 0.01, f"BT kemik penceresi: 3B tuval gerçekten çizildi (dolu piksel oranı {bone:.3f})")
    page.screenshot(path=SHOTS / "vr-01-kemik-mip.png")

    # Pencere: yumuşak doku → daha çok doku görünür
    page.get_by_test_id("vr-preset").select_option("yumusak")
    page.wait_for_timeout(2000)
    soft = lit_fraction(page)
    check(view.get_attribute("data-preset") == "yumusak" and soft > bone * 1.3, f"yumuşak doku penceresi kemikten daha çok voksel gösterir ({bone:.3f} → {soft:.3f})")
    # Kip: yarı saydam hacim
    page.get_by_test_id("vr-mode").select_option("dvr")
    page.wait_for_timeout(2000)
    check(view.get_attribute("data-mode") == "dvr" and lit_fraction(page) > 0.01 and page.get_by_test_id("vr-opacity").count() == 1, "yarı saydam hacim kipi çiziliyor, yoğunluk kaydırıcısı var")
    page.screenshot(path=SHOTS / "vr-02-yumusak-hacim.png")
    # Kesit al: hacmin yarısı kırpılınca dolu alan azalır
    page.get_by_test_id("vr-mode").select_option("mip")
    page.wait_for_timeout(1500)
    full = lit_fraction(page)
    page.get_by_test_id("vr-clip").fill("0.3")
    page.wait_for_timeout(2000)
    cut = lit_fraction(page)
    check(view.get_attribute("data-clip") == "0.30" and cut < full * 0.8, f"kesit al: kırpılan hacim daha az yer kaplar ({full:.3f} → {cut:.3f})")
    page.screenshot(path=SHOTS / "vr-03-kesit.png")
    page.get_by_test_id("vr-clip").fill("1")
    # Döndürme: sürükleyince görüntü değişir
    before = page.locator("[data-testid=volume-view] canvas").screenshot()
    box = page.locator("[data-testid=volume-view] canvas").bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 + 160, box["y"] + box["height"] / 2 + 40, steps=8)
    page.mouse.up()
    page.wait_for_timeout(1500)
    check(page.locator("[data-testid=volume-view] canvas").screenshot() != before, "sürükleyince hacim dönüyor")
    # Kesitlere dönüş
    page.get_by_test_id("vr-close").click()
    check(page.get_by_test_id("volume-view").count() == 0 and page.get_by_test_id("vr-open").get_attribute("aria-pressed") == "false", "'Kesitlere dön': 2B görüntüleyici geri geliyor")

    # ---------------------------------------------------------------- Telefon
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(500)
    # Telefonda görüntüleyici "belge" sekmesindedir (rapor/analiz paneli diğer sekmede).
    page.get_by_role("tab", name="Belge").click()
    page.get_by_test_id("vr-open").click()
    view.wait_for()
    page.wait_for_timeout(2500)
    dw = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(dw <= 1, f"telefon: 3B hacim ekranında yatay taşma yok ({dw})")
    cb = page.locator("[data-testid=volume-view] canvas").bounding_box()
    check(cb["width"] >= 300 and cb["height"] >= 300 and lit_fraction(page) > 0.01, f"telefon: 3B tuval görünür ve çiziyor ({cb['width']:.0f} × {cb['height']:.0f})")
    small = page.evaluate("() => [...document.querySelectorAll('[data-testid=volume-view] select, [data-testid=volume-view] button')].filter(b => b.getBoundingClientRect().height < 39.5).length")
    check(small == 0, "telefon: 3B hacim denetimleri ≥ 40 px")
    page.screenshot(path=SHOTS / "vr-04-telefon.png")

    csp = page.evaluate("window.__csp")
    check(csp == [], f"CSP ihlali yok {csp}")
    errors = [c for c in console if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors[:3]}")
    check(external == [], f"harici istek yok {external[:3]}")
    browser.close()

print({"problems": problems})
sys.exit(1 if problems else 0)
