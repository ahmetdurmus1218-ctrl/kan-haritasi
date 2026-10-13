"""Uçtan uca: rapordan bağımsız ham görüntü analizi ve vücut merkezli ekranlar.

Kabul senaryoları (yalnızca sentetik görüntülerle):
  A. Yalnızca MR fotoğrafı (rapor yok) → tür/bölge tahmini, kalite, gözlem, beyin hiyerarşisi, "rapor yok"
  E. Yalnızca EKG fotoğrafı → ızgara kalibrasyonu, kalp hızı; PR/QRS/QT uydurulmaz
  F. Yalnızca pankreas ultrason görüntüsü → ultrason tanınır, organ tanıma "yok", pankreas bağlamı
  G. Yalnızca patoloji görüntüsü → doku/çekirdek ölçümü, tanı yok
  Vücudum → organ sayfası (Nasıl çalışır? → Benim durumum → İç yapı → Derin), "Neden?" zinciri
  Kabul 87 (bağırsak: içini göster, fizyoloji adım adım, derinleş), 88 (beyin MR ön incelemesi), 95 (2 kesit)
  UI kabul: "Veri ekle" ilk ekranda, alt gezinme ≤5, sonuçta az seçenek, arama, telefonda taşma yok

Kullanım: pnpm build && (cd apps/web && npx vite preview --port 4173), sonra
  python3 tests/e2e/multimodal.py [ekran-görüntüsü-klasörü]
"""
import io
import math
import os
import random
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw
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


def png(img: Image.Image) -> bytes:
    b = io.BytesIO()
    img.save(b, "PNG")
    return b.getvalue()


def ecg_png(mm=8, bpm=75, width=1200) -> bytes:
    h = mm * 40
    img = Image.new("RGB", (width, h), (253, 240, 240))
    d = ImageDraw.Draw(img)
    for x in range(0, width, mm):
        d.line([(x, 0), (x, h)], fill=(235, 120, 130) if x % (mm * 5) == 0 else (245, 190, 195))
    for y in range(0, h, mm):
        d.line([(0, y), (width, y)], fill=(235, 120, 130) if y % (mm * 5) == 0 else (245, 190, 195))
    base = h * 0.65
    beat = 60 / bpm * 25 * mm
    beats = [mm * 6 + k * beat for k in range(int(width / beat) + 1)]
    pts = []
    for x in range(width):
        v = 0.0
        for b in beats:
            dd = x - b
            v += 1.5 * mm * math.exp(-(((dd + 4 * mm) / (0.9 * mm)) ** 2))
            if abs(dd) <= mm:
                v += 12 * mm * (1 - abs(dd) / mm)
            v += 3 * mm * math.exp(-(((dd - 8 * mm) / (1.6 * mm)) ** 2))
        pts.append((x, base - v))
    d.line(pts, fill=(25, 25, 30), width=2)
    return png(img)


def ultrasound_png(w=480, h=400) -> bytes:
    img = Image.new("L", (w, h), 0)
    px = img.load()
    rnd = random.Random(7)
    for y in range(h):
        for x in range(w):
            dx, dy = x - w / 2, y - 20
            r = math.hypot(dx, dy)
            if dy <= 0 or r > h - 40 or abs(math.atan2(dx, dy)) > 0.62:
                continue
            v = 70 + 90 * rnd.random() * (1 - r / h)
            if (x - w / 2 - 30) ** 2 / 900 + (y - 200) ** 2 / 400 < 1:
                v *= 0.2
            px[x, y] = int(v)
    return png(img.convert("RGB"))


def pathology_png(w=400, h=300) -> bytes:
    img = Image.new("RGB", (w, h), (245, 243, 247))
    d = ImageDraw.Draw(img)
    d.ellipse([30, 30, 370, 270], fill=(220, 145, 185))
    rnd = random.Random(3)
    for _ in range(160):
        cx, cy = 60 + rnd.random() * 280, 50 + rnd.random() * 200
        if (cx - 200) ** 2 / 165**2 + (cy - 150) ** 2 / 115**2 >= 1:
            continue
        r = 3 + rnd.random() * 2
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(85, 50, 140))
    return png(img)


