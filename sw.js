/* Kan Haritası service worker — otomatik üretildi */
const CACHE = 'kh-shell-4t5ewq';
const PRECACHE = ["./","./index.html","./assets/index-DXqSH_od.js","./assets/AlveolusScene-B22dl3v8.js","./assets/BloodScene-Bs26ub2U.js","./assets/BoneScene-BRhi5x3E.js","./assets/BrainMapPage-QQsaRnIl.js","./assets/CellScene-DpS5L_JJ.js","./assets/CochleaScene-D2VGJkoK.js","./assets/Explorer-LNKEJkhf.js","./assets/FlowPage-DNn0yl8t.js","./assets/FollicleScene-CaUbfUFS.js","./assets/HeartMuscleScene-CKL7X7X3.js","./assets/HormoneScene-CYSz4dq6.js","./assets/ImagingViewer-BCHE1RXj.js","./assets/IsletScene-Bc0JDOfU.js","./assets/LobuleScene-CBN6hqx1.js","./assets/LymphScene-DRbFDilx.js","./assets/MarrowScene-CAOhETUL.js","./assets/MyBodyPage-CxPS90WP.js","./assets/NephronScene-DPkP48Wx.js","./assets/NeuronScene-fGdWZd88.js","./assets/OrbitControls-BzM1N7JY.js","./assets/OrganPage-Ce4CK6c3.js","./assets/OvaryScene-FSRfdMIk.js","./assets/PdfViewer-C1y9_ASA.js","./assets/PersonalOrganDive-BEHVzbcn.js","./assets/PersonalOrganPage-ZGeTDcbu.js","./assets/PersonalVolume3D-C3ApU5z5.js","./assets/PhysiologyPage-DQaJQlrx.js","./assets/ReportSteps-CRaxjQ13.js","./assets/RetinaScene-Da9-VVPe.js","./assets/RoundedBoxGeometry-DxKrnRLo.js","./assets/SarcomereScene-O7Qzf5JC.js","./assets/SentencePage-CF7gkcZJ.js","./assets/SkinScene-DJ_r2WTY.js","./assets/StomachScene-CfHOWB5p.js","./assets/SystemPage-DG49ufl-.js","./assets/TestisScene-xzGZlpns.js","./assets/TissueScene-CxrtAdpT.js","./assets/VesselScene-DZHnh28O.js","./assets/VillusScene-Dk38M5Ig.js","./assets/anatomyNav-Bh59pdZI.js","./assets/common-CjSbVz_U.js","./assets/extends-DC1BzR_J.js","./assets/extract-BhjrA5KG.js","./assets/icons-DZMI_VGZ.js","./assets/imaging-Cx8HkQC5.js","./assets/imagingStudies-DFajGssb.js","./assets/jsx-runtime-lrofIGTe.js","./assets/micro-CnnbsVFx.js","./assets/palette-C24F6Xz0.js","./assets/pdf-B0q_Xp5M.js","./assets/preload-helper-khBccGFq.js","./assets/registry-BBgcGNHl.js","./assets/reportSteps-rPQmt1da.js","./assets/rolldown-runtime-BCiCTKAo.js","./assets/src-BmUdCsRu.js","./assets/src-Bpkz0B1-.js","./assets/src-D0QDoL20.js","./assets/src-DWdy4OJS.js","./assets/tissues-CHkHPaeC.js","./assets/tone-Dl9FCCs5.js","./assets/volumeResults-BV0m3Jo7.js","./assets/volumeSurface-CC8wl-hZ.js","./assets/analysis.worker-kJ_B0h3h.js","./assets/index-DHcItgzO.css","./assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","./assets/inter-latin-wght-normal-Dx4kXJAl.woff2","./assets/pdf.worker.min-BmVo14Nb.mjs","./assets/ort-wasm-simd-threaded-DcHrbrbl.wasm","./assets/ort.wasm.bundle.min-CTjDfixL.js"];
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
