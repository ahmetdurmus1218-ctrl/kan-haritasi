import { VESSEL_WALL, st } from '../build';
import type { OrganInteriorDefinition, UnitKind } from '../types';

/**
 * Beynin her bölümü için ayrı iç dünya: yarıküreler, beş lob, limbik sistem (hipokampus, amigdala),
 * talamus, bazal çekirdekler, karıncıklar (BOS), korpus kallozum, beyin zarları, beyin sapının üç
 * bölümü ve Willis halkası. Radyoloji raporundaki bir cümle hangi bölgeye yerleştiyse (ör. "sol frontal
 * lob") o bölgenin iç dünyasında, düğümü eşleşen basamakta kaynağıyla görünür (stagePersonal).
 * İçerik genel anatomi/fizyoloji bilgisidir; kişinin beyninin görüntüsü değildir.
 */

const LOBES = [
  { to: 'brain.frontal', label: 'Alın (frontal) lobu' },
  { to: 'brain.parietal', label: 'Yan kafa (parietal) lobu' },
  { to: 'brain.temporal', label: 'Şakak (temporal) lobu' },
  { to: 'brain.occipital', label: 'Arka kafa (oksipital) lobu' },
  { to: 'brain.insula', label: 'İnsula' },
];

/** Bir lobun ortak kalıbı: parankim (lobun kendisi) → işlevler → bölümler → korteks → beyaz cevher → nöron → sinaps. */
function lobe(
  id: string,
  name: string,
  summary: string,
  regions: Array<{ id: string; name: string; text: string }>,
  work: Array<{ id: string; title: string; text: string; node?: string; next?: Array<{ to: string; label: string }> }>,
  color: string,
): OrganInteriorDefinition {
  return {
    organId: id,
    name,
    type: 'solid',
    system: 'nervous',
    parent: 'brain.cerebrum',
    summary,
    anchor: id,
    structure: 'brain',
    interiorScene: { kind: 'parenchyma', unit: 'layers', color, inflow: 'Ön, orta ve arka beyin arterleri', outflow: 'Yüzeyel ve derin beyin venleri' },
    functionalRegions: regions,
    wallLayers: [
      { id: 'meninges', name: 'Beyin zarları', text: 'Lobun yüzeyini örten pia, araknoid ve dura.', node: 'brain.meninges' },
      { id: 'cortex', name: 'Korteks (gri cevher)', text: 'Yüzeydeki 2–4 mm\'lik nöron gövdesi tabakası.', node: 'tissue.gray-matter' },
      { id: 'subcortical', name: 'Subkortikal beyaz cevher', text: 'Korteksin hemen altındaki lifler; MR raporlarında "subkortikal" denen bölge.', node: 'tissue.white-matter' },
      { id: 'deep', name: 'Derin ve periventriküler beyaz cevher', text: 'Karıncıkların çevresine kadar uzanan lifler ("periventriküler").', node: 'brain.white-matter' },
    ],
    physiologyFlows: ['nervous'],
    deepAnatomyEntry: id,
    relatedSystems: ['nervous'],
    stages: [
      st('parenchyma', 'parenchyma', 'interior', `${name}: içi`, 'Dolu bir dokudur: yüzeyde kıvrımlı gri cevher (korteks), altında beyaz cevher lifleri. İçinde boşluk yoktur.', { focus: 'units', node: id }),
      ...work.map((w) => st(w.id, 'process', 'interior', w.title, w.text, { focus: 'flow', ...(w.node ? { node: w.node } : {}), ...(w.next ? { next: w.next } : {}) })),
      st('regions', 'region', 'region', 'Bölümleri', regions.map((r) => r.name).join(' · '), { focus: 'overview', next: LOBES.filter((l) => l.to !== id).slice(0, 2) }),
      st('cortex', 'tissue', 'tissue', 'Korteks (gri cevher)', 'Altı katmanlı nöron tabakası; bilgi IV. katmana girer, V–VI. katmandan çıkar.', { node: 'tissue.cortical-layers', scene: 'noron', next: [{ to: 'ic.cerebral-cortex', label: 'Kortekse gir' }] }),
      st('white', 'tissue', 'tissue', 'Altındaki beyaz cevher', 'Korteksin altındaki miyelinli lifler bu lobu diğer loblara, karşı yarıküreye ve omuriliğe bağlar. MR raporlarındaki "subkortikal" ve "periventriküler" sözcükleri bu katmanı anlatır.', { node: 'tissue.white-matter', scene: 'noron', next: [{ to: 'brain.white-matter', label: 'Beyaz cevhere gir' }] }),
      st('neuron', 'cell', 'cell', 'Piramidal nöron', 'Korteksin ana çıkış hücresi; uzun aksonunu başka bölgelere gönderir.', { node: 'cell.pyramidal', scene: 'noron' }),
      st('synapse', 'cell', 'cell', 'Sinaps', 'Nöronlar arası ~20 nm\'lik bağlantı noktası.', { node: 'sub.synapse', scene: 'noron', next: [{ to: 'sub.synapse', label: 'Sinapsın içine gir' }] }),
      st('signal', 'molecule', 'molecule', 'Sinyal ve nörotransmitter', 'Aksiyon potansiyeli aksonda ilerler; uçta glutamat, GABA gibi haberciler salınır.', { node: 'mol.neurotransmitter', scene: 'noron' }),
    ],
  };
}

