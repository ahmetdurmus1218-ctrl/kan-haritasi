import { MODEL_RESEARCH, OLD_INVENTORY_TASKS, RESEARCH_ACCESS, RESEARCH_DATE } from './records';
import { ADAPTER_GROUPS, ADAPTER_GROUP_TR, type AdapterGroup, type ModelResearchRecord, RESEARCH_STATUSES, RESEARCH_STATUS_TR, type ResearchStatus } from './types';
import type { Modality } from '../types';

export * from './types';
export { MODEL_RESEARCH, OLD_INVENTORY_TASKS, RESEARCH_ACCESS, RESEARCH_DATE };

/** Görüntü/sinyal modalitesinden adaptör grubuna (kayıttaki modalite alanı bu gruplarla tutulur). */
export function adapterGroupOf(m: Modality): AdapterGroup | null {
  switch (m) {
    case 'CT':
      return 'CT';
    case 'MRI':
      return 'MRI';
    case 'XRAY':
      return 'XRAY';
    case 'ULTRASOUND':
    case 'DOPPLER':
      return 'ULTRASOUND';
    case 'ECHOCARDIOGRAPHY':
      return 'ECHO';
    case 'ECG':
      return 'ECG';
    case 'PATHOLOGY':
    case 'MICROSCOPY':
      return 'PATHOLOGY';
    case 'OCT':
      return 'OCT';
    case 'FUNDUS':
      return 'FUNDUS';
    case 'ENDOSCOPY':
    case 'COLONOSCOPY':
      return 'ENDOSCOPY';
    case 'PET':
    case 'PET_CT':
    case 'SPECT':
      return 'PET';
    case 'DEXA':
      return 'DEXA';
    case 'ANGIOGRAPHY':
    case 'FLUOROSCOPY':
      return 'ANGIO';
    case 'DENTAL':
      return 'DENTAL';
    case 'MAMMOGRAPHY':
      return 'MAMMOGRAPHY';
    default:
      return null;
  }
}

/**
 * Kayıt kuralları (her test koşusunda tüm kayıtlar için). Boş dizi = geçerli.
 * - VERIFIED: doğrulama tarihi, özet, ölçülmüş kanıt ve uygulamadaki manifest kimliği olmadan verilemez.
 * - Uygulamaya gömülü (bundled) model yalnızca VERIFIED olabilir ve ağırlık lisansı yeniden dağıtıma izin vermelidir.
 * - Sınıflandırıcı konum veremez ('none'): sınıflandırmadan lokalizasyon uydurulmaz.
 * - UNAVAILABLE en az 3 kaynak denetlenmeden ve bir neden yazılmadan verilemez ("erişemedim" tek başına yetmez).
 * - Erişim engeli tek başına UNAVAILABLE nedeni değildir: ağırlık adresi biliniyorsa durum AVAILABLE olmalı.
 * - RESEARCH_ONLY: lisans ticari kullanıma ya da yeniden dağıtıma gerçekten kapalı olmalı.
 */
export function validateResearchRegistry(records: readonly ModelResearchRecord[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const r of records) {
    const e = (m: string) => errors.push(`${r.id}: ${m}`);
    if (ids.has(r.id)) e('kimlik tekrarlanıyor');
    ids.add(r.id);
    if (!RESEARCH_STATUSES.includes(r.status)) e(`bilinmeyen durum ${r.status}`);
    if (!r.modality.length || r.modality.some((m) => !ADAPTER_GROUPS.includes(m))) e('modalite grubu geçersiz');
    if (r.evidence.length < 20 || /_EVIDENCE$/.test(r.evidence)) e('kanıt metni eksik');
    if (r.status === 'VERIFIED') {
      if (!r.verified) e('VERIFIED ama verified=false');
      if (!r.verificationDate) e('VERIFIED ama doğrulama tarihi yok');
      if (!r.checksum?.startsWith('sha256:')) e('VERIFIED ama indirilen dosyanın SHA-256 özeti yok');
      if (!r.weightsUrl) e('VERIFIED ama ağırlık adresi yok');
      if (!r.manifestId) e('VERIFIED ama uygulamadaki manifest kimliği yok');
      if (r.distribution === 'not-distributed') e('VERIFIED model uygulamaya bağlanmalı (gömülü ya da paket)');
    } else {
      if (r.verified) e('yalnızca VERIFIED kayıt verified=true olabilir');
      if (!r.failureReason || r.failureReason.length < 20) e('VERIFIED olmayan kaydın nedeni yazılmalı');
      if (r.distribution !== 'not-distributed') e('doğrulanmamış model dağıtılamaz');
    }
    if (r.distribution === 'bundled' && r.license.weightsRedistribution !== true) e('ağırlık lisansı yeniden dağıtıma izin vermeden uygulamaya gömülemez');
    if (r.capabilities.classification && !r.capabilities.detection && !r.capabilities.segmentation && r.capabilities.localization !== 'none') e('sınıflandırıcı konum veremez');
    if (r.capabilities.personal3D && !(r.capabilities.segmentation && (r.capabilities.localization === 'voxel' || r.capabilities.localization === 'prompt'))) e('kişisel 3B yalnızca voksel maskesinden');
    if (r.status === 'UNAVAILABLE') {
      if (r.sourcesChecked.length < 3) e('UNAVAILABLE için en az 3 kaynak denetlenmeli');
      if (r.weightsUrl) e('ağırlık adresi biliniyorsa UNAVAILABLE değil (AVAILABLE / RESEARCH_ONLY / …)');
    }
    if (r.status === 'AVAILABLE' && !r.weightsUrl && !r.blockedHosts?.length && !/Hugging Face|Google Drive|NGC/i.test(r.evidence)) e('AVAILABLE için ağırlığın nerede yayımlandığı yazılmalı');
    if (r.status === 'RESEARCH_ONLY' && r.license.commercial !== false && r.license.redistribution !== false && r.license.weightsRedistribution !== false) e('RESEARCH_ONLY ama lisans kısıtı kayıtlı değil');
    if (r.checksum && !/^(sha256:[0-9a-f]{64}|sha1:[0-9a-f]{40})$/.test(r.checksum)) e('özet biçimi geçersiz');
  }
  for (const r of records) if (r.replacedBy && !ids.has(r.replacedBy)) errors.push(`${r.id}: replacedBy bilinmeyen kayıt (${r.replacedBy})`);
  for (const t of OLD_INVENTORY_TASKS) if (!records.some((r) => r.recheck?.previousEntry === t)) errors.push(`eski kayıt yeniden denetlenmedi: ${t}`);
  return errors;
}

