/* Kan Haritası service worker — otomatik üretildi */
const CACHE = 'kh-shell-5q2u0f';
const PRECACHE = ["./","./index.html","./assets/index-BdeB37Vb.js","./assets/AlveolusScene-CeCpEu-7.js","./assets/BloodScene-0Jj2SD2R.js","./assets/BoneScene-CyEA2ike.js","./assets/CellScene-B78MkdDa.js","./assets/CochleaScene-Dk3AMJx3.js","./assets/Explorer-BWZ4hz2A.js","./assets/FollicleScene-DNUwhKUe.js","./assets/HeartMuscleScene-Coqc0U1m.js","./assets/HormoneScene-CyDD4zSk.js","./assets/ImagingViewer-CLyUl8cg.js","./assets/IsletScene-BeQ7Gt7V.js","./assets/LobuleScene-BFYS4Rxl.js","./assets/LymphScene-0BMl62R6.js","./assets/MarrowScene-N6jtP_OT.js","./assets/NephronScene-Boyl0itA.js","./assets/NeuronScene-Dwv-HIWs.js","./assets/OvaryScene-ZNQ1aKSo.js","./assets/PdfViewer-CDFTHZut.js","./assets/RetinaScene-09s9Gs8q.js","./assets/RoundedBoxGeometry-Cu4y2Z6Y.js","./assets/SarcomereScene-DeFUinEv.js","./assets/SkinScene-BqBJANg3.js","./assets/StomachScene-BqN7AIgx.js","./assets/TestisScene-DS7sYuun.js","./assets/TissueScene-D1sc1gb3.js","./assets/VesselScene-CRM9IL90.js","./assets/VillusScene-CXOYx2k-.js","./assets/extract-Cjf5H5Mp.js","./assets/imaging-C-lejQOF.js","./assets/jsx-runtime-D3F0h15I.js","./assets/micro-BHICopHS.js","./assets/pdf-DuPPYxGl.js","./assets/preload-helper-BAlEavIC.js","./assets/rng-CjMInbdP.js","./assets/rolldown-runtime-C0FnF6B9.js","./assets/src-CyGca4g7.js","./assets/src-SuYvKHvm.js","./assets/index-vNj0ngxD.css","./assets/pdf.worker.min-BmVo14Nb.mjs"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kh-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }),
  );
});
