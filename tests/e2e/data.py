"""Uçtan uca: zaman çizelgesi, şifreli yedek → başka kasaya geri yükleme, "Verilerimi indir" ZIP.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/data.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import sys
import zipfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
PDF = ROOT / "fixtures/reports/sentetik-kan-tahlili.pdf"
PNG = ROOT / "fixtures/reports/sentetik-kan-tahlili.png"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
BACKUP_PASS = "yedek-parolasi-2026"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def watch(page, sink):
    page.on("console", lambda m: sink["console"].append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: sink["console"].append(f"pageerror: {e}"))
    page.on("request", lambda r: sink["external"].append(r.url) if not r.url.startswith((URL.rstrip("/"), "blob:", "data:")) else None)
    page.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")


def create_vault(page, password):
    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", password)
    page.fill("#confirm", password)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for(timeout=30000)


def upload_and_confirm(page, path, count, date=None):
    page.goto(URL + "#/belgeler")
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for()
    page.set_input_files("input[type=file][multiple]", [str(path)])
    page.get_by_role("button", name="Aç ve oku").wait_for(timeout=20000)
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=120000)
    if date:
        page.fill("input[type=date]", date)
    page.get_by_role("button", name=f"Onayla ve kaydet ({count})").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=10000)


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROME_PATH") or None,
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    )
    sink = {"console": [], "external": []}
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    watch(page, sink)
    create_vault(page, PASS)
    upload_and_confirm(page, PDF, 14)
    upload_and_confirm(page, PNG, 9, date="2026-03-10")

    # --- Zaman çizelgesi
    page.goto(URL + "#/zaman/ldl")
    page.get_by_text("Sonuçların zaman içinde").wait_for()
    chart = page.locator("svg[aria-label='Zaman içinde değerler, 2 ölçüm']")
    check(chart.count() == 1, "LDL için iki ölçümlü grafik")
    page.locator("svg circle[role=button]").first.focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    check(page.get_by_text("10 Mar 2026").count() + page.get_by_text("10.03.2026").count() >= 1 or "2026" in page.inner_text("main"), "seçili ölçüm tarihi")
    check(page.get_by_role("button", name="Raporu aç").count() == 1, "seçili ölçümden rapora gidiş")
    check(page.get_by_text("Rapor geçmişi").count() == 1, "rapor geçmişi")
    page.screenshot(path=SHOTS / "30-zaman.png", full_page=True)

    # --- Şifreli yedek
    page.goto(URL + "#/gizlilik")
    page.get_by_role("button", name="Şifreli yedek al").click()
    page.fill("#pf-a", BACKUP_PASS)
    page.fill("#pf-b", BACKUP_PASS)
    with page.expect_download(timeout=60000) as dl:
        page.get_by_role("button", name="Yedeği oluştur").click()
    backup_path = SHOTS / "test.khyedek"
    dl.value.save_as(backup_path)
    page.get_by_text("Şifreli yedek kaydedildi: 2 belge").wait_for(timeout=20000)
    data = backup_path.read_bytes()
    check(data[:8] == b"KHYEDEK1", "yedek dosyası imzası")
    check(b"LDL" not in data and b"Kolesterol" not in data and b"%PDF" not in data, "yedekte açık metin yok (şifreli)")

    # --- Verilerimi indir (ZIP)
    page.get_by_role("button", name="Verilerimi indir").click()
    with page.expect_download(timeout=60000) as dl2:
        page.get_by_role("button", name="Anladım, indir").click()
    zip_path = SHOTS / "verilerim.zip"
    dl2.value.save_as(zip_path)
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        check(z.testzip() is None, "ZIP bütünlüğü (CRC)")
        check(any(n.startswith("belgeler/") and n.endswith(".pdf") for n in names), "ZIP'te orijinal PDF")
        check(any(n.startswith("belgeler/") and n.endswith(".png") for n in names), "ZIP'te orijinal PNG")
        check(z.read([n for n in names if n.endswith(".pdf")][0]) == PDF.read_bytes(), "orijinal PDF bayt bayt aynı")
        js = json.loads(z.read("sonuclar.json"))
        check(len(js["raporlar"]) == 2, "sonuclar.json iki rapor")
        csv = z.read("sonuclar.csv").decode("utf-8-sig")
        check("LDL kolesterol" in csv and ";" in csv, "sonuclar.csv içerik")
    page.screenshot(path=SHOTS / "31-gizlilik.png", full_page=True)

    # --- Başka "cihaza" (yeni kasa) geri yükleme
    ctx2 = browser.new_context(viewport={"width": 1366, "height": 900})
    page2 = ctx2.new_page()
    watch(page2, sink)
    create_vault(page2, "baska-cihaz-parolasi-1")
    page2.goto(URL + "#/gizlilik")
    page2.get_by_text("Yedek ve dışa aktarma").wait_for()
    page2.set_input_files("input[type=file][accept*='.khyedek']", str(backup_path))
    page2.locator("#restore-pass").wait_for()
    page2.fill("#restore-pass", "yanlis-parola-0000")
    page2.get_by_role("button", name="Geri yükle", exact=True).click()
    page2.get_by_text("Parola yanlış.").wait_for(timeout=30000)
    check(True, "yanlış yedek parolası reddedildi")
    page2.fill("#restore-pass", BACKUP_PASS)
    page2.get_by_role("button", name="Geri yükle", exact=True).click()
    page2.get_by_text("Geri yüklendi: 2 yeni belge").wait_for(timeout=30000)
    page2.goto(URL + "#/sonuclar")
    page2.get_by_text("Tahlil sonuçların").wait_for()
    check(page2.get_by_text("LDL kolesterol").count() >= 1, "geri yüklenen kasada sonuçlar")
    page2.goto(URL + "#/belgeler")
    page2.wait_for_timeout(800)
    check(page2.get_by_text("sentetik-kan-tahlili", exact=False).count() >= 2, "geri yüklenen kasada iki belge")
    page2.screenshot(path=SHOTS / "32-geri-yuklendi.png", full_page=True)

    csp = page.evaluate("window.__csp") + page2.evaluate("window.__csp")
    check(csp == [], f"CSP ihlali yok {csp}")
    errors = [c for c in sink["console"] if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors[:3]}")
    check(sink["external"] == [], f"harici istek yok {sink['external'][:3]}")
    browser.close()

print({"problems": problems})
sys.exit(1 if problems else 0)
