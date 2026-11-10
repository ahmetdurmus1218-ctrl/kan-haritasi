/**
 * Fizyoloji simülasyon motoru: her model, yayımlanmış bir matematiksel fizyoloji modelinin (adi diferansiyel
 * denklemler ya da kapalı biçimli bağıntılar) sade bir uygulamasıdır. Modeller EĞİTİMSELDİR: tipik bir
 * yetişkinin parametreleriyle çalışır, kişiye özel ölçüm ya da tahmin üretmez. Her model varsayımlarını,
 * geçerlilik alanını, sınırlarını ve kaynağını taşır; arayüz bunları göstermek zorundadır.
 */
export type TimeUnit = 'ms' | 'sn' | 'dk' | 'saat' | 'gün';

export interface ParamDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Tipik sağlıklı yetişkin değeri ("normal çalışma"). */
  value: number;
  hint?: string;
}

export type SeriesColor = 'a' | 'b' | 'c' | 'd';

export interface SeriesDef {
  key: string;
  label: string;
  unit: string;
  /** Hangi grafikte (panel sırası). */
  panel: number;
  color: SeriesColor;
  decimals: number;
}

/** Eğitim amaçlı değişiklik senaryosu: parametreleri tipik değerden saptırır. Tanı ya da kişisel durum değildir. */
export interface Scenario {
  id: string;
  label: string;
  /** Ne değişti ve fizyolojik olarak ne beklenir. */
  note: string;
  set: Record<string, number>;
}

export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: string;
  decimals: number;
  /** Tipik yetişkin aralığı (bilgi amaçlı; laboratuvar referansı değildir). */
  typical?: string;
}

export interface SourceRef {
  title: string;
  detail: string;
}

/** t anındaki gözlenen değerler (seri anahtarı → değer) ve o andaki evre etiketi. */
export interface Sample {
  t: number;
  v: Record<string, number>;
  phase?: string;
}

export interface CurvePoint {
  x: number;
  y: number;
}

/** Statik bağıntı eğrisi (ör. oksijen-hemoglobin eğrisi, basınç-hacim halkası). */
export interface Curve {
  id: string;
  title: string;
  xLabel: string;
  yLabel: string;
  lines: Array<{ label: string; points: CurvePoint[]; dashed?: boolean }>;
  /** Modelin şu anki çalışma noktası. */
  marker?: CurvePoint & { label: string };
}

/** Kişinin ÖLÇÜLMÜŞ değerinin modelle dürüst bağı: ölçülen bir girdiyi parametreye koymak ya da eğride nokta. */
export interface PersonalBinding {
  /** Parametre anahtarı → ölçülen değer (yalnızca doğrudan ölçülen büyüklükler; ör. hemoglobin). */
  params: Record<string, number>;
  /** Eğri kimliği → ölçülen nokta. */
  markers: Array<{ curve: string; x: number; y: number; label: string }>;
  /** Kullanılan testler (katalog anahtarı). */
  used: string[];
}

export type Params = Record<string, number>;

export interface SimModel {
  id: string;
  title: string;
  /** Tek cümle: model neyi gösterir? */
  question: string;
  system: string;
  /** Bilgi grafiği organ düğümleri (organ sayfası bağlantıları). */
  organs: string[];
  /** "İçine gir" iç dünyası (varsa). */
  interior?: string;
  /** Katalog test anahtarları: bu süreçle ilişkili olabilecek tahliller. */
  relatedTests: string[];
  timeUnit: TimeUnit;
  /** Entegrasyon adımı (model zamanı). */
  dt: number;
  /** Simüle edilen toplam süre. */
  duration: number;
  /** Kaydedilen örnekler arası süre. */
  sampleEvery: number;
  /** 1× hızda gerçek saniye başına model zamanı. */
  pace: number;
  /** Bitince başa sar (kalp atımı gibi döngüsel süreçler). */
  loop?: boolean;
  panels: string[];
  series: SeriesDef[];
  params: ParamDef[];
  scenarios: Scenario[];
  /** Kullanılan denklemler (düz metin). */
  equations: string[];
  assumptions: string[];
  /** Modelin geçerli olduğu alan. */
  validity: string;
  limits: string[];
  sources: SourceRef[];
  init(p: Params): number[];
  /** dy/dt. */
  deriv(t: number, y: number[], p: Params): number[];
  /** Adım sonrası düzeltme (ör. uyarı darbesi, sınır). */
  after?(t: number, y: number[], p: Params, dt: number): void;
  observe(t: number, y: number[], p: Params): Record<string, number>;
  phase?(t: number, y: number[], p: Params): string;
  metrics(samples: Sample[], p: Params): Metric[];
  curves?(samples: Sample[], p: Params): Curve[];
  personal?(measured: Record<string, number>): PersonalBinding;
}