/** Derin gri cevher yapıları ve beyin sapı bölümleri için kısa kalıp. */
function nucleus(
  id: string,
  name: string,
  summary: string,
  o: {
    parent: string;
    unit?: UnitKind;
    color: string;
    inflow: string;
    outflow: string;
    regions: Array<{ id: string; name: string; text: string; interior?: string; node?: string }>;
    flow: { title: string; text: string; next?: Array<{ to: string; label: string }> };
    process?: { title: string; text: string; node?: string; next?: Array<{ to: string; label: string }> };
    /** İlk sahnenin metni (verilmezse: çekirdek kümesi). */
    inside?: string;
    cell?: { title: string; text: string; node: string };
    aliases?: string[];
    bindings?: string[];
  },
): OrganInteriorDefinition {
  return {
    organId: id,
    name,
    type: 'solid',
    system: 'nervous',
    parent: o.parent,
    summary,
    anchor: id,
    structure: 'brain',
    ...(o.aliases ? { aliases: o.aliases } : {}),
    interiorScene: { kind: 'parenchyma', unit: o.unit ?? 'neuron', color: o.color, inflow: o.inflow, outflow: o.outflow },
    functionalRegions: o.regions,
    physiologyFlows: ['nervous'],
    deepAnatomyEntry: id,
    relatedSystems: ['nervous'],
    ...(o.bindings ? { personalDataBindings: o.bindings } : {}),
    stages: [
      st('parenchyma', 'parenchyma', 'interior', `${name}: içi`, o.inside ?? 'Nöron kümelerinden (çekirdeklerden) ve aralarından geçen liflerden oluşan dolu doku; içinde boşluk yoktur.', { focus: 'units', node: id }),
      st('flow', 'flow', 'interior', o.flow.title, o.flow.text, { focus: 'flow', ...(o.flow.next ? { next: o.flow.next } : {}) }),
      ...(o.process ? [st('work', 'process', 'interior', o.process.title, o.process.text, { focus: 'secrete', ...(o.process.node ? { node: o.process.node } : {}), ...(o.process.next ? { next: o.process.next } : {}) })] : []),
      st('regions', 'region', 'region', 'Bölümleri', o.regions.map((r) => r.name).join(' · '), { focus: 'overview' }),
      st('tissue', 'tissue', 'tissue', 'Gri cevher dokusu', 'Nöron gövdeleri, glia ve sinapslar.', { node: 'tissue.gray-matter', scene: 'noron' }),
      st('cell', 'cell', 'cell', o.cell?.title ?? 'Nöron', o.cell?.text ?? 'Elektriksel ve kimyasal sinyal üreten hücre.', { node: o.cell?.node ?? 'cell.neuron', scene: 'noron' }),
      st('signal', 'molecule', 'molecule', 'Sinyal', 'İyon kanalları açılır, aksiyon potansiyeli lif boyunca ilerler, sinapsta nörotransmitter salınır.', { node: 'proc.nerve-signal', scene: 'noron' }),
    ],
  };
}

