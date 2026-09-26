"""Uçtan uca: rapor yükle → cihazda oku (PDF metni ve fotoğraf OCR) → onayla → Sonuçlarım.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/flow.py [ekran-görüntüsü-klasörü]
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
PDF = ROOT / "fixtures/reports/sentetik-kan-tahlili.pdf"
PNG = ROOT / "fixtures/reports/sentetik-kan-tahlili.png"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, device_scale_factor=1)
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
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for(timeout=20000)

    # --- PDF: metin katmanı
    page.set_input_files("input[type=file][multiple]", [str(PDF)])
    page.get_by_role("button", name="Aç ve oku").wait_for(timeout=20000)
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=30000)
    page.wait_for_timeout(800)
    page.screenshot(path=SHOTS / "20-onay-pdf.png")
    check(page.get_by_text("14 sonuç okundu").count() == 1, "PDF'ten 14 sonuç okundu")
    # Belgede göster
    page.locator("button:has-text('Belgede göster')").nth(8).click()
    page.wait_for_timeout(900)
    page.screenshot(path=SHOTS / "21-kaynak-vurgu.png")
    page.get_by_role("button", name="Onayla ve kaydet (14)").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=10000)
    check(page.get_by_text("5 tanesi aralık dışı").count() == 1, "kaydedilen raporda 5 aralık dışı sonuç (ALT, T.kolesterol, LDL, TG yüksek; ferritin düşük)")
    page.screenshot(path=SHOTS / "22-kaydedildi.png")

    # --- Fotoğraf: OCR
    page.get_by_role("button", name="Belgelere dön").click()
    page.set_input_files("input[type=file][multiple]", [str(PNG)])
    page.get_by_role("button", name="Aç ve oku").wait_for(timeout=20000)
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=120000)
    page.wait_for_timeout(500)
    page.screenshot(path=SHOTS / "23-onay-ocr.png")
    txt = page.locator("aside[aria-label='Çıkarılan sonuçlar']").inner_text()
    check("9 sonuç okundu" in txt, f"fotoğraftan OCR ile 9 sonuç okundu")
    page.get_by_role("button", name="Onayla ve kaydet (9)").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=10000)

    # --- Sonuçlarım
    page.get_by_role("link", name="Sonuçlar").first.click()
    page.get_by_text("Tahlil sonuçların").wait_for()
    page.wait_for_timeout(500)
    page.screenshot(path=SHOTS / "24-sonuclarim.png", full_page=True)
    check(page.get_by_text("LDL kolesterol").count() >= 1, "Sonuçlarım listesinde LDL")
    page.get_by_text("LDL kolesterol").first.click()
    page.get_by_text("Bu test neyi ölçer?").wait_for()
    page.screenshot(path=SHOTS / "25-ldl-detay.png", full_page=True)
    check(page.get_by_text("Doktoruna sorabileceklerin").count() == 1, "öğren paneli")

    csp = page.evaluate("window.__csp")
    check(csp == [], f"CSP ihlali yok {csp}")
    errors = [c for c in console if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors[:3]}")
    check(external == [], f"harici istek yok {external[:3]}")
    browser.close()

print({"problems": problems})
sys.exit(1 if problems else 0)
