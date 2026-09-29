"""Keşfet ekranı: iki vücut, sonuca göre belirginlik, bilgi bulutu, "temelde / sonucuma göre" süreç,
arama, araçlar (kesit, izole), tema ve tüm iç sahneler (masaüstü + telefon).

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/explore.py [ekran-görüntüsü-klasörü]
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots/explore")
SHOTS.mkdir(parents=True, exist_ok=True)
PDF = ROOT / "fixtures/reports/sentetik-kan-tahlili.pdf"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
SCENES = ["damar", "alveol", "nefron", "lobul", "adacik", "folikul", "ilik", "kan", "noron", "retina", "koklea", "kalpkasi",
          "sarkomer", "osteon", "mide", "villus", "deri", "hucre", "hormon", "lenf", "ovaryum", "testis"]
FROM = {"hormon": "adrenals", "hucre": "liver", "ovaryum": "ovaries", "testis": "testes", "noron": "brain", "retina": "eyes", "koklea": "ear"}
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def settle(page, ms=2500):
    page.wait_for_timeout(ms)


def canvas_nonblank(page) -> bool:
    """Kanvasın ortası tek renk değil mi (sahne çizildi mi)?"""
    shot = page.locator("canvas").first.screenshot(timeout=90000)
    from io import BytesIO
    try:
        from PIL import Image
    except ImportError:
        return len(shot) > 20000
    img = Image.open(BytesIO(shot)).convert("RGB").resize((64, 64))
    return len(set(img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata())) > 40


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROME_PATH") or None,
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    )
    # Yazılımsal WebGL (SwiftShader) çok yavaş: nabız ve CSS geçişleri kapalı (hareket azaltılmış) çalışılır,
    # yoksa kareler saniyeler sürer ve ekran görüntüsü geçişin ortasında kalır.
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1, reduced_motion="reduce")
    ctx.set_default_timeout(120000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for(timeout=20000)
    page.set_input_files("input[type=file][multiple]", [str(PDF)])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Sonuçları onayla").wait_for(timeout=30000)
    page.get_by_role("button", name="Onayla ve kaydet (14)").click()
    page.get_by_role("heading", name="Sonuçlar").wait_for(timeout=10000)

    # --- Genel görünüm: sonuçla ilişkili organlar belirgin
    page.goto(URL + "#/vucut")
    page.get_by_role("button", name="Açılışı atla").click(timeout=15000)
    settle(page, 6000)
    page.screenshot(path=SHOTS / "01-genel-erkek-sonuc-odak.png")
    toggle = page.get_by_role("button", name="Sonucumla ilişkili organlar belirgin")
    check(toggle.count() == 1 and toggle.get_attribute("aria-pressed") == "true", "sonuca göre belirginlik açık")
    toggle.click()
    settle(page, 1200)
    page.screenshot(path=SHOTS / "02-genel-hepsi.png")
    toggle.click()

    # --- Kadın vücudu
    page.get_by_role("radio", name="Kadın").click()
    settle(page, 7000)
    page.screenshot(path=SHOTS / "03-genel-kadin.png")
    check("Kadın" in (page.locator("nav[aria-label='Keşif seviyesi']").text_content() or ''), "gezinme yolunda kadın vücudu")
    page.goto(URL + "#/vucut/yapi/ovaries")
    settle(page, 4000)
    page.screenshot(path=SHOTS / "04-kadin-yumurtalik.png")
    check(page.get_by_role("heading", name="Yumurtalıklar").count() >= 1 or "Yumurtalık" in page.content(), "yumurtalık paneli")
    page.goto(URL + "#/vucut/yapi/prostate")
    settle(page, 2500)
    check(page.get_by_text("Bu yapı kadın vücudunda yok").count() == 1, "kadın vücudunda prostat için dürüst uyarı")
    page.get_by_role("button", name="Erkek vücuduna geç").click()
    settle(page, 6000)
    page.screenshot(path=SHOTS / "05-erkek-prostat.png")

    # --- Bilgi bulutu: karaciğere dokun (ALT yüksek)
    page.goto(URL + "#/vucut/yapi/liver")
    settle(page, 4000)
    box = page.locator("canvas").first.bounding_box()
    page.mouse.click(box["x"] + (box["width"] - 420) / 2, box["y"] + box["height"] / 2)
    settle(page, 4000)
    cloud = page.locator("[role=dialog][aria-label$='hızlı bilgi']")
    check(cloud.count() == 1, "karaciğere dokununca bilgi bulutu açıldı")
    page.screenshot(path=SHOTS / "06-bulut-karaciger.png")
    if cloud.count():
        check("ALT" in cloud.inner_text() or "bölüm" in cloud.inner_text().lower(), "bulutta sonuç satırı ya da bölüm bilgisi")
        btn = cloud.get_by_role("button", name="Temelde nasıl çalışır")
        if btn.count() == 0:
            btn = cloud.get_by_role("button", name="Nasıl çalışır")
        btn.first.click()
        settle(page, 9000)
        check("/temel" in page.url, "temelde nasıl çalışır → süreç (tipik) kipinde sahne")
        check(page.get_by_role("button", name="Temelde nasıl çalışır (açık)").count() == 1 or page.locator("button[aria-pressed=true]:has-text('Temelde')").count() == 1, "süreç tipik değerlerle oynuyor")
        page.screenshot(path=SHOTS / "07-lobul-temel.png")
        page.get_by_role("button", name="Sonucuma göre").first.click()
        settle(page, 2000)
        page.screenshot(path=SHOTS / "08-lobul-sonucuma-gore.png")

    # --- Arama
    page.goto(URL + "#/vucut")
    settle(page, 2500)
    page.keyboard.press("Control+k")
    page.get_by_role("combobox").fill("sol karıncık")
    settle(page, 300)
    page.screenshot(path=SHOTS / "09-arama.png")
    page.keyboard.press("Enter")
    settle(page, 4500)
    check("#/vucut/yapi/heart/left-ventricle" in page.url, "aramadan kalbin sol karıncığı açıldı")
    page.screenshot(path=SHOTS / "10-sol-karincik.png")
    page.keyboard.press("Control+k")
    page.get_by_role("combobox").fill("hepar")
    settle(page, 200)
    check("Karaciğer" in page.locator("#kh-search-list").inner_text(), "Latince ad (hepar) ile arama")
    page.keyboard.press("Escape")

    # --- Araçlar: kesit, izole, iç anatomi, yardım
    page.goto(URL + "#/vucut/yapi/heart")
    settle(page, 3500)
    page.keyboard.press("x")
    page.keyboard.press("t")
    settle(page, 1500)
    page.screenshot(path=SHOTS / "11-kalp-kesit-ic.png")
    check(page.get_by_role("slider", name="Kesit derinliği").count() == 1, "kesit denetimi açık")
    page.keyboard.press("x")
    page.keyboard.press("i")
    settle(page, 1500)
    page.screenshot(path=SHOTS / "12-kalp-izole.png")
    page.keyboard.press("?")
    check(page.get_by_role("dialog", name="Klavye kısayolları").count() == 1, "kısayol listesi")
    page.keyboard.press("Escape")
    check(page.get_by_role("dialog", name="Klavye kısayolları").count() == 0, "Esc kısayol listesini kapatır")

    # --- Tüm iç sahneler (koyu tema). Yazılımsal WebGL'de kare pahalı: hareket azaltılır, pencere küçük.
    page.goto(URL + "#/gizlilik")
    page.get_by_role("radio", name="Koyu").click()
    page.set_viewport_size({"width": 1100, "height": 700})
    for i, sc in enumerate(SCENES):
        frm = FROM.get(sc)
        page.goto(URL + f"#/simulasyon/{sc}" + (f"/{frm}" if frm else ""))
        # Sahne geçiş perdesi, yeni sahnenin gölgelendiricileri derlenene kadar kapalı kalır (yazılımsal WebGL'de saniyeler)
        settle(page, 9000)
        page.screenshot(path=SHOTS / f"s{i:02d}-{sc}.png", timeout=90000)
        check(canvas_nonblank(page), f"sahne çizildi: {sc}")
    page.set_viewport_size({"width": 1280, "height": 800})

    # --- Açık tema
    page.goto(URL + "#/gizlilik")
    page.get_by_role("radio", name="Açık").click()
    settle(page, 500)
    check(page.evaluate("document.documentElement.dataset.theme") == "light", "açık tema uygulandı")
    page.screenshot(path=SHOTS / "13-ayarlar-acik.png", full_page=True)
    page.goto(URL + "#/vucut")
    settle(page, 5000)
    page.screenshot(path=SHOTS / "14-genel-acik.png")
    for sc in ["noron", "alveol", "kan"]:
        page.goto(URL + f"#/simulasyon/{sc}")
        settle(page, 9000)
        page.screenshot(path=SHOTS / f"15-acik-{sc}.png", timeout=90000)
    page.goto(URL + "#/kapsam")
    settle(page, 800)
    page.screenshot(path=SHOTS / "16-kapsam-acik.png", full_page=True)
    check(page.get_by_text("Neyi, ne kadar gösterebiliyoruz?").count() == 1, "kapsam raporu açılıyor")
    page.goto(URL + "#/gizlilik")
    page.get_by_role("radio", name="Koyu").click()

    # --- Telefon görünümü
    storage = ctx.storage_state(indexed_db=True)
    m = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, storage_state=storage, reduced_motion="reduce")
    m.set_default_timeout(120000)
    mp = m.new_page()
    mp.on("pageerror", lambda e: console.append(f"pageerror(mobil): {e}"))
    mp.goto(URL)
    mp.fill("#unlock", PASS)
    mp.get_by_role("button", name="Kilidi aç").click()
    mp.wait_for_timeout(1500)
    mp.goto(URL + "#/vucut/yapi/liver")
    mp.wait_for_timeout(6000)
    mp.screenshot(path=SHOTS / "m1-karaciger.png")
    cb = mp.locator("canvas").first.bounding_box()
    mp.touchscreen.tap(cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] * 0.32)
    mp.wait_for_timeout(4000)
    mp.screenshot(path=SHOTS / "m2-bulut.png")
    check(mp.locator("[role=dialog][aria-label$='hızlı bilgi']").count() == 1, "telefonda bilgi bulutu")
    mp.goto(URL + "#/simulasyon/noron/brain/temel")
    mp.wait_for_timeout(5000)
    mp.screenshot(path=SHOTS / "m3-noron-temel.png")
    mp.goto(URL + "#/vucut")
    mp.wait_for_timeout(4000)
    mp.screenshot(path=SHOTS / "m4-genel.png")
    m.close()

    errors = [c for c in console if "pageerror" in c or c.startswith("error")]
    check(not errors, "konsolda hata yok" + ("" if not errors else f": {errors[:5]}"))
    check(not external, "dış ağ isteği yok" + ("" if not external else f": {external[:3]}"))
    browser.close()

print("\n" + ("TÜMÜ GEÇTİ" if not problems else f"{len(problems)} SORUN: {problems}"))
sys.exit(1 if problems else 0)
