"""Uçtan uca (telefon ekranı): MR fotoğrafı → dürüst yönlendirme; beyin MR raporu → Beyin haritası →
bölge → rapor cümlesi adım adım (7 adım) → bölgenin iç dünyasına gir (kişisel veri o basamakta).

Kabul:
  - MR fotoğrafından bölge/bulgu uydurulmaz ("şurada şu var" denmez); rapor ve DICOM yolu gösterilir,
    sağ-sol ön kontrolü kapalı "teknik ön kontrol" bölümündedir.
  - Rapor cümleleri beynin bölgelerine yerleşir; sinüs cümlesi beyne yazılmaz.
  - "Her iki" denen bulgu tek bir yarıküreye (ör. "Sol yarıküre") yazılmaz.
  - Her cümle: Raporda ne yazıyor → Sade dille → Beyinde nerede → Normalde ne yapar → İçine gir →
    Daha derine in → Hekimine sor.
  - Haritadaki her bölgenin iç dünyası açılır (beynin her yerine girilir).
  - Telefonda yatay taşma yok.

Kullanım: pnpm build && (cd apps/web && npx vite preview --port 4173), sonra
  python3 tests/e2e/brainmap.py [ekran-görüntüsü-klasörü]
"""
import os
import re
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

# Haritadaki bölgeler (packages/analysis/src/interior/data/brain.ts → BRAIN_REGIONS) ve açılması gereken iç dünya.
REGIONS = {
    "brain.frontal": "brain.frontal",
    "brain.parietal": "brain.parietal",
    "brain.temporal": "brain.temporal",
    "brain.occipital": "brain.occipital",
    "brain.insula": "brain.insula",
    "brain.white-matter": "brain.white-matter",
    "brain.corpus-callosum": "brain.corpus-callosum",
    "brain.basal-nuclei": "brain.basal-nuclei",
    "brain.thalamus": "brain.thalamus",
    "brain.hippocampus": "brain.hippocampus",
    "brain.amygdala": "brain.amygdala",
    "brain.hypothalamus": "ic.hypothalamus",
    "brain.ventricles": "brain.ventricles",
    "brain.meninges": "brain.meninges",
    "brain.cerebellum": "brain.cerebellum",
    "brain.midbrain": "brain.midbrain",
    "brain.pons": "brain.pons",
    "brain.medulla": "brain.medulla",
    "pituitary": "pituitary",
    "vessel.circle-of-willis": "vessel.circle-of-willis",
}


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)
    if not cond:
        problems.append(msg)


def upload(page, name, mime, data, category=None):
    page.goto(URL + "#/ekle")
    page.get_by_text("Tahlil, Rapor veya Görüntü Yükle").wait_for()
    if category:
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


