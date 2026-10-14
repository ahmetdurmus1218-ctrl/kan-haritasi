"""Uçtan uca: "İÇİNE GİR" — genel anatomi grafiğinde derinlik, komşuluk ve kişisel veri ayrımı (gerçek Chromium).

  - Pelvis (vücut bölgesi) → üyeler (yumurtalık, rahim, mesane, rektum …) → yumurtalık → korteks → foliküller → oosit
  - Yumurtalık bağırsağın PARÇASI değil: bağırsağın iç dallarında yok, ama "Yanında ne var?" içinde sigmoid kolon var
  - Kulak → orta kulak → kulak zarı → kemikçikler; koklea → Corti organı → iç tüy hücreleri → stereosilya → mekanik dönüşüm
  - Böbrek → korteks → nefron → glomerül → podosit → süzme yarığı; kalp → kalp kası → hücre → sarkomer
  - Kişisel veri yokken "Bende ne görülmüş?" açıkça "yok" der; genel anatomi ve kişisel veri etiketleri ayrı
  - Model deposu: devre dışı bırak / etkinleştir; isteğe bağlı paketler; eklenemeyen modeller envanteri
  + Ağ isteği yok, CSP ihlali yok, konsol hatası yok.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra python3 tests/e2e/inside.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def deep(page, organ, *trail):
    page.goto(URL + f"#/organ/{organ}/derin" + "".join(f"/{t}" for t in trail))
    page.get_by_test_id("deep-dive").wait_for()
    return page.get_by_test_id("deep-dive")


def children(page):
    return [c.get_attribute("data-node") for c in page.get_by_test_id("deep-child").all()]


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
    ctx.set_default_timeout(30000)
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

    # ------------------------------------------------------------ Pelvis → yumurtalık → hücre
    d = deep(page, "region:pelvis")
    members = page.get_by_test_id("region-members").inner_text()
    check(all(x in members for x in ["Yumurtalıklar", "Rahim", "Mesane", "Rektum", "Sigmoid"]), "pelvis: bölgedeki organlar (komşu, iç içe değil)")
    check("birbirlerinin parçası değildir" in members, "pelvis: 'komşudur, parça değildir' açıklaması")
    page.get_by_test_id("region-members").get_by_role("button", name="Yumurtalıklar").click()
    page.wait_for_url("**/#/organ/ovaries**")
    d = deep(page, "ovaries")
    check("ovary.cortex" in children(page) and "ovary.medulla" in children(page), "yumurtalık → korteks ve medulla")
    nb = page.get_by_test_id("deep-neighbors").inner_text()
    check("Rahim" in nb and "İç iliak" in nb, "yumurtalık: yanında rahim ve pelvis damarları (komşuluk)")
    check(d.get_by_text("Pelvis", exact=False).count() >= 1, "yumurtalık: bölge etiketi Pelvis")
    supply = page.get_by_test_id("deep-supply").inner_text()
    check("Yumurtalık arteri" in supply and "Gonad sırtı" in supply, "yumurtalık: kanlanma ve gelişim kökeni")
    page.get_by_test_id("deep-child").filter(has_text="Yumurtalık korteksi").get_by_role("button").click()
    deep(page, "ovaries", "ovary.cortex", "tissue.ovarian-follicles")
    kids = children(page)
    check(all(f"ovary.follicle-{k}" in kids for k in ["primordial", "primary", "secondary", "antral"]), "foliküller → primordiyal, primer, sekonder, antral")
    deep(page, "ovaries", "ovary.cortex", "tissue.ovarian-follicles", "ovary.follicle-antral")
    kids = children(page)
    check(all(x in kids for x in ["cell.oocyte", "cell.granulosa", "cell.theca"]) and "proc.ovulation" in kids, "antral folikül → oosit, granüloza, teka; yumurtlama")
    deep(page, "ovaries", "ovary.cortex", "tissue.ovarian-follicles", "ovary.follicle-antral", "cell.granulosa")
    check("mol.estradiol" in children(page), "granüloza → östradiol üretir")
    check("Döngü" in page.locator("main").inner_text() or "döngü" in page.locator("main").inner_text(), "granüloza: fizyoloji (döngü) zinciri görünür")
    page.screenshot(path=SHOTS / "i1-yumurtalik-granuloza.png", full_page=True)

    # Sigmoid → komşu yumurtalık; bağırsağın içinde yumurtalık yok
    deep(page, "large-intestine", "large-intestine.sigmoid")
    nbs = [x.get_attribute("data-node") for x in page.get_by_test_id("neighbor-link").all()]
    check("ovaries.left" in nbs, "sigmoid kolon → komşu: sol yumurtalık (bağırsaktan yumurtalığa geçiş)")
    deep(page, "large-intestine")
    check(not any((c or "").startswith("ovar") for c in children(page)), "kalın bağırsağın iç dallarında yumurtalık YOK")
    check("tissue.colon-wall" in children(page) and "tissue.villus" not in children(page), "kalın bağırsak duvarı (villus yok)")

    # ------------------------------------------------------------ Kulak
    deep(page, "ear")
    check(all(x in children(page) for x in ["ear.outer", "ear.middle", "ear.inner"]), "kulak → dış, orta, iç kulak")
    deep(page, "ear", "ear.middle")
    check(all(x in children(page) for x in ["ear.eardrum", "ear.ossicles", "ear.eustachian"]), "orta kulak → kulak zarı, kemikçikler, Östaki borusu")
    deep(page, "ear", "ear.middle", "ear.eardrum")
    nbs = [x.get_attribute("data-node") for x in page.get_by_test_id("neighbor-link").all()]
    check("ear.canal" in nbs and "ear.malleus" in nbs, "kulak zarı → bağlantı: kulak yolu ve çekiç kemiği")
    deep(page, "ear", "ear.middle", "ear.ossicles")
    check(all(x in children(page) for x in ["ear.malleus", "ear.incus", "ear.stapes"]), "kemikçikler → çekiç, örs, üzengi")
    deep(page, "ear", "ear.inner", "ear.cochlea", "tissue.organ-of-corti", "cell.inner-hair", "sub.stereocilia")
    check("sub.mechanotransduction-channel" in children(page), "koklea → Corti → iç tüy hücresi → stereosilya → mekanik kanallar")
    page.screenshot(path=SHOTS / "i2-kulak-stereosilya.png", full_page=True)

    # ------------------------------------------------------------ Böbrek, kalp
    deep(page, "kidneys", "kidneys.cortex", "tissue.nephron")
    check(all(x in children(page) for x in ["tissue.glomerulus", "tissue.proximal-tubule", "tissue.loop-of-henle", "tissue.distal-tubule", "tissue.collecting-duct"]), "nefron → glomerül, tübüller, Henle, toplayıcı kanal")
    deep(page, "kidneys", "kidneys.cortex", "tissue.nephron", "tissue.glomerulus", "cell.podocyte")
    check("sub.slit-diaphragm" in children(page) and "proc.glomerular-filtration" in children(page), "podosit → süzme yarığı, süzme")
    deep(page, "heart", "tissue.myocardium", "cell.cardiomyocyte")
    check("sub.sarcomere" in children(page), "kalp kası hücresi → sarkomer")
    personal = page.get_by_test_id("deep-personal").inner_text()
    check("KİŞİSEL VERİ" in personal and page.get_by_test_id("deep-personal-none").count() == 1, "kişisel veri yok: açıkça 'yok' yazar; genel anatomi ayrı")
    check(page.locator("text=GENEL ANATOMİ").count() >= 1, "genel anatomi etiketi")

    # ------------------------------------------------------------ Model deposu
    page.goto(URL + "#/gizlilik")
    page.get_by_test_id("model-card").first.wait_for()
    card = page.locator("[data-testid=model-card][data-model=xrv-densenet121-nih]")
    check("Bellek" in card.inner_text() and "WASM" in card.inner_text(), "model kartı: bellek, disk, çalışma ortamı")
    card.get_by_test_id("model-toggle").click()
    page.locator("[data-testid=model-card][data-model=xrv-densenet121-nih][data-enabled=false]").wait_for()
    check(True, "model devre dışı bırakıldı")
    caps = page.locator("details", has_text="Bu cihazda neler yapılabiliyor?")
    caps.locator("summary").click()
    check(caps.inner_text().count("Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.") == 10, "devre dışı röntgen modeli: röntgen artık 'model yok'")
    page.locator("[data-testid=model-card][data-model=xrv-densenet121-nih]").get_by_test_id("model-toggle").click()
    page.locator("[data-testid=model-card][data-model=xrv-densenet121-nih][data-enabled=true]").wait_for()
    check(True, "model yeniden etkinleştirildi")
    inv = page.get_by_test_id("model-inventory")
    inv.locator("summary").click()
    it = inv.inner_text()
    check(page.get_by_test_id("inventory-entry").count() >= 10 and "Mamografi" in it and "Patoloji" in it and "Eklenemedi" in it, "eklenemeyen modeller ve nedenleri listelenir")
    packs = page.get_by_test_id("model-packs")
    if packs.count():
        packs.locator("summary").click()
        check(page.get_by_test_id("model-pack").count() >= 1 and "SHA-256" in packs.inner_text(), "isteğe bağlı paketler: kurulu değil, SHA-256 ve klasör")
    page.screenshot(path=SHOTS / "i3-model-deposu.png", full_page=True)

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    browser.close()

print(json.dumps({"problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
