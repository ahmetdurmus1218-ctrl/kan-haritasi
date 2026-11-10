"""Uçtan uca: Simülasyon laboratuvarı, hesaplanan değerler, kanıt düzeyli "neye dayanıyor?" paneli ve
Anatomi laboratuvarı — önce TELEFONDA (390 × 844), sonra masaüstünde.

Denetlenen: model gerçekten çözülüyor ve oynuyor mu (zaman ilerliyor, senaryo ölçütleri değiştiriyor), eğitimsel
etiket her zaman görünür mü, kişinin ölçümü yalnızca istenirse ve yalnızca ölçülen parametreye giriyor mu,
hesaplanan değerler yalnızca aynı rapordan mı, veri yokken kişisel iddia yok mu, telefonda yatay taşma yok mu,
dokunma hedefleri ≥ 40 px mi; ağ isteği, CSP ihlali ve konsol hatası yok.

Kullanım: pnpm build && pnpm preview --port 4173, sonra: python3 tests/e2e/simlab.py [ekran-görüntüsü-klasörü]
"""
import os
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


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def overflow(page):
    return page.evaluate("() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth)")


def metric(page, key):
    v = page.get_by_test_id(f"metric-{key}").get_attribute("data-value")
    return float(v) if v else float("nan")


def sim(page):
    return page.get_by_test_id("simlab")


