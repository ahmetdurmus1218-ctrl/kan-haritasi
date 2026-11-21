"""Uçtan uca: Ana Ekran (görsel kimlik referansı) — masaüstü ve telefon.

- Boş kasada: 3B vücut merkezde, yükleme alanı açık; yüzde/sağlık göstergesi ÜRETİLMEZ.
- Sentetik tahlil yüklenince: Etkilenen Organlar analiz motorunun organlarıyla dolar, referans göstergesi
  gerçek sayımı (aralıktaki/toplam) gösterir.
- Organ yolculuğu: organ kartı → 3B'de organ seçilir, kamera yaklaşır, etiket çıkar → "İncele" keşif ekranında
  organı açar (#/vucut/yapi/<organ>) → "İçine gir" organın iç dünyasına dalar (#/ic/<organ>).
- Görünüm modları, telefonda ayrı düzen (alt çubuk, yatay organ kartları), yatay taşma yok.
- Ağ isteği, CSP ihlali, konsol hatası yok.

Kullanım: pnpm build && pnpm preview; python3 tests/e2e/home.py [ekran-görüntüsü-klasörü]
"""
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
PDF = ROOT / "fixtures/reports/sentetik-kan-tahlili.pdf"
URL = "http://localhost:4173/"
PASS = "cok-gizli-parola-2026"

problems: list[str] = []
external: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def camera(page):
    return page.locator("[data-testid=home-body]").evaluate("el => el.querySelector('canvas') ? 1 : 0")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)
    ctx = browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
    ctx.set_default_timeout(90000)
    page = ctx.new_page()
    console = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    """)

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for(timeout=30000)

    # --- Boş kasa
    home = page.locator("[data-testid=home]")
    check(home.get_attribute("data-layout") == "desktop", "masaüstü düzeni (üç sütun)")
    page.locator("[data-testid=home-body][data-loaded=true]").wait_for(timeout=120000)
    check(camera(page) == 1, "merkezde 3B tuval (gerçek model)")
    check(page.get_by_test_id("range-gauge").count() == 0, "boş kasa: yüzde/gösterge yok (uydurma veri yok)")
    check(page.get_by_text("Etkilenen Organlar (0)").count() == 1, "boş kasa: etkilenen organ yok")
    nav = [x.strip() for x in page.locator("header nav[aria-label='Ana gezinme'] a").all_inner_texts() if x.strip()]
    check(nav == ["Ana Ekran", "Laboratuvar", "Analizler", "Raporlar", "Serüven", "Ayarlar"], f"üst gezinme ({nav})")
    page.screenshot(path=SHOTS / "home-01-bos-masaustu.png")

    # --- Sentetik tahlil
    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    page.set_input_files("input[type=file][multiple]", [str(PDF)])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=60000)
    page.get_by_role("button", name=re.compile(r"Onayla ve kaydet")).click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=20000)

    page.locator("header nav[aria-label='Ana gezinme'] a", has_text="Ana Ekran").click()
    page.locator("[data-testid=home-body][data-loaded=true]").wait_for(timeout=120000)
    gauge = page.get_by_test_id("range-gauge")
    gauge.wait_for()
    inr, tot = int(gauge.get_attribute("data-in-range")), int(gauge.get_attribute("data-total"))
    check(tot == 14 and 0 < inr < tot, f"referans durumu gerçek sayım ({inr}/{tot})")
    check(page.get_by_text("Sağlık puanı değildir").count() >= 1, "gösterge sağlık puanı olmadığını söyler")
    check(page.get_by_test_id("home-files").get_by_text("Analiz tamamlandı · 14 sonuç").count() == 1, "Tahlil Analizi: gerçek okuma durumu")
    cards = page.locator("[data-testid=affected-organs] button")
    organs = [c.get_attribute("data-organ") for c in cards.all()]
    check("liver" in organs, f"etkilenen organlar: karaciğer listede ({organs})")
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "home-02-masaustu.png")

    # --- Organ yolculuğu
    body = page.locator("[data-testid=home-body]")
    page.locator("[data-testid=affected-organs] button[data-organ=liver]").click()
    page.wait_for_function("() => document.querySelector('[data-testid=home-body]').dataset.selected === 'liver'")
    page.get_by_test_id("home-callout").wait_for()
    check("Karaciğer" in page.get_by_test_id("home-callout").inner_text(), "3B etiket: Karaciğer")
    check(page.get_by_test_id("organ-actions").get_by_text("Dikkat gerekli").count() >= 1, "seçili organ durumu (tanı değil)")
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "home-03-karaciger.png")
    page.locator("[data-action=inspect]").click()
    page.wait_for_url(re.compile(r"#/vucut/yapi/liver$"))
    page.locator("aside[aria-label='Bilgi paneli']").wait_for(timeout=60000)
    check(True, "İncele → keşif ekranında karaciğer paneli")
    page.go_back()
    page.locator("[data-testid=home-body][data-loaded=true]").wait_for(timeout=120000)
    page.locator("[data-testid=affected-organs] button[data-organ=liver]").click()
    page.locator("[data-action=enter]").click()
    page.wait_for_url(re.compile(r"#/ic/liver"))
    check(True, "İçine gir → karaciğerin iç dünyası")
    page.go_back()
    page.locator("[data-testid=home-body][data-loaded=true]").wait_for(timeout=120000)

    # Görünüm modları: seçim kalkar, mod değişir
    for m in ["skeleton", "vessels", "lymph", "full"]:
        page.locator(f".kh-modes [data-mode={m}]").click()
        check(body.get_attribute("data-mode") == m and body.get_attribute("data-selected") == "", f"görünüm modu: {m}")

    # --- Telefon
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_function("() => document.querySelector('[data-testid=home]')?.dataset.layout === 'mobile'")
    page.locator("[data-testid=home-body][data-loaded=true]").wait_for(timeout=120000)
    bottom = [x.strip() for x in page.locator("nav.safe-bottom").locator("a, button").all_text_contents() if x.strip()]
    check(bottom == ["Ana Ekran", "Sistemler", "Dosya Yükle", "Sonuçlar", "Ayarlar"], f"telefon alt çubuk ({bottom})")
    dw = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(dw <= 1, f"telefon: yatay taşma yok ({dw})")
    page.wait_for_timeout(1200)
    page.screenshot(path=SHOTS / "home-04-telefon.png")
    page.locator("[data-testid=affected-organs] button[data-organ=liver]").click()
    page.wait_for_function("() => document.querySelector('[data-testid=home-body]').dataset.selected === 'liver'")
    page.wait_for_timeout(1500)
    top = page.locator("[data-testid=home-body]").evaluate("el => el.getBoundingClientRect().top")
    check(top < 300, f"telefon: organ kartı → sahne görünür alana kayar ({top:.0f})")
    page.screenshot(path=SHOTS / "home-05-telefon-karaciger.png")
    page.locator("nav.safe-bottom").get_by_role("button", name="Sistemler").click()
    check(page.locator("dialog[open] [data-testid=systems-sheet] button").count() >= 9, "telefon: Sistemler alt sayfası")
    page.keyboard.press("Escape")

    csp = page.evaluate("window.__csp")
    check(not csp, f"CSP ihlali yok {csp}")
    errs = [c for c in console if c.startswith(("error", "pageerror"))]
    check(not errs, f"konsol hatası yok {errs[:3]}")
    check(not external, f"dışarıya istek yok {external[:3]}")
    browser.close()

print(f"\n{len(problems)} sorun")
sys.exit(1 if problems else 0)