def no_overflow(page, label):
    w = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    check(w <= 1, f"telefon: yatay taşma yok ({label}, {w}px)")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    ctx.set_default_timeout(60000)
    page = ctx.new_page()
    console, external = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith((URL.rstrip("/"), "blob:", "data:")) else None)

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_role("heading", name="Vücudum nasıl?").wait_for(timeout=30000)

    # ------------------------------------------------------------ boş harita: rapor iste
    page.goto(URL + "#/beyin")
    page.get_by_test_id("brain-empty").wait_for()
    check("raporun kendisi" in page.get_by_test_id("brain-empty").inner_text(), "boş harita: fotoğraf değil rapor gerektiği yazıyor")

    # ------------------------------------------------------------ MR fotoğrafı: bölge uydurulmaz
    upload(page, "beyin_mr.jpg", "image/jpeg", (IMG / "mr-kolaj-foto.jpg").read_bytes(), "MR")
    card = page.get_by_role("region", name="Ham görüntü analizi")
    card.get_by_test_id("read-guide").wait_for(timeout=120000)
    vis = card.inner_text()
    check("sonuç çıkarılmaz" in vis and "Radyoloji raporunu ekle" in vis and "DICOM" in vis, "MR fotoğrafı: okuma yolu (rapor / DICOM) gösteriliyor")
    check(not re.search(r"(alın|şakak|yan kafa|arka kafa) lob|yarıküre", vis.lower()), "MR fotoğrafı: bir loba/yarıküreye yer verilmiyor")
    check(not card.get_by_role("list", name="Görüntüden çıkan gözlemler").is_visible(), "asimetri gözlemleri kapalı teknik bölümde")
    no_overflow(page, "MR fotoğrafı sonucu")
    page.screenshot(path=SHOTS / "b1-mr-foto.png", full_page=True)

    # ------------------------------------------------------------ rapor → harita
    upload(page, "beyin-mr-raporu.pdf", "application/pdf", (IMG / "beyin-mr-raporu.pdf").read_bytes())
    page.get_by_test_id("report-brain-map").first.wait_for(timeout=120000)
    page.get_by_test_id("report-brain-map").first.click()
    page.wait_for_url("**/#/beyin")
    summary = page.get_by_test_id("brain-summary").inner_text()
    print("özet:", summary)
    check(re.search(r"\d+ cümle okundu: [1-9]\d* dikkat çeken", summary) is not None, "harita: rapor cümleleri okundu, dikkat çekenler sayıldı")
    main = page.locator("main").inner_text()
    check("maksiller" not in main.lower(), "sinüs cümlesi beyin haritasına yazılmıyor")
    frontal = page.locator("svg [data-region='brain.frontal']")
    check(frontal.get_attribute("data-status") == "attention", "çizimde alın lobu 'dikkat' olarak işaretli (metinle: '!')")
    no_overflow(page, "beyin haritası")
    page.screenshot(path=SHOTS / "b2-beyin-haritasi.png", full_page=True)

    # ------------------------------------------------------------ bölge → 7 adım
    frontal.click()
    page.wait_for_url("**/#/beyin/brain.frontal")
    crumb = page.get_by_role("navigation", name="Şu anda neredeyim?").inner_text()
    check("Sol yarıküre" not in crumb and "Sağ yarıküre" not in crumb, f"'her iki' bulgusu tek yarıküreye yazılmıyor ({crumb!r})")
    steps = page.get_by_test_id("finding-steps")
    steps.wait_for()
    titles = []
    for i in range(7):
        titles.append(steps.inner_text())
        if i < 6:
            steps.get_by_role("button", name="Sonraki").click()
    joined = "\n".join(titles)
    for label in ["1. Raporda ne yazıyor?", "2. Sade dille", "3. Beyinde nerede?", "4. Bu bölge normalde ne yapar?", "5. İçine gir", "6. Daha derine in", "7. Hekimine sor"]:
        check(label in joined, f"adım: {label}")
    check("Milimetrik: milimetre boyutunda" in joined and "Hiperintens" in joined, "sade dil: sözcüklerin anlamı")
    check("Korteksin hemen altındaki beyaz cevher (subkortikal)" in joined and "İki tarafta" in joined, "nerede: katman ve taraf rapordan")
    check("rapor metninden okundu" in joined, "nerede: konumun kaynağı (rapor metni) yazılı")
    page.screenshot(path=SHOTS / "b3-adim-adim.png", full_page=True)
    steps.get_by_role("button", name="5. İçine gir").click()
    steps.get_by_test_id("finding-enter").click()
    page.wait_for_url("**/#/ic/brain.frontal/1")
    page.get_by_test_id("interior-label").wait_for(timeout=120000)
    page.wait_for_timeout(1500)
    check("Benim verim" in page.locator("body").inner_text(), "iç dünya: rapor cümlesi kişisel veri olarak basamakta")
    page.screenshot(path=SHOTS / "b4-alin-lobu-ic.png")

    # ------------------------------------------------------------ beynin her bölgesine girilir
    for region, interior in REGIONS.items():
        page.goto(URL + f"#/beyin/{region}")
        enter = page.get_by_test_id("brain-enter")
        enter.wait_for()
        enter.click()
        page.wait_for_url(f"**/#/ic/{interior}**")
        page.get_by_test_id("interior-label").wait_for(timeout=120000)
        check("Eğitimsel" in page.get_by_test_id("interior-label").inner_text(), f"{region}: iç dünyası açıldı ({interior})")

    check(not [c for c in console if "pageerror" in c], f"sayfa hatası yok ({console[:3]})")
    check(not external, f"dış ağ isteği yok ({external[:3]})")
    browser.close()

print(f"\n{len(problems)} sorun" if problems else "\nTümü geçti")
sys.exit(1 if problems else 0)
