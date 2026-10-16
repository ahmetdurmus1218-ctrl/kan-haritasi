"""Uçtan uca (gerçek Chromium): GERÇEK 3B ORGAN NAVİGASYONU + İÇİNE GİR + KADEMELİ ANATOMİK DERİNLİK.

Yalnızca metin denetlenmez. Her adımda tarayıcıdaki gerçek durum okunur (Explorer kök öğesi):
  data-camera          kamera konumu | hedefi | görüş açısı (CameraControls'ten, her karede)
  data-camera-moving   kamera hâlâ hareket ediyor mu
  data-scene           tuvalde ŞU AN çizilen 3B sahne; data-target-scene: gidilen sahne
  data-transition      sahne geçişi evresi (approach → cover → hold → reveal → idle)
  data-level           anatomik seviye (organ · interior · region · wall · tissue · cell · molecule)
  data-stage           iç dünya basamağı;  data-subject: kadrajdaki nesnenin ekrandaki dairesi
ve şunlar doğrulanır:
  - kamera gerçekten hareket etti (konum/hedef değişti), geçiş tamamlandı (idle, sahne = hedef)
  - 3B sahne / anatomik seviye değişti; yeni seviyenin eylemleri geldi, eskilerin seçenekleri kayboldu
  - organın dışından içine dalışta perde kapanmadan önce kamera organa yaklaştı (approach evresi)
  - tuval görünür alanı kaplıyor, model panelin arkasına/ekran dışına taşmıyor (telefon + masaüstü)
  - bütün anatomik ağaç hiçbir seviyede listelenmiyor (en fazla 5 eylem)
  - geri: kamera ters yönde, bir üst seviyeye; breadcrumb ile üst seviyeye dönüş
Akışlar: kalın bağırsak (telefon, 3B vücuttan organ seçimiyle), ince bağırsak, kalp, akciğer, böbrek, karaciğer, beyin.
Kritik adımların ekran görüntüleri ve Playwright izi (trace) kaydedilir.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra python3 tests/e2e/navigation3d.py [ekran-görüntüsü-klasörü]
"""
import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

from nav3d import PHASE_WATCH, attrs, cam, dist, phases_since, settle

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots") / "navigation3d"
SHOTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []
report: dict[str, list[str]] = {}


def norm(t):
    """Büyük/küçük harf ve Türkçe İ/ı farkı olmadan karşılaştırma (breadcrumb CSS ile büyük harf)."""
    return t.replace("İ", "I").replace("ı", "i").replace("i̇", "i").lower()


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)
    if not cond:
        problems.append(msg)
    return cond


def wait_settled(page, timeout=45, before=None):
    """Geçiş tamamlanana kadar bekler; görülen evreler sayfadaki MutationObserver kaydından da alınır."""
    a, ph = settle(page, timeout, before=before)
    return a, ph | phases_since(page)


def check_fit(page, a, label):
    """Tuval kökü kaplıyor; kadrajdaki nesne panelin kapatmadığı görünür alanda (ekran dışına taşmıyor)."""
    vw, vh = page.viewport_size["width"], page.viewport_size["height"]
    rl, rt, rw, rh = a["root"]
    cl, ct, cw, ch = a.get("canvas", [0, 0, 0, 0])
    check(abs(cl - rl) < 2 and abs(ct - rt) < 2 and abs(cw - rw) < 2 and abs(ch - rh) < 2 and cw > 200 and ch > 200, f"{label}: tuval görünür alanı kaplıyor ({[round(x) for x in a.get('canvas', [])]})")
    check(rl >= -1 and rt >= -1 and rl + rw <= vw + 1 and rt + rh <= vh + 1, f"{label}: tuval ekran içinde")
    if not a.get("subject"):
        return
    cx, cy, r = [float(x) for x in a["subject"].split(",")]
    right = bottom = 0.0
    if a.get("dock"):
        dl, dt, dw, dh = a["dock"]
        if dw < rw * 0.6:
            right = rl + rw - dl
        else:
            bottom = rt + rh - dt
    tol = 0.08 * r + 4
    inside = cx - r >= -tol and cy - r >= -tol and cx + r <= rw - right + tol and cy + r <= rh - bottom + tol
    check(inside and r > 25, f"{label}: 3B model görünür alana sığıyor (daire {cx:.0f},{cy:.0f} r={r:.0f}; alan {rw - right:.0f}×{rh - bottom:.0f})")


