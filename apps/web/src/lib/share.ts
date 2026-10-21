/**
 * "Hekime götür": rapor cümleleri, sade anlamları ve sorular düz metin olarak paylaşılır ya da panoya
 * kopyalanır. Metin cihazdan yalnızca kullanıcı paylaş ekranında bir uygulama seçerse çıkar; uygulama
 * kendisi hiçbir yere göndermez.
 */
import { formatDate } from './format';
import { type SentenceRef, doctorQuestions, plainReading } from './reportSteps';

const STATUS: Record<string, string> = { abnormal: 'dikkat çeken', uncertain: 'kesin olmayan', normal: 'olağan', 'not-assessed': 'değerlendirilemedi' };

/** Hekime götürülecek not: her cümle, raporda geçtiği yer, sade anlamı; en sonda tekrarsız sorular. */
export function doctorNote(items: readonly SentenceRef[]): string {
  const lines: string[] = ['Raporumdan hekimime sormak istediklerim', ''];
  const questions: string[] = [];
  items.forEach((s, i) => {
    const p = plainReading(s.finding);
    lines.push(`${i + 1}. “${s.finding.text}”`);
    lines.push(`   ${s.docName}${s.dateKnown ? ` · ${formatDate(s.date)}` : ''} · ${p.where ?? 'yer belirtilmemiş'} · raporda ${STATUS[s.finding.status] ?? ''} ifade`);
    for (const l of p.lines.slice(0, 4)) lines.push(`   – ${l}`);
    for (const q of doctorQuestions(s.finding)) if (!questions.includes(q)) questions.push(q);
  });
  lines.push('', 'Sorularım:', ...questions.map((q) => `• ${q}`), '', 'Not: Sözcüklerin genel anlamıdır (Kan Haritası); tanı değildir.');
  return lines.join('\n');
}

/** Sistem paylaş ekranı varsa onu, yoksa panoyu kullanır. Dönen metin kullanıcıya gösterilir. */
export async function shareOrCopy(title: string, text: string): Promise<string> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return 'Paylaşıldı.';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'Paylaşım iptal edildi.';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'Panoya kopyalandı: mesaj ya da not uygulamasına yapıştırabilirsin.';
  } catch {
    return 'Kopyalanamadı. Bu cihazda paylaşım ve pano kapalı olabilir.';
  }
}