export const BRAIN: OrganInteriorDefinition[] = [
  {
    organId: 'brain.cerebrum',
    name: 'Yarıküreler (uç beyin)',
    type: 'solid',
    system: 'nervous',
    parent: 'brain',
    summary: 'Beynin en büyük bölümü: sol ve sağ yarıküre, her birinde beş lob, altta beyaz cevher ve derin çekirdekler.',
    anchor: 'brain.cerebrum',
    structure: 'brain',
    aliases: ['brain.hemisphere-left', 'brain.hemisphere-right'],
    interiorScene: { kind: 'parenchyma', unit: 'layers', color: '#c99aa0', inflow: 'Ön, orta ve arka beyin arterleri', outflow: 'Dural venöz sinüsler' },
    functionalRegions: [
      ...LOBES.map((l) => ({ id: l.to.slice(6), name: l.label, text: 'Bu lobun içine gir.', interior: l.to, node: l.to })),
      { id: 'limbic', name: 'Limbik sistem', text: 'Bellek ve duygu.', interior: 'brain.limbic', node: 'brain.limbic' },
      { id: 'basal', name: 'Bazal çekirdekler', text: 'Hareketin başlatılması.', interior: 'brain.basal-nuclei', node: 'brain.basal-nuclei' },
      { id: 'cc', name: 'Korpus kallozum', text: 'İki yarıküreyi bağlar.', interior: 'brain.corpus-callosum', node: 'brain.corpus-callosum' },
    ],
    physiologyFlows: ['nervous'],
    deepAnatomyEntry: 'brain.cerebrum',
    relatedSystems: ['nervous'],
    stages: [
      st('parenchyma', 'parenchyma', 'interior', 'Yarıkürelerin içi', 'Yüzeyde kıvrımlı korteks (giruslar ve aralarındaki sulkuslar), altında beyaz cevher, en derinde çekirdekler ve karıncıklar.', { focus: 'units', node: 'brain.cerebrum' }),
      st('crossed', 'flow', 'interior', 'Çapraz yönetim', 'Sol yarıküre vücudun SAĞ yarısını, sağ yarıküre SOL yarısını yönetir; hareket ve duyu yolları beyin sapında çaprazlaşır.', { focus: 'flow', next: [{ to: 'brain.medulla', label: 'Çaprazlaşma: soğancık' }] }),
      st('talk', 'flow', 'interior', 'İki yarıküre konuşur', 'Yarıküreler ~200 milyon liften oluşan korpus kallozumla sürekli bilgi alışverişi yapar.', { focus: 'flow', node: 'fn.connectivity', next: [{ to: 'brain.corpus-callosum', label: 'Korpus kallozuma gir' }] }),
      st('left', 'region', 'region', 'Sol yarıküre', 'Çoğu kişide dil (konuşma üretme ve anlama) bu tarafta; vücudun sağ yarısını yönetir.', { node: 'brain.hemisphere-left', next: [{ to: 'brain.frontal', label: 'Konuşma: alın lobu' }, { to: 'brain.temporal', label: 'Dil anlama: şakak lobu' }] }),
      st('right', 'region', 'region', 'Sağ yarıküre', 'Uzamsal algı, yüz tanıma ve dikkatin iki yana dağıtılmasında baskın; vücudun sol yarısını yönetir.', { node: 'brain.hemisphere-right', next: [{ to: 'brain.parietal', label: 'Uzamsal algı: yan kafa lobu' }] }),
      st('lobes', 'region', 'region', 'Beş lob', 'Her lobun öne çıkan bir işi vardır. Bir loba girip içinde neler olduğunu adım adım gör.', { focus: 'overview', next: LOBES.slice(0, 4) }),
      st('cortex', 'tissue', 'tissue', 'Korteks', 'Altı katmanlı gri cevher.', { node: 'tissue.cortical-layers', scene: 'noron', next: [{ to: 'ic.cerebral-cortex', label: 'Kortekse gir' }] }),
    ],
  },
  lobe(
    'brain.frontal',
    'Alın (frontal) lobu',
    'Beynin ön bölümü: planlama, karar verme, kişilik, dikkat, istemli hareket ve (çoğu kişide solda) konuşma üretimi.',
    [
      { id: 'prefrontal', name: 'Prefrontal korteks', text: 'Planlama, karar, dürtü kontrolü, çalışma belleği.' },
      { id: 'premotor', name: 'Premotor alan', text: 'Hareketin planlanması.' },
      { id: 'motor', name: 'Motor korteks (presantral girus)', text: 'Kasları çalıştıran komutların çıktığı şerit.' },
      { id: 'broca', name: 'Broca alanı', text: 'Konuşmanın üretimi (çoğu kişide solda).' },
      { id: 'orbitofrontal', name: 'Orbitofrontal korteks', text: 'Duygusal karar, ödül ve sosyal davranış.' },
    ],
    [
      { id: 'planning', title: 'Planlama ve karar', text: 'Prefrontal korteks hedef koyar, seçenekleri tartar, dikkati yönetir ve dürtüleri frenler.', node: 'fn.executive' },
      { id: 'movement', title: 'Hareket komutu', text: 'Motor korteksten çıkan sinyal beyaz cevherden (kapsula interna) beyin sapına ve omuriliğe iner; karşı taraftaki kas kasılır.', node: 'fn.motor', next: [{ to: 'brain.basal-nuclei', label: 'Hareketin ayarı: bazal çekirdekler' }, { to: 'spinal-cord', label: 'Komutun yolu: omurilik' }] },
      { id: 'speech', title: 'Konuşma üretimi', text: 'Broca alanı kelimeleri seslere çevirecek kas planını kurar; anlama ise şakak lobundaki Wernicke alanındadır.', node: 'fn.speech', next: [{ to: 'brain.temporal', label: 'Dil anlama: şakak lobu' }] },
    ],
    '#cfa1a6',
  ),
  lobe(
    'brain.parietal',
    'Yan kafa (parietal) lobu',
    'Tepenin altındaki bölüm: dokunma, ağrı, sıcaklık ve vücut konumu duyuları; uzamsal algı, okuma ve hesap.',
    [
      { id: 'somatosensory', name: 'Duyu korteksi (postsantral girus)', text: 'Vücudun her bölgesinin duyu haritası.' },
      { id: 'superior', name: 'Üst parietal lobül', text: 'Vücudun uzaydaki yeri, el–göz koordinasyonu.' },
      { id: 'inferior', name: 'Alt parietal lobül', text: 'Okuma, yazma, hesap, sağ–sol ayrımı.' },
    ],
    [
      { id: 'touch', title: 'Dokunma ve ağrı duyusu', text: 'Deriden gelen sinyal omurilik → beyin sapı → talamus yoluyla duyu korteksine ulaşır; bedenin karşı yarısı burada haritalanır.', node: 'fn.sensation', next: [{ to: 'brain.thalamus', label: 'Aktarma istasyonu: talamus' }] },
      { id: 'space', title: 'Uzamsal algı', text: 'Görme ve duyu bilgisini birleştirir: nesnelerin nerede olduğu, elin ona nasıl uzanacağı.', node: 'fn.spatial', next: [{ to: 'brain.occipital', label: 'Görme bilgisi: arka kafa lobu' }] },
    ],
    '#c99fae',
  ),
  lobe(
    'brain.temporal',
    'Şakak (temporal) lobu',
    'Kulağın üstündeki bölüm: işitme, dil anlama, yeni anıların oluşması ve duygular. İç yüzünde hipokampus ve amigdala bulunur.',
    [
      { id: 'auditory', name: 'İşitme korteksi (Heschl girusu)', text: 'Sesin ilk işlendiği yer.' },
      { id: 'wernicke', name: 'Wernicke alanı', text: 'Dilin anlaşılması (çoğu kişide solda).' },
      { id: 'mesial', name: 'Mezial (iç) temporal bölge', text: 'Hipokampus ve amigdala: bellek ve duygu.' },
      { id: 'inferior', name: 'Alt temporal korteks', text: 'Yüz ve nesne tanıma.' },
    ],
    [
      { id: 'hearing', title: 'İşitme', text: 'İç kulaktan gelen sinyal beyin sapı ve talamus üzerinden işitme korteksine ulaşır.', node: 'fn.hearing', next: [{ to: 'ear.cochlea', label: 'Sesin geldiği yer: koklea' }] },
      { id: 'language', title: 'Dil anlama', text: 'Wernicke alanı duyulan ve okunan kelimelere anlam verir; Broca alanıyla bir lif demeti (arkuat fasikül) üzerinden konuşur.', node: 'fn.speech', next: [{ to: 'brain.frontal', label: 'Konuşma üretimi: alın lobu' }] },
      { id: 'memory', title: 'Bellek', text: 'İç yüzdeki hipokampus yeni anıları oluşturur; amigdala onlara duygusal önem ekler.', node: 'fn.memory', next: [{ to: 'brain.hippocampus', label: 'Hipokampusa gir' }, { to: 'brain.amygdala', label: 'Amigdalaya gir' }] },
    ],
    '#c7a0a0',
  ),
  lobe(
    'brain.occipital',
    'Arka kafa (oksipital) lobu',
    'Beynin arka bölümü: görme merkezleri. Gözden gelen bilgi burada şekil, renk ve harekete dönüşür.',
    [
      { id: 'v1', name: 'Birincil görme korteksi (V1)', text: 'Kalkarin yarığın kenarları; görüntünün ilk işlendiği yer.' },
      { id: 'association', name: 'Görsel ilişki alanları', text: 'Renk, hareket ve şekil ayrı ayrı işlenir.' },
    ],
    [
      { id: 'vision', title: 'Görme yolu', text: 'Retina → optik sinir → kiazma (yarısı çaprazlaşır) → talamus → görme ışınları → arka kafa lobu. Sağ görme alanı sol lobda işlenir.', node: 'fn.vision', next: [{ to: 'eyes', label: 'Işığın girdiği yer: göz' }, { to: 'brain.thalamus', label: 'Aktarma: talamus' }] },
    ],
    '#c4a3b0',
  ),
  lobe(
    'brain.insula',
    'İnsula',
    'Yan yarığın derininde, alın, yan kafa ve şakak loblarının örttüğü korteks: tat, iç organ duyuları (kalp atışı, açlık), ağrı ve duygusal farkındalık.',
    [
      { id: 'anterior', name: 'Ön insula', text: 'Duygusal farkındalık, tat.' },
      { id: 'posterior', name: 'Arka insula', text: 'İç organ ve ağrı duyusu.' },
    ],
    [
      { id: 'interoception', title: 'Vücudun içini hissetmek', text: 'Kalp atışı, nefes, açlık ve mide doluluğu gibi iç organ sinyalleri burada bilinçli hisse dönüşür.', node: 'fn.sensation' },
    ],
    '#c89c9a',
  ),
  {
    organId: 'brain.limbic',
    name: 'Limbik sistem',
    type: 'solid',
    system: 'nervous',
    parent: 'brain.cerebrum',
    summary: 'Hipokampus, amigdala ve singulat girustan oluşan halka: bellek, duygu ve motivasyon.',
    anchor: 'brain.limbic',
    structure: 'brain',
    aliases: ['brain.cingulate'],
    interiorScene: { kind: 'parenchyma', unit: 'neuron', color: '#c793a6', inflow: 'Arka ve orta beyin arterleri', outflow: 'Derin beyin venleri' },
    functionalRegions: [
      { id: 'hippocampus', name: 'Hipokampus', text: 'Yeni anılar.', interior: 'brain.hippocampus', node: 'brain.hippocampus' },
      { id: 'amygdala', name: 'Amigdala', text: 'Korku ve duygusal anılar.', interior: 'brain.amygdala', node: 'brain.amygdala' },
      { id: 'cingulate', name: 'Singulat girus', text: 'Duygu, dikkat, ağrının duygusal boyutu.', node: 'brain.cingulate' },
    ],
    physiologyFlows: ['nervous', 'endocrine-axis'],
    deepAnatomyEntry: 'brain.limbic',
    relatedSystems: ['nervous', 'endocrine'],
    stages: [
      st('parenchyma', 'parenchyma', 'interior', 'Limbik halkanın içi', 'Yarıkürelerin iç yüzünde, ara beynin çevresini saran gri cevher halkası.', { focus: 'units', node: 'brain.limbic' }),
      st('circuit', 'flow', 'interior', 'Duygu ve bellek devresi', 'Hipokampus → forniks → hipotalamus → talamus → singulat girus → hipokampus: deneyim bu halkada belleğe ve duyguya bağlanır.', { focus: 'flow', next: [{ to: 'brain.hippocampus', label: 'Hipokampusa gir' }, { to: 'ic.hypothalamus', label: 'Hipotalamusa git' }] }),
      st('stress', 'process', 'interior', 'Stres yanıtı', 'Amigdala tehlikeyi algılayınca hipotalamus üzerinden stres hormonu eksenini (CRH → ACTH → kortizol) başlatır.', { focus: 'secrete', node: 'proc.hpa-axis', biomarkers: ['cortisol'], next: [{ to: 'brain.amygdala', label: 'Amigdalaya gir' }] }),
      st('regions', 'region', 'region', 'Bölümleri', 'Hipokampus · amigdala · singulat girus.', { node: 'brain.cingulate' }),
      st('neuron', 'cell', 'cell', 'Nöron', 'Bellek izleri sinaps güçlenmesiyle saklanır.', { node: 'cell.neuron', scene: 'noron' }),
    ],
  },
  nucleus('brain.hippocampus', 'Hipokampus', 'Şakak lobunun iç yüzünde, deniz atına benzeyen kıvrım: yeni anıların oluşması ve yön bulma.', {
    parent: 'brain.limbic',
    unit: 'layers',
    inside: 'Kendi üzerine kıvrılmış ince, üç katmanlı korteks şeridi; yan karıncığın alt boynuzunun tabanında uzanır.',
    color: '#d1a3b0',
    inflow: 'Arka beyin arteri dalları',
    outflow: 'Bazal ven',
    regions: [
      { id: 'dentate', name: 'Dentat girus', text: 'Girişin ilk durağı; yetişkinde de yeni nöron üretilebilen az sayıdaki yerden biri.' },
      { id: 'ca3', name: 'CA3', text: 'Anıların parçalarını birbirine bağlar.' },
      { id: 'ca1', name: 'CA1', text: 'Çıkış; oksijen eksikliğine en duyarlı bölge.' },
      { id: 'fornix', name: 'Forniks', text: 'Hipokampusun çıkış lif demeti.' },
    ],
    flow: { title: 'Anının yolu', text: 'Entorinal korteks → dentat girus → CA3 → CA1 → subikulum → forniks: yaşanan an kısa süreli bellekten kalıcı belleğe aktarılır.', next: [{ to: 'brain.temporal', label: 'Bulunduğu yer: şakak lobu' }] },
    process: { title: 'Bellek kaydı', text: 'Tekrarlanan uyarı sinapsları güçlendirir (uzun süreli potansiyasyon); uykuda anılar kortekse taşınır.', node: 'fn.memory', next: [{ to: 'sub.synapse', label: 'Sinapsın içine gir' }] },
    cell: { title: 'Piramidal nöron (CA1)', text: 'Yer hücreleri: kişinin bulunduğu konuma göre ateşlenir.', node: 'cell.pyramidal' },
  }),
  nucleus('brain.amygdala', 'Amigdala', 'Hipokampusun önünde badem büyüklüğünde çekirdek kümesi: korku, tehlike algısı ve anılara duygusal renk.', {
    parent: 'brain.limbic',
    color: '#cf8f9d',
    inflow: 'Ön koroid arter',
    outflow: 'Bazal ven',
    regions: [
      { id: 'basolateral', name: 'Bazolateral çekirdekler', text: 'Duyulardan gelen bilgiyi değerlendirir.' },
      { id: 'central', name: 'Merkez çekirdek', text: 'Vücudun korku yanıtını başlatır.' },
    ],
    flow: { title: 'Tehlike sinyali', text: 'Talamustan gelen kaba duyu bilgisi kortekse varmadan amigdalaya ulaşır; kalp hızı ve dikkat saniyeden kısa sürede artar.', next: [{ to: 'brain.thalamus', label: 'Kaynak: talamus' }] },
    process: { title: 'Stres ekseni', text: 'Merkez çekirdek hipotalamusu uyarır: CRH → ACTH → kortizol.', node: 'proc.hpa-axis', next: [{ to: 'ic.hypothalamus', label: 'Hipotalamusa git' }] },
    bindings: ['cortisol'],
  }),
  nucleus('brain.thalamus', 'Talamus', 'Beynin ortasındaki iki yumurta biçimli çekirdek kümesi: koku dışındaki tüm duyuların kortekse aktarıldığı istasyon; uyanıklık ve dikkat.', {
    parent: 'brain',
    color: '#c8a2a8',
    inflow: 'Arka beyin arteri delici dalları',
    outflow: 'İç serebral venler',
    regions: [
      { id: 'lgn', name: 'Lateral genikulat çekirdek', text: 'Görme aktarması.' },
      { id: 'mgn', name: 'Medial genikulat çekirdek', text: 'İşitme aktarması.' },
      { id: 'vpl', name: 'Ventral posterior çekirdekler', text: 'Dokunma ve ağrı aktarması.' },
      { id: 'va', name: 'Ventral ön/yan çekirdekler', text: 'Bazal çekirdek ve beyincikten gelen hareket döngüsü.' },
      { id: 'hypothalamus', name: 'Hipotalamus (altında)', text: 'Hormon ve iç denge merkezi.', interior: 'ic.hypothalamus' },
    ],
    flow: { title: 'Duyu aktarma', text: 'Göz, kulak ve deriden gelen sinyaller önce talamusa uğrar, burada süzülür ve ilgili korteks alanına gönderilir.', next: [{ to: 'brain.parietal', label: 'Dokunma: yan kafa lobu' }, { to: 'brain.occipital', label: 'Görme: arka kafa lobu' }] },
    process: { title: 'Uyanıklık ve dikkat', text: 'Beyin sapındaki uyarıcı sistemle birlikte korteksi uyanık tutar; uykuda aktarımı kısar.', node: 'fn.relay' },
  }),
  nucleus('brain.basal-nuclei', 'Bazal çekirdekler', 'Yarıkürelerin derinindeki gri cevher kümeleri (kaudat, putamen, globus pallidus): hareketin başlatılması, akıcılığı ve alışkanlıklar.', {
    parent: 'brain.cerebrum',
    color: '#bf9aa0',
    inflow: 'Orta beyin arterinin lentikülostriat dalları',
    outflow: 'Derin beyin venleri',
    regions: [
      { id: 'caudate', name: 'Kaudat çekirdek', text: 'Karıncığın kenarında; öğrenme ve alışkanlık.' },
      { id: 'putamen', name: 'Putamen', text: 'Hareket döngüsünün girişi.' },
      { id: 'pallidus', name: 'Globus pallidus', text: 'Döngünün çıkışı; talamusu frenler.' },
      { id: 'capsule', name: 'Kapsula interna', text: 'Aralarından geçen hareket ve duyu lifleri.' },
    ],
    flow: { title: 'Hareket döngüsü', text: 'Korteks → striatum (kaudat + putamen) → globus pallidus → talamus → korteks: istenen hareket serbest bırakılır, istenmeyen frenlenir.', next: [{ to: 'brain.thalamus', label: 'Döngünün durağı: talamus' }, { to: 'brain.frontal', label: 'Komutun kaynağı: motor korteks' }] },
    process: { title: 'Dopamin', text: 'Orta beyindeki substantia nigra striatuma dopamin gönderir; dopamin azalınca hareket yavaşlar.', node: 'fn.relay', next: [{ to: 'brain.midbrain', label: 'Dopaminin kaynağı: orta beyin' }] },
  }),
  {
    organId: 'brain.ventricles',
    name: 'Beyin karıncıkları (ventriküller)',
    type: 'hollow',
    system: 'nervous',
    parent: 'brain',
    summary: 'Beynin içindeki birbirine bağlı dört boşluk: beyin-omurilik sıvısı (BOS) burada üretilir ve buradan beyin çevresine akar.',
    anchor: 'brain.ventricles',
    structure: 'brain',
    interiorScene: { kind: 'lumen', shape: 'sac', lining: 'cilia', content: 'fluid', radius: 1.1, wave: 0.15, flow: 0.35, color: '#9fc3d6' },
    lumen: { enabled: true, contents: ['Beyin-omurilik sıvısı (berrak, renksiz)', 'Koroid pleksus'], flow: ['Yan karıncıklar → Monro deliği → 3. karıncık → Sylvius kanalı → 4. karıncık → beyin ve omurilik çevresi'] },
    functionalRegions: [
      { id: 'lateral', name: 'Yan (lateral) karıncıklar', text: 'Her yarıkürede bir; en büyükleri. Raporlarda genişliği yazılır.' },
      { id: 'third', name: '3. karıncık', text: 'İki talamus arasında ince yarık.' },
      { id: 'aqueduct', name: 'Sylvius kanalı', text: 'Orta beyinde 3. ve 4. karıncığı bağlayan dar kanal.' },
      { id: 'fourth', name: '4. karıncık', text: 'Beyin sapı ile beyincik arasında.' },
    ],
    wallLayers: [
      { id: 'ependyma', name: 'Ependim', text: 'Karıncıkların iç yüzünü döşeyen kirpikli hücre tabakası.', node: 'cell.ependymal' },
      { id: 'periventricular', name: 'Periventriküler beyaz cevher', text: 'Karıncığın hemen dışındaki lifler; MR raporlarında sık geçen bölge.', node: 'brain.white-matter' },
    ],
    routes: [{ title: 'BOS\'un yolu', steps: [{ label: 'Koroid pleksus (üretim)' }, { label: 'Yan karıncıklar' }, { label: '3. karıncık' }, { label: 'Sylvius kanalı', to: 'brain.midbrain' }, { label: '4. karıncık' }, { label: 'Subaraknoid boşluk', to: 'brain.meninges' }, { label: 'Araknoid granülasyonlar → venöz sinüsler' }] }],
    physiologyFlows: ['nervous'],
    deepAnatomyEntry: 'brain.ventricles',
    relatedSystems: ['nervous'],
    stages: [
      st('lumen', 'lumen', 'interior', 'Karıncığın içi', 'Beynin ortasındaki sıvı dolu boşluk; duvarını kirpikli ependim hücreleri örter.', { focus: 'lumen', node: 'brain.ventricles' }),
      st('csf', 'content', 'interior', 'Beyin-omurilik sıvısı', 'Berrak, az proteinli sıvı. Toplam ~150 mL; beyni yastıklar, yüzdürür ve atıkları taşır.', { focus: 'contents' }),
      st('production', 'process', 'interior', 'Üretim: koroid pleksus', 'Karıncıkların içindeki kılcal yumaklar kandan süzerek günde ~500 mL BOS üretir; sıvı günde 3–4 kez yenilenir.', { focus: 'secrete', node: 'proc.csf-circulation' }),
      st('flow', 'flow', 'interior', 'BOS akışı', 'Yan karıncıklardan 3. ve 4. karıncığa, oradan beyin ve omuriliğin çevresine akar; araknoid granülasyonlardan kana geri emilir. Akış bir yerde tıkanırsa karıncıklar genişler.', { focus: 'flow', next: [{ to: 'brain.meninges', label: 'Beyin çevresi: zarlar' }, { to: 'spinal-cord', label: 'Omurilik çevresi' }] }),
      st('wall', 'wall', 'tissue', 'Karıncık duvarı', 'Ependim tabakası ve hemen dışındaki periventriküler beyaz cevher.', { focus: 'wall', next: [{ to: 'brain.white-matter', label: 'Periventriküler beyaz cevhere gir' }] }),
      st('ependymal', 'cell', 'cell', 'Ependim hücresi', 'Kirpikleriyle BOS\'un akmasına yardım eder.', { node: 'cell.ependymal' }),
    ],
  },
  {
    organId: 'brain.corpus-callosum',
    name: 'Korpus kallozum',
    type: 'solid',
    system: 'nervous',
    parent: 'brain.cerebrum',
    summary: 'İki yarıküreyi birbirine bağlayan, ~200 milyon liften oluşan en büyük beyaz cevher köprüsü.',
    anchor: 'brain.corpus-callosum',
    structure: 'brain',
    interiorScene: { kind: 'parenchyma', unit: 'fibers', color: '#ebe3d6', inflow: 'Perikallozal arterler', outflow: 'Derin venler' },
    functionalRegions: [
      { id: 'rostrum', name: 'Rostrum ve genu (ön)', text: 'İki alın lobunu bağlar.' },
      { id: 'body', name: 'Gövde', text: 'Hareket ve duyu alanlarını bağlar.' },
      { id: 'splenium', name: 'Splenium (arka)', text: 'Görme alanlarını bağlar.' },
    ],
    physiologyFlows: ['nervous'],
    physiologyChains: ['b12'],
    deepAnatomyEntry: 'brain.corpus-callosum',
    relatedSystems: ['nervous'],
    stages: [
      st('parenchyma', 'parenchyma', 'interior', 'Korpus kallozumun içi', 'Yan yana uzanan miyelinli aksonlar; karıncıkların tavanını oluşturur.', { focus: 'units', node: 'brain.corpus-callosum' }),
      st('signal', 'flow', 'interior', 'Sağdan sola, soldan sağa', 'Bir yarıkürenin gördüğünü, duyduğunu ve planladığını öbürüne iletir; iki el birlikte bu yolla çalışır.', { focus: 'flow', node: 'fn.connectivity', next: [{ to: 'brain.cerebrum', label: 'Yarıkürelere dön' }] }),
      st('parts', 'region', 'region', 'Bölümleri', 'Önden arkaya: rostrum, genu, gövde, splenium.', { focus: 'overview' }),
      st('tissue', 'tissue', 'tissue', 'Beyaz cevher dokusu', 'Akson demetleri ve oligodendrositler.', { node: 'tissue.white-matter', scene: 'noron' }),
      st('oligodendrocyte', 'cell', 'cell', 'Oligodendrosit', 'Aksonları miyelinle saran hücre.', { node: 'cell.oligodendrocyte' }),
      st('myelin', 'molecule', 'molecule', 'Miyelin', 'Sinyali hızlandıran yalıtkan katman.', { node: 'mol.myelin', chain: 'b12', biomarkers: ['b12'] }),
    ],
  },
  {
    organId: 'brain.meninges',
    name: 'Beyin zarları ve beyin çevresi',
    type: 'solid',
    system: 'nervous',
    parent: 'brain',
    summary: 'Beyni saran üç zar (dura, araknoid, pia) ve aradaki BOS dolu boşluk: koruma, yastıklama ve beyin damarlarının yolu.',
    anchor: 'brain.meninges',
    structure: 'brain',
    interiorScene: { kind: 'parenchyma', unit: 'layers', color: '#d9c2b4', inflow: 'Orta meninks arteri', outflow: 'Dural venöz sinüsler' },
    functionalRegions: [
      { id: 'dura', name: 'Dura mater', text: 'Kafatasına yapışık sert zar; venöz sinüsleri taşır.', node: 'tissue.dura' },
      { id: 'arachnoid', name: 'Araknoid ve subaraknoid boşluk', text: 'BOS ve büyük beyin damarları bu boşlukta.', node: 'tissue.arachnoid' },
      { id: 'pia', name: 'Pia mater', text: 'Beyin yüzeyine sıkıca yapışık ince zar.', node: 'tissue.pia' },
    ],
    physiologyFlows: ['nervous'],
    deepAnatomyEntry: 'brain.meninges',
    relatedSystems: ['nervous', 'cardiovascular'],
    stages: [
      st('parenchyma', 'parenchyma', 'interior', 'Zarların arası', 'Kafatası ile beyin arasında katman katman zarlar; aralarında ince ama önemli boşluklar.', { focus: 'units', node: 'brain.meninges' }),
      st('csf', 'flow', 'interior', 'Subaraknoid boşlukta BOS', 'Karıncıklardan gelen BOS beynin yüzeyini yıkar, sulkuslara ve sisternalara dolar, araknoid granülasyonlardan venöz sinüslere emilir.', { focus: 'flow', node: 'proc.csf-circulation', next: [{ to: 'brain.ventricles', label: 'BOS\'un kaynağı: karıncıklar' }] }),
      st('vessels', 'flow', 'interior', 'Beyin damarlarının yolu', 'Büyük beyin arterleri subaraknoid boşlukta ilerleyip beyne dalar; venöz kan dura içindeki sinüslerle boşalır.', { focus: 'flow', next: [{ to: 'vessel.circle-of-willis', label: 'Willis halkasına gir' }] }),
      st('layers', 'region', 'region', 'Üç zar', 'Dura · araknoid · pia.', { focus: 'overview' }),
      st('dura', 'tissue', 'tissue', 'Dura mater', 'Kalın kolajen zar.', { node: 'tissue.dura' }),
      st('arachnoid', 'tissue', 'tissue', 'Araknoid', 'Örümcek ağı gibi ince bağlarla piaya tutunur.', { node: 'tissue.arachnoid' }),
      st('pia', 'tissue', 'tissue', 'Pia mater', 'Beynin her kıvrımına girer.', { node: 'tissue.pia' }),
    ],
  },
  nucleus('brain.midbrain', 'Orta beyin', 'Beyin sapının en üst bölümü: göz hareketleri, görme ve işitme refleksleri; dopamin üreten substantia nigra.', {
    parent: 'brain.brainstem',
    unit: 'fibers',
    color: '#c69c90',
    inflow: 'Arka beyin arteri ve baziler arter dalları',
    outflow: 'Bazal ven',
    regions: [
      { id: 'tectum', name: 'Tektum (kollikuluslar)', text: 'Görme ve işitme refleksleri.' },
      { id: 'nigra', name: 'Substantia nigra', text: 'Dopamin üreten nöronlar.' },
      { id: 'aqueduct', name: 'Sylvius kanalı', text: 'BOS\'un 3. karıncıktan 4. karıncığa geçtiği dar kanal.', interior: 'brain.ventricles' },
      { id: 'peduncles', name: 'Serebral pedinküller', text: 'Korteksten inen hareket lifleri.' },
    ],
    flow: { title: 'Yukarı–aşağı yollar', text: 'Korteksten inen hareket lifleri pedinküllerden geçer; duyu yolları yukarı talamusa çıkar.', next: [{ to: 'brain.pons', label: 'Aşağı: pons' }, { to: 'brain.thalamus', label: 'Yukarı: talamus' }] },
    process: { title: 'Dopamin ve göz hareketleri', text: 'Substantia nigra bazal çekirdeklere dopamin gönderir; 3. ve 4. kafa sinirleri gözü hareket ettirir.', next: [{ to: 'brain.basal-nuclei', label: 'Dopaminin hedefi: bazal çekirdekler' }] },
  }),
  nucleus('brain.pons', 'Pons (köprü)', 'Orta beyin ile soğancık arasındaki şişkin bölüm: beyinciğe köprü, solunum ritminin ayarı, yüz ve çiğneme sinirleri.', {
    parent: 'brain.brainstem',
    unit: 'fibers',
    color: '#c99f92',
    inflow: 'Baziler arterin pontin dalları',
    outflow: 'Venöz pleksus',
    regions: [
      { id: 'basis', name: 'Bazal pons', text: 'Korteksten beyinciğe giden köprü lifleri.' },
      { id: 'tegmentum', name: 'Tegmentum', text: 'Kafa sinir çekirdekleri (5–8) ve uyanıklık sistemi.' },
    ],
    flow: { title: 'Beyinciğe köprü', text: 'Korteksin hareket planı pons çekirdeklerinden karşı beyincik yarısına geçer.', next: [{ to: 'brain.cerebellum', label: 'Beyinciğe git' }, { to: 'brain.medulla', label: 'Aşağı: soğancık' }] },
    process: { title: 'Solunum ve yüz', text: 'Solunum ritmini ince ayarlar; yüz kasları, çiğneme ve göz yana bakışı buradaki sinirlerle yönetilir.', node: 'fn.vital' },
  }),
  nucleus('brain.medulla', 'Soğancık (medulla oblongata)', 'Beyin sapının omuriliğe bağlanan alt bölümü: solunum ve dolaşım merkezleri; yutma, öksürme ve kusma refleksleri.', {
    parent: 'brain.brainstem',
    unit: 'fibers',
    color: '#c79a8e',
    inflow: 'Vertebral arterler',
    outflow: 'Venöz pleksus',
    regions: [
      { id: 'pyramids', name: 'Piramitler', text: 'Hareket liflerinin çaprazlaştığı yer.' },
      { id: 'olive', name: 'Olivler', text: 'Beyinciğe hareket bilgisi.' },
      { id: 'centers', name: 'Solunum ve dolaşım merkezleri', text: 'Nefes ve kan basıncı.' },
    ],
    flow: { title: 'Çaprazlaşma', text: 'Hareket liflerinin çoğu piramitlerde karşı tarafa geçer: sol beyin sağ vücudu bu yüzden yönetir.', next: [{ to: 'spinal-cord', label: 'Aşağı: omurilik' }] },
    process: { title: 'Yaşamsal merkezler', text: 'Kandaki CO₂\'yi algılayıp nefesi başlatır; kalp hızı ve damar tonusunu ayarlar.', node: 'fn.vital', next: [{ to: 'diaphragm', label: 'Nefesin kası: diyafram' }] },
  }),
  {
    organId: 'vessel.circle-of-willis',
    name: 'Willis halkası ve beyin arterleri',
    type: 'vascular',
    system: 'cardiovascular',
    parent: 'brain',
    summary: 'İç karotis ve vertebral arterlerin beyin tabanında oluşturduğu halka; ön, orta ve arka beyin arterleri beynin her bölgesini besler.',
    anchor: 'vessel.circle-of-willis',
    structure: 'carotid-arteries',
    interiorScene: { kind: 'vessel', caliber: 'medium', pulse: true, color: '#b33a3a' },
    lumen: { enabled: true, contents: ['Oksijenli kan', 'Alyuvarlar', 'Plazma (glukoz, oksijen)'], flow: ['Karotis ve vertebral arterler → Willis halkası → ön / orta / arka beyin arterleri'] },
    functionalRegions: [
      { id: 'aca', name: 'Ön beyin arteri', text: 'Alın lobunun iç yüzü ve bacak motor alanı.' },
      { id: 'mca', name: 'Orta beyin arteri', text: 'Lobların yan yüzleri, dil alanları, bazal çekirdekler.' },
      { id: 'pca', name: 'Arka beyin arteri', text: 'Arka kafa lobu, talamus, hipokampus.' },
      { id: 'basilar', name: 'Baziler arter', text: 'Beyin sapı ve beyincik.' },
    ],
    wallLayers: VESSEL_WALL,
    physiologyFlows: ['circulation'],
    physiologyChains: ['oxygen', 'glucose'],
    deepAnatomyEntry: 'vessel.circle-of-willis',
    relatedSystems: ['cardiovascular', 'nervous'],
    personalDataBindings: ['ldl', 'glucose'],
    stages: [
      st('lumen', 'lumen', 'interior', 'Arterin içi', 'Beyne giden kan nabızla akar; beyin her dakika ~750 mL kan alır.', { focus: 'lumen', node: 'vessel.circle-of-willis' }),
      st('blood', 'content', 'interior', 'Kan: oksijen ve glukoz', 'Beyin enerjisini neredeyse yalnızca glukozdan alır ve depolayamaz; birkaç dakikalık kesinti bile hasar yapabilir.', { focus: 'contents', chain: 'glucose', biomarkers: ['glucose'] }),
      st('ring', 'flow', 'interior', 'Halkanın işi', 'Ön ve arka dolaşımı birleştirir: bir dal daralırsa kan halkanın öbür yanından dolaşabilir.', { focus: 'flow', next: [{ to: 'brain.frontal', label: 'Ön beyin arteri → alın lobu' }, { to: 'brain.occipital', label: 'Arka beyin arteri → arka kafa lobu' }] }),
      st('bbb', 'process', 'interior', 'Kan-beyin bariyeri', 'Beyin kılcallarının sıkı bağlantıları kandaki çoğu maddenin beyne geçişini sınırlar.', { focus: 'exchange', node: 'proc.blood-brain-barrier' }),
      st('wall', 'wall', 'tissue', 'Duvarı incele', 'Endotel, düz kas, dış kılıf. Anevrizmalar sıklıkla dalların ayrıldığı yerlerde duvarın zayıflamasıyla oluşur.', { focus: 'wall', scene: 'damar' }),
      st('endothelium', 'tissue', 'tissue', 'Endotel', 'Kanla temas eden hücre tabakası.', { node: 'tissue.endothelium', scene: 'damar' }),
      st('ldl', 'molecule', 'molecule', 'LDL ve damar duvarı', 'Kolesterol taşıyan parçacıklar ve damar duvarı ilişkisi (genel bilgi).', { chain: 'lipids', biomarkers: ['ldl'], scene: 'damar' }),
    ],
  },
];