def wait_attr(page, name, value, timeout=30000):
    """CSP dize değerlendirmeyi (eval) engellediği için wait_for_function yerine öznitelik yoklanır."""
    page.locator(f"[data-testid='simlab'][data-{name}='{value}']").wait_for(timeout=timeout)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.set_default_timeout(60000)
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
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for(timeout=30000)
    check(page.evaluate("document.documentElement.dataset.theme") == "dark", "varsayılan tema koyu (lacivert/cyan)")

    # ---------------------------------------------------------------- Telefon: gezinme → Simülasyon
    page.get_by_role("navigation", name="Ana gezinme").get_by_role("button", name="Daha").click()
    more = page.locator("dialog[open]")
    more.get_by_text("Simülasyon", exact=True).click()
    page.get_by_test_id("simlab-list").wait_for()
    check(page.get_by_test_id("sim-card").count() == 14, "telefon: 14 fizyoloji modeli listeleniyor")
    check("Eğitimsel matematiksel model" in page.get_by_test_id("simlab-list").inner_text(), "liste: eğitimsel etiket görünür")
    check(overflow(page) <= 1, f"telefon: simülasyon listesinde yatay taşma yok ({overflow(page)})")
    # Veri yokken: hiçbir hesaplanan değer yok, kişisel iddia yok
    check(page.locator("[data-testid^='derived-']:not([data-testid^='derived-missing']):not([data-testid='derived-age']):not([data-testid='derived-sex']):not([data-testid='derived-waiting'])").count() == 0, "veri yokken hesaplanan değer üretilmez")
    check("Henüz hesaplanabilen bir değer yok" in page.get_by_test_id("simlab-list").inner_text(), "veri yokken 'hesaplanabilen değer yok' yazar")
    page.screenshot(path=SHOTS / "sim-01-liste-telefon.png", full_page=True)

    # ---------------------------------------------------------------- Kalp döngüsü: oynat / durdur / sıfırla / hız
    page.locator("[data-testid='sim-card'][data-model='kalp-dongusu']").click()
    sim(page).wait_for()
    check(sim(page).get_attribute("data-scenario") == "normal" and sim(page).get_attribute("data-playing") == "0", "kalp: normal çalışma, başlangıçta duruyor")
    check(page.get_by_test_id("sim-edu-label").is_visible(), "kalp: 'Eğitimsel matematiksel model — kişisel ölçüm ya da tahmin değildir.' görünür")
    ef, co, sbp = metric(page, "ef"), metric(page, "co"), metric(page, "sbp")
    check(50 < ef < 72 and 4 < co < 7.5 and 100 < sbp < 140, f"kalp: model fizyolojik değerler hesaplıyor (EF {ef:.0f} %, debi {co:.1f} L/dk, sistolik {sbp:.0f} mmHg)")
    page.get_by_test_id("sim-play").click()
    page.wait_for_timeout(1200)
    t1 = float(sim(page).get_attribute("data-t"))
    check(sim(page).get_attribute("data-playing") == "1" and t1 > 0.5, f"Başlat: model zamanı ilerliyor (t = {t1:.2f} sn)")
    check(page.get_by_test_id("sim-phase").inner_text().strip() != "", "evre açıklaması gösteriliyor")
    page.get_by_test_id("sim-play").click()
    page.wait_for_timeout(300)
    t2 = float(sim(page).get_attribute("data-t"))
    page.wait_for_timeout(500)
    check(sim(page).get_attribute("data-playing") == "0" and float(sim(page).get_attribute("data-t")) == t2, "Durdur: zaman duruyor")
    page.get_by_test_id("sim-reset").click()
    check(float(sim(page).get_attribute("data-t")) == 0, "Sıfırla: zaman 0")
    page.locator("[data-testid='sim-speed'][data-speed='4']").click()
    page.get_by_test_id("sim-play").click()
    page.wait_for_timeout(1000)
    page.get_by_test_id("sim-play").click()
    t4 = float(sim(page).get_attribute("data-t"))
    check(t4 > 2.0, f"Hız 4×: aynı sürede daha uzun model zamanı (t = {t4:.2f} sn)")
    page.get_by_test_id("sim-zoom").click()
    check(page.get_by_test_id("sim-zoom").get_attribute("data-zoom") == "2", "Yakınlaştır: 2×")
    page.get_by_test_id("sim-annotate").uncheck()
    check(page.get_by_test_id("sim-phase").count() == 0, "Açıklamaları gizle: evre etiketi kalkar")
    page.get_by_test_id("sim-annotate").check()
    check(page.get_by_test_id("sim-chart").count() == 2 and page.get_by_test_id("sim-curve").count() == 1, "kalp: 2 zaman grafiği + basınç-hacim halkası")
    drawn = page.evaluate("() => [...document.querySelectorAll('[data-testid=sim-chart] canvas')].every(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })")
    check(drawn, "grafik tuvalleri gerçekten çizildi")
    check(overflow(page) <= 1, f"telefon: simülasyon ekranında yatay taşma yok ({overflow(page)})")
    small = page.evaluate("() => [...document.querySelectorAll('[data-testid=simlab] button, [data-testid=simlab] a.btn-ghost')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 39.5).map(b => b.textContent.trim().slice(0, 30))")
    check(small == [], f"telefon: dokunma hedefleri ≥ 40 px ({small[:4]})")
    page.screenshot(path=SHOTS / "sim-02-kalp-telefon.png", full_page=True)

    # ---------------------------------------------------------------- Senaryo: azalmış kasılma gücü
    page.locator("[data-testid='sim-scenario'][data-id='dusuk-kasilma']").click()
    wait_attr(page, "scenario", "dusuk-kasilma")
    ef2 = metric(page, "ef")
    check(ef2 < ef - 12, f"senaryo 'azalmış kasılma gücü': EF düşüyor ({ef:.0f} → {ef2:.0f} %)")
    check("Eğitim senaryosu" in page.get_by_test_id("sim-scenario-note").inner_text(), "senaryo 'eğitim senaryosu' olarak etiketli")
    check(page.get_by_test_id("sim-metrics-normal").count() == 1, "ölçüt tablosunda normal çalışma sütunu (karşılaştırma)")
    check(page.url.endswith("#/sim/kalp-dongusu/dusuk-kasilma"), "senaryo adreste (geri tuşu ve paylaşılabilir bağlantı)")
    # Parametreyi elle değiştir → özel ayar
    slider = page.locator("[data-testid='param-hr'] input[type=range]")
    slider.fill("120")
    wait_attr(page, "scenario", "ozel")
    check("Özel ayar" in page.get_by_test_id("sim-scenario-note").inner_text(), "parametre elle değişince 'özel ayar' yazar")
    page.get_by_test_id("sim-params-reset").click()
    wait_attr(page, "scenario", "dusuk-kasilma")
    check(abs(metric(page, "ef") - ef2) < 0.01, "senaryo değerlerine dön: aynı sonuç (deterministik)")
    check(page.get_by_test_id("sim-no-data").count() == 1, "veri yokken: 'ilişkili ölçülmüş sonucun yok' (kişisel iddia yok)")
    about = page.get_by_test_id("sim-about").inner_text()
    check("Geçerlilik alanı" in about and "Varsayımlar" in about and "Sınırlar" in about, "model: geçerlilik alanı, varsayımlar ve sınırlar görünür")

    # Her model açılıyor, kararlı ve çiziliyor
    bad = []
    for mid in ["gaz-degisimi", "glukoz-insulin", "bobrek-suzme", "asit-baz", "su-dengesi", "demir-eritropoez", "tiroid-ekseni", "aksiyon-potansiyeli", "kas-kasilmasi", "sindirim-emilim", "bilirubin", "pihtilasma", "bagisiklik-yaniti"]:
        page.goto(URL + f"#/sim/{mid}")
        wait_attr(page, "model", mid)
        if page.get_by_test_id("sim-chart").count() < 1 or page.get_by_test_id("sim-metrics").locator("tbody tr").count() < 3 or overflow(page) > 1 or not page.get_by_test_id("sim-edu-label").is_visible():
            bad.append(mid)
    check(bad == [], f"telefon: diğer 13 model açılıyor, grafik + ölçüt + eğitimsel etiket var, taşma yok ({bad})")

    # ---------------------------------------------------------------- Anatomi laboratuvarı (telefon)
    page.goto(URL + "#/laboratuvar")
    page.get_by_test_id("anatomylab").wait_for()
    check(page.get_by_test_id("lab-system").count() == 9, "anatomi laboratuvarı: 9 sistem katmanı")
    check(page.get_by_test_id("lab-edu-label").is_visible(), "anatomi laboratuvarı: eğitimsel etiket")
    check(page.get_by_test_id("lab-scene").count() >= 40, f"anatomi laboratuvarı: doku ve hücre sahneleri ({page.get_by_test_id('lab-scene').count()})")
    page.get_by_test_id("lab-search").fill("nefron")
    page.wait_for_timeout(300)
    hits = page.locator("[data-testid='lab-interior']:visible")
    check(hits.count() >= 1 and "Nefron" in hits.first.inner_text(), "anatomi laboratuvarı: arama 'nefron' iç dünyasını buluyor")
    check(overflow(page) <= 1, f"telefon: anatomi laboratuvarında yatay taşma yok ({overflow(page)})")
    page.screenshot(path=SHOTS / "sim-03-anatomi-lab-telefon.png", full_page=True)
    hits.first.click()
    page.wait_for_url("**/#/ic/**")
    check(True, "anatomi laboratuvarı → İçine gir (3B iç dünya) açılıyor")

    # ---------------------------------------------------------------- Veri ekle → hesaplanan değerler, kişisel bağ, dayanak
    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    page.set_input_files("input[type=file][multiple]", [str(PDF)])
    page.get_by_role("button", name="Aç ve oku").wait_for(timeout=30000)
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=60000)
    page.get_by_role("button", name="Onayla ve kaydet (14)").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=20000)

    page.goto(URL + "#/sim")
    page.get_by_test_id("simlab-list").wait_for()
    ldl = page.get_by_test_id("derived-ldl-friedewald")
    ldl.wait_for()
    check(abs(float(ldl.get_attribute("data-value")) - (241 - 44 - 162 / 5)) < 0.01, "hesaplanan LDL (Friedewald) = 241 − 44 − 162/5 (aynı rapordaki ölçümlerden)")
    check("HESAPLANDI · ÖLÇÜM DEĞİL" in ldl.inner_text(), "hesaplanan değer 'HESAPLANDI · ÖLÇÜM DEĞİL' etiketli")
    ldl.locator("summary").click()
    det = ldl.inner_text()
    check("Friedewald" in det and "Total kolesterol − HDL − trigliserid / 5" in det and "Sınırlar" in det and "12 Eyl 2026" in det, "hesap: formül, kaynak, sınırlar ve girdilerin rapor tarihi gösteriliyor")
    page.get_by_test_id("derived-waiting").locator("summary").click()
    check(page.get_by_test_id("derived-egfr-ckdepi").count() == 0 and "yaş" in page.get_by_test_id("derived-missing-egfr-ckdepi").inner_text(), "eGFR yaş girilmeden hesaplanmaz")
    page.get_by_test_id("derived-age").fill("45")
    page.get_by_test_id("derived-sex").select_option("male")
    egfr = page.get_by_test_id("derived-egfr-ckdepi")
    egfr.wait_for()
    expected = 142 * (0.92 / 0.9) ** -1.2 * 0.9938 ** 45
    check(abs(float(egfr.get_attribute("data-value")) - expected) < 0.05, f"eGFR (CKD-EPI 2021): kreatinin 0,92, 45 y, erkek → {expected:.0f}")
    check("aynı raporda ölçülmüş olmalı" in page.get_by_test_id("derived-missing-anion-gap").inner_text(), "anyon açığı: sodyum/klor/bikarbonat ölçülmediği için 'veri yetersiz'")
    check(overflow(page) <= 1, f"telefon: hesaplanan değerlerde yatay taşma yok ({overflow(page)})")
    page.screenshot(path=SHOTS / "sim-04-hesaplanan-telefon.png", full_page=True)

    # Gaz değişimi: ölçülen hemoglobin yalnızca istenirse parametreye girer
    page.goto(URL + "#/sim/gaz-degisimi")
    wait_attr(page, "model", "gaz-degisimi")
    page.get_by_test_id("sim-personal").wait_for()
    check(sim(page).get_attribute("data-personal") == "0", "gaz değişimi: ölçülen değer kendiliğinden modele girmez")
    c0 = metric(page, "cao2")
    page.get_by_test_id("sim-personal-toggle").check()
    wait_attr(page, "personal", "1")
    c1 = metric(page, "cao2")
    check(abs(c1 - c0 * 13.9 / 15) < 0.15 and "senin ölçümün" in page.get_by_test_id("param-hb").inner_text(), f"istenince: hemoglobin 13,9 g/dL parametreye girdi, oksijen içeriği {c0:.1f} → {c1:.1f} mL/dL")
    check("senin için ölçüm ya da tahmin değildir" in page.get_by_test_id("sim-personal").inner_text(), "kişisel girdide 'ölçüm ya da tahmin değildir' uyarısı")
    check(page.locator("[data-testid='lab-hemoglobin']").count() == 1, "ilişkili ölçülmüş sonuç (hemoglobin) kaynağıyla listeleniyor")

    # Sonuç ayrıntısı: sekiz soruluk dayanak paneli
    page.goto(URL + "#/sonuc/ferritin")
    panel = page.get_by_test_id("evidence-panel")
    panel.wait_for()
    txt = panel.inner_text()
    check(panel.get_attribute("data-has-data") == "1" and "Doğrudan ölçülen veri" in txt and "19" in txt, "ferritin: ölçülen değer 'Doğrudan ölçülen veri' olarak")
    check(all(page.get_by_test_id(f"evidence-q{i}").count() == 1 for i in range(1, 9)), "dayanak paneli: sekiz sorunun hepsi yanıtlanıyor")
    lv = {e.get_attribute("data-structure"): e.get_attribute("data-level") for e in page.get_by_test_id("evidence-rel").all()}
    check(lv.get("liver") == "established" and lv.get("bones") == "established" and lv.get("small-intestine") == "educational", f"ferritin ilişkileri kanıt düzeyiyle: karaciğer/kemik iliği bilinen, bağırsak eğitimsel ({lv})")
    check("iltihap" in txt and "12 Eyl 2026" in txt, "ferritin: tek başına ne söylemediği ve verinin kaynağı (rapor tarihi) yazıyor")
    check("ölçülmemiş" in page.get_by_test_id("evidence-missing").inner_text() and "CRP" in page.get_by_test_id("evidence-missing").inner_text(), "ferritin: eksik tamamlayıcı testler (CRP…) listeleniyor")
    check(page.get_by_test_id("evidence-sim").count() >= 1, "ferritin → ilgili simülasyona bağlantı (demir dengesi)")
    check(overflow(page) <= 1, f"telefon: sonuç ayrıntısında yatay taşma yok ({overflow(page)})")
    page.screenshot(path=SHOTS / "sim-05-dayanak-telefon.png", full_page=True)
    page.goto(URL + "#/sonuc/crp")
    page.get_by_test_id("evidence-panel").wait_for()
    crp = page.get_by_test_id("evidence-panel")
    check(crp.get_attribute("data-has-data") == "0" and "Veri yetersiz" in crp.inner_text(), "CRP ölçülmemiş: 'Veri yetersiz' (kişisel çıkarım yok)")
    check(all(e.get_attribute("data-level") in ("educational", "insufficient") for e in page.get_by_test_id("evidence-rel").all()) and "organa atanamaz" in crp.inner_text(), "CRP hiçbir organa bilinen ilişkiyle bağlanmaz")

    # ---------------------------------------------------------------- Masaüstü
    page.set_viewport_size({"width": 1366, "height": 860})
    page.goto(URL + "#/sim/asit-baz/met-asidoz")
    wait_attr(page, "scenario", "met-asidoz")
    check(abs(metric(page, "pco2") - 25.6) < 0.6 and metric(page, "ph") > metric(page, "ph0"), "asit-baz: solunumsal telafi Winter formülüne ulaşıyor, pH kısmen düzeliyor")
    nav = page.get_by_role("complementary").get_by_role("navigation", name="Ana gezinme")
    check(nav.locator("a[aria-current=page]").inner_text().strip() == "Simülasyon", "masaüstü: gezinmede 'Simülasyon' etkin")
    page.screenshot(path=SHOTS / "sim-06-asit-baz-masaustu.png", full_page=True)
    nav.get_by_role("link", name="Anatomi Laboratuvarı").click()
    page.get_by_test_id("anatomylab").wait_for()
    check(nav.locator("a[aria-current=page]").inner_text().strip() == "Anatomi Laboratuvarı", "masaüstü: gezinmede 'Anatomi Laboratuvarı' etkin")
    page.screenshot(path=SHOTS / "sim-07-anatomi-lab-masaustu.png")

    csp = page.evaluate("window.__csp")
    check(csp == [], f"CSP ihlali yok {csp}")
    errors = [c for c in console if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors[:3]}")
    check(external == [], f"harici istek yok {external[:3]}")
    browser.close()

print({"problems": problems})
sys.exit(1 if problems else 0)
