"""Uçtan uca: farklı laboratuvar düzenlerindeki sentetik raporlar (PDF, PNG, JPG, e-Nabız ekran
görüntüsü) uygulamanın kendisiyle okunur, onaylanır ve yorumlanır.

Kapsam: hemogram, biyokimya, hormon (kadın/erkek), vitamin-mineral, lipid ve çoklu anormallik
raporları; OCR ile okunan görüntüler; evreye göre verilen hormon aralıkları; çoklu bulgunun ayrı
ayrı listelenmesi, doğrulama listesi, tek organa özgü olmayan testler ve 3B'ye geçiş.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/reports.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
REPORTS = ROOT / "fixtures/reports"
EXPECTED = json.loads((REPORTS / "expected.json").read_text(encoding="utf-8"))
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []

# Yükleme sırası ve her dosyada en az kaç sonucun okunması gerektiği.
# PDF'lerde tümü; görüntülerde bilinen OCR sınırları (bkz. apps/web/src/__tests__/ocr-fixtures.test.ts).
UPLOADS = [
    ("hemogram.pdf", 20),
    ("biyokimya.pdf", 19),
    ("hormon-kadin.pdf", 14),
    ("vitamin-mineral.pdf", 11),
    ("lipid.pdf", 6),
    ("hormon-erkek.png", 8),
    ("enabiz-ekran.png", 6),
    ("hemogram-foto.jpg", 18),
    ("coklu-anormallik.pdf", 27),
]


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROME_PATH") or None,
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    )
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, device_scale_factor=1)
    ctx.set_default_timeout(120000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for(timeout=20000)

    for i, (name, minimum) in enumerate(UPLOADS):
        exp = EXPECTED[name]
        if i:
            page.get_by_role("button", name="Belgelere dön").click()
        page.set_input_files("input[type=file][multiple]", [str(REPORTS / name)])
        page.get_by_role("button", name="Aç ve oku").wait_for(timeout=20000)
        page.get_by_role("button", name="Aç ve oku").click()
        page.get_by_text("Sonuçları onayla").wait_for(timeout=180000)
        page.wait_for_timeout(600)
        head = page.locator("text=/sonuç okundu/").first.inner_text()
        m = re.search(r"(\d+) sonuç okundu", head)
        n = int(m.group(1)) if m else 0
        check(n >= minimum, f"{name}: {n} sonuç okundu (en az {minimum}) — {head[:110]}")
        sex_select = page.locator("select:has(option[value='female'])")
        if sex_select.count():
            sex_select.first.select_option(exp["sex"])
            page.wait_for_timeout(300)
        if exp["date"]:
            got = page.locator("input[type=date]").first.input_value()
            check(got == exp["date"], f"{name}: rapor tarihi {got} (beklenen {exp['date']})")
        page.screenshot(path=SHOTS / f"40-onay-{Path(name).stem}.png")
        page.locator("button:has-text('Onayla ve kaydet')").click()
        page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=15000)

    # --- Sonuçlarım: en güncel değerler (çoklu anormallik raporu en yeni tarihli)
    page.get_by_role("link", name="Sonuçlar").first.click()
    page.get_by_text("Tahlil sonuçların").wait_for()
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "41-sonuclar.png", full_page=True)
    body = page.locator("main").inner_text()

    def tile(label: str) -> int:
        t = page.locator(f"div:has(> div:text-is('{label}')) > div").first.inner_text()
        return int(t) if t.isdigit() else -1

    out, verify, systems = tile("Aralık dışı"), tile("Doğrulaman gereken"), tile("İlgili sistem")
    check(out >= 25, f"özet: {out} test aralık dışı")
    check(verify >= 4, f"özet: {verify} değer doğrulama istiyor (evreye göre aralıklar, OCR)")
    check(systems >= 7, f"özet: {systems} ilgili sistem")
    for title in [
        "Karaciğer hücre enzimlerinde artış",
        "Safra akışıyla ilişkili enzimlerde artış",
        "Kas enzimi (CK) yüksek",
        "Böbrek süzme işlevinde azalma olabilir",
        "Pankreas enzimleri yüksek",
        "İnflamasyon (iltihap) belirteçleri yüksek",
        "Testosteron düşük",
        "Kansızlık (anemi) bulgusu",
        "Homosistein yüksek",
    ]:
        check(title in body, f"örüntü: {title}")
    for test in ["Östradiol", "Progesteron", "Serbest T4", "Ürik asit", "25-OH D vitamini", "HDL dışı kolesterol", "Homosistein"]:
        check(test in body, f"listede: {test}")
    verify_box = page.locator("section[aria-labelledby='dogrula']")
    vtxt = verify_box.inner_text() if verify_box.count() else ""
    # Progesteron yalnızca kadın hormon raporunda var; aralığı döngü evresine göre verilmiş
    check("Progesteron" in vtxt and "döngü evresine" in vtxt, "evreye göre verilen progesteron aralığı doğrulama listesinde")

    # Tek bir organa özgü olmayan test: CRP
    page.locator("li button:has-text('CRP')").first.click()
    page.get_by_text("Bu test neyi ölçer?").wait_for()
    page.wait_for_timeout(400)
    check(page.get_by_text("Tek bir organa özgü değil").count() >= 1, "CRP: tek organa özgü olmadığı belirtiliyor")
    page.screenshot(path=SHOTS / "42-crp.png", full_page=True)
    page.keyboard.press("Escape")
    page.go_back()
    page.get_by_text("Tahlil sonuçların").wait_for()

    # --- 3B: CK bulgusu → kaslar; bulgular arasında gezinme
    page.get_by_role("button", name="CK (kreatin kinaz): vücutta göster").click()
    page.wait_for_timeout(1500)
    for _ in range(60):
        if page.locator("text=Anatomi modelleri yükleniyor").count() == 0:
            break
        page.wait_for_timeout(1000)
    page.wait_for_timeout(4000)
    page.screenshot(path=SHOTS / "43-ck-3b.png")
    info = page.locator("aside[aria-label='Bilgi paneli']").inner_text()
    check("#/vucut/ck" in page.url, "CK için vücut rotası")
    check("Kas" in info, "CK → iskelet kasları bağlantısı")
    nxt = page.locator("button:has-text('Sonraki bulgu')")
    if nxt.count():
        before = page.url
        nxt.first.click()
        page.wait_for_timeout(2500)
        check(page.url != before, f"sonraki bulguya geçiş ({page.url.split('#')[-1]})")
    else:
        check(False, "bulgular arası gezinme düğmesi")

    errors = [c for c in console if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors[:3]}")
    check(external == [], f"harici istek yok {external[:3]}")
    browser.close()

print({"problems": problems})
sys.exit(1 if problems else 0)
