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
  confidence: number;
  issues: IssueCode[];
  source: SourceBox;
}

export interface UnrecognizedRow {
  rawName: string;
  valueText: string;
  unit: string;
  refText: string;
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
