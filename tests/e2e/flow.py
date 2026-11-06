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
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for(timeout=20000)
    # Yeni bilgi mimarisi: kasa açılınca ana sayfa; belgeler "Verilerim"de
    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()

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
    page.goto(URL + "#/sonuclar")
    page.get_by_role("heading", name="Sonuçlar", exact=True).wait_for()
    page.get_by_test_id("results-more").locator("summary").click()
    page.wait_for_timeout(500)
    page.screenshot(path=SHOTS / "24-sonuclarim.png", full_page=True)
    check(page.get_by_text("LDL kolesterol").count() >= 1, "Sonuçlarım listesinde LDL")
    check(page.get_by_text("Genel durum").count() == 1, "kişisel genel değerlendirme")
    check(page.get_by_text("Karaciğer hücre enzimlerinde artış").count() == 1, "karaciğer paterni (ALT yüksek)")
    check(page.get_by_text("Birden fazla lipid değeri istenmeyen yönde").count() == 1, "lipid paterni")
    # Kabul 90/91: anormal sonuçta test adı ve değer aynı tonu taşır; normal sonuç nötr
    def row_classes(name):
        row = page.locator("li", has=page.locator("[data-part=name]", has_text=name)).first
        return row.locator("[data-part=name]").get_attribute("class") or "", row.locator("[data-part=value]").get_attribute("class") or ""
    n, v = row_classes("LDL kolesterol")
    check(("text-high" in n or "text-caution-fg" in n) and ("text-high" in v or "text-caution-fg" in v), f"90: LDL yüksek → ad ve değer yüksek tonunda ({n} | {v})")
    n, v = row_classes("Ferritin")
    check("text-low" in n and "text-low" in v, f"90: ferritin düşük → ad ve değer düşük (mavi) tonunda ({n})")
    n, v = row_classes("Glukoz")
    check(not any(t in n for t in ("text-high", "text-low", "text-caution-fg", "text-danger")), f"91: normal glukoz nötr ({n})")
    page.goto(URL + "#/organ/pancreas")
    page.get_by_text("Normalde ne işe yarar?").first.wait_for()
    tg = page.locator("[data-testid=lab-triglyceride]").first
    parts = [tg.locator(f"[data-part={x}]").get_attribute("class") or "" for x in ("name", "value", "status")]
    tone = tg.get_attribute("data-tone")
    check(tone in ("follow", "attention") and all(("text-caution-fg" in c or "text-high" in c) for c in parts), f"90: pankreas sayfasında trigliserid adı/değeri/durumu aynı tonda ({tone})")
    check("▲ Yüksek" in tg.inner_text(), "90: ▲ Yüksek etiketi")
    gl = page.locator("[data-testid^=lab-glucose]").first
    check(gl.count() == 0 or gl.get_attribute("data-tone") == "normal", "91: normal glukoz pankreas sayfasında nötr")
    check("referans dışında" in page.locator("[data-testid=organ-status]").inner_text(), "28: organ özeti 'ilişkili N sonuç referans dışında' (organ hasta denmiyor)")
    page.get_by_role("button", name="Benim durumuma göre göster").click()
    page.get_by_text("Benim verilerimde").wait_for()
    check(page.get_by_text("“sorunlu” sayılmaz", exact=False).count() + page.get_by_text("olası ilişki", exact=False).count() >= 1, "46/84: fizyoloji akışında kişisel katman 'olası ilişki'")
    page.screenshot(path=SHOTS / "24b-pankreas-renkler.png", full_page=True)
    page.goto(URL + "#/sonuclar")
    page.get_by_role("heading", name="Sonuçlar", exact=True).wait_for()
    page.locator("li button:has-text('LDL kolesterol')").first.click()
    page.get_by_text("Senin sonucun ne anlama geliyor?").wait_for()
    page.screenshot(path=SHOTS / "25-ldl-detay.png", full_page=True)
    check(page.get_by_test_id("result-short").count() == 1, "değer sayfası: kısa 'Ne demek?' açıklaması ilk kartta")
    check(page.get_by_text("Orta derecede yüksek").count() >= 1, "sapma derecesi (LDL 178 / 130)")
    page.get_by_role("tab", name="Bilgi").click()
    page.get_by_text("Bu test neyi ölçer?").wait_for()
    page.get_by_role("tab", name="Doktora sor").click()
    check(page.get_by_text("Doktoruna sorabileceklerin").count() == 1, "öğren paneli (Doktora sor sekmesi)")

    # --- Vücutta göster → keşif yolu → eğitimsel simülasyon
    page.get_by_role("button", name="Vücutta göster").click()
    page.get_by_text("Keşif yolu").wait_for(timeout=20000)
    page.wait_for_timeout(6000)
    page.screenshot(path=SHOTS / "26-vucutta-goster.png")
    check("#/vucut/ldl" in page.url, "LDL için vücut rotası")
    check(page.locator("aside[aria-label='Bilgi paneli']").get_by_text("Koroner arterler").count() >= 1, "LDL → koroner arterler bağlantısı")
    page.locator("button:has-text('Eğitimsel simülasyonu başlat')").click()
    # Kamera önce organa dalar (yaklaşma evresi), sonra perde; yazılımsal GPU'da kare başına ~1 sn sürebilir.
    page.get_by_text("Eğitimsel biyolojik simülasyon").locator("visible=true").first.wait_for(timeout=90000)  # telefon ve masaüstü kopyası var: görüneni bekle
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
    # İçine gir organın iç dünyasıdır (damar lümeni, kan akışı); doku sahnesi "Daha derine in"dir
    # (kamera önce geri çekilir, perde açılınca organ paneli gelir: geçişin bitmesi beklenir)
    page.locator("aside[aria-label='Bilgi paneli'] button:has-text('İçine gir · Arter')").first.wait_for(state="attached", timeout=60000)
    check(page.locator("aside[aria-label='Bilgi paneli'] button:has-text('İçine gir · Arter')").count() >= 1, "3B organ paneli: 'İçine gir' damarın iç dünyasına (doku sahnesi değil)")
    # Daha derine in: önce kişisel durum; genel süreç yalnızca istenince başlar
    page.locator("button:has-text('Daha derine in · Damar içi')").first.click()
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
