import {
  type RangeValue,
  type ResultStatus,
  type Sex,
  catalogRange,
  convert,
  normalizeText,
  parseNumber,
  rangeText,
  statusFor,
  testByKey,
} from '@kh/catalog';
import type { IssueCode, ParsedRow, ReportDraft, SourceBox } from '@kh/parser';
import { type Vault, randomId } from '@kh/vault';
import { deleteImagingNotes } from './imagingRecords';

export const PARSER_VERSION = '1';

/** Onaylanmış tek sonuç. Değerler hem rapor biriminde hem kanonik birimde tutulur. */
export interface StoredResult {
  testKey: string;
  loinc: string;
  rawName: string;
  value: number;
  qualifier?: '<' | '>' | '<=' | '>=';
  unit: string;
  unitKey: string | null;
  canonicalValue: number | null;
  refMin?: number;
  refMax?: number;
  refMinExclusive?: boolean;
  refMaxExclusive?: boolean;
  refText: string;
  refSource: 'report' | 'catalog' | 'none';
  status: ResultStatus;
  reportFlag?: 'H' | 'L';
  userEdited: boolean;
  source?: SourceBox;
  /** Okuma güveni (0–1) ve okuma sırasında görülen sorunlar; elle girilen/düzeltilen değerlerde yok sayılır. */
  confidence?: number;
  issues?: IssueCode[];
  /** Kullanıcı sonradan "belgeyle karşılaştırdım, doğru" dedi. */
  verified?: boolean;
}

/** Kullanıcının belgeyle karşılaştırması gereken okuma sorunları. */
export const VERIFY_ISSUES: IssueCode[] = ['LOW_OCR_CONFIDENCE', 'IMPLAUSIBLE', 'FLAG_CONFLICT', 'AMBIGUOUS_DECIMAL', 'UNIT_MISSING', 'UNIT_UNKNOWN', 'NAME_FUZZY', 'DUPLICATE', 'RANGE_SEX_SPECIFIC', 'RANGE_PHASE_SPECIFIC', 'PERCENT_GUESSED', 'OCR_DISAGREE'];

/** Kaydedilmiş ama okuma güveni düşük / sorunlu ve kullanıcının henüz doğrulamadığı sonuç mu? */
export function needsVerification(r: StoredResult): boolean {
  if (r.userEdited || r.verified) return false;
  return (r.confidence ?? 1) < 0.75 || (r.issues ?? []).some((i) => VERIFY_ISSUES.includes(i));
}

export function verificationIssues(r: StoredResult): IssueCode[] {
  const list = (r.issues ?? []).filter((i) => VERIFY_ISSUES.includes(i));
  if (!list.length && (r.confidence ?? 1) < 0.75) list.push('LOW_OCR_CONFIDENCE');
  return list;
}

/** Bir sonucu "belgeyle karşılaştırıldı, doğru" olarak işaretler. */
export async function markVerified(vault: Vault, reportId: string, testKey: string): Promise<void> {
  const report = (await listReports(vault)).find((r) => r.id === reportId);
  if (!report) return;
  const next: StoredReport = { ...report, results: report.results.map((r) => (r.testKey === testKey ? { ...r, verified: true } : r)) };
  await vault.putRecord('report', report.id, next);
}

/** Bir belgeden çıkarılıp kullanıcının onayladığı rapor. Ham metin saklanmaz. */
export interface StoredReport {
  id: string;
  fileId: string;
  reportDate?: string;
  labName?: string;
  method: ReportDraft['method'] | 'manual';
  parserVersion: string;
  createdAt: string;
  results: StoredResult[];
}

/** Onay ekranındaki düzenlenebilir satır. */
export interface ReviewRow extends ParsedRow {
  include: boolean;
  userEdited: boolean;
  /** Kullanıcının yazdığı metinler (düzenleme sırasında). */
  edit?: { value: string; unitKey: string | null; refMin: string; refMax: string };
}

function isStoredReport(v: unknown): v is StoredReport {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.fileId === 'string' && Array.isArray(o.results) && typeof o.createdAt === 'string';
}

