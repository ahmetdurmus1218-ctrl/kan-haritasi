"""Uçtan uca: GERÇEK BT → gerçek maske → KİŞİSEL 3B ORGAN → İçine gir (kamera gerçek mesh'in içine) → eğitimsel iç dünya.

  1. BT serisi (TotalSegmentator örneği, DICOM) yüklenir → yerel TotalSegmentator modeli cihazda çalışır.
  2. Organ sayfası (karaciğer): "İçine gir · senin görüntünden" → #/kisisel/liver.
  3. Kişisel organ: [GERÇEK VERİ] etiketi, model kartı (Model · Modalite · Girdi · Çıktı · Kaynak), 3B tuval,
     voksel aralığı, köşe/üçgen sayısı ve süre; dolu organda lümen iddiası yok.
  4. İçine gir: kamera gerçek mesh'in içine dalar (data-dive: outside → moving → inside), [ANATOMİK EĞİTİM]
     notu, breadcrumb "… › Senin 3B organın › İçerisi".
  5. Devam → 3B keşifte karaciğerin eğitimsel iç dünyası (parankim; duvar/hücreye atlamaz); geri → kişisel organ.
  6. Kalın bağırsak: maske organı dolu bölge olarak verdiği için iç lümen EĞİTİMSEL (uydurma lümen yok).
  7. Kalp (bu seride bölütlenmedi): kişisel 3B iddiası yok → eğitimsel normal anatomi.
  8. Telefon (390 × 844): yatay taşma yok; başlık, 3B alan, etiket ve düğmeler ekranda.
  + Ağ isteği yok, CSP ihlali yok, konsol hatası yok.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/personal3d.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import re
import sys
import time
from pathlib import Path

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


def pick_type(page, name):
    radio = page.get_by_role("radio", name=name, exact=True)
    if not radio.count() or not radio.first.is_visible():
        page.get_by_role("button", name=re.compile("Türünü kendim seçeyim|Tür: ")).click()
    radio.first.click()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
    ctx.set_default_timeout(60000)
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

    # Gerçek veri yokken: kişisel 3B iddiası yok
    page.goto(URL + "#/kisisel/liver")
    page.locator("[data-testid=personal-organ][data-state=none]").wait_for()
    check("uydurulmaz" in page.get_by_test_id("personal-organ-none").inner_text(), "0: görüntü yokken kişisel 3B yok, eğitimsel anatomiye yönlendirir")

    # ------------------------------------------------------------ 1: BT serisi → yerel model
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    pick_type(page, "Tomografi (BT)")
    page.set_input_files("input[aria-label='DICOM klasörü']", str(IMG / "totalseg-ct-sm"))
    page.get_by_text("30 dosya şifrelendi ve kaydedildi").wait_for(timeout=120000)
    page.get_by_role("button", name="Aç", exact=True).click()
    panel = page.get_by_test_id("series-model-panel")
    panel.wait_for(timeout=60000)
    t0 = time.time()
    panel.get_by_test_id("run-series-model").click()
    panel.locator("[data-testid=series-state][data-state=model]").wait_for(timeout=900000)
    infer_s = time.time() - t0
    check(panel.get_by_test_id("series-structure").count() >= 6, f"1: BT serisi cihazda bölütlendi ({infer_s:.0f} sn)")

    # ------------------------------------------------------------ 2: organ sayfası → İçine gir (kişisel)
    page.goto(URL + "#/organ/liver")
    page.get_by_role("heading", name="Karaciğer", exact=True).wait_for()
    enter = page.get_by_test_id("organ-enter-personal")
    enter.wait_for(timeout=30000)
    check("senin görüntünden" in enter.inner_text(), "2: organ sayfası: İçine gir önce kişinin gerçek organ mesh'ine")
    check(page.get_by_test_id("organ-enter-interior").count() == 1, "2: yalnızca eğitimsel iç dünya seçeneği ayrı duruyor")
    enter.click()

    # ------------------------------------------------------------ 3: kişisel organ (gerçek veri)
    t1 = time.time()
    po = page.locator("[data-testid=personal-organ][data-state=ready]")
    po.wait_for(timeout=120000)
    mesh_s = time.time() - t1
    txt = po.inner_text()
    check(page.url.endswith("#/kisisel/liver"), "3: adres #/kisisel/liver")
    check("GERÇEK VERİ" in txt and "segmentasyon maskesinden oluşturuldu" in txt, "3: [GERÇEK VERİ] Bu karaciğer 3B modeli yüklediğiniz görüntüdeki segmentasyondan")
    check(po.get_attribute("data-lumen") == "none" and "ANATOMİK EĞİTİM" not in txt, "3: dolu organ: lümen iddiası yok; dışarıdayken eğitimsel etiket yok")
    pv = page.get_by_test_id("personal-organ-provenance").inner_text()
    for k in ["TotalSegmentator", "CT", "Gerçek görüntü · DICOM seri, 30 kesit", "Segmentasyon (voksel maskesi)", "Gerçek görüntü analizi · cihazda", "mm izotropik", "köşe", "Apache-2.0"]:
        check(k in pv, f"3: model kartı: {k}")
    page.locator("[data-testid=personal-organ-3d] canvas").wait_for(timeout=30000)
    check(page.locator("[data-testid=personal-organ-3d] canvas").count() == 1, "3: 3B tuval çizildi")
    stats = re.search(r"([\d.]+) köşe, ([\d.]+) üçgen · ([\d.]+) ms", pv)
    check(stats is not None, f"3: yüzey ölçümü ({stats.group(0) if stats else '?'})")
    canvas = page.locator("[data-testid=personal-organ-3d] canvas")
    box = canvas.bounding_box()
    # Döndür (sürükle) ve yakınlaştır (tekerlek)
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 + 120, box["y"] + box["height"] / 2 + 30, steps=8)
    page.mouse.up()
    page.mouse.wheel(0, -300)
    page.wait_for_timeout(400)
    page.get_by_test_id("personal-organ-cut").click()
    page.wait_for_timeout(400)
    page.screenshot(path=SHOTS / "p1-kisisel-karaciger.png", full_page=True)
    page.get_by_test_id("personal-organ-cut").click()

    # ------------------------------------------------------------ 4: İçine gir → kamera gerçek mesh'in içine
    page.get_by_test_id("personal-organ-enter").click()
    page.locator("[data-testid=personal-organ][data-inside=true]").wait_for()
    seen_moving = False
    for _ in range(40):
        d = page.get_by_test_id("personal-organ").get_attribute("data-dive")
        if d == "moving":
            seen_moving = True
        if d == "inside":
            break
        page.wait_for_timeout(100)
    check(seen_moving, "4: kamera geçişi (dalış animasyonu) oynadı")
    check(page.get_by_test_id("personal-organ").get_attribute("data-dive") == "inside", "4: kamera gerçek mesh'in içinde (maskenin en derin noktası)")
    note = page.get_by_test_id("personal-organ-edu-note").inner_text()
    check("ANATOMİK EĞİTİM" in note and "BT/MR" in note, "4: [ANATOMİK EĞİTİM] iç birimler eğitimsel, BT/MR'dan görüntülenmez")
    crumbs = page.locator("nav[aria-label='Şu anda neredeyim?']").inner_text()
    check("Karaciğer" in crumbs and "Senin 3B organın" in crumbs and "İçerisi" in crumbs, f"4: breadcrumb Vücut › … › Karaciğer › Senin 3B organın › İçerisi ({crumbs!r})")
    ladder = page.get_by_test_id("personal-organ-ladder").inner_text()
    check("parankim" in ladder.lower() and "Lobül" in ladder, "4: sonraki basamaklar: parankim → … → lobül (eğitimsel)")
    page.screenshot(path=SHOTS / "p2-karaciger-icine-gir.png", full_page=True)

    # ------------------------------------------------------------ 5: eğitimsel iç dünyaya devam, geri
    page.get_by_test_id("personal-organ-continue").click()
    page.locator("[data-testid=explorer][data-interior=liver]").wait_for()
    ex = page.get_by_test_id("explorer")
    check(ex.get_attribute("data-current-level") == "interior" and ex.get_attribute("data-current-node") == "parenchyma", "5: devam → karaciğerin eğitimsel iç dünyası (parankim), duvar/hücreye atlamıyor")
    page.go_back()
    page.locator("[data-testid=personal-organ][data-inside=true][data-state=ready]").wait_for(timeout=60000)
    check(True, "5: geri → kişisel organın içi (konum kaybolmadı)")
    page.get_by_test_id("personal-organ-out").click()
    page.locator("[data-testid=personal-organ][data-inside=false]").wait_for()
    check(True, "5: organa dön → kamera dışarı")

    # ------------------------------------------------------------ 6: içi boş organ: lümen dürüstlüğü
    page.goto(URL + "#/kisisel/large-intestine")
    page.locator("[data-testid=personal-organ][data-state=ready]").wait_for(timeout=120000)
    lumen = page.get_by_test_id("personal-organ").get_attribute("data-lumen")
    page.get_by_test_id("personal-organ-enter").click()
    page.locator("[data-testid=personal-organ][data-dive=inside]").wait_for(timeout=15000)
    t = page.get_by_test_id("personal-organ-edu-note").inner_text()
    if lumen == "educational":
        check("iç lümen eğitimsel anatomi olarak gösteriliyor" in t, "6: kalın bağırsak: maske dolu → iç lümen eğitimsel (uydurulmadı)")
    else:
        check(lumen == "real" and "senin görüntünden" in page.get_by_test_id("personal-organ-source").inner_text().lower(), "6: kalın bağırsak: maskenin kapattığı gerçek boşluk")
    page.get_by_test_id("personal-organ-continue").click()
    page.locator("[data-testid=explorer][data-interior=large-intestine]").wait_for()
    check(page.get_by_test_id("explorer").get_attribute("data-current-node") == "lumen", "6: kalın bağırsak → İçine gir → lümen (duvara atlamıyor)")
    page.screenshot(path=SHOTS / "p3-kolon-lumen.png")

    # ------------------------------------------------------------ 7: bölütlenmeyen organ
    page.goto(URL + "#/kisisel/heart")
    page.locator("[data-testid=personal-organ][data-state=none]").wait_for(timeout=60000)
    check(True, "7: kalp bu seride bölütlenmedi → kişisel 3B iddiası yok")
    page.goto(URL + "#/organ/heart")
    page.get_by_role("heading", name="Kalp", exact=True).wait_for()
    check(page.get_by_test_id("organ-enter-personal").count() == 0 and page.get_by_test_id("organ-enter-interior").count() == 1, "7: kalp organ sayfasında yalnızca eğitimsel İçine gir")

    # ------------------------------------------------------------ 8: telefon
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(URL + "#/kisisel/liver/ic")
    page.locator("[data-testid=personal-organ][data-state=ready]").wait_for(timeout=120000)
    page.locator("[data-testid=personal-organ][data-dive=inside]").wait_for(timeout=15000)
    over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check(over <= 1, f"8: telefonda yatay taşma yok ({over})")
    b3 = page.get_by_test_id("personal-organ-3d").bounding_box()
    check(b3 and b3["width"] <= 390 and b3["height"] >= 250, "8: 3B alan ekrana sığıyor")
    for tid in ["personal-organ-source", "personal-organ-edu-note", "personal-organ-continue", "personal-organ-out"]:
        bb = page.get_by_test_id(tid).bounding_box()
        check(bb is not None and bb["x"] >= 0 and bb["x"] + bb["width"] <= 391, f"8: {tid} ekranda")
    page.screenshot(path=SHOTS / "p4-telefon-icine-gir.png", full_page=True)

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    print(json.dumps({"inferenceSeconds": round(infer_s), "meshSeconds": round(mesh_s, 1), "stats": stats.group(0) if stats else None}, ensure_ascii=False))
    browser.close()

print(json.dumps({"problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
