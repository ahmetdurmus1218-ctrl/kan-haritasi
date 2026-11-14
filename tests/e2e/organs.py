"""Uçtan uca: "İÇİNE GİR" HER ORGANDA organın kendi iç dünyasını açar (gerçek Chromium).

Kural: "İçine gir" = organın fiziksel/işlevsel içi (lümen · içerik · akış / parankim · süreç / odacık · kan yolu …).
"Daha derine in" = duvar → doku → hücre → molekül. İçine girildiğinde duvara, dokuya, hücreye ya da moleküle atlanmaz.

Her kabul organı için (§25):
  - #/ic/<organ> 3B keşifte açılır (aynı tuval ve kamera) → currentLevel === interior, currentNode ∉ {wall, tissue, cell, molecule}
  - kalıba göre içerik: hollow → lümen + içerik + hareket/akış; solid → parankim + bölgeler + süreç;
    vascular → lümen + kan akışı; chamber → odacık + kan akışı; airway → hava + akış; sensory → uyaranın yolu
  - 3B iç görünüm çizilir (boş ekran yok): gerçek modeli olan organda kesit (data-section), olmayanda temsili iç sahne;
    "Eğitimsel · Temsili anatomi" etiketi
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

from nav3d import action, attrs, goto_interior, settle

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
    print(("PASS " if cond else "FAIL ") + msg, flush=True)
    if not cond:
        problems.append(msg)


def norm(t):
    return t.replace("İ", "I").replace("ı", "i").replace("i̇", "i").lower()


def title(page):
    return page.get_by_test_id("level-title").inner_text()


def crumb(page):
    return page.get_by_role("navigation", name="Keşif seviyesi").inner_text()


def assert_inside(page, a, label, expect_id=None):
    """§26: currentLevel === interior; currentNode ∉ {wall, tissue, cell, molecule}; 3B iç sahne; eğitimsel etiket."""
    ok_level = a.get("currentLevel") == "interior" and a.get("currentNode") not in NOT_FIRST and a.get("level") == "interior"
    check(ok_level, f"{label}: İçine gir → iç dünya (seviye={a.get('currentLevel')}, düğüm={a.get('currentNode')})")
    if expect_id:
        check(a.get("interior") == expect_id, f"{label}: doğru organın içi ({a.get('interior')} == {expect_id})")
    # Gerçek 3B modeli olan organ: vücut sahnesinde kesitle açılır (data-section); modeli olmayan (mikroskobik) yapı:
    # temsili iç sahne (ic:…).
    in_section = a.get("scene") == "body" and bool(a.get("section"))
    check((in_section or a.get("scene", "").startswith("ic:")) and a.get("sceneKind") in {"lumen", "vessel", "chambers", "parenchyma", "pathway"}, f"{label}: 3B iç görünüm — {'gerçek modelin kesiti' if in_section else 'iç sahne'} ({a.get('scene')}, {a.get('section')}, {a.get('sceneKind')})")
    check(len(a.get("actions", [])) <= 5 and any(x.startswith("back:") for x in a["actions"]), f"{label}: yalnızca bu seviyenin eylemleri ({len(a['actions'])})")
    return a


def walk_titles(page, n):
    out = [title(page)]
    for _ in range(n - 1):
        if not page.locator("[data-testid=level-action][data-action=forward]").count():
            break
        action(page, "forward")
        out.append(title(page))
    return out


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    # 117 yapının durum denetimi (seviye, sahne, eylemler) animasyon gerektirmez: "hareketi azalt" ile geçişler
    # kısalır (uygulamanın erişilebilirlik kipi). Tam kamera animasyonları navigation3d.py'de denetlenir.
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1, reduced_motion="reduce")
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

    # ------------------------------------------------------------------ tüm kabul organları
    tested = []
    for system, ids in ACCEPTANCE.items():
        for oid in ids:
            a = goto_interior(page, URL, oid)
            assert_inside(page, a, f"[{system}] {oid}", oid)
            check("Eğitimsel" in page.get_by_test_id("interior-label").inner_text(), f"[{system}] {oid}: eğitimsel etiket")
            tested.append(oid)
    check(len(tested) == sum(len(v) for v in ACCEPTANCE.values()), f"kabul listesindeki {len(tested)} yapının hepsi test edildi")

    # Organ sayfası → İçine gir → yine organın iç dünyası (döngü), her kalıptan
    loops = []
    for organ, expect_id in [("large-intestine", "large-intestine"), ("kidneys", "kidneys"), ("heart", "heart"), ("lungs", "lungs"), ("eyes", "eyes"), ("spleen", "spleen")]:
        page.goto(URL + f"#/organ/{organ}")
        btn = page.get_by_test_id("organ-enter-interior")
        btn.wait_for()
        btn.click()
        page.wait_for_url(f"**/#/ic/{expect_id}**")
        a, _ = settle(page, 120, want={"interior": expect_id})
        if not a.get("scene", "").startswith("ic:"):
            a, _ = settle(page, 120, before=a)
        assert_inside(page, a, f"organ sayfası {organ} → İçine gir", expect_id)
        loops.append(organ)
    print("organ sayfası → İçine gir döngüsü:", json.dumps(loops, ensure_ascii=False))

    # ------------------------------------------------------------------ kalın bağırsak: zorunlu referans
    page.goto(URL + "#/vucudum")
    page.get_by_role("button", name="Sindirim", exact=True).click()
    page.get_by_role("heading", name="Sindirim sistemi").wait_for()
    page.get_by_role("button", name="Kalın bağırsak", exact=False).first.click()
    page.get_by_role("heading", name="Kalın bağırsak", exact=True).wait_for()
    page.get_by_test_id("organ-enter-interior").click()
    page.wait_for_url("**/#/ic/large-intestine**")
    a, _ = settle(page, 120, want={"interior": "large-intestine"})
    if not a.get("scene", "").startswith("ic:"):
        a, _ = settle(page, 120, before=a)
    assert_inside(page, a, "Vücut → Sindirim → Kalın bağırsak → İçine gir", "large-intestine")
    check(a.get("stage") == "lumen" and "Kalın bağırsağın içi" in title(page), "kalın bağırsak: ilk sahne lümen (duvar/mukoza/kript/epitel değil)")
    check(a.get("focus") == "lumen", "kalın bağırsak: 3B sahnede duvara zoom yok, lümen odağı")
    page.screenshot(path=SHOTS / "01-kalin-bagirsak-lumen.png")
    seen = [a.get("stage")]
    for _ in range(6):
        seen.append(action(page, "forward").get("stage"))
    check(seen == ["lumen", "contents", "motion", "water", "microbiota", "concentration", "feces"], f"kalın bağırsak: lümen → içerik → hareket → su/elektrolit → mikrobiyota → yoğunlaşma/dışkı ({seen})")
    c = crumb(page)
    check(all(norm(x) in norm(c) for x in ["Sindirim", "Kalın bağırsak", "İçerisi", "İçerik", "Hareket", "Su ve elektrolit geri emilimi", "Dışkı → rektum"]), f"breadcrumb geçilen basamakları gösteriyor ({c!r})")
    a = attrs(page)
    check(not any(x.startswith(("deeper:", "forward:")) and ("Mukoza" in x or "Hücre" in x) for x in a["actions"]), "kalın bağırsak: içeride duvar/hücreye 'İlerle' yok — ayrı 'Duvarı incele' eylemi")
    a = action(page, "wall")
    check(a.get("stage") == "wall" and a.get("level") == "wall" and a.get("currentLevel") != "interior", f"kalın bağırsak: duvar ancak iç dünyadan SONRA ve ayrı seviye ({a.get('stage')}, {a.get('level')})")
    a = action(page, "deeper")
    check(a.get("stage") == "mucosa", f"duvar → mukoza ({a.get('stage')})")
    c = crumb(page)
    check(all(norm(x) in norm(c) for x in ["İçerisi", "Duvar"]), f"breadcrumb: içeride mi duvarda mı belli ({c!r})")
    page.screenshot(path=SHOTS / "02-kalin-bagirsak-derin.png")
    a = goto_interior(page, URL, "large-intestine", 7)
    page.locator("[data-testid=level-action][data-action=goto]", has_text="Rektuma git").click()
    page.wait_for_url("**/#/ic/large-intestine.rectum**")
    a, _ = settle(page, 60, want={"interior": "large-intestine.rectum"})
    assert_inside(page, a, "dışkı → rektuma ilerleme", "large-intestine.rectum")

    # ------------------------------------------------------------------ ince bağırsak, mide, özofagus
    goto_interior(page, URL, "small-intestine")
    t = walk_titles(page, 6)
    check(t[0].startswith("Lümen") and not any("Villus" in x for x in t), f"ince bağırsak: villus ilk ekran değil, iç dünyada yok ({t})")
    goto_interior(page, URL, "stomach")
    t = walk_titles(page, 7)
    check(t == ["Midenin içi", "İçerik: yemek", "Mekanik karıştırma", "Asit", "Pepsin", "İç faktör ve B12", "Kimus → duodenum"], f"mide: lümen → içerik → karıştırma → asit → pepsin → kimus → pilor ({t})")
    goto_interior(page, URL, "esophagus")
    t = walk_titles(page, 4)
    check(t == ["Yemek borusunun içi", "İçerik: lokma", "Peristaltizm", "Alt sfinkter ve mideye geçiş"], f"özofagus: lümen → lokma → peristaltik dalga → mideye ({t})")

    # ------------------------------------------------------------------ kalp: kanın yolu
    a = goto_interior(page, URL, "heart")
    assert_inside(page, a, "kalp", "heart")
    check(a.get("archetype") == "chamber" and a.get("sceneKind") == "chambers", "kalp: pompa/odacık kalıbı (lümen değil)")
    t = walk_titles(page, 11)
    check(t == ["Kalbin içi: dört odacık", "Sağ atriyum", "Triküspit kapak", "Sağ ventrikül", "Pulmoner kapak", "Akciğer", "Sol atriyum", "Mitral kapak", "Sol ventrikül", "Aort", "Sistemik dolaşım"], f"kalp: sağ atriyum → … → aort → sistemik dolaşım ({t})")
    a = goto_interior(page, URL, "heart", 4)
    check(a.get("focus") == "path:2", "kalp: sağ ventrikül adımında kan yolu animasyonu odağı")
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
        a = goto_interior(page, URL, oid)
        assert_inside(page, a, oid, oid)
        t = walk_titles(page, len(first))
        check(t == first and a.get("archetype") == arch[oid], f"{oid}: {' → '.join(first)} · {arch[oid]} ({t}, {a.get('archetype')})")
        if arch[oid] == "solid":
            check(a.get("sceneKind") == "parenchyma", f"{oid}: sahte lümen yok (parankim)")

    # ------------------------------------------------------------------ 3B vücut paneli → İçine gir (doku sahnesi değil)
    for structure, expect_id in [("large-intestine", "large-intestine"), ("kidneys", "kidneys"), ("heart", "heart"), ("spleen", "spleen"), ("thymus", "ic.thymus")]:
        before = attrs(page)
        page.goto(URL + f"#/vucut/yapi/{structure}")
        settle(page, 120, before=before, want={"level": "organ"})
        panel = page.locator("aside[aria-label='Bilgi paneli']")
        btn = panel.get_by_role("button", name=re.compile("^İçine gir"))
        btn.first.wait_for(timeout=90000)
        check(panel.get_by_role("button", name=re.compile("^İçeri gir")).count() == 0, f"3B panel {structure}: belirsiz 'İçeri gir' yok; doku sahnesi 'Daha derine in' altında")
        btn.first.click()
        page.wait_for_url(f"**/#/ic/{expect_id}**")
        a, _ = settle(page, 60, want={"interior": expect_id})
        if not a.get("scene", "").startswith("ic:"):
            a, _ = settle(page, 60, before=a)
        assert_inside(page, a, f"3B vücut → {structure} → İçine gir", expect_id)

    # ------------------------------------------------------------------ arama → İçine gir
    page.goto(URL + "#/vucudum")
    page.keyboard.press("Control+k")
    page.get_by_role("searchbox").or_(page.locator("dialog[open] input")).first.fill("kalın bağırsak")
    dlg = page.locator("dialog[open]")
    dlg.get_by_role("button", name="İçine gir").first.click()
    page.wait_for_url("**/#/ic/large-intestine**")
    a, _ = settle(page, 120, want={"interior": "large-intestine"})
    if not a.get("scene", "").startswith("ic:"):
        a, _ = settle(page, 120, before=a)
    assert_inside(page, a, "arama → kalın bağırsak → İçine gir", "large-intestine")

    # ------------------------------------------------------------------ Benim vücudum → İçine gir
    page.goto(URL + "#/vucudum")
    page.get_by_test_id("mybody-layers").wait_for()
    page.locator("[data-testid=layer-row][data-organ=kidneys]").get_by_role("button", name=re.compile("İçine gir")).click()
    page.wait_for_url("**/#/ic/kidneys**")
    a, _ = settle(page, 120, want={"interior": "kidneys"})
    if not a.get("scene", "").startswith("ic:"):
        a, _ = settle(page, 120, before=a)
    assert_inside(page, a, "Benim vücudum → böbrek → İçine gir", "kidneys")

    # ------------------------------------------------------------------ telefon genişliği
    page.set_viewport_size({"width": 390, "height": 844})
    for oid in ["large-intestine", "heart", "kidneys"]:
        goto_interior(page, URL, oid)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check(overflow <= 1, f"telefon: {oid} iç dünya ekranında yatay taşma yok ({overflow}px)")
    page.screenshot(path=SHOTS / "04-telefon-bobrek.png")

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    browser.close()

print(json.dumps({"tested": len(tested), "problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
