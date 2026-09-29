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
    # WebGL: başsız tarayıcıda yazılımsal (SwiftShader) çizim
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
    try:
        page.get_by_text("5 tanesi aralık dışı").first.wait_for(timeout=15000)
    except Exception:
        print("özet:", [t[:120] for t in page.locator("text=/sonuç ·/").all_inner_texts()])
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
    check(page.get_by_text("Genel durum").count() == 1, "kişisel genel değerlendirme")
    check(page.get_by_text("Karaciğer hücre enzimlerinde artış").count() == 1, "karaciğer paterni (ALT yüksek)")
    check(page.get_by_text("Birden fazla lipid değeri istenmeyen yönde").count() == 1, "lipid paterni")
    page.locator("li button:has-text('LDL kolesterol')").first.click()
    page.get_by_text("Bu test neyi ölçer?").wait_for()
    page.screenshot(path=SHOTS / "25-ldl-detay.png", full_page=True)
    check(page.get_by_text("Doktoruna sorabileceklerin").count() == 1, "öğren paneli")
    check(page.get_by_text("Senin sonucun ne anlama geliyor?").count() == 1, "kişisel yorum")
    check(page.get_by_text("Orta derecede yüksek").count() >= 1, "sapma derecesi (LDL 178 / 130)")

    # --- Vücutta göster → keşif yolu → eğitimsel simülasyon
    page.get_by_role("button", name="Vücutta göster").click()
    page.get_by_text("Keşif yolu").wait_for(timeout=20000)
    page.wait_for_timeout(6000)
    page.screenshot(path=SHOTS / "26-vucutta-goster.png")
    check("#/vucut/ldl" in page.url, "LDL için vücut rotası")
    check(page.locator("aside[aria-label='Bilgi paneli']").get_by_text("Koroner arterler").count() >= 1, "LDL → koroner arterler bağlantısı")
    page.locator("button:has-text('Eğitimsel simülasyonu başlat')").click()
    page.get_by_text("Eğitimsel biyolojik simülasyon").locator("visible=true").first.wait_for(timeout=20000)  # telefon ve masaüstü kopyası var: görüneni bekle
    page.wait_for_timeout(5000)
    page.screenshot(path=SHOTS / "27-simulasyon.png")
    panel = page.locator("aside[aria-label='Simülasyon paneli']").inner_text()
    import re
    m = re.search(r"(\d)/8", panel)
    stage_no = int(m.group(1)) if m else 0
    # Simülasyon 2. aşamadan (LDL taşınması) başlar ve kendiliğinden ilerler; yavaş/hızlı makinede 2 veya sonrası olabilir.
    check(stage_no >= 2, f"simülasyon başladı ve ilerliyor (aşama {stage_no}/8)")
    page.locator("button[aria-label^='Aşama 8:']").click()
    page.wait_for_timeout(1500)
    check("Plak gelişimi" in page.locator("aside[aria-label='Simülasyon paneli']").inner_text(), "aşama seçimi")
    sim = page.locator("aside[aria-label='Simülasyon paneli']").inner_text()
    check("Sonucuma göre" in sim and "LDL kolesterol" in sim and "tipik düzeyin" in sim, "simülasyonda kişisel durum (LDL değeri sahneye yansır)")
    page.get_by_role("button", name="LDL parçacığı").click()
    check(page.get_by_text("Düşük yoğunluklu lipoprotein").count() >= 1, "nesne bilgisi (LDL)")
    # Geri: organa dön
    page.keyboard.press("Escape")
    page.wait_for_timeout(4000)
    check("#/vucut/yapi/coronary-arteries" in page.url, "Esc ile organa dönüş")
    # İçeri gir: önce kişisel durum; genel süreç yalnızca istenince başlar
    page.locator("button:has-text('İçeri gir · Damar içi')").first.click()
    page.locator("aside[aria-label='Simülasyon paneli']").wait_for(timeout=60000)
    page.wait_for_timeout(1500)
    sim = page.locator("aside[aria-label='Simülasyon paneli']").inner_text()
    check("Süreci adım adım izle" in sim and "Aşama 1/8" not in sim, "içeri girişte süreç kendiliğinden başlamaz")
    page.get_by_role("button", name="Temelde nasıl çalışır").click()
    page.wait_for_timeout(500)
    check("tipik (referans aralığının ortası)" in page.locator("aside[aria-label='Simülasyon paneli']").inner_text(), "tipik değerlerle karşılaştırma")
    page.keyboard.press("Escape")
    page.wait_for_timeout(3000)

    csp = page.evaluate("window.__csp")
    check(csp == [], f"CSP ihlali yok {csp}")
    errors = [c for c in console if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors[:3]}")
    check(external == [], f"harici istek yok {external[:3]}")
    browser.close()

print({"problems": problems})
sys.exit(1 if problems else 0)