/** Beyin haritasında gösterilen bölgeler (sırayla) ve iç dünyaları. */
export const BRAIN_REGIONS: ReadonlyArray<{ node: string; interior: string; group: string }> = [
  { node: 'brain.frontal', interior: 'brain.frontal', group: 'Loblar' },
  { node: 'brain.parietal', interior: 'brain.parietal', group: 'Loblar' },
  { node: 'brain.temporal', interior: 'brain.temporal', group: 'Loblar' },
  { node: 'brain.occipital', interior: 'brain.occipital', group: 'Loblar' },
  { node: 'brain.insula', interior: 'brain.insula', group: 'Loblar' },
  { node: 'brain.white-matter', interior: 'brain.white-matter', group: 'Derin yapılar' },
  { node: 'brain.corpus-callosum', interior: 'brain.corpus-callosum', group: 'Derin yapılar' },
  { node: 'brain.basal-nuclei', interior: 'brain.basal-nuclei', group: 'Derin yapılar' },
  { node: 'brain.thalamus', interior: 'brain.thalamus', group: 'Derin yapılar' },
  { node: 'brain.hippocampus', interior: 'brain.hippocampus', group: 'Derin yapılar' },
  { node: 'brain.amygdala', interior: 'brain.amygdala', group: 'Derin yapılar' },
  { node: 'brain.hypothalamus', interior: 'ic.hypothalamus', group: 'Derin yapılar' },
  { node: 'brain.ventricles', interior: 'brain.ventricles', group: 'Sıvı ve zarlar' },
  { node: 'brain.meninges', interior: 'brain.meninges', group: 'Sıvı ve zarlar' },
  { node: 'brain.cerebellum', interior: 'brain.cerebellum', group: 'Beyincik ve beyin sapı' },
  { node: 'brain.midbrain', interior: 'brain.midbrain', group: 'Beyincik ve beyin sapı' },
  { node: 'brain.pons', interior: 'brain.pons', group: 'Beyincik ve beyin sapı' },
  { node: 'brain.medulla', interior: 'brain.medulla', group: 'Beyincik ve beyin sapı' },
  { node: 'pituitary', interior: 'pituitary', group: 'Çevresi' },
  { node: 'vessel.circle-of-willis', interior: 'vessel.circle-of-willis', group: 'Çevresi' },
];
