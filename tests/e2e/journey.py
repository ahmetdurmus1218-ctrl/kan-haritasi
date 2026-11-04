"""Uçtan uca: tahlil sonucu → vücuttaki yolculuk → İçine gir ("Sonucuma göre") ve gerçek BT tomografi görünümü.

Senaryo (kullanıcının gözünden): hastaneden kan verdim, bazı değerler referans dışı çıktı. Bu değerler
vücudumda NEREYİ etkiliyor, normalde nasıl çalışıyor, benim sonucumla nasıl çalışıyor, olası nedenler neler?

  1. Çoklu anormallik raporu yüklenir ve onaylanır.
  2. Sonuçlarım: "Sonuçlarına birlikte bakınca" (birden çok sonucun desteklediği olası durumlar, ✓/✗/?).
  3. Hemoglobin (düşük) ayrıntısı: normal yol (kemik iliği → alveol → kılcal → dalak), "Senin sonucun",
     mekanizma, etkilenen yerler, sonuçlara göre sıralı olası nedenler, netleştiren testler.
  4. Etkilenen yerden "İçine gir" → 3B iç dünya; seviye panelinde "Senin sonucunla burada" ve
     "Normal ↔ Sonucuma göre" sahne anahtarı.
  5. Tomografi görünümü: gerçek BT hacmi açılır, önayarlar, kalbi seç → İçine gir → kalbin iç dünyası.
  6. Telefonda yatay taşma yok, dış istek yok, CSP ihlali yok.

Kullanım: pnpm build && pnpm preview --port 4173; python3 tests/e2e/journey.py [ekran-klasörü]
"""
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:4173/"
PASS = "cok-gizli-parola-2026"
REPORT = ROOT / "fixtures/reports/coklu-anormallik.pdf"

problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def no_overflow(page, label):
    w = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    check(w <= 1, f"telefon: yatay taşma yok ({label}, {w}px)")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    ctx.set_default_timeout(90000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith((URL.rstrip("/"), "blob:", "data:")) else None)
    page.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for(timeout=30000)

    # ------------------------------------------------------------ 1. rapor
    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    page.set_input_files("input[type=file][multiple]", [str(REPORT)])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=180000)
    sex = page.locator("select:has(option[value='female'])")
    if sex.count():
        sex.first.select_option("male")
    page.locator("button:has-text('Onayla ve kaydet')").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=20000)

    # ------------------------------------------------------------ 2. birlikte bakış
    page.goto(URL + "#/sonuclar")
    page.get_by_test_id("differential").wait_for()
    d = page.get_by_test_id("differential")
    causes = d.get_by_test_id("cause")
    check(causes.count() >= 2, f"Sonuçlarım: birlikte bakışta en az iki olası durum ({causes.count()})")
    dt = d.inner_text()
    check("✓" in dt and "tanı değildir" in dt, "birlikte bakış: destekleyen sonuçlar ✓ ve 'tanı değildir' notu")
    no_overflow(page, "Sonuçlarım")
    page.screenshot(path=SHOTS / "j1-birlikte-bakis.png", full_page=True)

    # ------------------------------------------------------------ 3. hemoglobin yolculuğu
    page.goto(URL + "#/sonuc/hemoglobin")
    j = page.get_by_test_id("result-journey")
    j.wait_for()
    check(j.get_attribute("data-dir") == "low", f"hemoglobin: yön 'düşük' ({j.get_attribute('data-dir')})")
    steps = j.get_by_test_id("journey-normal-step")
    check(steps.count() >= 3, f"normal yol en az 3 adım ({steps.count()})")
    normal = j.get_by_test_id("journey-normal").inner_text()
    check("Kemik iliği" in normal and "Alveol" in normal, "normal yol: kemik iliği → alveol (oksijen) adımları")
    mine = j.get_by_test_id("journey-mine").inner_text()
    check("Kansızlık" in mine and "Nereyi etkiler?" in mine, "senin sonucun: özet (kansızlık) ve etkilenen yerler")
    check(j.get_by_test_id("journey-site").count() >= 3, "etkilenen en az 3 yer, her biri İçine gir ile")
    ranked = j.get_by_test_id("cause")
    check(ranked.count() >= 5, f"olası nedenler listesi ({ranked.count()})")
    first = ranked.first.inner_text()
    check("sonuçlarınla uyum" in first, "nedenler sonuçlarla uyuma göre sıralı (uyum çubuğu)")
    check("tanı değildir" in j.inner_text() and "olasılık listesi" in j.inner_text(), "olasılık listesi, tanı değildir notu")
    check(j.get_by_test_id("journey-urgent").count() == 1, "ne zaman acil? uyarısı")
    check(j.get_by_test_id("journey-next").count() == 1, "netleştiren testler (ölçülmüş/ölçülmemiş)")
    no_overflow(page, "sonuç yolculuğu")
    page.screenshot(path=SHOTS / "j2-hemoglobin-yolculuk.png", full_page=True)

    # ------------------------------------------------------------ 4. İçine gir: sonucuma göre
    j.get_by_test_id("journey-site").first.get_by_test_id("journey-enter").click()
    page.wait_for_url(re.compile(r"#/ic/"))
    ex = page.get_by_test_id("explorer")
    ex.wait_for()
    page.wait_for_function("() => document.querySelector('[data-testid=explorer]')?.dataset.transition === 'idle'", timeout=90000)
    dock = page.get_by_test_id("level-dock")
    eff = page.get_by_test_id("interior-result-effects")
    eff.wait_for()
    check(page.get_by_test_id("interior-result-effect").count() >= 1, "iç dünyada 'Senin sonucunla burada' kartı")
    et = eff.inner_text()
    check("Hemoglobin" in et and "▼" in et, "kartta hemoglobin ▼ ve buradaki etkisi")
    check(ex.get_attribute("data-result-view") == "normal", "sahne varsayılan: normal (tipik)")
    mine_btn = page.get_by_test_id("result-view-mine")
    check(mine_btn.count() == 1, "'Sonucuma göre' anahtarı var")
    mine_btn.click()
    page.wait_for_timeout(800)
    check(ex.get_attribute("data-result-view") == "mine", "sahne 'sonucuma göre' görünümüne geçti")
    check("Eğitimsel, temsili" in page.get_by_test_id("result-view-note").inner_text(), "sahne notu: eğitimsel, temsili; senin dokun değil")
    page.screenshot(path=SHOTS / "j3-ic-dunya-sonucuma-gore.png")
    check(dock.count() == 1, "seviye paneli görünür")

    # ------------------------------------------------------------ 5. tomografi
    page.goto(URL + "#/tomografi")
    page.wait_for_selector("[data-testid=tomography][data-state=ready]", timeout=180000)
    page.wait_for_timeout(4000)
    t = page.get_by_test_id("tomography")
    check("anonim bir yetişkin taraması" in t.inner_text() and "Senin vücudun değildir" in t.inner_text(), "tomografi: kaynak ve 'senin vücudun değil' notu")
    check(page.get_by_test_id("tomo-preset").count() >= 6, "tomografi: en az 6 önayar")
    page.screenshot(path=SHOTS / "j4-tomografi.png")
    page.locator("[data-testid=tomo-preset][data-preset=bones]").click()
    check(t.get_attribute("data-preset") == "bones", "önayar: kemikler")
    page.locator("[data-testid=tomo-organ]", has_text=re.compile(r"^Kalp$")).click()
    page.get_by_test_id("tomo-selected").wait_for()
    check("Kalp" in page.get_by_test_id("tomo-selected").inner_text() and t.get_attribute("data-selected") == "Kalp", "organ seçimi: kalp yalıtıldı")
    check("#/tomografi/heart" in page.url, "adres çubuğu: #/tomografi/heart")
    check(t.get_attribute("data-preset") == "cinematic", "kemik önayarında kalp seçilince organ görünsün diye sinematiğe geçildi")
    page.wait_for_timeout(3000)
    page.screenshot(path=SHOTS / "j5-tomografi-kalp.png")
    page.get_by_test_id("tomo-enter").click()
    page.wait_for_url(re.compile(r"#/ic/heart"))
    check(True, "tomografiden kalbin iç dünyasına geçildi")

    csp = page.evaluate("window.__csp || []")
    check(not csp, f"CSP ihlali yok ({csp[:3]})")
    check(not external, f"dış istek yok ({external[:3]})")
    errs = [c for c in console if "WebGL" not in c and "THREE." not in c]
    check(not errs, f"konsol hatası yok ({errs[:3]})")
    browser.close()

print(f"\n{len(problems)} sorun" if problems else "\nTÜMÜ GEÇTİ")
sys.exit(1 if problems else 0)
