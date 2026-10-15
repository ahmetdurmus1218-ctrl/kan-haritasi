"""Uçtan uca: "İÇİNE GİR" HER ORGANDA organın kendi iç dünyasını açar (gerçek Chromium).

Kural: "İçine gir" = organın fiziksel/işlevsel içi (lümen · içerik · akış / parankim · süreç / odacık · kan yolu …).
"Daha derine in" = duvar → doku → hücre → molekül. İçine girildiğinde duvara, dokuya, hücreye ya da moleküle atlanmaz.

Her kabul organı için (§25):
  - #/ic/<organ> açılır → currentLevel === interior, currentNode ∉ {wall, tissue, cell, molecule}
  - kalıba göre içerik: hollow → lümen + içerik + hareket/akış; solid → parankim + bölgeler + süreç;
    vascular → lümen + kan akışı; chamber → odacık + kan akışı; airway → hava + akış; sensory → uyaranın yolu
  - 3B iç sahne çizilir (boş ekran yok), "Eğitimsel · Temsili anatomi" etiketi
  - organ sayfası varsa: organ sayfası → "İçine gir" → yine organın iç dünyası (döngü)
Girişler: 3B vücut paneli, sistem sayfası, arama, Benim vücudum. Ayrıntılı akışlar: kalın bağırsak (lümen → içerik →
hareket → emilim → mikrobiyota → dışkı → rektum, duvar ancak sonra), ince bağırsak (villus ilk ekran değil), mide, kalp,
akciğer, böbrek, karaciğer, beyin, göz, kulak, mesane, damar. Breadcrumb geçilen basamakları gösterir.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra python3 tests/e2e/organs.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots") / "organs"
SHOTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []
NOT_FIRST = {"wall", "tissue", "cell", "molecule"}

# packages/analysis/src/interior/acceptance.ts ile aynı liste
ACCEPTANCE = {
    "sindirim": ["ic.mouth", "ic.tongue", "ic.pharynx", "esophagus", "stomach", "small-intestine", "small-intestine.duodenum", "small-intestine.jejunum", "small-intestine.ileum", "large-intestine", "large-intestine.rectum", "ic.anal-canal", "liver", "gallbladder.bile-ducts", "gallbladder", "pancreas", "ic.pancreatic-ducts"],
    "dolasim": ["heart", "ic.atrium", "ic.ventricle", "heart.valves", "vessel.aorta", "ic.artery", "ic.arteriole", "ic.capillary", "ic.venule", "ic.vein", "ic.pulmonary-vessels"],
    "solunum": ["ic.nose", "ic.nasal-cavity", "ic.larynx", "airways.trachea", "airways.main-bronchi", "airways.bronchioles", "tissue.alveolus", "lungs", "diaphragm"],
    "uriner": ["kidneys", "urinary-tract.renal-pelvis", "urinary-tract.ureter", "urinary-tract.bladder", "urinary-tract.urethra", "tissue.nephron"],
    "sinir": ["brain", "ic.cerebral-cortex", "brain.white-matter", "brain.brainstem", "brain.cerebellum", "spinal-cord", "nerves", "sub.synapse"],
    "endokrin": ["ic.hypothalamus", "pituitary", "ic.pineal", "thyroid", "ic.parathyroid", "adrenals", "pancreas.endocrine", "ic.gonads", "adipose"],
    "ureme": ["uterus", "tissue.endometrium", "tissue.myometrium", "ovaries", "fallopian-tubes", "uterus.cervix", "vagina", "testes", "ic.epididymis", "ic.vas-deferens", "prostate", "ic.breast"],
    "duyu": ["eyes", "eyes.retina", "ear", "ear.canal", "ear.eardrum", "ear.middle", "ear.cochlea", "ear.vestibule"],
    "kas_iskelet": ["ic.bone", "ic.bone-marrow", "ic.joint", "ic.cartilage", "ic.tendon", "ic.ligament", "skeletal-muscle", "cell.skeletal-myocyte"],
    "deri": ["skin", "ic.epidermis", "ic.dermis", "ic.hypodermis", "ic.hair-follicle", "ic.sweat-gland", "ic.sebaceous-gland"],
    "bagisiklik": ["spleen", "ic.thymus", "ic.tonsil", "ic.lymph-node"],
}


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def interior(page):
    el = page.get_by_test_id("interior")
    el.wait_for()
    return el


def state(page):
    el = interior(page)
    return {k: el.get_attribute(f"data-{k}") for k in ["interior", "archetype", "current-level", "current-node"]}


def steps(page):
    return [(b.get_attribute("data-scale"), b.get_attribute("data-kind"), b.inner_text()) for b in page.get_by_test_id("interior-step").all()]


def crumb(page):
    return page.get_by_role("navigation", name="Şu anda neredeyim?").inner_text()


def assert_inside(page, label, expect_id=None):
    """§26: currentLevel === interior; currentNode ∉ {wall, tissue, cell, molecule}; kalıba uygun içerik."""
    s = state(page)
    ok_level = s["current-level"] == "interior" and s["current-node"] not in NOT_FIRST
    check(ok_level, f"{label}: İçine gir → iç dünya (seviye={s['current-level']}, düğüm={s['current-node']})")
    if expect_id:
        check(s["interior"] == expect_id, f"{label}: doğru organın içi ({s['interior']} == {expect_id})")
    inside = [k for sc, k, _ in steps(page) if sc == "interior"]
    kinds = set(inside)
    arch = s["archetype"]
    rule = {
        "hollow": {"lumen", "content"} <= kinds and bool(kinds & {"motion", "flow", "process"}),
        "solid": inside[:1] == ["parenchyma"] and bool(kinds & {"motion", "flow", "process"}),
        "vascular": "lumen" in kinds and bool(kinds & {"flow", "content"}),
        "chamber": "flow" in kinds,
        "airway": bool(kinds & {"content", "lumen"}) and bool(kinds & {"flow", "process"}),
        "sensory": bool(kinds & {"flow", "motion"}),
    }.get(arch, False)
    check(rule and len(inside) >= 2, f"{label}: kalıp '{arch}' içeriği ({inside})")
    return s


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
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
    main = page.locator("main")

    # ------------------------------------------------------------------ tüm kabul organları
    tested, loops = [], []
    for system, ids in ACCEPTANCE.items():
        for oid in ids:
            page.goto(URL + f"#/ic/{oid}")
            label = f"[{system}] {oid}"
            assert_inside(page, label, oid)
            sc = page.get_by_test_id("interior-scene")
            check(sc.get_attribute("data-kind") in {"lumen", "vessel", "chambers", "parenchyma", "pathway"}, f"{label}: 3B iç sahne türü ({sc.get_attribute('data-kind')})")
            check("Eğitimsel" in page.get_by_test_id("interior-label").inner_text(), f"{label}: eğitimsel etiket")
            tested.append(oid)
            # Organ sayfası → İçine gir döngüsü (organ sayfası olan her yapı)
            back = page.get_by_role("button", name="Organ sayfası", exact=True)
            if back.count():
                back.click()
                btn = page.get_by_test_id("organ-enter-interior")
                btn.wait_for()
                organ_url = page.url
                btn.click()
                s = assert_inside(page, f"{label} (organ sayfası → İçine gir)")
                loops.append((organ_url.split("#")[-1], s["interior"]))
    check(len(tested) == sum(len(v) for v in ACCEPTANCE.values()), f"kabul listesindeki {len(tested)} yapının hepsi test edildi")
    print("organ sayfası → İçine gir döngüsü:", json.dumps(loops, ensure_ascii=False))

    # Canvas gerçekten çiziliyor (temsilî örneklem: her kalıptan)
    for oid in ["large-intestine", "kidneys", "heart", "ic.artery", "lungs", "eyes", "spleen"]:
        page.goto(URL + f"#/ic/{oid}")
        page.get_by_test_id("interior-scene").locator("canvas").wait_for(timeout=90000)
        check(True, f"{oid}: 3B iç sahne çizildi (canvas)")

    # ------------------------------------------------------------------ kalın bağırsak: zorunlu referans
    page.goto(URL + "#/vucudum")
    page.get_by_role("button", name="Sindirim", exact=True).click()
    page.get_by_role("heading", name="Sindirim sistemi").wait_for()
    page.get_by_role("button", name="Kalın bağırsak", exact=False).first.click()
    page.get_by_role("heading", name="Kalın bağırsak", exact=True).wait_for()
    page.get_by_test_id("organ-enter-interior").click()
    page.wait_for_url("**/#/ic/large-intestine**")
    s = assert_inside(page, "Vücut → Sindirim → Kalın bağırsak → İçine gir", "large-intestine")
    check(s["current-node"] == "lumen" and "Kalın bağırsağın içi" in page.get_by_test_id("interior-stage").inner_text(), "kalın bağırsak: ilk sahne lümen (duvar/mukoza/kript/epitel değil)")
    check(page.get_by_test_id("interior-scene").get_attribute("data-focus") == "lumen", "kalın bağırsak: 3B sahnede duvara zoom yok, lümen odağı")
    page.get_by_test_id("interior-scene").locator("canvas").wait_for(timeout=90000)
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "01-kalin-bagirsak-lumen.png")
    contents = page.get_by_test_id("interior").inner_text()
    check(all(x in contents for x in ["su", "elektrolit", "sindirim artıkları", "mukus", "mikrobiyota"]), "kalın bağırsak: içerik — su, elektrolitler, sindirim artıkları, mukus, mikrobiyota (eğitimsel temsili)")
    seen, scales = [], []
    for _ in range(12):
        st = page.get_by_test_id("interior-stage")
        seen.append(st.get_attribute("data-stage"))
        scales.append(st.get_attribute("data-scale"))
        nxt = page.get_by_test_id("interior-next-stage")
        if not nxt.count():
            break
        if nxt.get_attribute("data-crossing") == "deeper":
            check(nxt.inner_text().startswith("Daha derine in"), f"kalın bağırsak: iç dünyadan çıkış 'Daha derine in' olarak işaretli ({nxt.inner_text()!r})")
            c = crumb(page)
            check(all(x in c for x in ["Vücut", "Sindirim", "Kalın bağırsak", "İçerisi", "İçerik", "Hareket", "Su ve elektrolit geri emilimi", "Dışkı → rektum"]), f"breadcrumb geçilen basamakları gösteriyor ({c!r})")
        nxt.click()
        page.wait_for_timeout(120)
    check(seen[:7] == ["lumen", "contents", "motion", "water", "microbiota", "concentration", "feces"], f"kalın bağırsak: lümen → içerik → hareket → su/elektrolit → mikrobiyota → yoğunlaşma/dışkı → rektum ({seen[:7]})")
    wall = seen.index("wall")
    check(all(s == "interior" for s in scales[:7]) and wall > 6 and scales[wall] != "interior", f"kalın bağırsak: duvar ancak iç dünyadan SONRA ({scales})")
    check(seen[wall:wall + 2] == ["wall", "mucosa"], f"duvar → mukoza (kript) → hücre ({seen[wall:]})")
    c = crumb(page)
    check("İçerisi" in c and "Duvarı incele" in c, f"breadcrumb: içeride mi duvarda mı belli ({c!r})")
    page.screenshot(path=SHOTS / "02-kalin-bagirsak-derin.png", full_page=True)
    page.goto(URL + "#/ic/large-intestine/7")
    page.get_by_test_id("interior-next").get_by_role("button", name=re.compile("Rektuma git")).click()
    page.wait_for_url("**/#/ic/large-intestine.rectum**")
    assert_inside(page, "dışkı → rektuma ilerleme", "large-intestine.rectum")

    # ------------------------------------------------------------------ ince bağırsak, mide, özofagus
    page.goto(URL + "#/ic/small-intestine")
    kinds = [k for _, k, _ in steps(page)]
    titles = [t for _, _, t in steps(page)]
    check(kinds[0] == "lumen" and titles.index("Villus") > kinds.index("wall"), f"ince bağırsak: villus ilk ekran değil, duvardan sonra ({titles})")
    page.goto(URL + "#/ic/stomach")
    titles = [t for _, _, t in steps(page)]
    check(titles[:7] == ["Midenin içi", "İçerik: yemek", "Mekanik karıştırma", "Asit", "Pepsin", "İç faktör ve B12", "Kimus → duodenum"], f"mide: lümen → içerik → karıştırma → asit → pepsin → kimus → pilor ({titles[:7]})")
    page.goto(URL + "#/ic/esophagus")
    titles = [t for _, _, t in steps(page)]
    check(titles[:4] == ["Yemek borusunun içi", "İçerik: lokma", "Peristaltizm", "Alt sfinkter ve mideye geçiş"], f"özofagus: lümen → lokma → peristaltik dalga → mideye ({titles[:4]})")

    # ------------------------------------------------------------------ kalp: kanın yolu
    page.goto(URL + "#/ic/heart")
    s = assert_inside(page, "kalp", "heart")
    titles = [t for sc, _, t in steps(page) if sc == "interior"]
    check(titles == ["Kalbin içi: dört odacık", "Sağ atriyum", "Triküspit kapak", "Sağ ventrikül", "Pulmoner kapak", "Akciğer", "Sol atriyum", "Mitral kapak", "Sol ventrikül", "Aort", "Sistemik dolaşım"], f"kalp: sağ atriyum → … → aort → sistemik dolaşım ({titles})")
    check(s["archetype"] == "chamber", "kalp: pompa/odacık kalıbı (lümen değil)")
    page.goto(URL + "#/ic/heart/4")
    check(page.get_by_test_id("interior-scene").get_attribute("data-focus") == "path:2", "kalp: sağ ventrikül adımında kan yolu animasyonu odağı")
    page.get_by_test_id("interior-scene").locator("canvas").wait_for(timeout=90000)
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "03-kalp-kan-yolu.png")

    # ------------------------------------------------------------------ akciğer, böbrek, karaciğer, beyin, göz, kulak, mesane, damar
    expect = {
        "lungs": ["Hava", "Trakea", "Bronş", "Bronşiyol", "Alveol", "Alveol–kılcal damar: gaz değişimi"],
        "kidneys": ["Böbreğin içi: parankim", "Kan akışı", "Filtrasyon", "Geri emilim", "Salgılama", "İdrar"],
        "liver": ["Karaciğerin içi: parankim", "Çift kanlanma"],
        "brain": ["Beynin içi: gri ve beyaz cevher"],
        "eyes": ["Işık", "Kornea", "Ön kamara", "Lens", "Vitreus", "Retina", "Fotoreseptör", "Bipolar hücre", "Gangliyon hücresi"],
        "ear": ["Dış kulak", "Kulak yolu", "Timpanik membran", "Malleus", "İnkus", "Stapes", "Koklea", "Baziler membran", "Corti organı"],
        "urinary-tract.bladder": ["Mesanenin içi", "İçerik: idrar", "Dolma", "Boşaltma (işeme)"],
        "ic.artery": ["Damarın içi: lümen", "Kan akışı", "Kan hücreleri"],
    }
    arch = {"lungs": "airway", "kidneys": "solid", "liver": "solid", "brain": "solid", "eyes": "sensory", "ear": "sensory", "urinary-tract.bladder": "hollow", "ic.artery": "vascular"}
    for oid, first in expect.items():
        page.goto(URL + f"#/ic/{oid}")
        s = assert_inside(page, oid, oid)
        titles = [t for _, _, t in steps(page)]
        check(titles[: len(first)] == first and s["archetype"] == arch[oid], f"{oid}: {' → '.join(first)} · {arch[oid]} ({titles[:len(first)]}, {s['archetype']})")
        if arch[oid] == "solid":
            check(page.get_by_test_id("interior-no-lumen").count() == 1, f"{oid}: sahte lümen yok")

    # ------------------------------------------------------------------ 3B vücut paneli → İçine gir (doku sahnesi değil)
    for structure, expect_id in [("large-intestine", "large-intestine"), ("kidneys", "kidneys"), ("heart", "heart"), ("spleen", "spleen"), ("thymus", "ic.thymus")]:
        page.goto(URL + f"#/vucut/yapi/{structure}")
        panel = page.locator("aside[aria-label='Bilgi paneli']")
        btn = panel.get_by_role("button", name=re.compile("^İçine gir"))
        btn.first.wait_for(timeout=90000)
        check(panel.get_by_role("button", name=re.compile("^İçeri gir")).count() == 0, f"3B panel {structure}: belirsiz 'İçeri gir' yok; doku sahnesi 'Daha derine in' altında")
        btn.first.click()
        page.wait_for_url(f"**/#/ic/{expect_id}**")
        assert_inside(page, f"3B vücut → {structure} → İçine gir", expect_id)

    # ------------------------------------------------------------------ arama → İçine gir
    page.goto(URL + "#/vucudum")
    page.keyboard.press("Control+k")
    page.get_by_role("searchbox").or_(page.locator("dialog[open] input")).first.fill("kalın bağırsak")
    dlg = page.locator("dialog[open]")
    dlg.get_by_role("button", name="İçine gir").first.click()
    page.wait_for_url("**/#/ic/large-intestine**")
    assert_inside(page, "arama → kalın bağırsak → İçine gir", "large-intestine")

    # ------------------------------------------------------------------ Benim vücudum → İçine gir
    page.goto(URL + "#/vucudum")
    page.get_by_test_id("mybody-layers").wait_for()
    page.locator("[data-testid=layer-row][data-organ=kidneys]").get_by_role("button", name=re.compile("İçine gir")).click()
    page.wait_for_url("**/#/ic/kidneys**")
    assert_inside(page, "Benim vücudum → böbrek → İçine gir", "kidneys")

    # ------------------------------------------------------------------ telefon genişliği
    page.set_viewport_size({"width": 390, "height": 844})
    for oid in ["large-intestine", "heart", "kidneys"]:
        page.goto(URL + f"#/ic/{oid}")
        interior(page)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check(overflow <= 1, f"telefon: {oid} iç dünya ekranında yatay taşma yok ({overflow}px)")
    page.screenshot(path=SHOTS / "04-telefon-bobrek.png", full_page=True)

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    browser.close()

print(json.dumps({"tested": len(tested), "problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
