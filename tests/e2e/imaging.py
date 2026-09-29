"""Uçtan uca: görüntüleme belgeleri (MR, BT, röntgen).

DICOM klasörü içe aktar (DICOMDIR ve metin dosyası atlanır) → seri tek satır → görüntüleyici
(kesit kaydırma, pencere/seviye, BT ön ayarları) → kimlik bilgisi ekranda yok → radyoloji raporu PDF'i
okunur, bölümlere ayrılır, terimler açıklanır → çekim tarihi önerisi → vücutta göster.

Kullanım: pnpm build && pnpm preview (ayrı terminal), sonra
  python3 tests/e2e/imaging.py [ekran-görüntüsü-klasörü]
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
IMG = ROOT / "fixtures/imaging"
URL = os.environ.get("KH_URL", "http://localhost:4173/")
PASS = "cok-gizli-parola-2026"
problems: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


def canvas_brightness(page):
    return page.evaluate(
        """() => {
          const c = document.querySelector('canvas[role=img]');
          if (!c) return -1;
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let s = 0;
          for (let i = 0; i < d.length; i += 4) s += d[i];
          return s / (d.length / 4);
        }"""
    )


with sync_playwright() as p:
    # WebGL: başsız tarayıcıda yazılımsal (SwiftShader) çizim — "vücutta göster" 3B ekranı için
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROME_PATH") or None,
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    )
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, device_scale_factor=1)
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
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for(timeout=20000)

    # --- MR: DICOM klasörü
    page.get_by_role("radio", name="MR", exact=True).click()
    page.get_by_text("MR Görüntüsü veya Raporu Yükle").wait_for()
    check(page.get_by_role("button", name="DICOM klasörü seç").count() == 1, "MR seçilince klasör düğmesi görünüyor")
    page.screenshot(path=SHOTS / "60-goruntuleme-yukle.png")
    page.set_input_files("input[aria-label='DICOM klasörü']", str(IMG / "beyin-mr"))
    page.get_by_text("8 dosya şifrelendi ve kaydedildi").wait_for(timeout=60000)
    check(page.get_by_text("DICOM olmayan 2 dosya").count() == 1, "DICOMDIR ve metin dosyası atlandı")
    check(page.get_by_text("MR · Beyin / kafa olarak kaydedildi.").count() >= 1, "tür ve bölge başlıktan")
    check(page.get_by_text("8 kesit").count() == 1, "seri listede tek satır, 8 kesit")
    page.screenshot(path=SHOTS / "61-seri-listede.png")

    page.get_by_role("button", name="Aç", exact=True).click()
    page.locator("canvas[role=img]").wait_for(timeout=20000)
    page.get_by_text("Kesit 1 / 8").wait_for()
    check(canvas_brightness(page) > 10, "MR kesiti çizildi (boş değil)")
    page.locator("[aria-label='Görüntüleyici']").focus()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowDown")
    page.get_by_text("Kesit 3 / 8").wait_for()
    check(page.get_by_text("WL 600 · WW 1200").count() == 1, "pencere dosyadaki değerden")
    check(page.get_by_role("heading", name="MR · Beyin / kafa").count() == 1, "görüntüleme paneli başlığı")
    check(page.get_by_text("AX T2").count() >= 1, "seri açıklaması")
    check("SENTETIK^HASTA" not in page.content() and "SENTETIK HASTA" not in page.content(), "hasta adı ekranda yok")
    # Pencere/seviye: sağ tıkla sürükle
    box = page.locator("canvas[role=img]").bounding_box()
    before = canvas_brightness(page)
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down(button="right")
    page.mouse.move(box["x"] + box["width"] / 2 + 120, box["y"] + box["height"] / 2 + 80, steps=5)
    page.mouse.up(button="right")
    page.wait_for_timeout(200)
    check(abs(canvas_brightness(page) - before) > 1 and page.get_by_text("WL 600 · WW 1200").count() == 0, "sağ tıkla sürükleme kontrastı değiştiriyor")
    page.screenshot(path=SHOTS / "62-mr-goruntuleyici.png")
    page.get_by_role("button", name="Vücutta göster · Beyin / kafa").click()
    page.wait_for_timeout(500)
    check("#/vucut/yapi/brain" in page.url, "vücutta göster → beyin")
    page.get_by_text("Görüntülemelerin (1)").wait_for(timeout=120000)
    check(page.get_by_text("MR · 15 Mar 2026 · 8 kesit").count() == 1, "3B organ panelinde MR çalışması")
    page.screenshot(path=SHOTS / "62b-vucutta-mr.png")

    # --- BT: tek dosya, BT pencere ön ayarları
    page.goto(URL + "#/belgeler")
    page.get_by_role("radio", name="Tomografi (BT)").click()
    page.set_input_files("input[type=file][multiple]", [str(IMG / "toraks-bt.dcm")])
    page.get_by_role("button", name="Aç ve oku").click()
    page.locator("canvas[role=img]").wait_for(timeout=20000)
    page.get_by_label("Pencere ön ayarı").select_option(label="BT: Akciğer")
    page.get_by_text("WL -600 · WW 1500 HU").wait_for()
    check(page.get_by_role("heading", name="Tomografi (BT) · Göğüs / akciğer").count() == 1, "BT → göğüs / akciğer")
    page.screenshot(path=SHOTS / "63-bt-akciger-penceresi.png")

    # --- Radyoloji raporu PDF
    page.goto(URL + "#/belgeler")
    page.get_by_role("radio", name="MR", exact=True).click()
    page.set_input_files("input[type=file][multiple]", [str(IMG / "beyin-mr-raporu.pdf")])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Raporda geçen terimler").wait_for(timeout=60000)
    check(page.get_by_text("Frontal beyaz cevherde nonspesifik milimetrik hiperintens odaklar.").count() == 1, "SONUÇ bölümü ayrıldı")
    check(page.get_by_text("Hiperintens / hipointens").count() == 1, "terim: hiperintens")
    check(page.get_by_text("Klinik korelasyon önerilir", exact=True).count() >= 1, "terim: klinik korelasyon")
    check(page.get_by_text("Sonuçları onayla").count() == 0, "görüntüleme raporunda tahlil onayı açılmıyor")
    if page.get_by_role("button", name="Uygula").count():
        page.get_by_role("button", name="Uygula").click()
        page.get_by_text("Çekim: 15 Mar 2026").wait_for()
        check(True, "rapordan çekim tarihi önerisi uygulandı")
    else:
        check(False, "rapordan çekim tarihi önerisi")
    page.get_by_text("Aynı çekime ait belgeler").wait_for(timeout=10000)
    check(page.get_by_text("AX T2", exact=False).count() >= 1, "rapor ile MR serisi aynı çekim olarak bağlandı")
    page.screenshot(path=SHOTS / "64-radyoloji-raporu.png", full_page=True)

    # --- Tahlil olarak yüklenmiş röntgen filmi fotoğrafı: OCR'dan önce sorulur, görüntüleyicide incelenir
    page.goto(URL + "#/belgeler")
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for()
    # Telefon galerisi adı: dosya adından tür anlaşılmasın.
    film = {"name": "IMG_2041.jpg", "mimeType": "image/jpeg", "buffer": (IMG / "rontgen-film-foto.jpg").read_bytes()}
    page.set_input_files("input[type=file][multiple]", [film])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Bu fotoğraf bir tahlil raporundan çok bir görüntüye").wait_for(timeout=20000)
    check(page.get_by_text("Sonuçları onayla").count() == 0, "film fotoğrafında OCR kendiliğinden başlamadı")
    page.get_by_role("button", name="Röntgen", exact=True).click()
    page.locator("canvas[role=img]").wait_for(timeout=20000)
    check(page.get_by_role("heading", name="Röntgen").count() == 1, "film fotoğrafı röntgen olarak işaretlendi")
    before = canvas_brightness(page)
    page.get_by_label("Pencere ön ayarı").select_option(label="Otomatik kontrast")
    page.wait_for_timeout(300)
    check(abs(canvas_brightness(page) - before) > 1, "fotoğrafta otomatik kontrast çalışıyor")
    page.get_by_role("button", name="Negatif").click()
    page.get_by_role("button", name="Sağa döndür").click()
    page.wait_for_timeout(400)
    check(page.get_by_text("Bu fotoğraf bir görüntüye (film) benziyor").count() == 1, "film fotoğrafında rapor okuma kendiliğinden başlamadı")
    page.screenshot(path=SHOTS / "67-rontgen-film-foto.png")
    # Bölgesi bilinmeyen görüntü: "Vücutta göster" önce bölgeyi sorar, seçince 3B'de açar
    page.get_by_role("button", name="Vücutta göster", exact=True).click()
    page.get_by_label("Vücutta gösterilecek bölge").select_option(label="Göğüs / akciğer")
    page.wait_for_url("**/#/vucut/yapi/lungs", timeout=20000)
    page.get_by_text("Görüntülemelerin (", exact=False).wait_for(timeout=120000)
    check(page.get_by_text("Röntgen · ", exact=False).count() >= 1, "bölge seçilince röntgen 3B'de akciğerde görünüyor")
    page.screenshot(path=SHOTS / "67b-vucutta-rontgen.png")

    # --- Kâğıt BT raporunun fotoğrafı: kendiliğinden okunur, BT kesitiyle bağlanır
    page.goto(URL + "#/belgeler")
    page.get_by_role("radio", name="Tomografi (BT)").click()
    page.set_input_files("input[type=file][multiple]", [str(IMG / "toraks-bt-raporu-foto.png")])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Raporda geçen terimler").wait_for(timeout=240000)
    check(page.get_by_text("milimetrik nodül", exact=False).count() >= 1, "rapor fotoğrafı OCR ile okundu")
    check(page.get_by_text("Nodül", exact=True).count() >= 1, "terim: nodül")
    if page.get_by_role("button", name="Uygula").count():
        page.get_by_role("button", name="Uygula").click()
    page.get_by_text("Aynı çekime ait belgeler").wait_for(timeout=10000)
    check(page.get_by_text("TORAKS BT (SENTETIK)", exact=False).count() >= 1, "rapor fotoğrafı BT kesitiyle bağlandı")
    page.screenshot(path=SHOTS / "68-bt-rapor-foto.png", full_page=True)

    # --- Sonuçlar ve Zaman: görüntüleme raporları tahlillerle aynı yerde
    page.goto(URL + "#/sonuclar")
    page.get_by_text("Görüntüleme raporların (5)").wait_for(timeout=10000)
    check(page.get_by_text("Frontal beyaz cevherde nonspesifik", exact=False).count() >= 1, "Sonuçlar: MR raporunun sonucu")
    check(page.get_by_text("milimetrik nodül", exact=False).count() >= 1, "Sonuçlar: BT raporunun sonucu")
    page.screenshot(path=SHOTS / "69-sonuclar-goruntuleme.png", full_page=True)
    page.goto(URL + "#/zaman")
    page.get_by_text("Rapor geçmişi").wait_for()
    check(page.get_by_text("15 Mar 2026 · MR · Beyin / kafa").count() >= 1, "Zaman: MR çalışması rapor geçmişinde")
    page.screenshot(path=SHOTS / "70-zaman-goruntuleme.png", full_page=True)

    # --- Ölçümler tahlil gibi: rapordaki sayılar genel referansa göre
    page.goto(URL + "#/belgeler")
    page.get_by_role("radio", name="Ultrason", exact=True).click()
    page.set_input_files("input[type=file][multiple]", [str(IMG / "batin-usg-raporu.pdf")])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Raporda geçen terimler").wait_for(timeout=60000)
    olc = page.locator("section[aria-label='Ölçümler']")
    check(olc.get_by_text("2 tanesi genel referans dışında").count() == 1, "batın raporu: 2 ölçüm referans dışında")
    check(olc.get_by_text("Dalak uzunluğu").count() == 1 and olc.get_by_text("145 mm").count() >= 1, "dalak 14,5 cm → 145 mm")
    check(olc.get_by_text("Olası nedenler (kesin değil)").count() >= 1, "referans dışı ölçümde olası nedenler")
    check(olc.get_by_text("Böbrek uzunluğu").count() == 2, "sağ ve sol böbrek ayrı")
    page.screenshot(path=SHOTS / "71-olcumler-rapordan.png", full_page=True)

    # --- Elle ölçüm: MR'da cetvelle Evans indeksi (iki çizgi → oran)
    page.goto(URL + "#/belgeler")
    page.get_by_role("radio", name="Görüntüleme", exact=False).first.click()
    page.get_by_text("8 kesit").click()
    page.locator("canvas[role=img]").wait_for(timeout=20000)
    page.get_by_role("button", name="Cetvel").click()
    box = page.locator("canvas[role=img]").bounding_box()

    def draw(x1, y1, x2, y2):
        page.mouse.move(box["x"] + box["width"] * x1, box["y"] + box["height"] * y1)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] * x2, box["y"] + box["height"] * y2, steps=6)
        page.mouse.up()

    draw(0.38, 0.45, 0.62, 0.45)
    draw(0.12, 0.5, 0.88, 0.5)
    page.get_by_label("Ölçüm türü").select_option(label="Evans indeksi")
    page.get_by_role("button", name="Kaydet", exact=True).click()
    page.get_by_text("Kaydedildi — ", exact=False).wait_for()
    page.locator("section[aria-label='Ölçümler']").get_by_text("Evans indeksi").wait_for(timeout=10000)
    check(page.locator("section[aria-label='Ölçümler']").get_by_text("senin ölçümün", exact=False).count() >= 1, "elle ölçüm kaydedildi ve değerlendirildi")
    page.screenshot(path=SHOTS / "72-cetvel-evans.png")

    # --- BT'de yoğunluk (HU) ölçümü
    page.goto(URL + "#/belgeler")
    page.get_by_text("TORAKS BT (SENTETIK)").first.click()
    page.locator("canvas[role=img]").wait_for(timeout=20000)
    page.get_by_role("button", name="Yoğunluk ölçümü").click()
    box = page.locator("canvas[role=img]").bounding_box()
    draw(0.5, 0.3, 0.5, 0.36)
    check(page.get_by_text("ort. 40 HU", exact=False).count() >= 1, "BT: daire içi ortalama 40 HU")
    page.screenshot(path=SHOTS / "73-bt-hu.png")

    # --- 3B: referans dışı görüntüleme ölçümü organı tahlil gibi renklendirir
    page.goto(URL + "#/vucut/yapi/spleen")
    page.get_by_text("Görüntülemelerin (", exact=False).wait_for(timeout=120000)
    check(page.get_by_text("Dalak ▲", exact=False).count() >= 1, "3B: dalak referans dışı ölçümle vurgulandı")
    page.screenshot(path=SHOTS / "74-vucut-dalak.png")

    # --- Liste filtresi
    page.goto(URL + "#/belgeler")
    page.get_by_role("radio", name="Görüntüleme · 6").click()
    check(page.locator("section[aria-label=Belgeler] li").count() == 6, "görüntüleme filtresi: 6 belge (seri tek satır)")

    # --- Telefon görünümü: sekmeler "Bilgiler" / "Belge"
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("section[aria-label=Belgeler] li button").first.click()
    page.get_by_role("tab", name="Bilgiler").wait_for()
    page.screenshot(path=SHOTS / "65-telefon-bilgiler.png")
    page.get_by_role("tab", name="Belge").click()
    page.wait_for_timeout(800)
    page.screenshot(path=SHOTS / "66-telefon-belge.png")

    # --- Ekrandan çekilmiş MR fotoğrafı, tahlil olarak yüklenir: sorulur → MR → bölge görüntüdeki
    # yazılardan (ör. "MR BEYIN") önerilir → tek dokunuşla vücutta beyin → organ panelinde listelenir
    page.set_viewport_size({"width": 1366, "height": 900})
    page.goto(URL + "#/belgeler")
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for()
    shot = {"name": "IMG_3001.jpg", "mimeType": "image/jpeg", "buffer": (IMG / "mr-ekran-foto.jpg").read_bytes()}
    page.set_input_files("input[type=file][multiple]", [shot])
    page.get_by_role("button", name="Aç ve oku").click()
    page.get_by_text("Bu fotoğraf bir tahlil raporundan çok bir görüntüye").wait_for(timeout=20000)
    page.locator("main").get_by_role("button", name="MR", exact=True).last.click()
    page.get_by_text("Görüntüdeki yazılardan önerilen:").wait_for(timeout=180000)
    check("Beyin / kafa" in page.get_by_text("Görüntüdeki yazılardan önerilen:").locator("..").inner_text(), "MR fotoğrafı: bölge görüntüdeki yazılardan (beyin)")
    page.screenshot(path=SHOTS / "71-mr-foto-bolge-onerisi.png")
    page.get_by_role("button", name="Uygula ve vücutta göster").click()
    page.wait_for_url("**#/vucut/yapi/brain", timeout=30000)
    page.wait_for_timeout(4000)
    check("Görüntülemelerin" in (page.text_content("main") or ""), "beyin panelinde görüntüleme belgeleri listeleniyor")
    page.screenshot(path=SHOTS / "72-beyin-goruntulemeler.png")

    # --- Yazısız MR kolajı: kesitler ayrılır, sağ-sol karşılaştırması yapılır, dikkat bölgesi
    # sonuçlara eklenince 3B beyin işaretlenir ve "Sonucuma göre" görüntüyü açar
    page.goto(URL + "#/belgeler")
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for()
    page.get_by_role("radio", name="MR", exact=True).click()
    kolaj = {"name": "IMG_3002.jpg", "mimeType": "image/jpeg", "buffer": (IMG / "mr-kolaj-foto.jpg").read_bytes()}
    page.set_input_files("input[type=file][multiple]", [kolaj])
    page.get_by_role("button", name="Aç ve oku").click()
    card = page.get_by_role("region", name="Otomatik görüntü incelemesi")
    card.get_by_text("kesit bulundu", exact=False).wait_for(timeout=30000)
    text = card.inner_text()
    check("3 kesit bulundu · 2 tanesinde" in text, "kolaj 3 kesite ayrıldı, 2'si karşılaştırıldı (sagital hariç)")
    check(text.count("Kesit ") == 1 and "Kesit 2 · görüntünün sol üst kısmı · karşı tarafa göre daha parlak" in text, "tek taraflı odak doğru kesitte ve yarıda")
    check("Tanı değildir" in text, "inceleme tanı olmadığını söylüyor")
    card.screenshot(path=SHOTS / "73-mr-otomatik-inceleme.png")
    card.get_by_role("button", name="Sonuçlarıma ekle", exact=False).click()
    card.get_by_text("Sonuçlarına eklendi", exact=False).wait_for()
    page.get_by_text("Kesitlerin şeklinden önerilen (kesin değil):").wait_for()
    page.get_by_role("button", name="Uygula ve vücutta göster").click()
    page.wait_for_url("**#/vucut/yapi/brain", timeout=30000)
    page.get_by_text("Görüntü incelemesi (1 dikkat bölgesi)", exact=False).first.wait_for(timeout=120000)
    mine = page.get_by_role("button", name="Sonucuma göre", exact=False).first
    check(mine.is_enabled() and "görüntünle" in mine.inner_text(), "beyin: Sonucuma göre görüntülemeye bağlı")
    page.screenshot(path=SHOTS / "74-beyin-inceleme-vurgusu.png")
    mine.click()
    page.wait_for_url("**#/belge/**", timeout=20000)
    page.get_by_text("Sonuçlarına eklendi", exact=False).wait_for(timeout=30000)
    check(page.get_by_role("region", name="Otomatik görüntü incelemesi").count() == 1, "Sonucuma göre → incelemesi kaydedilen görüntü açıldı")

    csp = page.evaluate("window.__csp || []")
    check(not external, f"dış istek yok ({len(external)})")
    check(not [c for c in console if c.startswith("pageerror")], "sayfa hatası yok")
    check(not csp, "CSP ihlali yok")
    browser.close()

if problems:
    print("\n".join(console[-30:]))
    sys.exit(f"{len(problems)} sorun: " + "; ".join(problems))
print("imaging e2e: tamam")