export interface ResearchReport {
  date: string;
  total: number;
  counts: Record<ResearchStatus, number>;
  bundled: number;
  packs: number;
  rechecked: number;
  /** Eski 19 kayıttan durumu değişenler (UNAVAILABLE → başka). */
  recheckChanged: number;
  byModality: Array<{ group: AdapterGroup; label: string; verified: number; total: number }>;
  lines: Array<{ id: string; name: string; status: ResearchStatus; reason: string }>;
}

export function researchReport(records: readonly ModelResearchRecord[] = MODEL_RESEARCH): ResearchReport {
  const counts = Object.fromEntries(RESEARCH_STATUSES.map((s) => [s, 0])) as Record<ResearchStatus, number>;
  for (const r of records) counts[r.status]++;
  const rech = records.filter((r) => r.recheck);
  return {
    date: RESEARCH_DATE,
    total: records.length,
    counts,
    bundled: records.filter((r) => r.distribution === 'bundled').length,
    packs: records.filter((r) => r.distribution === 'pack').length,
    rechecked: new Set(rech.map((r) => r.recheck!.previousEntry)).size,
    recheckChanged: new Set(rech.filter((r) => r.status !== 'UNAVAILABLE').map((r) => r.recheck!.previousEntry)).size,
    byModality: ADAPTER_GROUPS.map((g) => {
      const of = records.filter((r) => r.modality.includes(g));
      return { group: g, label: ADAPTER_GROUP_TR[g], verified: of.filter((r) => r.status === 'VERIFIED').length, total: of.length };
    }),
    lines: records.map((r) => ({ id: r.id, name: r.name, status: r.status, reason: r.status === 'VERIFIED' ? r.evidence : r.failureReason ?? '' })),
  };
}

