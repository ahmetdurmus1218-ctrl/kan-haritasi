/**
 * TAHLİL → VÜCUT ETKİSİ bilgi tabanı.
 *
 * Bir kan/idrar sonucu referans dışına çıktığında kullanıcı şu soruları sorar:
 *   1. Bu değer normalde vücutta nasıl bir yoldan geçer? (üretim → taşınma → kullanım → atılım)
 *   2. Benim sonucum (yüksek/düşük) bu yolda NEREYİ, NASIL değiştirir? (iç dünya basamağı: "İçine gir")
 *   3. Bunun olası nedenleri neler? Diğer sonuçlarım hangisini destekliyor, hangisiyle çelişiyor, ne eksik?
 *   4. Ne zaman acil? Hangi ek testler netleştirir?
 *
 * Her şey VERİDİR (hastalığa özel kod yok); doğrulama testleri her iç dünya/basamak/test/durum kimliğinin
 * gerçekten var olduğunu denetler. İçerik genel tıbbi bilgidir, TANI DEĞİLDİR: olası nedenler bir
 * "olasılık listesi"dir; sıralama yalnızca kullanıcının kendi sonuçlarının bu nedenin tipik tahlil
 * imzasına ne kadar uyduğunu gösterir, hastalık olasılığı değildir.
 */

export type Dir = 'high' | 'low';

/** Bir durumun tipik tahlil imzasında beklenen yön. `w` ağırlık (varsayılan 1; 0,5 = yardımcı ipucu). */
export interface Clue {
  test: string;
  dir: 'high' | 'low' | 'normal';
  w?: number;
}

export type ConditionKind =
  | 'disease' // hastalık
  | 'physiological' // fizyolojik / normal varyasyon
  | 'nutrition' // beslenme
  | 'medication' // ilaç / takviye
  | 'lifestyle' // yaşam tarzı
  | 'sample' // örnek / ölçüm kaynaklı (gerçek değişim değil)
  | 'genetic'; // kalıtsal

export const CONDITION_KIND_TR: Record<ConditionKind, string> = {
  disease: 'Hastalık',
  physiological: 'Fizyolojik durum',
  nutrition: 'Beslenme',
  medication: 'İlaç / takviye',
  lifestyle: 'Yaşam tarzı',
  sample: 'Örnek / ölçüm kaynaklı',
  genetic: 'Kalıtsal',
};

/** Olası neden (hastalık, ilaç, örnek hatası, fizyolojik durum…). */
export interface Condition {
  id: string;
  name: string;
  kind: ConditionKind;
  /** Sade dilde 1–2 cümle: ne olur, neden bu tahlilleri etkiler. */
  text: string;
  /** Etkilediği iç dünyalar (İçine gir hedefleri). */
  organs: string[];
  /** Tipik tahlil imzası (destekleyen ipuçları). */
  signature: Clue[];
  /** Görülürse bu nedene karşı kanıt olan ipuçları. */
  against?: Clue[];
  /** Bu neden düşünülüyorsa hızlı hekim değerlendirmesi gerekebilir. */
  urgent?: boolean;
  /** Netleştiren, katalogda olmayan testler / incelemeler (serbest metin). */
  workup?: string[];
  /** Yalnızca bu cinsiyette anlamlı. */
  sex?: 'female' | 'male';
}

/** Vücutta bir nokta: iç dünya (+ basamak) ve orada olan şey. */
export interface Site {
  interior: string;
  stage?: string;
  text: string;
}

/**
 * İç sahnenin "sonucuma göre" görsel değişimi (eğitimsel, temsili). Çarpanlar 1 = tipik; 0–1 değerler
 * 0 = yok. Sahne yalnızca kendi çizebildiği düğmeleri kullanır.
 */
export interface SceneShift {
  /** Alyuvar yoğunluğu (çarpan). */
  rbc?: number;
  /** Alyuvarın solukluğu (0–1; hemoglobin azlığı). */
  pale?: number;
  /** Alyuvar büyüklüğü (çarpan). */
  rbcSize?: number;
  /** Akyuvar yoğunluğu (çarpan). */
  wbc?: number;
  /** Trombosit yoğunluğu (çarpan). */
  plt?: number;
  /** Damar duvarında yağ birikintisi / plak (0–1). */
  plaque?: number;
  /** Plazmanın yağla bulanıklaşması (0–1). */
  lipid?: number;
  /** Serbest şeker parçacıkları (0–1). */
  sugar?: number;
  /** Sarılık rengi (bilirubin, 0–1). */
  yellow?: number;
  /** İltihap: duvar kızarıklığı, şişlik, akyuvar göçü (0–1). */
  inflam?: number;
  /** Hasarlı hücrelerden sızan enzim parçacıkları (0–1). */
  leak?: number;
  /** Akış / hareket hızı (çarpan). */
  flow?: number;
  /** Kristal birikimi (ürik asit, kalsiyum; 0–1). */
  crystals?: number;
  /** Ödem / doku arası sıvı (0–1). */
  fluid?: number;
  /** Asit (−1) ↔ baz (+1) kayması. */
  acid?: number;
  /** Kanın oksijen yüklülüğü (çarpan; düşükse koyu). */
  oxygen?: number;
  /** Sinir/kas sinyal hızı ve uyarılabilirlik (çarpan). */
  signal?: number;
  /** Süzgeçten (böbrek) kaçan protein (0–1). */
  protein?: number;
}

export interface DirEffect {
  /** Tek cümle: bu yönde vücutta genel olarak ne oluyor. */
  summary: string;
  /** Adım adım mekanizma (normalden sapmanın zinciri). */
  mechanism: string[];
  /** Vücutta etkilenen yerler: her biri bir iç dünyaya (ve basamağa) girer. */
  sites: Site[];
  /** Olası belirtiler (olabilir; olmayabilir). */
  symptoms?: string[];
  /** Olası nedenler: Condition kimlikleri (genelde sıktan seyreğe). */
  causes: string[];
  /** Netleştiren katalog testleri. */
  next?: string[];
  /** Ne zaman acil (genel uyarı). */
  urgent?: string;
  /** İç sahnenin "sonucuma göre" görünümü. */
  scene?: SceneShift;
}

export interface LabEffect {
  test: string;
  normal: {
    /** Normalde ne iş görür (tek cümle). */
    summary: string;
    /** Normal yol: üretim → taşınma → kullanım → atılım; her adım bir iç dünyaya girer. */
    path: Site[];
  };
  /** Yönün anlamlı olmadığı durumda gerekçe (ör. "CRP'nin düşük olması anlam taşımaz"). */
  high: DirEffect | string;
  low: DirEffect | string;
}
