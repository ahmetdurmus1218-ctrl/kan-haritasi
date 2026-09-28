"""Uçtan uca doğrulama: gerçek Chromium'da kurulum, yükleme, görüntüleme, indirme,
yeniden adlandırma, silme, kilit ve depolama sızıntı kontrolü.

Kullanım:
  pnpm build && pnpm preview          # ayrı terminalde, http://localhost:4173
  pip install playwright && playwright install chromium
  python3 tests/e2e/smoke.py [ekran-görüntüsü-klasörü]
İsteğe bağlı: CHROME_PATH ile Chromium yolu verilebilir.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tests/e2e/.shots")
SHOTS.mkdir(parents=True, exist_ok=True)
PDF = ROOT / "fixtures/reports/sentetik-kan-tahlili.pdf"
PNG = ROOT / "fixtures/reports/sentetik-kan-tahlili.png"
URL = "http://localhost:4173/"
PASS = "cok-gizli-parola-2026"

problems: list[str] = []
external: list[str] = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        problems.append(msg)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    ctx.set_default_timeout(120000)
    page = ctx.new_page()
    console = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost:4173", "blob:", "data:")) else None)
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    """)

    page.goto(URL)
    page.get_by_text("Kasanı oluştur").wait_for()
    page.screenshot(path=SHOTS / "01-kurulum.png")

    page.fill("#pass", PASS)
    page.fill("#confirm", PASS)
    page.check("input[type=checkbox]")
    page.get_by_role("button", name="Kasayı oluştur").click()
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for(timeout=20000)
    page.screenshot(path=SHOTS / "02-belgeler-bos.png")

    # Yükleme: PDF + PNG + sahte (.pdf uzantılı HTML)
    fake = SHOTS / "sahte.pdf"
    fake.write_text("<html><script>alert(1)</script></html>")
    page.set_input_files("input[type=file][multiple]", [str(PDF), str(PNG), str(fake)])
    page.get_by_text("Dosyanın içeriği PDF, JPG, PNG veya desteklenen bir DICOM değil.").wait_for(timeout=20000)
    page.locator('ul li').nth(1).wait_for(timeout=20000)
    page.screenshot(path=SHOTS / "03-yuklendi.png", full_page=True)
    check(page.locator("ul li").count() == 2, "iki geçerli dosya listede, sahte dosya reddedildi")

    # Aynı dosya tekrar
    page.set_input_files("input[type=file][multiple]", [str(PDF)])
    page.get_by_text("Bu dosya zaten yüklü").wait_for(timeout=20000)
    check(page.locator("ul li").count() == 2, "çift yükleme engellendi")

    # Depoda açık metin var mı? (OPFS + IndexedDB)
    leak = page.evaluate("""async () => {
      const needles = ['LDL Kolesterol', 'ÖRNEK HASTA', 'sentetik-kan-tahlili', '%PDF-'];
      const found = [];
      const scan = (label, bytes) => {
        const text = new TextDecoder('latin1').decode(bytes) + '\\n' + new TextDecoder().decode(bytes);
        for (const n of needles) if (text.includes(n)) found.push(label + ':' + n);
      };
      try {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle('kh-blobs');
        for await (const [name, h] of dir.entries()) scan('opfs/' + name, new Uint8Array(await (await h.getFile()).arrayBuffer()));
      } catch (e) { found.push('opfs-error:' + e); }
      const db = await new Promise((res, rej) => { const r = indexedDB.open('kan-haritasi'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const store of db.objectStoreNames) {
        const all = await new Promise((res) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); });
        scan('idb/' + store, new TextEncoder().encode(JSON.stringify(all)));
      }
      return found;
    }""")
    check(leak == [], f"depoda açık metin/dosya adı yok {leak}")

    # PDF'i aç, ara
    page.locator("ul li").filter(has_text="· PDF ·").first.locator("button").first.click()
    # Mobilde belge ekranı "Sonuçlar" sekmesiyle açılır; görüntüleyici "Belge" sekmesinde
    page.get_by_role("tab", name="Belge").click()
    page.wait_for_selector("canvas", timeout=20000)
    page.wait_for_timeout(1200)
    page.screenshot(path=SHOTS / "04-pdf.png")
    page.fill("input[aria-label='Belgede ara']", "ldl")
    page.keyboard.press("Enter")
    page.get_by_text("1/2 sayfa").wait_for(timeout=10000)
    page.wait_for_timeout(800)
    page.screenshot(path=SHOTS / "05-pdf-arama.png")
    nonblank = page.evaluate("""() => { const c = document.querySelector('canvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let dark=0; for (let i=0;i<d.length;i+=16) if (d[i]<128) dark++; return dark; }""")
    check(nonblank > 500, f"PDF sayfası çizildi (koyu piksel örneği: {nonblank})")
    check(page.get_by_role("tab", name="Sonuçlar").count() == 1, "belge ekranında okunan sonuçlar sekmesi")

    # İndir ve orijinalle karşılaştır
    with page.expect_download() as dl:
        page.get_by_role("button", name="Orijinal dosyayı indir").first.click()
    d = dl.value
    got = Path(d.path()).read_bytes()
    check(hashlib.sha256(got).hexdigest() == hashlib.sha256(PDF.read_bytes()).hexdigest(), f"indirilen dosya orijinalle bayt bayt aynı ({d.suggested_filename})")

    # Sayfa 2
    page.get_by_role("button", name="Sonraki sayfa").click()
    page.wait_for_timeout(600)
    check(page.input_value("input[aria-label='Sayfa numarası']") == "2", "sayfa gezinme")

    page.get_by_role("button", name="Belgelere dön").click()
    page.get_by_text("Laboratuvar Raporunu Yükle").wait_for()

    # Görseli aç, döndür
    page.locator("ul li").filter(has_text="· PNG ·").first.locator("button").first.click()
    page.get_by_role("tab", name="Belge").click()
    page.wait_for_selector("img[alt='Yüklenen rapor görseli']", timeout=10000)
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Sağa döndür").click()
    page.wait_for_timeout(400)
    page.screenshot(path=SHOTS / "06-gorsel-dondurulmus.png")
    page.get_by_role("button", name="Belgelere dön").click()

    # Yeniden adlandır
    page.locator("ul li").first.get_by_role("button", name="Yeniden adlandır").click()
    page.fill("#rename", "Eylül Check-up <b>kalın</b>")
    page.get_by_role("button", name="Kaydet").click()
    page.get_by_text("Eylül Check-up <b>kalın</b>").wait_for()
    check(page.locator("ul li b").count() == 0, "görünen addaki HTML metin olarak kaldı (XSS yok)")

    # Sil
    before = page.locator("ul li").count()
    page.locator("ul li").first.get_by_role("button", name="Sil").click()
    page.screenshot(path=SHOTS / "07-silme-onay.png")
    page.get_by_role("button", name="Kalıcı olarak sil").click()
    page.get_by_text("Belge ve anahtarı kalıcı olarak silindi.").wait_for()
    check(page.locator("ul li").count() == before - 1, "silme")
    counts = page.evaluate("""async () => {
      const root = await navigator.storage.getDirectory(); const dir = await root.getDirectoryHandle('kh-blobs');
      let n = 0; for await (const _ of dir.keys()) n++;
      const db = await new Promise((res) => { const r = indexedDB.open('kan-haritasi'); r.onsuccess = () => res(r.result); });
      const recs = await new Promise((res) => { const r = db.transaction('records').objectStore('records').count(); r.onsuccess = () => res(r.result); });
      return { blobs: n, records: recs };
    }""")
    check(counts == {"blobs": 1, "records": 1}, f"silinen belgenin gövdesi ve kaydı gitti {counts}")

    # Gizlilik ekranı
    page.get_by_role("link", name="Gizlilik").click()
    page.get_by_text("Verilerin nerede ve nasıl duruyor").wait_for()
    page.screenshot(path=SHOTS / "08-gizlilik.png", full_page=True)

    # Kilitle → yanlış parola → doğru parola
    page.get_by_role("button", name="Kilitle").click()
    page.get_by_text("Kasa kilitli").wait_for()
    page.fill("#unlock", "yanlis-parola-000")
    page.get_by_role("button", name="Kilidi aç").click()
    page.get_by_text("Parola yanlış.").wait_for(timeout=20000)
    page.screenshot(path=SHOTS / "09-kilit-yanlis.png")
    page.fill("#unlock", PASS)
    page.get_by_role("button", name="Kilidi aç").click()
    page.get_by_text("Verilerin nerede ve nasıl duruyor").wait_for(timeout=20000)
    check(True, "kilit aç / yanlış parola reddi")

    # Masaüstü görünüm
    page.set_viewport_size({"width": 1366, "height": 860})
    page.get_by_role("link", name="Belgeler").first.click()
    page.wait_for_timeout(500)
    page.screenshot(path=SHOTS / "10-masaustu.png")
    page.locator("ul li").first.locator("button").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "11-masaustu-detay.png")

    csp = page.evaluate("window.__csp")
    check(csp == [], f"CSP ihlali yok {csp}")
    errors = [c for c in console if c.startswith(("error", "pageerror"))]
    check(errors == [], f"konsol hatası yok {errors}")
    check(external == [], f"harici ağ isteği yok {external}")
    browser.close()

print(json.dumps({"problems": problems}, ensure_ascii=False))
sys.exit(1 if problems else 0)
