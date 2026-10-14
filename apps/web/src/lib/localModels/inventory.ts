/**
 * Model envanteri: her modalite için araştırılan gerçek modeller ve durumları. Gömülü ve paket modeller
 * manifestlerden gelir; burada yalnızca eklenemeyenler ve nedenleri kayıtlıdır (dürüst eksik listesi).
 * Kaynak: bu projede yapılan araştırma (ağırlık erişimi, lisans, cihaz uygunluğu, doğrulama verisi).
 */
export type InventoryStatus = 'unavailable';

export interface InventoryEntry {
  modality: string;
  task: string;
  candidates: string;
  status: InventoryStatus;
  reason: string;
}

/**
 * Erişim notu (son araştırma: 2026-10): bu derleme ortamından Hugging Face, GitHub sürümleri, Zenodo ve
 * NGC'ye istek 403 / bağlantı hatasıyla döndü. Bu yüzden yeni ağırlık indirilemedi ve doğrulanamadı;
 * aşağıdaki hiçbir model "varmış gibi" eklenmedi.
 */
export const INVENTORY_ACCESS_NOTE = 'Son araştırmada (2026-10) Hugging Face, GitHub sürümleri, Zenodo ve NGC derleme ortamından erişilemedi; yeni ağırlık indirilip doğrulanamadı. Doğrulanamayan model eklenmez.';

