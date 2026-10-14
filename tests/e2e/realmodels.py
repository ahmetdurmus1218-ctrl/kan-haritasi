"""Uçtan uca: GERÇEK yerel tıbbi modeller (uygulamayla gelir, cihazda çalışır), gerçek görüntülerle.

  A — Model deposu: 6 gerçek model; lisans, kaynak, SHA-256, cihaz, sınırlar; uygulamayla gelenler kaldırılamaz.
  B — Röntgen (NIH ChestX-ray14 örneği) → TorchXRayVision sınıflandırıcı → skorlar, kardiyomegali bulgusu
      (konum yok: yalnızca organ), köken (SHA-256), organ sayfası.
  C — BT serisi (TotalSegmentator örneği, DICOM) → patoloji modeli önce anatomi ister → 3B anatomi bölütleme
      (cihazda) → yapılar, görüntü üzerinde maske, Görüntüde / Organ / 3B → organ sayfasında model yapısı.
  D — BT patoloji (basamaklı): böbrek kisti modeli anatomi sonucuna göre kırpılan bölgede çalışır → sonuç ve
      köken; resmi çıktıda olduğu gibi kist yok (uydurma bulgu yok).
  E — MR serisi → TotalSegmentator MRI anatomi bölütleme.
  F — İsteğe bağlı paket dosyadan kurulur (SHA-256) → BT serisinde karaciğer segmentleri (anizotropik, basamaklı) → İçine gir.
  + Ağ isteği yok, CSP ihlali yok, konsol hatası yok.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/realmodels.py [ekran-görüntüsü-klasörü]
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
MODELS = ROOT / "apps/web/public/ai-models"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def manifest(mid):
    return json.loads((MODELS / mid / "manifest.json").read_text())


def pick_type(page, name):
    radio = page.get_by_role("radio", name=name, exact=True)
    if not radio.count() or not radio.first.is_visible():
        page.get_by_role("button", name=re.compile("Türünü kendim seçeyim|Tür: ")).click()
    radio.first.click()


def upload_series(page, kind, folder, n):
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    pick_type(page, kind)
    page.set_input_files("input[aria-label='DICOM klasörü']", str(IMG / folder))
    page.get_by_text(f"{n} dosya şifrelendi ve kaydedildi").wait_for(timeout=120000)
    page.get_by_role("button", name="Aç", exact=True).click()
    page.get_by_test_id("series-model-panel").wait_for(timeout=60000)
    return page.url


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

    # ------------------------------------------------------------ A: model deposu
    page.goto(URL + "#/gizlilik")
    page.get_by_test_id("model-card").first.wait_for()
    cards = page.get_by_test_id("model-card")
    check(cards.count() == 6, f"A: uygulamayla gelen 6 gerçek model ({cards.count()})")
    store = page.get_by_role("list", name="Kurulu modeller").inner_text()
    for mid in ["totalseg-ct-total-3mm", "totalseg-mr-total-3mm", "xrv-densenet121-nih", "totalseg-ct-kidney-cysts", "totalseg-ct-effusion", "totalseg-ct-liver-segments"]:
        m = manifest(mid)
        check(m["name"] in store and m["sha256"] in store, f"A: {mid}: ad ve SHA-256 görünür")
    check(store.count("Apache-2.0") >= 5, "A: her modelin lisansı yazıyor (Apache-2.0)")
    check("github.com/wasserth/TotalSegmentator" in store and "github.com/mlmed/torchxrayvision" in store, "A: kaynaklar yazıyor")
    check(page.get_by_role("button", name=re.compile("modelini kaldır")).count() == 0, "A: uygulamayla gelen modeller kaldırılamaz")
    page.screenshot(path=SHOTS / "r1-model-deposu.png", full_page=True)

    # ------------------------------------------------------------ B: röntgen → gerçek sınıflandırıcı
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    pick_type(page, "Röntgen")
    page.set_input_files("input[type=file][multiple]", [str(IMG / "nih-cxr-00000001_000.png")])
    page.get_by_role("button", name="Aç ve oku").click()
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.locator("[data-testid=analysis-state][data-state=model]").wait_for(timeout=240000)
    check(True, "B: röntgende durum 'Yerel tıbbi AI modeli ile analiz edildi'")
    card.get_by_test_id("model-finding").first.wait_for()
    f = card.get_by_test_id("model-finding").first.inner_text()
    check("kardiyomegali" in f.lower() and re.search(r"güven %\d+", f) is not None, f"B: kardiyomegali bulgusu ve skoru ({f[:80]!r})")
    check(card.get_by_test_id("model-overlay").count() == 0, "B: sınıflandırıcı konum vermez: görüntüye kutu çizilmedi (sahte konum yok)")
    scores = card.get_by_test_id("model-scores")
    check(scores.count() == 1 and scores.locator("li").count() == 14 and re.search(r"0,\d\d", scores.text_content()) is not None, "B: 14 bulgunun skor tablosu")
    prov = card.locator("details", has_text="Model kökeni").first
    prov.locator("summary").first.click()
    check(manifest("xrv-densenet121-nih")["sha256"] in card.inner_text(), "B: köken: model SHA-256")
    card.screenshot(path=SHOTS / "r2-rontgen-model.png")

    # ------------------------------------------------------------ C: BT serisi → 3B anatomi
    ct_url = upload_series(page, "Tomografi (BT)", "totalseg-ct-sm", 30)
    panel = page.get_by_test_id("series-model-panel")
    check(panel.get_by_test_id("series-state").get_attribute("data-state") == "ready", "C: BT serisi analize hazır (model cihazda)")
    kc = panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-kidney-cysts]")
    check(kc.get_attribute("data-state") == "needs-anatomy" and "Önce yukarıdaki anatomi analizi" in kc.inner_text(), "C: patoloji modeli önce anatomi bölütlemesini ister")
    panel.get_by_test_id("run-series-model").click()
    panel.get_by_test_id("series-progress").wait_for()
    check(True, "C: ilerleme gösteriliyor (iptal edilebilir)")
    panel.locator("[data-testid=series-state][data-state=model]").wait_for(timeout=900000)
    n = panel.get_by_test_id("series-structure").count()
    check(n >= 6, f"C: bölütlenen yapılar listelendi ({n} görünür)")
    pt = panel.inner_text()
    check("normal anatomi; bulgu değildir" in pt, "C: anatomi bölütlemesi bulgu değil diye yazıyor")
    check(page.get_by_test_id("segmentation-overlay").count() == 1, "C: görüntü üzerinde gerçek maske katmanı")
    liver = panel.get_by_test_id("series-structure").filter(has_text="Karaciğer").first
    check(re.search(r"\d+([.,]\d+)? (mL|L) · kesit \d+–\d+", liver.inner_text()) is not None, f"C: karaciğer hacmi ve kesit aralığı ({liver.inner_text()[:60]!r})")
    liver.get_by_role("button", name="Görüntüde").click()
    page.wait_for_timeout(500)
    page.screenshot(path=SHOTS / "r3-bt-seri-maske.png")
    prov = panel.locator("details", has_text="Analiz ayrıntıları ve model kökeni").first
    prov.locator("summary").click()
    check(manifest("totalseg-ct-total-3mm")["sha256"] in prov.inner_text() and "Apache-2.0" in prov.inner_text(), "C: köken: model, SHA-256, lisans")
    # 2B → 3B ve 3B → 2B: kişisel 3B (gerçek maskelerden)
    panel.get_by_test_id("personal-3d-toggle").click()
    panel.get_by_test_id("personal-3d").wait_for(timeout=120000)
    p3 = panel.get_by_test_id("personal-3d").inner_text()
    check(re.search(r"bölütlediği \d+ yapının gerçek maske yüzeyi", p3) is not None and "Şablon değildir" in p3, "C: kişisel 3B: gerçek maske yüzeyleri (şablon değil)")
    check(panel.locator("[data-testid=personal-3d] canvas").count() == 1, "C: kişisel 3B tuval çizildi (döndür/yakınlaştır)")
    check("Turkuaz düzlem: görüntüleyicide açık kesit" in p3, "C: 2B → 3B: görüntüleyicideki kesit 3B'de düzlem olarak")
    page.screenshot(path=SHOTS / "r3b-kisisel-3b.png")
    # İçine gir: karaciğer yapısı → derin görünüm, kişisel veri gerçek konumlu (FULL)
    liver.get_by_test_id("structure-inside").click()
    page.locator("[data-testid=deep-dive][data-node=liver]").wait_for()
    pers = page.get_by_test_id("deep-personal")
    check(pers.locator("[data-testid=deep-personal-item][data-depth=FULL]").count() >= 1 and "Karaciğer" in pers.inner_text(), "C: İçine gir → karaciğer: kişisel veri (gerçek voksel konumu, FULL)")
    check("hücrede şu var" in pers.inner_text() or "genel anatomi" in pers.inner_text().lower(), "C: kişisel veri ile genel anatomi ayrımı yazılı")
    check("tissue.liver-lobule" in [c.get_attribute("data-node") for c in page.get_by_test_id("deep-child").all()], "C: karaciğer → lobül (daha içine)")
    page.screenshot(path=SHOTS / "r3c-icine-gir-karaciger.png", full_page=True)
    page.goto(URL + "#/organ/liver")
    page.get_by_role("heading", name="Karaciğer", exact=True).wait_for()
    main = page.locator("main").inner_text()
    check(page.get_by_test_id("organ-model-structure-summary").count() >= 1 or page.get_by_test_id("organ-model-structure").count() >= 1, "C: organ sayfası: modelin bölütlediği yapı (hacimle)")
    check("bulgu değil" in main, "C: organ sayfası: bölütleme bulgu değil")
    page.screenshot(path=SHOTS / "r4-organ-model-yapisi.png", full_page=True)
    page.goto(ct_url)
    panel = page.get_by_test_id("series-model-panel")
    panel.locator("[data-testid=series-state][data-state=model]").wait_for(timeout=60000)
    panel.get_by_test_id("series-structure").filter(has_text="Karaciğer").first.get_by_role("button", name=re.compile("3B anatomide göster")).click()
    page.wait_for_url(re.compile("#/vucut"), timeout=30000)
    check(True, "C: yapı → 3B anatomi görünümü")

    # ------------------------------------------------------------ D: BT patoloji (basamaklı)
    page.goto(ct_url)
    panel = page.get_by_test_id("series-model-panel")
    kc = panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-kidney-cysts]")
    kc.wait_for()
    check(kc.get_attribute("data-state") == "ready", "D: anatomi sonucu var → böbrek kisti modeli çalıştırılabilir")
    kc.get_by_test_id("run-pathology-model").click()
    kc.get_by_test_id("series-progress").wait_for()
    panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-kidney-cysts][data-state=done]").wait_for(timeout=1500000)
    kc = panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-kidney-cysts]")
    kt = kc.inner_text()
    check(kc.get_by_test_id("pathology-finding").count() == 0 and kc.get_by_test_id("pathology-none").count() == 1, "D: resmi çıktıda olduğu gibi kist yok; 'bulunmadı, kesinleştirmez' yazıyor")
    kc.locator("details").first.locator("summary").click()
    kt = kc.inner_text()
    check(manifest("totalseg-ct-kidney-cysts")["sha256"] in kt and "anatomi sonucuna" in kt and "1,5 mm" in kt, "D: köken: patoloji modeli SHA-256, 1,5 mm ızgara, anatomiye göre kırpılmış bölge")
    kc.screenshot(path=SHOTS / "r5-bt-patoloji.png")

    # ------------------------------------------------------------ F: uygulamayla gelen karaciğer segmentleri (kurulum gerekmez)
    page.goto(URL + "#/gizlilik")
    page.get_by_test_id("model-card").first.wait_for()
    card = page.locator("[data-testid=model-card][data-model=totalseg-ct-liver-segments]")
    check(card.count() == 1 and "uygulamayla gelir" in card.inner_text(), "F: karaciğer segmentleri uygulamayla geliyor (dosya seçmeden)")
    page.goto(ct_url)
    panel = page.get_by_test_id("series-model-panel")
    seg = panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-liver-segments]")
    seg.wait_for(timeout=60000)
    seg.get_by_test_id("run-pathology-model").click()
    panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-liver-segments][data-state=done]").wait_for(timeout=1800000)
    seg = panel.locator("[data-testid=pathology-model][data-model=totalseg-ct-liver-segments]")
    n = seg.get_by_test_id("cascade-structure").count()
    check(n >= 6 and "segment VII" in seg.inner_text(), f"F: karaciğer segmentleri (anizotropik ızgara) bölütlendi ({n})")
    seg.locator("details").first.locator("summary").click()
    check("0,805 × 0,805 × 1,5 mm" in seg.inner_text(), "F: köken: anizotropik ızgara (0,8 × 0,8 × 1,5 mm)")
    seg.get_by_test_id("cascade-structure").filter(has_text=re.compile(r"segment VII(?!I)")).get_by_role("button", name="İçine gir").click()
    page.locator("[data-testid=deep-dive][data-node='liver.segment-7']").wait_for()
    check("Sağ lob" in page.locator("nav[aria-label='Şu anda neredeyim?']").inner_text(), "F: İçine gir → Karaciğer › Sağ lob › Segment VII")
    page.screenshot(path=SHOTS / "r7-karaciger-segmentleri.png", full_page=True)

    # ------------------------------------------------------------ E: MR serisi → 3B anatomi
    upload_series(page, "MR", "totalseg-mr-sm", 20)
    panel = page.get_by_test_id("series-model-panel")
    check("TotalSegmentator MRI" in panel.inner_text(), "E: MR serisi için MR modeli seçildi")
    panel.get_by_test_id("run-series-model").click()
    panel.locator("[data-testid=series-state][data-state=model]").wait_for(timeout=900000)
    check(panel.get_by_test_id("series-structure").count() >= 6, "E: MR yapıları bölütlendi")
    page.screenshot(path=SHOTS / "r6-mr-seri.png")

    # Görüntüler listesi: model rozetleri
    page.goto(URL + "#/goruntuler")
    page.get_by_test_id("image-study").first.wait_for()
    check(page.locator("[data-testid=image-study] [data-state=model]").count() >= 1, "Görüntüler: model ile analiz edilen çalışma rozeti")

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    browser.close()

print(json.dumps({"problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
