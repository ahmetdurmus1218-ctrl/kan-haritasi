/**
 * Z-Anatomy yapı adlarının Türkçesi: yalnızca sözlükte bulunanlar çevrilir (dişler, kemikçikler,
 * kıkırdaklar, baş-boyun organları, kafa sinirleri ve ana periferik sinirler). Sözlükte olmayan ad
 * çevrilmez; uygulama uluslararası (İngilizce, Terminologia Anatomica) adı ve tarafı gösterir.
 */
import type { ElementName } from './names-tr';

const SIDE = { l: 'Sol', r: 'Sağ' } as const;

const EXACT: Record<string, ElementName> = {
  malleus: { tr: 'Çekiç kemiği', la: 'Malleus' },
  incus: { tr: 'Örs kemiği', la: 'Incus' },
  stapes: { tr: 'Üzengi kemiği', la: 'Stapes' },
  'thyroid cartilage': { tr: 'Tiroid kıkırdağı (Âdem elması)', la: 'Cartilago thyroidea' },
  'cricoid cartilage': { tr: 'Krikoid kıkırdak', la: 'Cartilago cricoidea' },
  'arytenoid cartilage': { tr: 'Aritenoid kıkırdak', la: 'Cartilago arytenoidea' },
  'corniculate cartilage': { tr: 'Kornikulat kıkırdak', la: 'Cartilago corniculata' },
  'nasal septal cartilage': { tr: 'Burun bölmesi kıkırdağı', la: 'Cartilago septi nasi' },
  'lateral process of nasal septal cartilage': { tr: 'Burun yan kıkırdağı', la: 'Processus lateralis cartilaginis septi nasi' },
  'major alar cartilage': { tr: 'Büyük kanat kıkırdağı', la: 'Cartilago alaris major' },
  'sinus of frontal bone': { tr: 'Alın sinüsü', la: 'Sinus frontalis' },
  'sinus of sphenoid bone': { tr: 'Kama kemiği sinüsü', la: 'Sinus sphenoidalis' },
  'anterior cells of ethmoid bone': { tr: 'Etmoid ön hücreleri', la: 'Cellulae ethmoidales anteriores' },
  'middle cells of ethmoid bone': { tr: 'Etmoid orta hücreleri', la: 'Cellulae ethmoidales mediae' },
  'posterior cells of ethmoid bone': { tr: 'Etmoid arka hücreleri', la: 'Cellulae ethmoidales posteriores' },
  'thyroid gland': { tr: 'Tiroid bezi', la: 'Glandula thyroidea' },
  'superior parathyroid gland': { tr: 'Üst paratiroid bezi', la: 'Glandula parathyroidea superior' },
  'inferior parathyroid gland': { tr: 'Alt paratiroid bezi', la: 'Glandula parathyroidea inferior' },
  tongue: { tr: 'Dil', la: 'Lingua' },
  'soft palate': { tr: 'Yumuşak damak', la: 'Palatum molle' },
  'uvula of palate': { tr: 'Küçük dil (uvula)', la: 'Uvula palatina' },
  gingiva: { tr: 'Dişeti', la: 'Gingiva' },
  'parotid gland': { tr: 'Kulak altı (parotis) bezi', la: 'Glandula parotidea' },
  'accessory parotid gland': { tr: 'Yardımcı parotis bezi', la: 'Glandula parotidea accessoria' },
  'parotid duct': { tr: 'Parotis kanalı (Stensen)', la: 'Ductus parotideus' },
  'sublingual gland': { tr: 'Dil altı bezi', la: 'Glandula sublingualis' },
  'submandibular gland': { tr: 'Çene altı bezi', la: 'Glandula submandibularis' },
  'submandibular duct': { tr: 'Çene altı bezi kanalı (Wharton)', la: 'Ductus submandibularis' },
  nasopharynx: { tr: 'Burun yutağı (nazofarenks)', la: 'Pars nasalis pharyngis' },
  oropharynx: { tr: 'Ağız yutağı (orofarenks)', la: 'Pars oralis pharyngis' },
  laryngopharynx: { tr: 'Gırtlak yutağı (larengofarenks)', la: 'Pars laryngea pharyngis' },
  'mucosa of nasal cavity': { tr: 'Burun boşluğu mukozası', la: 'Tunica mucosa cavitatis nasi' },
  'tympanic membrane': { tr: 'Kulak zarı', la: 'Membrana tympanica' },
  'auditory tube': { tr: 'Östaki borusu', la: 'Tuba auditiva' },
  'olfactory nerve (i)': { tr: 'Koku siniri (I)', la: 'Nervus olfactorius' },
  'optic nerve (ii)': { tr: 'Görme siniri (II)', la: 'Nervus opticus' },
  'oculomotor nerve (iii)': { tr: 'Göz hareket siniri (III)', la: 'Nervus oculomotorius' },
  'trochlear nerve (iv)': { tr: 'Makara siniri (IV)', la: 'Nervus trochlearis' },
  'trigeminal nerve (v)': { tr: 'Üçlü sinir (V, trigeminus)', la: 'Nervus trigeminus' },
  'abducens nerve (vi)': { tr: 'Uzaklaştırıcı sinir (VI)', la: 'Nervus abducens' },
  'facial nerve (vii)': { tr: 'Yüz siniri (VII)', la: 'Nervus facialis' },
  'vestibulocochlear nerve (viii)': { tr: 'İşitme-denge siniri (VIII)', la: 'Nervus vestibulocochlearis' },
  'glossopharyngeal nerve (ix)': { tr: 'Dil-yutak siniri (IX)', la: 'Nervus glossopharyngeus' },
  'vagus nerve (x)': { tr: 'Vagus siniri (X)', la: 'Nervus vagus' },
  'accessory nerve (xi)': { tr: 'Aksesuar sinir (XI)', la: 'Nervus accessorius' },
  'hypoglossal nerve (xii)': { tr: 'Dil altı siniri (XII)', la: 'Nervus hypoglossus' },
  'ophthalmic nerve': { tr: 'Oftalmik sinir (V1)', la: 'Nervus ophthalmicus' },
  'maxillary nerve': { tr: 'Üst çene siniri (V2)', la: 'Nervus maxillaris' },
  'lingual nerve': { tr: 'Dil siniri', la: 'Nervus lingualis' },
  'inferior alveolar nerve': { tr: 'Alt alveoler sinir', la: 'Nervus alveolaris inferior' },
  'chorda tympani': { tr: 'Korda timpani', la: 'Chorda tympani' },
  'median nerve': { tr: 'Median sinir', la: 'Nervus medianus' },
  'ulnar nerve': { tr: 'Ulnar sinir', la: 'Nervus ulnaris' },
  'radial nerve': { tr: 'Radyal sinir', la: 'Nervus radialis' },
  'axillary nerve': { tr: 'Aksiller sinir', la: 'Nervus axillaris' },
  'musculocutaneous nerve': { tr: 'Muskulokutanöz sinir', la: 'Nervus musculocutaneus' },
  'femoral nerve': { tr: 'Femoral sinir', la: 'Nervus femoralis' },
  'sciatic nerve': { tr: 'Siyatik sinir', la: 'Nervus ischiadicus' },
  'tibial nerve': { tr: 'Tibial sinir', la: 'Nervus tibialis' },
  'common fibular nerve': { tr: 'Ortak fibular (peroneal) sinir', la: 'Nervus fibularis communis' },
  'superficial fibular nerve': { tr: 'Yüzeyel fibular sinir', la: 'Nervus fibularis superficialis' },
  'deep fibular nerve': { tr: 'Derin fibular sinir', la: 'Nervus fibularis profundus' },
  'obturator nerve': { tr: 'Obturator sinir', la: 'Nervus obturatorius' },
  'pudendal nerve': { tr: 'Pudendal sinir', la: 'Nervus pudendus' },
  'phrenic nerve': { tr: 'Frenik sinir (diyafram siniri)', la: 'Nervus phrenicus' },
  'sympathetic trunk': { tr: 'Sempatik zincir', la: 'Truncus sympathicus' },
  'ganglia of sympathetic trunk': { tr: 'Sempatik zincir ganglionları', la: 'Ganglia trunci sympathici' },
  'spinal ganglion': { tr: 'Spinal ganglion', la: 'Ganglion sensorium nervi spinalis' },
  'falx cerebri': { tr: 'Beyin orağı (falx cerebri)', la: 'Falx cerebri' },
  'tentorium cerebelli': { tr: 'Beyincik çadırı', la: 'Tentorium cerebelli' },
  'spinal dura': { tr: 'Omurilik sert zarı (dura)', la: 'Dura mater spinalis' },
};

