"""Uçtan uca: "İÇİNE GİR" motoru ve kişisel veri → fizyoloji (gerçek Chromium).

Kabul testleri:
  49  Bağırsak: Vücudum → Sindirim → İnce bağırsak → (normal anatomi) → İçine gir → lümen → içerik/hareket →
      sindirim → emilim → duvar → mukoza → villus → enterosit → mikrovillus → moleküler taşıma; içerik modları,
      bölge seçimi (ileum), duvar katmanları, 3B iç sahne; kalın bağırsakta villus yok; karaciğerde lümen yok.
  50  Kişisel veri: B12 (düşük → normal, iki gerçek tarih) → sonuç kartı → "Vücutta" → B12 zinciri (mide → iç faktör →
      ileum → kan → kemik iliği / sinir) → "Bunun devamı nerede?" ileuma götürür; zaman seçici yalnızca gerçek tarihler.
  52  Model yok: modeli olmayan modalitede "model yok" yazar; normal fizyoloji ve eğitimsel iç dünya yine çalışır.
  + Benim vücudum katmanları, fizyoloji zincirleri, telefon genişliği, ağ isteği / CSP / konsol hatası yok.
(51 — gerçek BT → gerçek maske → 3B → organ → içine gir — tests/e2e/realmodels.py içindedir.)

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra python3 tests/e2e/interior.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from nav3d import action, attrs, goto_interior, settle

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
REPORTS = ROOT / "fixtures/reports"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def norm(t):
    return t.replace("İ", "I").replace("ı", "i").replace("i̇", "i").lower()


def upload(page, name):
    page.goto(URL + "#/belgeler")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    page.set_input_files("input[type=file][multiple]", [str(REPORTS / name)])
    page.get_by_role("button", name="Aç ve oku").wait_for(timeout=30000)
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=180000)
    page.wait_for_timeout(500)
    sex = page.locator("select:has(option[value='female'])")
    if sex.count():
        sex.first.select_option("female")
        page.wait_for_timeout(200)
    page.locator("button:has-text('Onayla ve kaydet')").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=20000)


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

    # ------------------------------------------------------------------ 49: bağırsak
    page.goto(URL + "#/vucudum")
    page.get_by_role("button", name="Sindirim", exact=True).click()
    page.get_by_role("heading", name="Sindirim sistemi").wait_for()
    page.get_by_role("button", name="İnce bağırsak", exact=False).first.click()
    page.get_by_role("heading", name="İnce bağırsak", exact=True).wait_for()
    check("Normalde ne işe yarar?" in main.inner_text(), "49: önce normal bağırsak anatomisi ve işlevi")
    check("Bileşik yapı" in page.get_by_test_id("organ-interior-type").inner_text(), "49: yapı türü gösteriliyor")
    check(page.get_by_test_id("organ-changes-none").count() == 1, "39: kişisel veri yokken 'Bu organla ilişkili kişisel veri bulunamadı'")
    page.get_by_test_id("organ-enter-interior").click()
    page.wait_for_url("**/#/ic/small-intestine**")
    # İçine gir 3B keşifte açılır: önce organ 3B vücutta, sonra kamera organa dalar (aynı tuval, aynı kamera)
    a, phases = settle(page, 120, want={"interior": "small-intestine"})
    if not a.get("scene", "").startswith("ic:") and not a.get("section"):
        a, phases2 = settle(page, 120, before=a)
        phases |= phases2
    # İçine gir'in ilk adımı: organın gerçek 3B modeli kesitle açılır (prosedürel iç sahne değil)
    check(a.get("section") == "small-intestine" and a.get("scene") == "body" and a.get("sceneKind") == "lumen", f"49: İçine gir → gerçek modelin kesit görünümü ({a.get('scene')}, kesit {a.get('section')}, {a.get('sceneKind')})")
    check(a.get("level") == "interior" and a.get("stage") == "lumen", "49: İçine gir → organın içi (duvar/hücre değil)")
    check("Eğitimsel" in page.get_by_test_id("interior-label").inner_text(), "35: eğitimsel etiket (Eğitimsel · Temsili anatomi)")
    page.screenshot(path=SHOTS / "ic1-ince-bagirsak-lumen.png")
    seen, scales = [a.get("stage")], [a.get("currentLevel")]
    for act in ["forward"] * 5 + ["wall"] + ["deeper"] * 5:
        a = action(page, act)
        seen.append(a.get("stage"))
        scales.append(a.get("currentLevel"))
    check(seen == ["lumen", "contents", "motion", "digestion", "absorption", "regions", "wall", "mucosa", "villus", "enterocyte", "microvilli", "transport"], f"49: lümen → içerik → hareket → sindirim → emilim → bölge → duvar → mukoza → villus → enterosit → mikrovillus → moleküler taşıma ({seen})")
    order = {"interior": 3, "region": 4, "tissue": 5, "cell": 6, "molecule": 7}
    check([order[s] for s in scales] == sorted(order[s] for s in scales) and scales[0] == "interior", f"43: ölçek merdiveni geri gitmiyor, organın içinden başlıyor ({scales})")
    check(len(a["actions"]) <= 5 and any(x.startswith("graph:") for x in a["actions"]), f"son seviyede yalnızca kendi eylemleri + 'Bilgi grafiğinde incele' ({a['actions']})")
    page.screenshot(path=SHOTS / "ic2-molekul.png")
    page.locator("[data-testid=level-action][data-action=graph]").click()
    page.get_by_test_id("deep-dive").wait_for()
    check(True, "Daha derine in → bilgi grafiği (derin anatomi)")
    # Emilim basamağı: emilim odağı ve "Bunun devamı nerede?" (B12 → ileum)
    a = goto_interior(page, URL, "small-intestine", 5)
    check(a.get("focus") == "absorb" and a.get("stage") == "absorption", f"11G: emilim basamağı — 3B emilim odağı ({a.get('focus')})")
    check(any("ileuma git" in x for x in a["actions"]), f"38: 'Bunun devamı nerede?' — B12: ileuma git ({a['actions']})")
    page.screenshot(path=SHOTS / "ic3-emilim.png")
    a = action(page, "wall")
    check(a.get("sceneKind") == "wall" and a.get("level") == "wall", "11E: Duvarı incele → 3B duvar kesiti (ayrı sahne)")
    # Bölge → ileum: başka bir iç dünyaya geçiş
    a = goto_interior(page, URL, "small-intestine.ileum")
    check(a.get("interior") == "small-intestine.ileum" and a.get("level") == "interior", "11D: ileum iç dünyası")
    crumb = page.get_by_role("navigation", name="Keşif seviyesi").inner_text()
    check(all(norm(x) in norm(crumb) for x in ["Sindirim", "İnce bağırsak", "İleum", "İçerisi"]), f"42: breadcrumb ({crumb!r})")

    # Kalın bağırsak: villus yok; karaciğer: lümen yok; kalp: kan yolu
    a = goto_interior(page, URL, "large-intestine")
    seen = [a.get("stage")]
    for _ in range(6):
        seen.append(action(page, "forward").get("stage"))
    check(seen == ["lumen", "contents", "motion", "water", "microbiota", "concentration", "feces"], f"12: kalın bağırsak ayrı sahne — su/elektrolit → mikrobiyota → dışkı ({seen})")
    a = attrs(page)
    check(any("Rektuma git" in x for x in a["actions"]), "12: dışkı → rektuma git")
    a = goto_interior(page, URL, "liver")
    check(a.get("sceneKind") == "parenchyma" and a.get("currentNode") == "parenchyma", "8/17: karaciğer — sahte lümen yok, parankim (lobül)")
    a = goto_interior(page, URL, "heart", 8)
    check(a.get("focus") == "path:6" and a.get("stage") == "mitral", f"14: kalp — kanın yolu, mitral kapak odağı ({a.get('focus')}, {a.get('stage')})")
    page.screenshot(path=SHOTS / "ic4-kalp.png")
    for oid, st, kind in [("ear", 3, "pathway"), ("eyes", 2, "pathway"), ("ic.capillary", None, "vessel"), ("kidneys", None, "parenchyma"), ("brain", None, "parenchyma")]:
        a = goto_interior(page, URL, oid, st)
        check(a.get("sceneKind") == kind, f"#/ic/{oid}: sahne türü {kind} ({a.get('sceneKind')})")

    # ------------------------------------------------------------------ 52: model yok, normal fizyoloji çalışır
    page.goto(URL + "#/gizlilik")
    caps = page.locator("details", has_text="Bu cihazda neler yapılabiliyor?")
    caps.locator("summary").click()
    ct = caps.inner_text()
    check("Endoskopi" in ct and "OCT" in ct and "DEXA" in ct and "Anjiyografi" in ct, "33: modalite listesi OCT, DEXA, anjiyografi, PET/BT dahil")
    check(ct.count("Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.") >= 12, "52: modeli olmayan modalitelerde 'model yok'")
    inv = page.get_by_test_id("model-inventory")
    inv.locator("summary").click()
    check("erişilemedi" in page.get_by_test_id("inventory-access-note").inner_text(), "30/53: model araştırması — erişilemeyen kaynaklar açıkça yazıyor, sahte model yok")
    a = goto_interior(page, URL, "stomach")
    check(a.get("sceneKind") == "lumen", "52: model olmasa da eğitimsel iç dünya (mide) çalışıyor")

    # ------------------------------------------------------------------ 50: B12 (iki gerçek ölçüm)
    upload(page, "vitamin-mineral.pdf")
    upload(page, "sentetik-kan-tahlili.pdf")
    page.goto(URL + "#/sonuc/b12")
    page.get_by_test_id("result-physiology").wait_for()
    rp = page.get_by_test_id("result-physiology")
    t = rp.text_content() or ""
    check(all(x in t for x in ["Normalde vücutta ne yapıyor?", "Nerede kullanılıyor?", "Hangi organlarla ilişkili?", "Hangi fizyolojik süreçte?"]), "40: sonuç ayrıntısı — rol, üretim, kullanım, organ, süreç")
    chain = rp.locator("[data-testid=physio-chain][data-chain=b12]")
    check(chain.count() == 1, "50: B12 zinciri")
    nodes = [n.get_attribute("data-node") for n in chain.get_by_test_id("physio-node").all()]
    check(nodes[:5] == ["stomach", "b12", "parietal-cell", "intrinsic-factor", "ileum"], f"50: mide → iç faktör → ileum ({nodes})")
    marker = chain.locator("[data-testid=physio-marker][data-test=b12]").first
    check(marker.get_attribute("data-status") == "normal", "50: B12 son değer (312) aralıkta")
    time = chain.get_by_test_id("physio-time")
    check(time.count() == 1 and "30 Haz 2026" in time.inner_text() and "12 Eyl 2026" in time.inner_text(), "24: zaman — yalnızca gerçek ölçüm tarihleri (Haziran, Eylül)")
    time.get_by_role("button", name="30 Haz 2026").click()
    page.wait_for_timeout(200)
    check(chain.locator("[data-testid=physio-marker][data-test=b12]").first.get_attribute("data-status") == "low", "24: Haziran itibarıyla B12 düşük (zincir zamana göre güncellenir)")
    page.screenshot(path=SHOTS / "ic5-b12.png", full_page=True)
    rp.get_by_role("button", name="Normal fizyolojiyi gör").click()
    page.wait_for_url("**/#/fizyoloji/**")
    page.locator("[data-testid=physio-node][data-node=ileum]").first.click()
    page.wait_for_url("**/#/ic/small-intestine.ileum**")
    check(True, "38: B12 → ileum: 'Bunun devamı nerede?' ileuma götürür")
    goto_interior(page, URL, "small-intestine.ileum", 4)
    page.get_by_test_id("interior-stage-personal-toggle").click()
    page.get_by_test_id("interior-stage-personal").wait_for()
    check("B12" in page.get_by_test_id("interior-stage-personal").inner_text() and "olası ilişki" in page.get_by_test_id("interior-stage-personal").inner_text(), "21: B12 sonucu ileum 'B12 emilimi' basamağında kişisel veri (olası ilişki)")
    page.goto(URL + "#/organ/small-intestine")
    page.get_by_role("heading", name="İnce bağırsak", exact=True).wait_for()
    check(page.get_by_test_id("organ-changes").count() == 1, "5: 'Bende ne değişmiş olabilir?' — kişisel veri bağlandı")

    # Glukoz zinciri (çapraz sistem)
    page.goto(URL + "#/fizyoloji/glucose")
    page.locator("[data-testid=physio-chain][data-chain=glucose]").wait_for()
    nodes = [n.get_attribute("data-node") for n in page.locator("[data-testid=physio-chain][data-chain=glucose] [data-testid=physio-node]").all()]
    check(nodes == ["small-intestine", "glucose", "pancreas", "insulin", "glucose", "cell", "atp"], f"37: glukoz → pankreas → insülin → (glukoz) → hücre → ATP ({nodes})")

    # Benim vücudum katmanları
    page.goto(URL + "#/vucudum")
    page.get_by_test_id("mybody-layers").wait_for()
    row = page.locator("[data-testid=layer-row][data-organ=small-intestine]")
    check(row.count() == 1 and "İçine gir" in row.inner_text(), "23: Benim vücudum — normal katman (iç dünya) her organda")
    labs_before = page.locator("[data-layer-item=labs]").count()
    page.locator("[data-layer=labs]").click()
    check(labs_before > 0 and page.locator("[data-layer-item=labs]").count() == 0, "23: laboratuvar katmanı kapatılıp açılabiliyor")
    page.locator("[data-layer=labs]").click()
    page.screenshot(path=SHOTS / "ic6-katmanlar.png", full_page=True)

    # Telefon genişliği: yatay taşma yok
    page.set_viewport_size({"width": 390, "height": 844})
    goto_interior(page, URL, "small-intestine")
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(overflow <= 1, f"telefon: iç dünya ekranında yatay taşma yok ({overflow}px)")

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(page.evaluate("window.__csp") == [], "CSP ihlali yok")
    check(not console, f"konsol hatası yok {console[:3]}")
    browser.close()

print(json.dumps({"problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun: " + "; ".join(problems))
    sys.exit(1)