export async function listReports(vault: Vault): Promise<StoredReport[]> {
  const { items } = await vault.listRecords<StoredReport>('report');
  return items
    .map((i) => i.value)
    .filter(isStoredReport)
    .sort((a, b) => (b.reportDate ?? b.createdAt).localeCompare(a.reportDate ?? a.createdAt));
}

export async function reportForFile(vault: Vault, fileId: string): Promise<StoredReport | undefined> {
  return (await listReports(vault)).find((r) => r.fileId === fileId);
}

export async function saveReport(vault: Vault, report: Omit<StoredReport, 'id' | 'createdAt' | 'parserVersion'>): Promise<StoredReport> {
  // Aynı belgenin eski raporu varsa yenisiyle değiştirilir (yeniden analiz).
  const previous = (await listReports(vault)).filter((r) => r.fileId === report.fileId);
  const stored: StoredReport = { ...report, id: randomId(), createdAt: new Date().toISOString(), parserVersion: PARSER_VERSION };
  await vault.putRecord('report', stored.id, stored);
  for (const p of previous) await vault.deleteRecord('report', p.id);
  return stored;
}

/** Belgeyi ve ondan çıkarılan tüm sonuçları siler. */
export async function deleteDocument(vault: Vault, fileId: string): Promise<void> {
  for (const r of (await listReports(vault)).filter((x) => x.fileId === fileId)) await vault.deleteRecord('report', r.id);
  await deleteImagingNotes(vault, fileId);
  await vault.deleteFile(fileId);
}

// ---------------------------------------------------------------- Kullanıcı takma adları

const ALIAS_ID = 'aliases';

export async function loadAliases(vault: Vault): Promise<Record<string, string>> {
  const rec = await vault.getRecord<Record<string, string>>('alias', ALIAS_ID).catch(() => undefined);
  if (!rec || typeof rec !== 'object') return {};
  return Object.fromEntries(Object.entries(rec).filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && testByKey.has(v)));
}

export async function addAlias(vault: Vault, rawName: string, testKey: string): Promise<void> {
  const norm = normalizeText(rawName);
  if (!norm || !testByKey.has(testKey)) return;
  const current = await loadAliases(vault);
  current[norm] = testKey;
  await vault.putRecord('alias', ALIAS_ID, current);
}

// ---------------------------------------------------------------- Profil (cinsiyet)

const PROFILE_ID = 'profile';

export async function loadSex(vault: Vault): Promise<Sex> {
  const p = await vault.getRecord<{ sex?: Sex }>('profile', PROFILE_ID).catch(() => undefined);
  return p?.sex === 'female' || p?.sex === 'male' ? p.sex : 'unspecified';
}

export async function saveSex(vault: Vault, sex: Sex): Promise<void> {
  await vault.putRecord('profile', PROFILE_ID, { sex });
}

// ---------------------------------------------------------------- Düzenleme ve yeniden değerlendirme

/**
 * Kullanıcının düzelttiği değer/birim/aralıkla satırı yeniden değerlendirir.
 * Aralık boşsa genel referans (etiketli) kullanılır.
 */
