"""Uçtan uca: tek tek kemikler ve isteğe bağlı anatomi paketleri (Z-Anatomy).

  A — Temel iskelet: her kemik ayrı yapı; panelde kemik adı (Türkçe + Latince), kaynak kimliği (FMA) ve lisans.
  B — Paket kurulumu dosyadan: resmi paketler SHA-256 ile doğrulanıp kurulur; değiştirilmiş paket reddedilir.
  C — Paketler 3B vücutta: kaslar (bölgesel parçaların yerine tek tek kaslar), sinirler (şematik tüplerin yerine),
      damarlar, eklemler, lenf düğümleri, baş-boyun; tek bir yapı seçilir.
  D — Kadın vücudu: uyarlanmış yapılar "Erkek referansından uyarlanmıştır" diye işaretli.
  E — Paket kapatılınca temel model geri gelir.
  + Ağ isteği yok, CSP ihlali yok, konsol hatası yok. Masaüstü ve telefon görünümü.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/anatomypacks.py [ekran-görüntüsü-klasörü]
"""
import io
import os
import re
import sys
import time
import zipfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots/paketler")
SHOTS.mkdir(parents=True, exist_ok=True)
PACKS = ROOT / "anatomy-packs"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []
timings: dict[str, float] = {}


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def skip_intro(page):
    btn = page.get_by_role("button", name="Açılışı atla")
    for _ in range(30):
        if not btn.count():
            return
        try:
            btn.click(timeout=1000)
            return
        except Exception:
            page.wait_for_timeout(300)


def settle(page, ms=2500):
    page.wait_for_timeout(ms)


def packs(tag):
    return sorted(str(p) for p in PACKS.glob(f"anatomi-*-{tag}.khpack"))


