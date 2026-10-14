"""Uçtan uca: yerel tıbbi AI modeli (cihazda), üç dürüst durum, rapor ↔ model çelişkisi, DICOM MPR.

  Senaryo 2 — Beyin MR FOTOĞRAFI: uygulamayla gelen MR modeli 3B'dir (yalnızca DICOM serisi) → fotoğrafta
              çalıştırılmaz, nedeni yazılır; "ön inceleme · tıbbi model değil", model bulgusu yok.
  Senaryo 3 — TEST AMAÇLI sahte ONNX modeli (tests/fixtures/models/mock-detector, tıbbi değil):
              kur (SHA-256) → gerçek görüntüde çıkarım → kutu → anatomi → organ sayfası → akış → köken.
  Senaryo 4 — Aynı çalışmaya rapor metni: rapor ve model AYRI kaynak; "beyin olağan" ↔ model bulgusu
              çelişkisi gizlenmez.
  + DICOM: 8 kesitlik seride MPR yapılmaz, nedeni gösterilir; yakılmış yazı bilgisi.
  + Ağ isteği yok, CSP ihlali yok.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/localai.py [ekran-görüntüsü-klasörü]
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
IMG = ROOT / "fixtures/imaging"
MODEL = ROOT / "tests/fixtures/models/mock-detector"
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


def upload_mr_photo(page):
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    pick_type(page, "MR")
    page.set_input_files("input[type=file][multiple]", [{"name": "beyin_mr.jpg", "mimeType": "image/jpeg", "buffer": (IMG / "mr-kolaj-foto.jpg").read_bytes()}])
    page.get_by_role("button", name="Aç ve oku").click()
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_test_id("analysis-state").wait_for(timeout=120000)
    return card


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, device_scale_factor=1)
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

    # ------------------------------------------------------------ Senaryo 2: uygulamayla gelen modeller; fotoğrafta 3B model yok
    page.goto(URL + "#/gizlilik")
    page.get_by_test_id("model-card").first.wait_for()
    BUNDLED = page.get_by_test_id("model-card").count()
    check(BUNDLED == 5, f"uygulamayla gelen 5 gerçek model listelendi ({BUNDLED})")
    caps = page.locator("details", has_text="Bu cihazda neler yapılabiliyor?")
    caps.locator("summary").click()
    ct = caps.inner_text()
    check(ct.count("Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.") == 9, "modeli olmayan 9 modalitede 'bu cihazda tıbbi AI modeli bulunmuyor' (BT, MR, röntgen hariç)")
    check("3B, yalnızca DICOM serisinde" in ct and "görüntü düzeyinde skor, konum vermez" in ct, "yetenekler: BT/MR modeli 3B (seri), röntgen modeli skor (konum yok) diye dürüstçe yazıyor")
    check(all(m in ct for m in ["MR", "BT", "Röntgen", "Ultrason", "Doppler", "EKO", "Mamografi", "Patoloji", "EKG", "Endoskopi", "Fundus", "Diş"]), "yetenek listesi: 12 modalite")

    card = upload_mr_photo(page)
    state = card.get_by_test_id("analysis-state")
    check(state.get_attribute("data-state") == "precheck", f"S2: model yokken durum 'precheck' ({state.get_attribute('data-state')})")
    vis = card.inner_text()
    check("Görüntü ön incelemesi yapıldı" in vis and "Bu sonuç tıbbi AI modeli sonucu değildir" in vis and "ön inceleme · tıbbi model değil" in vis, "S2: 'ön inceleme — tıbbi AI modeli sonucu değildir' açıkça yazıyor")
    check(card.get_by_test_id("model-finding").count() == 0, "S2: model bulgusu yok (uydurma sonuç yok)")
    check(card.get_by_test_id("volume-only").count() == 1 and "yalnızca DICOM serisinde" in card.get_by_test_id("volume-only").inner_text(), "S2: MR modeli 3B: fotoğrafta çalıştırılmadı, nedeni yazıyor")
    doc_url = page.url
    check("#/belge/" in doc_url, "S2: görüntü belgesi açıldı")
    card.screenshot(path=SHOTS / "a1-mr-model-yok.png")

    # ------------------------------------------------------------ Senaryo 3: test modeli kur
    page.goto(URL + "#/gizlilik")
    page.get_by_test_id("model-card").first.wait_for()
    # Önce bozuk model: SHA-256 uyuşmaz → reddedilir
    page.set_input_files("[data-testid=model-input]", [{"name": "manifest.json", "mimeType": "application/json", "buffer": (MODEL / "manifest.json").read_bytes()}, {"name": "model.onnx", "mimeType": "application/octet-stream", "buffer": b"bozuk-model"}])
    page.get_by_text("SHA-256 özetiyle eşleşmiyor", exact=False).wait_for()
    check(page.get_by_test_id("model-card").count() == BUNDLED, "S3: SHA-256 uyuşmayan model kurulmadı")
    page.set_input_files("[data-testid=model-input]", [str(MODEL / "manifest.json"), str(MODEL / "model.onnx")])
    page.get_by_text("kuruldu (SHA-256 doğrulandı)", exact=False).wait_for()
    installed = page.get_by_role("list", name="Kurulu modeller").inner_text()
    sha = json.loads((MODEL / "manifest.json").read_text())["sha256"]
    check("TEST — sahte bulgu modeli (tıbbi değil)" in installed and sha in installed, "S3: test modeli kuruldu; adı 'TEST — tıbbi değil', SHA-256 görünür")
    caps = page.locator("details", has_text="Bu cihazda neler yapılabiliyor?")
    caps.locator("summary").click()
    check(page.get_by_test_id("model-card").count() == BUNDLED + 1, "S3: kurulu modeller listesi bir arttı")
    check(caps.inner_text().count("Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.") == 9, "S3: test modelinin modaliteleri (MR, BT) zaten destekli; diğer 9'u hâlâ 'yok'")
    page.screenshot(path=SHOTS / "a2-model-kuruldu.png", full_page=True)

    # Aynı görüntüyü yeniden aç: model cihazda çalışır
    page.goto(doc_url)
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.locator("[data-testid=analysis-state][data-state=model]").wait_for(timeout=120000)
    check(True, "S3: durum 'Yerel tıbbi AI modeli ile analiz edildi'")
    card.get_by_test_id("model-finding").first.wait_for()
    f = card.get_by_test_id("model-finding").first.inner_text()
    check("Test bulgusu (sahte model)" in f and re.search(r"güven %\d+", f) is not None, f"S3: model bulgusu ve güveni ({f[:60]!r})")
    check("model kaynaklı" in f and re.search(r"x \d+, y \d+, \d+×\d+ px", f) is not None, "S3: gerçek görüntü üzerinde kutu (piksel konumu)")
    check("Beyin" in f and "Alın (frontal) lobu" in f, "S3: konum → anatomi (beyin › frontal lob)")
    check(card.get_by_test_id("model-overlay").count() == 1, "S3: model kutusu görüntü üzerine çizildi")
    prov = card.locator("details", has_text="Model kökeni (provenance)")
    prov.locator("summary").click()
    pt = prov.inner_text()
    check(sha in pt and "kh-test-mock-detector" in pt, "S3: köken: model kimliği ve SHA-256")
    check(card.get_by_test_id("local-model-row").inner_text().find("bu görüntüde çalıştı (cihazda)") >= 0, "S3: yetenek satırı: model bu görüntüde cihazda çalıştı")
    card.screenshot(path=SHOTS / "a3-model-bulgusu.png")

    # Görüntüler listesi: durum rozeti
    page.goto(URL + "#/goruntuler")
    page.get_by_test_id("image-study").first.wait_for()
    row = page.get_by_test_id("image-study").first
    check(row.locator("[data-state=model]").count() == 1 and "1 bulgu" in row.inner_text(), "S3: Görüntüler: 'Yerel AI modeli · 1 bulgu'")

    # Anatomi bağlantısı → organ sayfası
    page.goto(doc_url)
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_test_id("model-finding").first.wait_for(timeout=120000)
    card.get_by_role("button", name="Organ sayfası · Beyin").first.click()
    page.get_by_role("heading", name="Beyin", exact=True).wait_for()
    check(page.get_by_test_id("organ-model-summary").count() == 1 and "Test bulgusu (sahte model)" in page.get_by_test_id("organ-model-summary").inner_text(), "S3: organ sayfası (Benim durumum): model bulgusu, model-derived")
    check("Model bulgusu var" in page.locator("main").inner_text() or "Yerel tıbbi AI modeli 1 bulgu bildirdi" in page.locator("main").inner_text(), "S3: organ durumu model bulgusunu sayıyor (tanı değil)")
    page.get_by_role("button", name="Sonuçlarımı gör").click()
    page.get_by_test_id("organ-model-finding").first.wait_for()
    of = page.get_by_test_id("organ-model-finding").first.inner_text()
    check("TIBBİ GÖRÜNTÜ MODELİ" in of and "TEST — sahte bulgu modeli" in of, "S3: organ ayrıntısı: kaynak rozeti ve model adı")
    page.screenshot(path=SHOTS / "a4-organ-model-bulgusu.png", full_page=True)

    # Fizyoloji: sinir sistemi akışında ilgili basamak
    page.goto(URL + "#/akis/nervous/1/benim")
    page.get_by_role("list", name="Akışın basamakları").wait_for()
    page.get_by_role("list", name="Akışın basamakları").get_by_role("button", name=re.compile("^İşleme")).click()
    page.get_by_test_id("flow-finding").first.wait_for()
    ff = page.get_by_test_id("flow-finding").first.inner_text()
    check("Yerel tıbbi AI modeli: Test bulgusu (sahte model)" in ff and "tanı değildir" in ff, "S3: akış basamağı (İşleme · frontal lob) model bulgusuyla 'olası ilişki'")
    check("◆" in page.get_by_role("list", name="Akışın basamakları").inner_text(), "S3: bulgulu basamak simgeyle işaretli (yalnızca renk değil)")

    # Vücudum özeti
    page.goto(URL + "#/vucudum")
    page.get_by_role("heading", name="Vücudum", exact=True).wait_for()
    check("yerel AI modeli bulgusu" in page.locator("main").inner_text(), "S3: Vücudum: beyinde 'yerel AI modeli bulgusu' nedeni")

    # ------------------------------------------------------------ Senaryo 4: rapor + görüntü, çelişki
    page.goto(doc_url)
    page.get_by_role("button", name="Elle yaz").click()
    page.get_by_role("textbox", name="Rapor metni").fill("BEYİN MR\nBULGULAR: Beyin parankimi olağan görünümdedir. Patolojik bulgu izlenmedi.\nSONUÇ: Olağan beyin MR incelemesi.")
    page.get_by_role("button", name="Kaydet").click()
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_test_id("model-conflict").first.wait_for(timeout=120000)
    conf = card.get_by_test_id("model-conflict").first.inner_text()
    check("ÇELİŞKİ" in conf and "İki kaynak ayrı gösterilir" in conf and "⚠" in conf, "S4: rapor 'olağan' ↔ model bulgusu çelişkisi gizlenmiyor (simge + metin)")
    check("Rapor da var" in card.inner_text(), "S4: rapor ayrı kaynak olarak belirtilmiş")
    card.get_by_test_id("model-finding").first.wait_for(timeout=60000)
    check(card.get_by_test_id("model-finding").count() >= 1, "S4: model bulgusu raporla silinmedi/ezilmedi")
    card.screenshot(path=SHOTS / "a5-rapor-model-celiski.png")
    page.goto(URL + "#/goruntuler")
    page.get_by_test_id("image-study").first.wait_for()
    check("Rapor ↔ model çelişkisi" in page.get_by_test_id("image-study").first.inner_text(), "S4: Görüntüler listesinde çelişki rozeti")
    check(re.search(r"Rapor · \d+ cümle", page.get_by_test_id("image-study").first.inner_text()) is not None, "S4: rapor ayrı rozet (kaynak ayrı)")

    # Model kaldırılınca: canlı analiz yeniden 'ön inceleme'
    page.goto(URL + "#/gizlilik")
    page.get_by_role("button", name=re.compile("modelini kaldır")).click()
    for _ in range(100):  # CSP string-eval'e izin vermez (wait_for_function kullanılamaz); Python'da yokla
        if page.get_by_test_id("model-card").count() == BUNDLED:
            break
        page.wait_for_timeout(100)
    check(page.get_by_test_id("model-card").count() == BUNDLED, "kurulan test modeli kaldırıldı")
    check(page.get_by_role("button", name=re.compile("modelini kaldır")).count() == 0, "uygulamayla gelen modeller kaldırılamaz (yalnızca kullanıcının kurduğu)")
    page.goto(doc_url)
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.locator("[data-testid=analysis-state][data-state=precheck]").wait_for(timeout=120000)
    check(True, "model kaldırılınca durum yeniden 'ön inceleme'")

    # ------------------------------------------------------------ DICOM: MPR yapılamaz (8 kesit) + yakılmış yazı
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    pick_type(page, "MR")
    page.set_input_files("input[aria-label='DICOM klasörü']", str(IMG / "beyin-mr"))
    page.get_by_text("8 dosya şifrelendi ve kaydedildi").wait_for(timeout=60000)
    page.get_by_role("button", name="Aç", exact=True).click()
    page.get_by_text("Kesit 1 / 8").wait_for(timeout=30000)
    page.get_by_role("button", name="Diğer düzlemler (MPR)").wait_for(timeout=30000)
    page.get_by_role("button", name="Diğer düzlemler (MPR)").click()
    page.get_by_test_id("mpr-unavailable").wait_for(timeout=60000)
    check("en az 10 kesit" in page.get_by_test_id("mpr-unavailable").inner_text(), "MPR: 8 kesitlik seride yapılmıyor, nedeni gösteriliyor (uydurma görüntü yok)")
    more = page.locator("details", has_text="DICOM bilgileri").first
    if more.count():
        more.locator("summary").first.click()
    check(page.get_by_text("Yakılmış yazı").count() >= 1, "DICOM bilgileri: görüntüye yakılmış yazı durumu gösteriliyor")
    page.screenshot(path=SHOTS / "a6-dicom-mpr.png")

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    browser.close()

print(json.dumps({"problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