export function reevaluate(row: ReviewRow, edit: NonNullable<ReviewRow['edit']>, sex: Sex): ReviewRow {
  const test = testByKey.get(row.testKey);
  if (!test) return row;
  const num = parseNumber(edit.value.trim());
  const min = edit.refMin.trim() ? parseNumber(edit.refMin.trim())?.value : undefined;
  const max = edit.refMax.trim() ? parseNumber(edit.refMax.trim())?.value : undefined;
  const conv = edit.unitKey ? test.conversions[edit.unitKey] : undefined;
  const value = num?.value ?? Number.NaN;
  const canonicalValue = Number.isFinite(value) && conv ? convert(value, conv) : null;

  let range: RangeValue = { source: 'none' };
  let status: ResultStatus = 'unknown';
  if (min !== undefined || max !== undefined) {
    range = { min, max, source: 'report' };
    status = Number.isFinite(value) ? statusFor(value, range, num?.qualifier) : 'unknown';
  } else if (canonicalValue !== null) {
    range = catalogRange(test, sex);
    status = statusFor(canonicalValue, range, num?.qualifier);
  }
  const storedMin = range.source === 'report' && conv && min !== undefined ? convert(min, conv) : range.min;
  const storedMax = range.source === 'report' && conv && max !== undefined ? convert(max, conv) : range.max;
  const issues: IssueCode[] = row.issues.filter((i) => i === 'DUPLICATE');
  if (canonicalValue !== null && (canonicalValue < test.plausible[0] || canonicalValue > test.plausible[1])) issues.push('IMPLAUSIBLE');
  return {
    ...row,
    edit,
    userEdited: true,
    value,
    ...(num?.qualifier ? { qualifier: num.qualifier } : { qualifier: undefined }),
    valueText: edit.value,
    unitKey: edit.unitKey,
    unit: edit.unitKey ? unitLabel(test.key, edit.unitKey) : '',
    canonicalValue,
    refMin: storedMin,
    refMax: storedMax,
    refMinExclusive: undefined,
    refMaxExclusive: undefined,
    refText: range.source === 'report' ? rangeText(min, max, test.decimals) : range.text ?? '',
    refSource: range.source,
    status,
    confidence: 1,
    issues,
  };
}

const UNIT_LABELS: Record<string, string> = {
  'mg/dl': 'mg/dL',
  'g/dl': 'g/dL',
  'g/l': 'g/L',
  'mg/l': 'mg/L',
  'u/l': 'U/L',
  'miu/l': 'mIU/L (µIU/mL)',
  'miu/ml': 'mIU/mL',
  'ng/ml': 'ng/mL',
  'pg/ml': 'pg/mL',
  'ng/dl': 'ng/dL',
  'ug/dl': 'µg/dL',
  'mmol/l': 'mmol/L',
  'umol/l': 'µmol/L',
  'nmol/l': 'nmol/L',
  'pmol/l': 'pmol/L',
  fl: 'fL',
  pg: 'pg',
  '%': '%',
  'l/l': 'L/L',
  'mm/h': 'mm/saat',
  s: 'sn',
  'iu/ml': 'IU/mL',
  'mmol/mol': 'mmol/mol',
  ratio: '(oran)',
  '10^3/ul': '10³/µL',
  '10^6/ul': '10⁶/µL',
  '10^9/l': '10⁹/L',
  '10^12/l': '10¹²/L',
  '/ul': '/µL',
  'ml/min/1.73m2': 'mL/dk/1,73m²',
};

export function unitLabel(_testKey: string, unitKey: string): string {
  return UNIT_LABELS[unitKey] ?? unitKey;
}

export function toStoredResult(row: ReviewRow): StoredResult {
  const test = testByKey.get(row.testKey);
  return {
    testKey: row.testKey,
    loinc: test?.loinc ?? row.loinc,
    rawName: row.rawName,
    value: row.value,
    ...(row.qualifier ? { qualifier: row.qualifier } : {}),
    unit: row.unit,
    unitKey: row.unitKey,
    canonicalValue: row.canonicalValue,
    refMin: row.refMin,
    refMax: row.refMax,
    ...(row.refMinExclusive ? { refMinExclusive: true } : {}),
    ...(row.refMaxExclusive ? { refMaxExclusive: true } : {}),
    refText: row.refText,
    refSource: row.refSource,
    status: row.status,
    ...(row.reportFlag ? { reportFlag: row.reportFlag } : {}),
    userEdited: row.userEdited,
    source: row.source,
    ...(row.userEdited ? {} : { confidence: Math.round(row.confidence * 100) / 100, ...(row.issues.length ? { issues: row.issues } : {}) }),
  };
}

/** Bir satırın kaydedilebilmesi için asgari koşul: sayısal değer ve bilinen birim. */
export function isSavable(row: ReviewRow): boolean {
  return Number.isFinite(row.value) && row.canonicalValue !== null;
}

export function draftToReview(draft: ReportDraft): ReviewRow[] {
  return draft.rows.map((r) => ({ ...r, include: true, userEdited: false }));
}