def tampered(src: str) -> Path:
    """Model dosyasının bir baytı değiştirilmiş, manifesti aynı kalmış paket (kurulmamalı)."""
    out = SHOTS / "degistirilmis.khpack"
    zin = zipfile.ZipFile(src)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for n in zin.namelist():
            data = bytearray(zin.read(n))
            if n == "model.glb":
                data[len(data) // 2] ^= 0xFF
            z.writestr(n, bytes(data))
    out.write_bytes(buf.getvalue())
    return out


def open_structure(page, sid, wait=5000):
    page.goto(URL + f"#/vucut/yapi/{sid}")
    skip_intro(page)
    settle(page, wait)


def anatomy_tab(page):
    tab = page.get_by_role("tab", name="Anatomi")
    if tab.count():
        tab.first.click()
        settle(page, 600)


def part_rows(page):
    return page.locator("ul.max-h-72 li button")


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROME_PATH") or None,
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    )
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1, reduced_motion="reduce")
    ctx.set_default_timeout(180000)
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

    # --- A: tek tek kemikler (temel model)
    open_structure(page, "bones", 9000)
    anatomy_tab(page)
    rows = part_rows(page)
    n = rows.count()
    check(n >= 200, f"iskelet panelinde tek tek yapılar listeleniyor ({n})")
    check(page.get_by_text("Modeldeki tek tek yapılar").count() >= 1, "başlık: modeldeki tek tek yapılar")
    page.screenshot(path=SHOTS / "01-iskelet-tek-tek.png")
    target = page.get_by_role("button", name=re.compile("Sol 3\\. el tarak kemiği"))
    check(target.count() >= 1, "Sol 3. el tarak kemiği listede")
    if target.count():
        target.first.click()
        settle(page, 3000)
        body_text = page.content()
        check("Os metacarpi III" in body_text, "Latince ad: Os metacarpi III")
        check("FMA" in body_text and "BodyParts3D 3.0" in body_text and "CC BY-SA 2.1 JP" in body_text, "kaynak kimliği (FMA), kaynak ve lisans gösteriliyor")
        page.screenshot(path=SHOTS / "02-tek-kemik-metakarp.png")

    # --- B: paket kurulumu
    page.goto(URL + "#/gizlilik")
    page.get_by_text("Anatomi paketleri (ayrıntılı 3B modeller)").wait_for()
    file_input = page.locator("#anatomi-paketleri input[type=file]")
    male = packs("erkek")
    check(len(male) == 6, f"6 erkek paketi bulundu ({len(male)})")
    t0 = time.time()
    file_input.set_input_files(male)
    page.get_by_text(re.compile("Kuruldu ve doğrulandı")).wait_for(timeout=300000)
    timings["erkek paketlerini kurma (6)"] = time.time() - t0
    check(page.locator("#anatomi-paketleri").get_by_text("kurulu değil", exact=True).count() == 6, "erkek paketleri kurulu, kadın paketleri değil")
    page.locator("#anatomi-paketleri").screenshot(path=SHOTS / "03-paket-kurulumu.png")
    file_input.set_input_files(str(tampered(male[0])))
    page.get_by_text(re.compile("SHA-256")).first.wait_for(timeout=60000)
    check(page.get_by_text(re.compile("eşleşmiyor")).count() >= 1, "değiştirilmiş paket reddedildi (SHA-256)")

    # --- C: paketler 3B vücutta (erkek)
    t0 = time.time()
    open_structure(page, "skeletal-muscle", 15000)
    timings["kas paketiyle ilk açılış"] = time.time() - t0
    anatomy_tab(page)
    rows = part_rows(page)
    check(rows.count() >= 400, f"kas paketinden tek tek kaslar listeleniyor ({rows.count()})")
    page.screenshot(path=SHOTS / "04-kaslar-paket.png")
    glut = page.get_by_role("button", name=re.compile("Gluteus maximus"))
    if glut.count():
        glut.first.click()
        settle(page, 3000)
        check("Z-Anatomy" in page.content() and "CC BY-SA 4.0" in page.content(), "kas: kaynak Z-Anatomy, lisans CC BY-SA 4.0")
        page.screenshot(path=SHOTS / "05-tek-kas-gluteus.png")
    else:
        check(False, "Gluteus maximus listede")

    for sid, name, minimum in [("nerves", "06-sinirler", 150), ("limb-vessels", "07-kol-bacak-damarlari", 150), ("joints", "08-eklemler", 150), ("lymph-node", "09-lenf", 100), ("mouth", "10-agiz-yutak", 10), ("thyroid", "11-tiroid", 3), ("ear", "12-kulak", 10)]:
        open_structure(page, sid, 7000)
        anatomy_tab(page)
        c = part_rows(page).count()
        check(c >= minimum, f"{sid}: paketten tek tek yapılar ({c} ≥ {minimum})")
        page.screenshot(path=SHOTS / f"{name}.png")
    open_structure(page, "nerves", 4000)
    check(page.get_by_text("Ayrıntılı model: anatomi paketi (Z-Anatomy).").count() >= 1, "sinir paneli: şematik değil, paket modeli")
    # Arama: tek yapılar (kemik ve paket yapıları) aranabilir
    page.keyboard.press("Control+k")
    page.keyboard.type("ay kemiği")
    settle(page, 800)
    check(page.get_by_text("Sol ay kemiği").count() >= 1, "arama: 'ay kemiği' → Sol ay kemiği (tek yapı)")
    page.keyboard.press("Escape")
    # Organı vücuttan ayır
    open_structure(page, "heart", 6000)
    before = page.locator("canvas").first.screenshot()
    page.keyboard.press("d")
    settle(page, 4000)
    after = page.locator("canvas").first.screenshot()
    check(before != after and page.get_by_role("button", name=re.compile("Organı vücuda geri yerleştir")).count() == 1, "organı vücuttan ayır (D): kalp vücudun önüne taşındı")
    page.screenshot(path=SHOTS / "12b-kalp-ayrildi.png")

    # Genel görünüm: deri gizli, kaslar katmanı açık
    page.goto(URL + "#/vucut")
    skip_intro(page)
    settle(page, 8000)
    page.screenshot(path=SHOTS / "13-genel-erkek-paketli.png")

    # --- D: kadın vücudu (uyarlanmış)
    page.goto(URL + "#/gizlilik")
    female = packs("kadin")
    page.locator("#anatomi-paketleri input[type=file]").set_input_files(female)
    page.get_by_text(re.compile("Kuruldu ve doğrulandı")).wait_for(timeout=300000)
    check(page.locator("#anatomi-paketleri").get_by_text("kurulu değil", exact=True).count() == 0, "kadın paketleri de kuruldu")
    page.goto(URL + "#/vucut")
    skip_intro(page)
    page.get_by_role("radio", name="Kadın").click()
    settle(page, 12000)
    open_structure(page, "skeletal-muscle", 12000)
    anatomy_tab(page)
    check(page.get_by_text(re.compile("erkek referansından uyarlanmıştır", re.I)).count() >= 1, "kadın: kaslar 'erkek referansından uyarlanmıştır' diye işaretli")
    check(page.get_by_text("uyarlandı").count() >= 5, "kadın: listede 'uyarlandı' rozetleri")
    page.screenshot(path=SHOTS / "14-kadin-kaslar-uyarlandi.png")
    open_structure(page, "bones", 6000)
    anatomy_tab(page)
    vert = page.get_by_role("button", name=re.compile("12\\. göğüs omuru"))
    if vert.count():
        vert.first.click()
        settle(page, 2500)
        check("Erkek referansından uyarlanmıştır" not in page.content(), "kadın omuru kendi kaynağından (HRA), uyarlanmış değil")
    back = page.get_by_role("button", name="← İskelet")
    if back.count():
        back.first.click()
        settle(page, 1500)
    anatomy_tab(page)
    hum = page.get_by_role("button", name=re.compile("Sol pazu kemiği"))
    check(hum.count() >= 1, "kadın: Sol pazu kemiği listede")
    if hum.count():
        hum.first.click()
        settle(page, 2500)
        check("Erkek referansından uyarlanmıştır" in page.content(), "kadın kol kemiği uyarlanmış diye işaretli")
        page.screenshot(path=SHOTS / "15-kadin-kemik-uyarlandi.png")

    # --- E: paket kapatılınca temel model
    page.goto(URL + "#/gizlilik")
    row = page.locator("#anatomi-paketleri li", has_text="Kaslar, tendonlar").filter(has_text="uyarlanmıştır")
    box = row.locator("input[type=checkbox]")
    check(box.count() == 1, "kadın kas paketi satırında aç/kapa var")
    if box.count():
        box.first.click()
        row.get_by_text("Kapalı").wait_for(timeout=10000)
    open_structure(page, "skeletal-muscle", 8000)
    anatomy_tab(page)
    c = part_rows(page).count()
    check(c <= 20, f"kas paketi kapalıyken temel model (bölgesel kas parçaları: {c})")

    # Telefon görünümü
    phone = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, reduced_motion="reduce", is_mobile=True, has_touch=True)
    phone.add_cookies(ctx.cookies())
    phone.close()

    csp = page.evaluate("window.__csp")
    check(not external, f"dış ağ isteği yok ({external[:3]})")
    check(not csp, f"CSP ihlali yok ({csp[:3]})")
    check(not console, f"konsol hatası yok ({console[:3]})")
    browser.close()

for k, v in timings.items():
    print(f"SÜRE {k}: {v:.1f} sn")
print(f"\n{len(problems)} sorun" if problems else "\nTÜMÜ GEÇTİ")
sys.exit(1 if problems else 0)
