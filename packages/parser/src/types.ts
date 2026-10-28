import type { ResultStatus } from '@kh/catalog';

/** Sayfa üzerindeki bir metin parçası; koordinatlar sol-üst kökenli, sayfa birimi (PDF: pt, OCR: px). */
export interface TextItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
  /** OCR güveni 0–100; PDF metin katmanında yok. */
  conf?: number;
  /**
   * Satır gruplamada kullanılacak dikey merkez (OCR'da eğimi düzeltilmiş satır merkezi).
   * Yoksa `y + h/2` kullanılır. Kaynak kutusu her zaman özgün x/y/w/h'dir.
   */
  cy?: number;
}

export interface SourceBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Sayfanın boyutu (kutuyu görüntüleyicide ölçeklemek için). */
  pageW?: number;
  pageH?: number;
}

export type IssueCode =
  | 'NAME_FUZZY'
  | 'UNIT_MISSING'
  | 'UNIT_UNKNOWN'
  | 'RANGE_MISSING'
  | 'RANGE_SEX_SPECIFIC'
  | 'RANGE_PHASE_SPECIFIC'
  | 'RANGE_CATEGORIES'
  | 'PERCENT_GUESSED'
  | 'OCR_DISAGREE'
  | 'RANGE_DECIMAL_GUESSED'
  /** Raporda aralık yok; genel aralığın dışında görünüyor ama "yüksek/düşük" denmez. */
  | 'RANGE_GENERIC'
  /** Raporun kendi işareti (renkli simge, pembe zemin) okunan değer/aralıkla uyuşmuyor. */
  | 'MARK_CONFLICT'
  | 'FLAG_CONFLICT'
  | 'IMPLAUSIBLE'
  | 'AMBIGUOUS_DECIMAL'
  | 'LOW_OCR_CONFIDENCE'
  | 'DUPLICATE';

export interface ParsedRow {
  testKey: string;
  loinc: string;
  rawName: string;
  valueText: string;
  /** Rapordaki değer ve birim (dönüşümsüz). */
  value: number;
  qualifier?: '<' | '>' | '<=' | '>=';
  unit: string;
  unitKey: string | null;
  /** Kanonik birimde değer; birim bilinmiyorsa null. */
  canonicalValue: number | null;
  refMin?: number;
  refMax?: number;
  refMinExclusive?: boolean;
  refMaxExclusive?: boolean;
  refText: string;
  refSource: 'report' | 'catalog' | 'none';
  status: ResultStatus;
  reportFlag?: 'H' | 'L';
  /** Raporun satıra koyduğu görsel işaret: aralık dışı (kırmızı/pembe) ya da içi (yeşil). */
  reportMark?: ReportMark;
  confidence: number;
  issues: IssueCode[];
  source: SourceBox;
}

/** Raporun satıra koyduğu görsel işaret (e-Nabız'da kırmızı ünlem + pembe zemin / yeşil onay). */
export type ReportMark = 'in' | 'out';

/**
 * Katalogda olmayan test satırı. Raporun kendi aralığıyla (rapor biriminde) değerlendirilir; organa
 * bağlanamaz ama sonuç listesinde durumuyla gösterilir.
 */
export interface UnrecognizedRow {
  rawName: string;
  valueText: string;
  value: number;
  qualifier?: '<' | '>' | '<=' | '>=';
  unit: string;
  refText: string;
  refMin?: number;
  refMax?: number;
  refMinExclusive?: boolean;
  refMaxExclusive?: boolean;
  status: ResultStatus;
  reportFlag?: 'H' | 'L';
  reportMark?: ReportMark;
  source: SourceBox;
}

/** Testi tanınan ama değeri okunamayan satır (ör. OCR sayıyı kaçırdı): kullanıcı elle girer. */
export interface MissingValue {
  testKey: string;
  rawName: string;
  source: SourceBox;
}

export interface ReportDraft {
  reportDate?: string;
  labName?: string;
  rows: ParsedRow[];
  unrecognized: UnrecognizedRow[];
  /** Adı tanınıp değeri okunamayan testler. */
  missing: MissingValue[];
  pageCount: number;
  method: 'text' | 'ocr' | 'mixed';
}