const TOOTH: [RegExp, string, string][] = [
  [/^(upper|lower) medial incisor$/, 'orta kesici diş', 'Dens incisivus medialis'],
  [/^(upper|lower) lateral incisor$/, 'yan kesici diş', 'Dens incisivus lateralis'],
  [/^(upper|lower) canine$/, 'köpek dişi', 'Dens caninus'],
  [/^(upper|lower) first premolar$/, '1. küçük azı dişi', 'Dens premolaris primus'],
  [/^(upper|lower) second premolar$/, '2. küçük azı dişi', 'Dens premolaris secundus'],
  [/^(upper|lower) first molar tooth$/, '1. büyük azı dişi', 'Dens molaris primus'],
  [/^(upper|lower) second molar tooth$/, '2. büyük azı dişi', 'Dens molaris secundus'],
];

/** Z-Anatomy adı (taraf eki olmadan) + taraf → Türkçe ad; sözlükte yoksa null. */
export function zaName(base: string, side: 'l' | 'r' | null): ElementName | null {
  const b = base.toLowerCase().trim();
  const sided = (n: ElementName): ElementName => (side ? { tr: `${SIDE[side]} ${n.tr.charAt(0).toLocaleLowerCase('tr')}${n.tr.slice(1)}`, la: n.la } : n);
  if (EXACT[b]) return sided(EXACT[b]!);
  for (const [re, tr, la] of TOOTH) {
    const m = re.exec(b);
    if (m) {
      const jaw = m[1] === 'upper' ? 'üst' : 'alt';
      return { tr: `${side ? `${SIDE[side]} ` : ''}${jaw} ${tr}`.replace(/^./, (c) => c.toLocaleUpperCase('tr')), la: `${la} ${m[1] === 'upper' ? 'maxillaris' : 'mandibularis'}` };
    }
  }
  return null;
}