def act(page, action, label, expect_stage=None, expect_level=None, shot=None):
    """Bir seviye eylemi: kamera hareketi + (gerekirse) sahne geçişi + yeni seviye + yeni seçenekler."""
    before = attrs(page)
    btn = page.locator(f"[data-testid=level-action][data-action={action}]").first
    if not check(btn.count() == 1, f"{label}: '{action}' eylemi bu seviyede var ({before['actions']})"):
        return before
    btn.click()
    a, phases = wait_settled(page, before=before)
    p0, t0, _ = cam(before)
    p1, t1, _ = cam(a)
    moved = dist(p0, p1) + dist(t0, t1)
    check(moved > 0.02, f"{label}: kamera gerçekten hareket etti (Δ={moved:.3f})")
    check(a["transition"] == "idle" and a["scene"] == a["targetScene"], f"{label}: geçiş tamamlandı (sahne {a['scene']})")
    if before["scene"] != a["scene"]:
        check({"cover", "reveal"} <= phases, f"{label}: sahne geçişi animasyonlu ({sorted(x for x in phases if x)})")
        deeper = a.get("level") != before.get("level") and before.get("scene") != "body"
        if deeper and a.get("scene") != "body":
            check("approach" in phases, f"{label}: perdeden önce kamera yeni seviyeye doğru hareket etti (approach)")
    if expect_stage:
        check(a.get("stage") == expect_stage, f"{label}: basamak {a.get('stage')} == {expect_stage}")
    if expect_level:
        check(a.get("level") == expect_level, f"{label}: anatomik seviye {a.get('level')} == {expect_level}")
    check(a["actions"] != before["actions"], f"{label}: yeni seviyenin seçenekleri geldi, eskileri kayboldu")
    check(len(a["actions"]) <= 5, f"{label}: yalnızca bu seviyenin eylemleri ({len(a['actions'])} ≤ 5)")
    check_fit(page, a, label)
    if shot:
        page.screenshot(path=SHOTS / shot)
    report.setdefault(label.split(":")[0], []).append(f"{a.get('level')}/{a.get('stage')} @ {a['scene']}")
    return a