const tri = (v: boolean | 'unknown') => (v === 'unknown' ? '?' : v ? '✓' : '✗');
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** docs/MODEL_RESEARCH.md: kayıttan üretilir (elle düzenlenmez; test, belgenin güncel olduğunu denetler). */
export function renderResearchMarkdown(records: readonly ModelResearchRecord[] = MODEL_RESEARCH): string {
  const rep = researchReport(records);
  const L: string[] = [];
  L.push('# Model araştırma raporu', '');
  L.push(`> Bu dosya \`packages/analysis/src/modelRegistry\` kaydından üretilir (\`KH_UPDATE_DOCS=1 pnpm vitest run packages/analysis/src/__tests__/modelRegistry.test.ts\`). Araştırma tarihi: ${rep.date}.`, '');
  L.push('Araştırma geliştirme sırasında yapılır; uygulama çalışırken internete çıkmaz, hasta verisi hiçbir yere gönderilmez. Çıkarım cihazda yapılır.', '');
  L.push('## Özet', '');
  L.push('```');
  L.push('MODEL RESEARCH');
  for (const s of RESEARCH_STATUSES) L.push(`${RESEARCH_STATUS_TR[s].padEnd(36)} ${String(rep.counts[s]).padStart(3)}   (${s})`);
  L.push(`${'Toplam'.padEnd(36)} ${String(rep.total).padStart(3)}`);
  L.push(`${'Uygulamayla gelen / isteğe bağlı paket'.padEnd(36)} ${rep.bundled} / ${rep.packs}`);
  L.push(`${'Eski 19 "eklenemedi" kaydı'.padEnd(36)} ${rep.rechecked} yeniden denetlendi, ${rep.recheckChanged} kaydın durumu değişti`);
  L.push('```', '');
  L.push('### Bu ortamın ağ erişimi', '');
  L.push(`- Erişilebilen: ${RESEARCH_ACCESS.reachable.join(', ')}`);
  L.push(`- Engelli (kuruluş politikası): ${RESEARCH_ACCESS.blocked.join(', ')}`);
  L.push('- Engelli bir alan adı tek başına "eklenmedi" nedeni sayılmaz: ağırlığı yayımlanmış modeller **AVAILABLE** olarak kayıtlıdır ve ağı açık bir makinede aynı betiklerle (`scripts/models/build_models.py`) üretilip doğrulanabilir.', '');
  L.push('## Modaliteye göre', '');
  L.push('| Modalite | Doğrulanan | Araştırılan |', '| --- | --- | --- |');
  for (const m of rep.byModality) L.push(`| ${m.label} | ${m.verified} | ${m.total} |`);
  L.push('');
  L.push('## Kayıtlar', '');
  L.push('| Model | Modalite | Görev | Durum | Konum | Lisans (ticari · yeniden dağıtım · ağırlık) | Dağıtım | Neden / kanıt |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of records) {
    const dist = r.distribution === 'bundled' ? 'uygulamayla gelir' : r.distribution === 'pack' ? 'isteğe bağlı paket' : '—';
    const why = r.status === 'VERIFIED' ? r.evidence : r.failureReason ?? '';
    L.push(
      `| ${cell(r.name)}${r.replacedBy ? ` → yerine: \`${r.replacedBy}\`` : ''} | ${r.modality.map((m) => ADAPTER_GROUP_TR[m]).join(', ')} | ${cell(r.task)} | **${r.status}**${r.recheck ? ' (RECHECKED)' : ''} | ${r.capabilities.localization} | ${cell(r.license.license)} (${tri(r.license.commercial)} · ${tri(r.license.redistribution)} · ${tri(r.license.weightsRedistribution)}) | ${dist} | ${cell(why)} |`,
    );
  }
  L.push('');
  L.push('## Ayrıntı', '');
  for (const r of records) {
    L.push(`### ${r.name}`, '');
    L.push(`- Kimlik: \`${r.id}\` · durum **${r.status}** (${RESEARCH_STATUS_TR[r.status]})${r.recheck ? ` · RECHECKED (önceki: ${r.recheck.previousStatus})` : ''}`);
    L.push(`- Resmi depo: ${r.officialRepository}`);
    L.push(`- Ağırlık: ${r.weightsUrl ?? '—'}${r.weightsBytes ? ` (${(r.weightsBytes / 1e6).toFixed(1)} MB)` : ''} · sürüm: ${r.version} · özet: ${r.checksum ?? '—'}`);
    L.push(`- Girdi → çıktı: ${r.inputFormat} → ${r.outputFormat}`);
    L.push(`- Yetenek: sınıflandırma ${tri(r.capabilities.classification)} · tespit ${tri(r.capabilities.detection)} · bölütleme ${tri(r.capabilities.segmentation)} · konum: ${r.capabilities.localization} · ${r.capabilities.dims} · kişisel 3B ${tri(r.capabilities.personal3D)}`);
    L.push(`- Çalışma ortamı: ${r.runtime.framework}; ONNX ${tri(r.runtime.onnxPossible)} · ORT Web ${tri(r.runtime.onnxRuntime)} · web ${tri(r.runtime.web)} · Android ${tri(r.runtime.android)} · CPU ${tri(r.runtime.cpu)} · GPU ${tri(r.runtime.gpu)} · bellek: ${r.runtime.memoryEstimate || 'ölçülmedi'}`);
    L.push(`- Lisans: ${r.license.license} — ticari ${tri(r.license.commercial)} · araştırma ${tri(r.license.research)} · yeniden dağıtım ${tri(r.license.redistribution)} · ağırlık dağıtımı ${tri(r.license.weightsRedistribution)} · atıf ${tri(r.license.attribution)}${r.license.note ? ` — ${r.license.note}` : ''}`);
    L.push(`- Kanıt: ${r.evidence}`);
    if (r.failureReason) L.push(`- Neden / sonra nasıl eklenir: ${r.failureReason}`);
    L.push(`- Denetlenen kaynaklar: ${r.sourcesChecked.join('; ')}${r.blockedHosts?.length ? ` · erişilemeyen: ${r.blockedHosts.join(', ')}` : ''}`);
    if (r.recheck) L.push(`- Eski kayıt: "${r.recheck.previousEntry}" — ${r.recheck.previousReason}`);
    if (r.replacedBy) L.push(`- Alternatif: \`${r.replacedBy}\``);
    L.push('');
  }
  return L.join('\n');
}
