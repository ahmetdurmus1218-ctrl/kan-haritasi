"""Uçtan uca testler için 3B gezinme yardımcıları: Explorer kök öğesindeki gerçek durumu okur.

  data-camera (konum|hedef|görüş açısı), data-camera-moving, data-scene / data-target-scene,
  data-transition (approach → cover → hold → reveal → idle), data-level, data-stage, data-interior,
  data-current-level / data-current-node, data-scene-kind, data-focus, data-subject.
"""
import time

KEYS = ("stage", "targetScene", "level", "scene", "interior")


PHASE_WATCH = """window.__kh_phases=[];new MutationObserver(m=>{for(const r of m)window.__kh_phases.push(r.target.getAttribute('data-transition'))}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-transition']});"""


def phases_since(page):
    """Son okumadan beri gerçekleşen geçiş evreleri (MutationObserver ile; yoklamada kaçmaz)."""
    return set(page.evaluate("(() => { const p = window.__kh_phases || []; window.__kh_phases = []; return p; })()"))


def attrs(page):
    return page.evaluate(
        """() => { const e = document.querySelector('[data-testid=explorer]'); if (!e) return null;
        const d = {...e.dataset}; const c = e.querySelector('canvas'); const dock = document.querySelector('[data-testid=level-dock]');
        const r = e.getBoundingClientRect(); d.root = [r.left, r.top, r.width, r.height];
        if (c) { const q = c.getBoundingClientRect(); d.canvas = [q.left, q.top, q.width, q.height]; }
        if (dock) { const q = dock.getBoundingClientRect(); d.dock = [q.left, q.top, q.width, q.height]; }
        d.actions = [...document.querySelectorAll('[data-testid=level-action]')].map(b => b.dataset.action + ':' + b.innerText.replace(/\\s+/g, ' ').trim());
        return d; }"""
    )


def cam(a):
    pos, tgt, fov = a["camera"].split("|")
    return [float(x) for x in pos.split(",")], [float(x) for x in tgt.split(",")], float(fov)


def dist(p, q):
    return sum((x - y) ** 2 for x, y in zip(p, q)) ** 0.5


def settle(page, timeout=60, before=None, want=None):
    """Önce (verildiyse) gezinme durumu değişir / istenen değerler gelir; sonra geçiş tamamlanır:
    evre idle, çizilen sahne = hedef sahne, kamera en az 0,8 sn hareketsiz. (durum, görülen evreler) döner."""
    t0 = time.time()
    phases = set()
    while time.time() - t0 < timeout:
        a = attrs(page)
        if a:
            phases.add(a.get("transition"))
            changed = not before or any(a.get(k) != before.get(k) for k in KEYS) or a.get("camera") != before.get("camera")
            if changed and (not want or all(a.get(k) == v for k, v in want.items())):
                break
        time.sleep(0.05)
    # Kamera hareketi başlasın (yavaş yazılımsal GPU'da ilk kare gecikebilir); hareket yoksa en fazla 3 sn beklenir.
    if before:
        t1 = time.time()
        while time.time() - t1 < 3 and time.time() - t0 < timeout:
            a = attrs(page)
            phases.add(a.get("transition"))
            if a.get("cameraMoving") == "true" or a.get("camera") != before.get("camera") or a.get("transition") not in ("idle", None):
                break
            time.sleep(0.05)
    still = None
    while time.time() - t0 < timeout:
        a = attrs(page)
        if a:
            phases.add(a.get("transition"))
            ok = a.get("transition") == "idle" and a.get("scene") == a.get("targetScene") and a.get("cameraMoving") == "false" and a.get("camera")
            if ok:
                still = still or time.time()
                if time.time() - still > 0.8:
                    return a, phases
            else:
                still = None
        time.sleep(0.1)
    return attrs(page), phases


def goto_interior(page, url, oid, stage=None):
    """#/ic/<oid>[/<stage>] açar ve iç dünya sahnesi yerleşene kadar bekler."""
    before = attrs(page)
    page.goto(url + f"#/ic/{oid}" + (f"/{stage}" if stage else ""))
    page.get_by_test_id("explorer").wait_for()
    a, _ = settle(page, 90, before=before, want={"interior": oid})
    if a and not a.get("scene", "").startswith(("ic:", "in:")):
        a, _ = settle(page, 90, before=a)
    return a


def action(page, act, timeout=60):
    """Seviye eylemine bas (İlerle, Duvarı incele, Daha derine in, Geri…) ve yeni seviyenin yerleşmesini bekle."""
    before = attrs(page)
    page.locator(f"[data-testid=level-action][data-action={act}]").first.click()
    return settle(page, timeout, before=before)[0]