def dive(page, oid, label, shot=None, structure=None):
    """3B vücutta organ → "İçine gir": önce organ dış görünümü, sonra kamera organa dalar ve iç dünyaya girer.
    structure verilmezse doğrudan iç dünya adresi açılır (yine önce organ gösterilir, sonra dalış)."""
    if structure:
        before = attrs(page)
        page.goto(URL + f"#/vucut/yapi/{structure}")
        page.get_by_test_id("explorer").wait_for()
        org, _ = wait_settled(page, 90, before=before if before else None)
        check(org.get("level") == "organ", f"{label}: organ seçildi (3B dış görünüm)")
        opener = page.get_by_role("button", name="Bilgi paneli: aç")
        if opener.count() and opener.is_visible():
            opener.click()
        page.locator("aside[aria-label='Bilgi paneli'] button:has-text('İçine gir')").first.click()
    else:
        # Bağlantıdan doğrudan açılış: 3B keşif yeniden kurulur (önce organ gösterilir, sonra dalış)
        page.goto(URL + "#/vucudum")
        page.get_by_test_id("explorer").wait_for(state="detached")
        page.goto(URL + f"#/ic/{oid}")
        page.get_by_test_id("explorer").wait_for()
    t0 = time.time()
    first = None
    while time.time() - t0 < 60:
        a = attrs(page)
        if a and a.get("scene") == "body" and a.get("camera"):
            first = first or a
        if a and a.get("scene", "").startswith(("ic:", "in:")):
            break
        time.sleep(0.1)
    check(first is not None, f"{label}: önce organ 3B vücutta (dış görünüm)")
    a, _ = wait_settled(page)
    check(a.get("level") == "interior" and a.get("currentNode") not in {"wall", "tissue", "cell", "molecule"}, f"{label}: İçine gir → organın iç dünyası ({a.get('level')}/{a.get('stage')}), duvara/hücreye atlanmadı")
    if first:
        p0, _, f0 = cam(first)
        p1, _, f1 = cam(a)
        check(dist(p0, p1) > 0.05, f"{label}: kamera vücuttan iç dünyaya hareket etti")
    check_fit(page, a, label)
    if shot:
        page.screenshot(path=SHOTS / shot)
    report.setdefault(label, []).append(f"{a.get('level')}/{a.get('stage')} @ {a['scene']}")
    return a


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    ctx.set_default_timeout(60000)
    ctx.tracing.start(screenshots=True, snapshots=True)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith((URL.rstrip("/"), "blob:", "data:")) else None)
    page.add_init_script(PHASE_WATCH)

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for(timeout=30000)

    # ------------------------------------------------------------------ KALIN BAĞIRSAK (telefon, 3B vücuttan)
    L = "kalın bağırsak"
    page.goto(URL + "#/vucut/sistem/digestive")
    page.get_by_test_id("explorer").wait_for()
    sysa, _ = wait_settled(page, 90)
    time.sleep(1.0)
    check(sysa.get("level") == "system", "vücut → sindirim sistemi (3B)")
    page.goto(URL + "#/vucut/yapi/large-intestine")
    org, _ = wait_settled(page, 90, before=sysa)
    check(org.get("level") == "organ" and org.get("scene") == "body", f"{L}: organ seçildi — 3B dış görünüm ({org.get('level')})")
    check(dist(cam(sysa)[0], cam(org)[0]) > 0.05, f"{L}: sistemden organa gerçek kamera geçişi (zoom/odak)")
    check_fit(page, org, f"{L}: organ dış görünüm")
    page.screenshot(path=SHOTS / "01-kalin-bagirsak-organ.png")
    opener = page.get_by_role("button", name="Bilgi paneli: aç")
    if opener.count() and opener.is_visible():
        opener.click()
    enter = page.locator("aside[aria-label='Bilgi paneli'] button:has-text('İçine gir')").first
    enter.wait_for(state="visible")
    phases_since(page)
    enter.click()
    # Perde kapanmadan önce kamera organa yaklaşır (approach): evre kaydı + yaklaşma sırasında kamera
    t0 = time.time()
    approach_cam = None
    while time.time() - t0 < 30:
        a = attrs(page)
        if a.get("transition") == "approach" and approach_cam is None:
            time.sleep(0.4)
            approach_cam = attrs(page)
            page.screenshot(path=SHOTS / "02-icine-girme-animasyonu.png")
        if a.get("scene", "").startswith("ic:"):
            break
        time.sleep(0.05)
    phases = phases_since(page)
    check("approach" in phases and "cover" in phases, f"{L}: İçine gir → önce kamera organa yaklaşır (approach), sonra perde (cover) ({sorted(x for x in phases if x)})")
    if approach_cam:
        check(dist(cam(org)[0], cam(approach_cam)[0]) > 0.05, f"{L}: dalış sırasında kamera organa doğru hareket ediyor")
    a, ph = wait_settled(page)
    ph |= phases
    check(a.get("scene") == "ic:large-intestine" and a.get("level") == "interior" and a.get("stage") == "lumen", f"{L}: kamera lümene girdi — kalın bağırsak içi ({a.get('scene')}, {a.get('stage')})")
    check(cam(a)[2] > 50, f"{L}: lümen içinde geniş açılı (endoskop) kamera (fov {cam(a)[2]})")
    check({"cover", "reveal"} <= ph, f"{L}: sahne geçişi animasyonlu (perde kapanır, yeni sahne açılır)")
    check(not any(x.startswith(("wall:", "deeper:")) and "Hücre" in x for x in a["actions"]), f"{L}: içeride hücreye atlayan seçenek yok")
    crumb = page.get_by_role("navigation", name="Keşif seviyesi").inner_text()
    check(all(norm(x) in norm(crumb) for x in ["Sindirim", "Kalın bağırsak", "İçerisi"]), f"{L}: breadcrumb Vücut › Sindirim › Kalın bağırsak › İçerisi ({crumb!r})")
    page.screenshot(path=SHOTS / "03-kalin-bagirsak-ici-lumen.png")
    act(page, "forward", f"{L}: İlerle → içerik", "contents", "interior", "04-kalin-bagirsak-icerik.png")
    act(page, "forward", f"{L}: İlerle → hareket", "motion", "interior", "05-kalin-bagirsak-hareket.png")
    a = act(page, "wall", f"{L}: Duvarı incele → duvar", "wall", "wall", "06-kalin-bagirsak-duvara-gecis.png")
    check(a.get("sceneKind") == "wall", f"{L}: duvar kesiti sahnesi")
    act(page, "deeper", f"{L}: Daha derine in → mukoza", "mucosa", "tissue", "07-kalin-bagirsak-mukoza.png")
    act(page, "deeper", f"{L}: Daha derine in → kript", "crypt", "tissue", "08-kalin-bagirsak-kript.png")
    act(page, "deeper", f"{L}: Daha derine in → epitel", "epithelium", "tissue")
    a = act(page, "deeper", f"{L}: Hücreye in → kolonosit", "colonocyte", "cell", "09-kalin-bagirsak-hucre.png")
    crumb = page.get_by_role("navigation", name="Keşif seviyesi").inner_text()
    check(all(norm(x) in norm(crumb) for x in ["İçerisi", "Duvar", "Kript", "Epitel", "Kolonosit"]), f"{L}: breadcrumb hücre seviyesinde (… › Kript › Epitel › Kolonosit) ({crumb!r})")
    act(page, "deeper", f"{L}: Moleküler süreç", "scfa", "molecule", "10-kalin-bagirsak-molekul.png")
    # Geri: kamera ters yönde, bir üst seviyeye
    act(page, "back", f"{L}: Geri ← hücre", "colonocyte", "cell")
    act(page, "back", f"{L}: Geri ← epitel", "epithelium", "tissue")
    # Breadcrumb ile üst seviyeye (İçerisi)
    b0 = attrs(page)
    page.get_by_role("navigation", name="Keşif seviyesi").get_by_role("button", name="İçerisi").click()
    a, _ = wait_settled(page, before=b0)
    check(a.get("stage") == "lumen" and a.get("scene") == "ic:large-intestine", f"{L}: breadcrumb → İçerisi (lümene dönüş, {a.get('scene')})")
    # İlk iç basamaktan geri: organın dışına (3B vücut, organ dış görünüm)
    a = act(page, "back", f"{L}: Geri → organ dış görünüm")
    check(a.get("scene") == "body" and a.get("level") == "organ", f"{L}: dışarı çıkıldı — organ 3B görünümü ({a.get('scene')}, {a.get('level')})")
    page.screenshot(path=SHOTS / "11-kalin-bagirsak-geri-organ.png")

    # ------------------------------------------------------------------ İNCE BAĞIRSAK (telefon)
    L = "ince bağırsak"
    a = dive(page, "small-intestine", L, "20-ince-bagirsak-lumen.png")
    check(a.get("stage") == "lumen", f"{L}: villus ilk sahne değil — lümen ({a.get('stage')})")
    act(page, "forward", f"{L}: kimus (içerik)", "contents", "interior")
    act(page, "forward", f"{L}: peristaltizm/segmentasyon", "motion", "interior")
    act(page, "forward", f"{L}: sindirim", "digestion", "interior")
    act(page, "forward", f"{L}: emilim", "absorption", "interior", "21-ince-bagirsak-emilim.png")
    act(page, "wall", f"{L}: duvar", "wall", "wall")
    act(page, "deeper", f"{L}: mukoza", "mucosa", "tissue")
    act(page, "deeper", f"{L}: villus", "villus", "tissue", "22-ince-bagirsak-villus.png")
    act(page, "deeper", f"{L}: enterosit", "enterocyte", "cell", "23-ince-bagirsak-enterosit.png")

    # ------------------------------------------------------------------ masaüstü
    page.set_viewport_size({"width": 1280, "height": 860})

    # KALP: odacık → kan akışı → kapak → dolaşım → duvar → miyokard → kardiyomiyosit
    L = "kalp"
    a = dive(page, "heart", L, structure="heart", shot="30-kalp-ici.png")
    check(a.get("sceneKind") == "chambers", f"{L}: odacık sahnesi (lümen değil)")
    act(page, "forward", f"{L}: sağ atriyum (kan akışı)", "ra", "interior")
    act(page, "forward", f"{L}: triküspit kapak", "tricuspid", "interior", "31-kalp-kapak.png")
    act(page, "forward", f"{L}: sağ ventrikül", "rv", "interior")
    act(page, "wall", f"{L}: duvar", "wall", "wall")
    act(page, "deeper", f"{L}: endokard", "endocardium", "tissue")
    act(page, "deeper", f"{L}: miyokard", "myocardium", "tissue", "32-kalp-miyokard.png")
    act(page, "deeper", f"{L}: epikard", "epicardium", "tissue")
    act(page, "deeper", f"{L}: kardiyomiyosit", "cardiomyocyte", "cell", "33-kalp-kardiyomiyosit.png")

    # AKCİĞER: hava yolu → bronş → bronşiyol → alveol → gaz değişimi → doku
    L = "akciğer"
    a = dive(page, "lungs", L, structure="lungs", shot="40-akciger-hava-yolu.png")
    act(page, "forward", f"{L}: trakea", "trachea", "interior")
    act(page, "forward", f"{L}: bronş", "bronchus", "interior")
    act(page, "forward", f"{L}: bronşiyol", "bronchiole", "interior")
    act(page, "forward", f"{L}: alveol", "alveolus", "interior")
    act(page, "forward", f"{L}: gaz değişimi", "exchange", "interior", "41-akciger-gaz-degisimi.png")
    act(page, "wall", f"{L}: alveol duvarı (doku)", "alveolar-wall", "tissue", "42-akciger-doku.png")

    # BÖBREK: parankim → korteks → medulla → nefron → filtrasyon
    L = "böbrek"
    a = dive(page, "kidneys", L, structure="kidneys", shot="50-bobrek-parankim.png")
    check(a.get("sceneKind") == "parenchyma", f"{L}: parankim (yapay lümen yok)")
    for st in ["blood", "filtration", "reabsorption", "secretion", "urine"]:
        act(page, "forward", f"{L}: {st}", st, "interior")
    act(page, "forward", f"{L}: korteks", "cortex", "region")
    act(page, "forward", f"{L}: medulla", "medulla", "region", "51-bobrek-medulla.png")
    act(page, "wall", f"{L}: nefron", "nephron", "tissue", "52-bobrek-nefron.png")
    act(page, "deeper", f"{L}: glomerül (filtrasyon)", "glomerulus", "tissue")

    # KARACİĞER: parankim → kan akışı → sinüzoid → hepatosit → safra yolu
    L = "karaciğer"
    dive(page, "liver", L, structure="liver", shot="60-karaciger-parankim.png")
    act(page, "forward", f"{L}: çift kanlanma", "blood-in", "interior")
    act(page, "wall", f"{L}: lobül", "lobule", "tissue")
    act(page, "deeper", f"{L}: portal üçlü", "triad", "tissue")
    act(page, "deeper", f"{L}: sinüzoid", "sinusoid", "tissue", "61-karaciger-sinuzoid.png")
    act(page, "deeper", f"{L}: hepatosit", "hepatocyte", "cell")
    act(page, "deeper", f"{L}: safra yolu", "bile", "cell", "62-karaciger-safra.png")

    # BEYİN: korteks → beyaz cevher → nöral ağ → nöron → sinaps
    L = "beyin"
    dive(page, "brain", L, structure="brain", shot="70-beyin-ici.png")
    act(page, "wall", f"{L}: korteks", "cortex", "tissue")
    act(page, "deeper", f"{L}: beyaz cevher", "white-matter", "tissue")
    act(page, "deeper", f"{L}: nöron ağı", "network", "cell", "71-beyin-noron.png")
    act(page, "deeper", f"{L}: sinaps", "synapse", "cell", "72-beyin-sinaps.png")

    # Yatay telefon: aynı sahne ekrana sığar
    page.set_viewport_size({"width": 844, "height": 390})
    dive(page, "heart", "kalp (yatay telefon)", "80-kalp-yatay.png")  # doğrudan adres: önce organ, sonra dalış

    check(not external, f"harici ağ isteği yok {external[:3]}")
    check(not console, f"konsol hatası yok {console[:3]}")
    ctx.tracing.stop(path=str(SHOTS / "trace.zip"))
    browser.close()

print(json.dumps(report, ensure_ascii=False, indent=1))
print(json.dumps({"problems": problems}, ensure_ascii=False))
if problems:
    print(f"{len(problems)} sorun")
    sys.exit(1)