def upload(page, category: str, name: str, mime: str, data: bytes):
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    # Tür seçimi isteğe bağlı ve varsayılan olarak gizli (sistem kendisi anlar).
    toggle = page.get_by_role("button", name=re.compile("Türünü kendim seçeyim|Tür: "))
    if toggle.count():
        toggle.click()
    radio = page.get_by_role("radio", name=category, exact=True)
    if radio.count():
        radio.click()
    else:
        page.get_by_label("Diğer belge türleri").select_option(label=category)
    page.set_input_files("input[type=file][multiple]", [{"name": name, "mimeType": mime, "buffer": data}])
    page.get_by_role("button", name="Aç ve oku").click()


def expand(page):
    """Organ sayfasında "Daha fazla göster" (sekme değişince açık kalabilir)."""
    b = page.get_by_role("button", name="Daha fazla göster")
    if b.count():
        b.click()


def card_text(card) -> str:
    """Kartın tamamı (kapalı "Nasıl analiz edildi?" dahil)."""
    return card.evaluate("e => e.textContent")


def open_technical(card):
    det = card.locator("details", has_text="Nasıl analiz edildi?").first
    if det.count() and not det.evaluate("d => d.open"):
        det.locator("summary").first.click()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, device_scale_factor=1)
    ctx.set_default_timeout(60000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)
    page.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for(timeout=20000)

    # --- UI kabul: ana sayfa "Vücudum nasıl?" sorusunu yanıtlar; "Veri ekle" ve "Vücudum" hemen görünür
    check(page.get_by_role("link", name="Veri ekle").first.is_visible(), "UI: 'Veri ekle' ilk ekranda görünür")
    check(page.get_by_role("link", name="Vücudum").first.is_visible(), "UI: ana gezinmede 'Vücudum' görünür")
    labels = [x.strip() for x in page.locator("nav[aria-label] a, nav[aria-label] button").all_inner_texts() if x.strip()]
    check(not any(w in " ".join(labels) for w in ("Kapsam", "Simülasyon", "Hakkında", "DICOM")), f"UI: gezinmede teknik öğe yok {labels}")

    # --- A / kabul 88: yalnızca MR fotoğrafı, rapor yok → görüntü ÖN İNCELEMESİ (tıbbi model değil)
    upload(page, "MR", "brain_mri.jpg", "image/jpeg", (IMG / "mr-kolaj-foto.jpg").read_bytes())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Görüntü ön incelemesi yapıldı").wait_for(timeout=60000)
    card.get_by_role("list", name="Görüntüden çıkan gözlemler").wait_for()
    vis = card.inner_text()
    check("Analiz tamamlandı" not in vis, "88: yalnızca simetri çalıştıysa 'Analiz tamamlandı' denmiyor")
    check("ön inceleme · tıbbi model değil" in vis and "Bu bir tıbbi görüntü tanı modeli değildir" in vis, "88: ön kontrolün tıbbi model olmadığı açık")
    check("Rapor yok" in vis and "yalnızca görüntünün kendisine dayanıyor" in vis, "A: rapor olmadığı ve analizin yalnızca görüntüye dayandığı özette")
    check("Bu bir MR görüntüsü gibi görünüyor" in vis and "Beyin" in vis, "A: modalite ve bölge (beyin) tahmini sade cümleyle")
    check("Tür: kullanıcı seçimi" in vis, "35: MR türü kullanıcı seçimi olarak işaretli (görüntüden doğrulanmış gibi değil)")
    check("İnceleme kapsamı:" in vis and "Görüntü kapsamı sınırlı" in vis, "95: fotoğrafta kapsam sınırlı ve kesit sayısı yazılı")
    steps = card.get_by_role("list", name="Görüntü ön incelemesi adımları").inner_text()
    for label in ["Görüntü okundu", "Kesitleri ayırma", "Orta hat", "Sağ-sol simetri ön kontrolü"]:
        check(label in steps, f"88: ✓ {label}")
    check("Lezyon analizi" in steps and "Bu kurulumda tıbbi AI modeli yok." in steps, "88: ◻ lezyon analizi — tıbbi AI modeli yok")
    check("Organ segmentasyonu" in steps and "MR sekansı" in steps and "Belirlenemedi." in steps, "88/34: ◻ segmentasyon, MR sekansı belirlenemedi")
    check("yarıküre" in vis, "A: gözlem kartı konumu (beyin → yarıküre → lob)")
    check("Görüntü asimetrisi gözlemi" in vis and "tıbbi bulgu değil" in vis and "Kaynak:" in vis, "56: sağ-sol farkı 'görüntü asimetrisi gözlemi', bulgu değil")
    check(not re.search(r"lezyon (izlendi|var|tespit edildi)|tümör|kitle", vis.lower()), "110: asimetri lezyon/tümör diye yorumlanmıyor")
    nbtn = card.locator("button:visible").count()
    check(nbtn <= 8, f"UI: MR sonucunda az sayıda seçenek ({nbtn} düğme)")
    check(card.get_by_role("button", name="Gözlemleri gör").count() == 1 and card.get_by_role("button", name="Vücudumda göster").count() >= 1, "UI: sonuç ekranında 'Gözlemleri gör' / 'Vücudumda göster'")
    card.screenshot(path=SHOTS / "90-ham-goruntu-analizi-mr.png")
    open_technical(card)
    t = card.inner_text()
    check("Heuristic (kural tabanlı; tıbbi AI modeli değil)" in t and "Sağ-sol ayna karşılaştırması" in t and "1.0.0" in t and "Evet" in t, "60: teknik detaylarda model / tür / versiyon / cihazda")
    check("parlama, kesilme ya da düşük çözünürlük saptanmadı" in t or "bulanık" in t or "Görüntü kalitesi" in t, "A: kalite kontrolü yapıldı")
    card.get_by_role("button", name="İncele").first.click()
    t = card.inner_text()
    check("GÖRÜNTÜ · KURAL TABANLI" in t and "güven" in t, "A: gözlem kaynaklı (kural tabanlı) ve güvenli (İncele)")
    check("gerçek görüntü üzerinde piksel konumu var" in t, "A: gerçek görüntüde konum var")
    card.get_by_role("button", name="Neden? / Neyi etkiler?").first.click()
    check(card.get_by_text("Normalde ne yapar").count() >= 1, "A: 'Neden?' zinciri açılıyor (normal işlev)")
    card.screenshot(path=SHOTS / "90b-ham-goruntu-analizi-mr-acik.png")
    sysrev = page.get_by_role("region", name="Sistematik değerlendirme")
    if sysrev.count():
        st = sysrev.inner_text()
        check("Görüntü kapsamı sınırlı" in st and "mevcut" in st, "33/95: 2 kesitten tam beyin MR protokolü izlenimi verilmiyor")
        check("Tüm beyin" not in st and "tamamen değerlendirildi" not in st, "95: 'tüm beyin MR değerlendirildi' denmiyor")
    page.get_by_role("button", name="Vücutta göster", exact=False).last.click()
    page.wait_for_timeout(500)
    check("#/vucut/yapi/brain" in page.url, "88: Vücutta göster → beyin açılır")
    page.wait_for_timeout(800)

    # Ana sayfa artık özet gösteriyor
    page.goto(URL + "#/")
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for()
    check(page.get_by_text("Son durum").count() >= 1, "UI: ana sayfada 'Son durum' özeti")
    check("görüntü/rapor gözlemi" in page.locator("main").inner_text(), "UI: asimetri anormallik değil 'gözlem' olarak sayılıyor")
    page.screenshot(path=SHOTS / "90c-ana-sayfa.png", full_page=True)

    # Vücudum → beyin (görüntü gözlemi kaydedildi)
    page.goto(URL + "#/vucudum")
    page.get_by_role("heading", name="Vücudum", exact=True).wait_for()
    page.get_by_role("button", name="Beyin", exact=False).first.wait_for()
    check("görüntü asimetrisi gözlemi" in page.locator("main").inner_text(), "Vücudum: beyinde görüntü asimetrisi gözlemi sayılıyor")
    page.screenshot(path=SHOTS / "91-vucudum.png", full_page=True)
    page.get_by_role("button", name="Beyin", exact=False).first.click()
    sheet = page.locator("dialog[open]")
    sheet.get_by_text("Detaylı incele").wait_for()
    check(sheet.get_by_role("button", name="Normalde nasıl çalışır?").count() == 1, "UI: organa dokununca alt sayfa (özet + yollar)")
    sheet.get_by_role("button", name="Detaylı incele").click()
    page.get_by_role("heading", name="Beyin", exact=True).wait_for()
    main = page.locator("main")
    mt = main.inner_text()
    check("1. NASIL ÇALIŞIR?" in mt.upper() and "2. BENİM DURUMUM" in mt.upper(), "78: organ ilk ekranı: önce nasıl çalışır, sonra benim durumum")
    check("Seviye 6" not in mt and "Detaylandır" not in mt, "48/76: ilk ekranda hücre/molekül ağacı açık değil")
    check("Belirsiz" in mt or "gözlem" in mt, "69: organ durumu 'Belirsiz' (gözlem, anormallik değil)")
    page.get_by_role("button", name="Sonuçlarımı gör").click()
    page.get_by_text("Görüntülerimden çıkan gözlemler").wait_for()
    check(page.get_by_text("radyolog raporu değildir", exact=False).count() >= 1, "Organ sayfası: görüntü gözlemi rapor değil diye işaretli")
    check(page.get_by_text("Bende (fark)").count() >= 1 and page.get_by_text("Görüntü asimetrisi gözlemi (doğrulanmamış)").count() >= 1, "Benim durumum: fark kaynağıyla")
    page.screenshot(path=SHOTS / "92-organ-beyin-benim.png", full_page=True)

    # Kabul 88 devamı: normal beyin anatomisi → frontal lob → normal işlev (derinleşme)
    page.goto(URL + "#/organ/brain")
    page.get_by_text("Normalde ne işe yarar?").first.wait_for()
    check(page.get_by_text("Planlama, karar verme, dikkat").count() >= 1, "Normal: beyin işlevleri")
    page.screenshot(path=SHOTS / "93-organ-beyin.png", full_page=True)

    # UI kabul: anatomi → doku → hücre → süreç → molekül, seviye seviye (Derinlemesine incele)
    page.goto(URL + "#/organ/brain.white-matter")
    page.get_by_role("button", name="Derinlemesine incele").click()
    page.get_by_text("Seviye 2 / Bölge").first.wait_for()
    for name in ["Dokuyu gör", "Hücreyi gör", "Süreci gör", "Moleküler mekanizmayı gör"]:
        cards = page.locator("li", has=page.get_by_role("button", name=name))
        target = {"Dokuyu gör": "Beyaz cevher dokusu", "Hücreyi gör": "Oligodendrosit", "Süreci gör": "Miyelin oluşumu", "Moleküler mekanizmayı gör": "Miyelin"}[name]
        cards.filter(has_text=target).first.get_by_role("button", name=name).click()
        page.wait_for_timeout(250)
    mt = main.inner_text()
    check("Seviye 6 / Molekül" in mt and "Miyelin" in mt, "UI: anatomi → doku → hücre → süreç → molekül iniş (Oligodendrosit → Miyelin)")
    crumb = page.get_by_role("navigation", name="Şu anda neredeyim?").inner_text()
    check(all(x in crumb for x in ["Vücut", "Sinir sistemi", "Beyin", "Beyaz cevher", "Oligodendrosit"]), f"14/15: her derinlikte breadcrumb ({crumb!r})")
    page.go_back()
    page.wait_for_timeout(300)
    check("Seviye 5" in main.inner_text(), "101: geri tuşu bir seviye yukarı döndürüyor")

    # --- Kabul 87: Vücudum → Sindirim sistemi → İnce bağırsak
    page.goto(URL + "#/vucudum")
    page.get_by_role("button", name="Sindirim", exact=True).click()
    page.get_by_role("heading", name="Sindirim sistemi").wait_for()
    page.get_by_role("button", name="İnce bağırsak", exact=False).first.click()
    page.get_by_role("heading", name="İnce bağırsak", exact=True).wait_for()
    mt = main.inner_text()
    check("Normalde ne işe yarar?" in mt and "Besin emilimi" in mt, "87: önce bağırsağın ne olduğu / nasıl çalıştığı")
    check("Seviye 4" not in mt and "Enterosit" not in mt.split("4. İÇ YAPI")[0], "87: ilk ekranda hücreye atlanmıyor")
    page.screenshot(path=SHOTS / "94a-bagirsak.png", full_page=True)
    page.get_by_role("button", name="Organın içine gir").click()
    page.get_by_text("İnce bağırsak · içi").wait_for()
    seen = []
    for _ in range(6):
        seen.append(page.get_by_role("region", name="Bu adım").locator("h2").inner_text())
        nxt = page.get_by_role("button", name=re.compile("^Bir seviye daha"))
        if not nxt.count():
            break
        nxt.click()
        page.wait_for_timeout(150)
    check(seen == ["Bağırsak duvarı", "Mukozal yüzey", "Villuslar", "Enterosit (emici epitel hücresi)"], f"87/39: içini göster: duvar → mukoza → villus → hücre ({seen})")
    check(page.get_by_role("button", name=re.compile("İçeri gir · Bağırsak villusları")).count() >= 1, "38: mevcut VillusScene bu akışa bağlı")
    page.screenshot(path=SHOTS / "94b-bagirsak-ici.png", full_page=True)
    page.get_by_role("button", name=re.compile("Daha derine in")).click()
    page.get_by_text("Seviye 5 / Biyolojik süreç").first.wait_for()
    check("Besin emilimi" in main.inner_text(), "87: derinleş: hücre → süreç → molekül")
    page.goto(URL + "#/organ/small-intestine")
    page.get_by_role("button", name=re.compile("^Fizyolojiyi adım adım incele")).click()
    page.get_by_text("1 / 11").first.wait_for()
    titles = []
    for _ in range(11):
        titles.append(page.get_by_role("region", name="Bu basamak").locator("h2").inner_text())
        nxt = page.get_by_role("button", name="Sonraki")
        if not nxt.count():
            break
        nxt.click()
        page.wait_for_timeout(120)
    check(titles[:3] == ["Besin", "Mide", "Duodenum"] and "Villus" in titles and titles[-1] == "Dolaşım", f"87/9: normal fizyoloji adım adım ({titles})")
    page.get_by_role("button", name="Önceki").click()
    check("10 / 11" in main.inner_text(), "44: ← Önceki · 10 / 11")
    page.get_by_role("button", name="Benim durumuma göre göster").click()
    page.get_by_text("Benim verilerimde").wait_for()
    check("“sorunlu” sayılmaz" in main.inner_text(), "12/83: verisi olmayan basamak sorunlu gösterilmiyor")
    page.screenshot(path=SHOTS / "94c-akis-emilim.png", full_page=True)

    # Keşif modu: sistem seç → akış
    page.goto(URL + "#/akis")
    page.get_by_role("heading", name="Vücudun nasıl çalıştığını keşfet").wait_for()
    for sysname in ["Sindirim", "Dolaşım", "Solunum", "Sinir sistemi", "Hormonlar", "Böbrek / idrar", "Bağışıklık", "Kan", "Kas", "Üreme"]:
        check(page.get_by_role("region", name=sysname).count() == 1, f"11: keşif modunda sistem: {sysname}")
    page.get_by_role("button", name=re.compile("^Kalp ve dolaşım")).click()
    page.get_by_text("Vena cava").first.wait_for()
    check("1 / 8" in main.inner_text(), "10: kalp akışı 8 adım")

    page.goto(URL + "#/organ/pancreas")
    page.get_by_text("Normalde ne işe yarar?").first.wait_for()
    flows = [b.inner_text() for b in page.get_by_role("region", name="1. Nasıl çalışır?").get_by_role("button").all()]
    check(any("Pankreas enzimleri" in f for f in flows) and any("Kan şekeri" in f for f in flows), f"10: pankreas: enzim ve kan şekeri akışları ({flows})")
    page.screenshot(path=SHOTS / "94-organ-pankreas.png", full_page=True)

    # UI kabul: genel arama
    page.keyboard.press("Control+k")
    page.get_by_role("searchbox").or_(page.locator("dialog[open] input")).first.fill("pankreas")
    dlg = page.locator("dialog[open]")
    dlg.get_by_text("Pankreas", exact=True).first.wait_for()
    check(dlg.get_by_role("button", name="Normalde nasıl çalışır?").count() >= 1 and dlg.get_by_role("button", name="İçine gir").count() >= 1, "UI: arama 'pankreas' → organ ve alt bağlantılar")
    page.keyboard.press("Escape")

    # --- E: yalnızca EKG fotoğrafı
    upload(page, "EKG", "ECG_photo.png", "image/png", ecg_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Kalp hızı yaklaşık", exact=False).wait_for(timeout=60000)
    t = card_text(card)
    check("Kalp hızı yaklaşık 7" in t, "E: kalp hızı ölçüldü (~75/dk)")
    check("QT / QTc" in t and "ölçülmedi" in t, "E: QT ölçülmedi, uydurulmadı")
    check("Kalp" in t, "E: bölge kalp")
    open_technical(card)
    card.screenshot(path=SHOTS / "95-ekg-analizi.png")

    # --- F: yalnızca pankreas ultrasonu
    upload(page, "Ultrason", "pancreas_ultrasound.png", "image/png", ultrasound_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Görüntü ön incelemesi yapıldı").wait_for(timeout=60000)
    t = card_text(card)
    check("Ultrason" in t, "F: ultrason tanındı")
    check("Organı görüntüden tanıma (ör. pankreas)" in t, "F: organ tanıma modeli olmadığı açık")
    check("Pankreas" in t, "F: pankreas bağlamı (dosya adı) gösteriliyor")
    open_technical(card)
    card.screenshot(path=SHOTS / "96-ultrason-analizi.png")

    # --- G: yalnızca patoloji görüntüsü
    upload(page, "Patoloji / biyopsi", "pathology_slide.png", "image/png", pathology_png())
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_text("Görüntü ön incelemesi yapıldı").wait_for(timeout=60000)
    t = card_text(card)
    check("çekirdek" in t, "G: çekirdek ölçümü yapıldı")
    check("Patolojik tanı" in t and "tanı üretilmedi" in t, "G: tanı üretilmedi")
    open_technical(card)
    card.screenshot(path=SHOTS / "97-patoloji-analizi.png")

    # --- Telefon genişliği: alt gezinme ≤5 öğe, Vücudum yatay kaydırma yok
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(URL + "#/")
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for()
    bottom = page.get_by_role("navigation", name="Ana gezinme")
    n_items = bottom.locator("a:visible, button:visible").count()
    check(1 <= n_items <= 5, f"telefon: alt gezinmede en fazla 5 öğe ({n_items})")
    check(bottom.get_by_role("link", name="Ekle").is_visible(), "telefon: ortada 'Ekle'")
    check(bottom.get_by_role("link", name="Sonuçlar").is_visible(), "telefon: alt gezinmede 'Sonuçlar'")
    bottom.get_by_role("button", name="Daha").click()
    more = page.locator("dialog[open]")
    more.get_by_text("Görüntüler", exact=True).wait_for()
    check(more.get_by_text("Zamanım", exact=True).count() == 1 and more.get_by_text("Belgelerim", exact=True).count() == 1, "telefon: 'Daha' alt sayfasında Görüntüler, Zamanım, Belgelerim")
    page.keyboard.press("Escape")
    page.goto(URL + "#/vucudum")
    page.get_by_role("heading", name="Vücudum", exact=True).wait_for()
    sw = page.evaluate("() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth")
    dw = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(sw <= 1 and dw <= 1, f"telefon: Vücudum yatay taşma yok ({sw}, {dw})")
    page.screenshot(path=SHOTS / "98-telefon-vucudum.png", full_page=True)
    page.goto(URL + "#/organ/brain")
    page.get_by_role("heading", name="Beyin", exact=True).wait_for()
    dw = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(dw <= 1, f"telefon: organ sayfası yatay taşma yok ({dw})")
    page.screenshot(path=SHOTS / "99-telefon-organ.png", full_page=True)

    csp = page.evaluate("window.__csp")
    check(not csp, f"CSP ihlali yok {csp}")
    errs = [c for c in console if "error" in c.lower()]
    check(not errs, f"konsol hatası yok {errs[:3]}")
    check(not external, f"dışarıya istek yok {external[:3]}")
    browser.close()

print(f"\n{len(problems)} sorun" if problems else "\nTümü geçti")
sys.exit(1 if problems else 0)