export const MODEL_INVENTORY: InventoryEntry[] = [
  { modality: 'BT', task: 'Akciğer nodülü', candidates: 'TotalSegmentator lung_nodules (Dataset913)', status: 'unavailable', reason: 'Açık lisanslı, ancak ResidualEncoder ağı, 0,74 mm ızgara ve 820 MB ağırlık: tarayıcıda/telefonda bellek ve süre olarak çalıştırılamıyor.' },
  { modality: 'BT', task: 'Karaciğer lezyonu (tümör, metastaz, kist)', candidates: 'TotalSegmentator liver_lesions (Dataset591)', status: 'unavailable', reason: 'Dönüştürüldü ve gerçek bir LiTS vakasında (uzman etiketi: 12,9 mL tümör) denendi: aynı ağırlıklarla sonuç kırpma ve karo yerleşimindeki küçük farklarla değişti (uzman etiketine göre Dice 0,71 ile 0,14 arası; büyük tümör bazı ayarlarda kaçtı). Güvenilir bulgu üretmediği için eklenmedi.' },
  { modality: 'BT', task: 'Beyin içi kanama', candidates: 'TotalSegmentator cerebral_bleed (Dataset150)', status: 'unavailable', reason: 'Ağırlıklar indirildi ve ağ uyumlu; ancak resmi çıktıyla karşılaştıracak açık bir baş BT\'si bu ortamda bulunamadı. Doğrulanmadan eklenmedi.' },
  { modality: 'BT', task: 'Kalp odacıkları (yüksek çözünürlük), koroner arterler, doku tipleri, apendiküler kemikler, beyin yapıları, yüz', candidates: 'TotalSegmentator lisanslı görevleri', status: 'unavailable', reason: 'Ticari olmayan / ayrı lisans gerektiriyor; ağırlıklar lisans anahtarıyla dağıtılıyor. Gömülemez, anahtarsız indirilemez.' },
  { modality: 'MR', task: 'Beyin anevrizması (TOF)', candidates: 'TotalSegmentator brain_aneurysm', status: 'unavailable', reason: 'CC BY-NC lisansı; ayrıca 0,39 mm ızgara cihazda çok ağır.' },
  { modality: 'BT/MR', task: 'MONAI Model Zoo (dalak, pankreas tümörü, beyin tümörü, prostat …)', candidates: 'MONAI bundle\'ları', status: 'unavailable', reason: 'Ağırlıklar Hugging Face / NGC üzerinde; bu derleme ortamında erişim kuruluş politikasıyla kapalı. Doğrulanamayan ağırlık eklenmez; bir kısmının lisansı ticari değil.' },
  { modality: 'Tümü', task: 'Genel bölütleme (MedSAM, SAM-Med3D)', candidates: 'MedSAM, SAM-Med3D', status: 'unavailable', reason: 'İstem (kutu/nokta) gerektiren etkileşimli modeller; ağırlıklar Hugging Face / Google Drive üzerinde, erişilemedi.' },
  { modality: 'Röntgen', task: 'CheXpert / MIMIC eğitimli sınıflandırıcılar', candidates: 'TorchXRayVision densenet121-res224-chex / -mimic / -all', status: 'unavailable', reason: 'Eğitim verilerinin (CheXpert, MIMIC-CXR) kullanım koşulları yeniden dağıtıma izin vermiyor; uygulamaya gömülmedi.' },
  { modality: 'Röntgen', task: 'Kırık tespiti', candidates: 'Açık, doğrulanabilir ağırlıklı model', status: 'unavailable', reason: 'Lisansı açık ve ağırlığı erişilebilir bir kırık modeli bulunamadı.' },
  { modality: 'Ultrason / Doppler / EKO', task: 'Organ, kist, akım, EF, odacık bölütleme', candidates: 'EchoNet-Dynamic, CAMUS modelleri', status: 'unavailable', reason: 'Ağırlıklar ya araştırma lisanslı (ticari olmayan, yeniden dağıtım yok) ya da erişilemeyen sunucularda; video modelleri için doğrulama verisi yok.' },
  { modality: 'Mamografi', task: 'Kitle, kalsifikasyon, yoğunluk', candidates: 'Açık mamografi modelleri', status: 'unavailable', reason: 'Yeniden dağıtılabilir lisanslı ve doğrulanabilir ağırlık bulunamadı.' },
  { modality: 'Patoloji (WSI)', task: 'Doku, çekirdek, hücre sınıflandırma; temel modeller', candidates: 'HoVer-Net, UNI / UNI2, CONCH, Virchow, PLIP', status: 'unavailable', reason: 'UNI/UNI2, CONCH ve Virchow ağırlıkları erişim onayı (Hugging Face, kapılı) ve ticari olmayan lisans gerektiriyor; PLIP ağırlıkları Hugging Face\'te, HoVer-Net\'inkiler Google Drive\'da — bu derleme ortamından erişilemedi, SHA-256 ve lisans doğrulanamadı. Ayrıca tam slayt (WSI) okuma cihazda desteklenmiyor.' },
  { modality: 'Çok modaliteli', task: 'OpenMedLab model koleksiyonu (çeşitli bölütleme/sınıflandırma)', candidates: 'OpenMedLab depoları', status: 'unavailable', reason: 'Ağırlıklar Hugging Face / Google Drive / Baidu bağlantılarında; bu derleme ortamından erişilemedi. Lisanslar modele göre değişiyor (bir kısmı yalnızca araştırma). Doğrulanamayan ağırlık eklenmez.' },
  { modality: 'Endoskopi / Kolonoskopi', task: 'Polip, kanama, lezyon', candidates: 'PraNet ve benzeri polip modelleri', status: 'unavailable', reason: 'Ağırlıklar Google Drive / Baidu üzerinde ve lisansı belirsiz; eklenmedi.' },
  { modality: 'Fundus / OCT', task: 'Damar, optik disk, diyabetik retinopati, retina katmanları', candidates: 'RETFound, fundus damar bölütleme modelleri, OCT katman modelleri', status: 'unavailable', reason: 'RETFound ticari olmayan lisanslı ve ağırlıkları Hugging Face\'te (kapılı); diğerlerinin çoğu yalnızca makale kodu ya da ağırlığı erişilemeyen bağlantılarda. Lisansı açık ve doğrulanabilir ağırlık bulunamadı.' },
  { modality: 'Diş (panoramik / CBCT)', task: 'Diş bölütleme ve numaralandırma', candidates: 'TotalSegmentator teeth (ToothFairy3)', status: 'unavailable', reason: 'Açık lisanslı ve ağırlığı erişilebilir; ancak 0,5 mm ızgara ve kafatası basamaklaması (craniofacial_structures) cihazda saatler sürer. Eklenmedi.' },
  { modality: 'PET / PET-BT / DEXA', task: 'Lezyon, SUV, kemik yoğunluğu', candidates: 'autoPET modelleri, DEXA modelleri', status: 'unavailable', reason: 'Açık ve yeniden dağıtılabilir ağırlık bulunamadı; PET için SUV hesabı DICOM radyofarmasötik bilgisi gerektirir.' },
  { modality: 'EKG', task: 'Ritim, aralıklar, morfoloji', candidates: 'Açık EKG sınıflandırıcıları', status: 'unavailable', reason: 'Kâğıt EKG fotoğrafı için doğrulanmış açık model yok; uygulama ızgaradan RR/kalp hızını kural tabanlı ölçer.' },
  { modality: 'Anjiyografi / Floroskopi', task: 'Damar ağacı, darlık, cihaz takibi', candidates: '—', status: 'unavailable', reason: 'Açık lisanslı, doğrulanabilir ağırlıklı model bulunamadı.' },
];
