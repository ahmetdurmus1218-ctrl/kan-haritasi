/**
 * Bilgi grafiğinin içeriği: genel anatomi ve fizyoloji (eğitim amaçlı, kişiye özel değil).
 * Organ düğümlerinin `structure`/`part` alanları 3B modeldeki yapılara, biyobelirteçlerin `testKey`
 * alanları laboratuvar kataloğuna bağlanır (testler bu bağların geçerliliğini denetler).
 */
import type { KEdge, KNode, Relation } from './graph';
import { addDeepAnatomy } from './deep';

const N: KNode[] = [];
const E: KEdge[] = [];

function node(n: KNode): string {
  N.push(n);
  return n.id;
}
function edge(from: string, rel: Relation, to: string, note?: string) {
  E.push(note ? { from, to, rel, note } : { from, to, rel });
}
function lab(testKey: string, nameTr: string, summary: string): string {
  return node({ id: `lab:${testKey}`, kind: 'biomarker', nameTr, summary, testKey });
}

/* ---------------------------------------------------------------- Sistemler */
const SYS: Record<string, string> = {
  nervous: 'Sinir sistemi',
  cardiovascular: 'Kalp ve damar sistemi',
  digestive: 'Sindirim sistemi',
  endocrine: 'Endokrin (hormon) sistemi',
  urinary: 'Boşaltım sistemi',
  respiratory: 'Solunum sistemi',
  hematologic: 'Kan ve kemik iliği',
  musculoskeletal: 'Kemik ve kas sistemi',
};
for (const [id, nameTr] of Object.entries(SYS)) node({ id: `system:${id}`, kind: 'system', nameTr, summary: `${nameTr}: birlikte çalışan organlar topluluğu.` });

/* ---------------------------------------------------------------- Beyin */
const brain = node({ id: 'brain', kind: 'organ', nameTr: 'Beyin', structure: 'brain', summary: 'Kafatası içinde, düşünme, hareket, duyu, dil, bellek ve vücudun iç dengesini yöneten merkezi sinir sistemi organı.' });
edge(brain, 'belongs_to', 'system:nervous');
const hemL = node({ id: 'brain.hemisphere-left', kind: 'region', nameTr: 'Sol yarıküre (hemisfer)', structure: 'brain', summary: 'Vücudun SAĞ yarısının hareket ve duyusunu yönetir. Çoğu kişide dil merkezleri (konuşma üretme ve anlama) bu taraftadır.' });
const hemR = node({ id: 'brain.hemisphere-right', kind: 'region', nameTr: 'Sağ yarıküre (hemisfer)', structure: 'brain', summary: 'Vücudun SOL yarısının hareket ve duyusunu yönetir. Uzamsal algı, yüz tanıma ve dikkatin iki yana dağıtılmasında baskın rol oynar.' });
edge(hemL, 'part_of', brain);
edge(hemR, 'part_of', brain);

const funcs = {
  planning: node({ id: 'fn.executive', kind: 'function', nameTr: 'Planlama, karar verme, dikkat', summary: 'Hedef belirleme, davranışı düzenleme, çalışma belleği ve kişilik özellikleri.' }),
  motor: node({ id: 'fn.motor', kind: 'function', nameTr: 'İstemli hareket', summary: 'Kasları harekete geçiren komutlar birincil motor korteksten çıkar; karşı taraf vücuda gider.' }),
  speech: node({ id: 'fn.speech', kind: 'function', nameTr: 'Konuşma üretme (Broca alanı)', summary: 'Çoğu kişide sol alın lobunun alt kısmında; kelimeleri sese dönüştürme planı.' }),
  sensation: node({ id: 'fn.sensation', kind: 'function', nameTr: 'Dokunma, ağrı, konum duyusu', summary: 'Vücuttan gelen duyuların birincil duyu korteksinde işlenmesi.' }),
  spatial: node({ id: 'fn.spatial', kind: 'function', nameTr: 'Uzamsal algı ve duyu birleştirme', summary: 'Nesnelerin yeri, vücut şeması, okuma-yazma ve hesaplamaya katkı.' }),
  hearing: node({ id: 'fn.hearing', kind: 'function', nameTr: 'İşitme ve dil anlama', summary: 'Seslerin işlenmesi; çoğu kişide sol şakak lobunda dil anlama (Wernicke alanı).' }),
  memory: node({ id: 'fn.memory', kind: 'function', nameTr: 'Yeni anı oluşturma', summary: 'Hipokampus yeni bilgileri uzun süreli belleğe aktarır.' }),
  vision: node({ id: 'fn.vision', kind: 'function', nameTr: 'Görme', summary: 'Gözden gelen görüntünün görme korteksinde işlenmesi.' }),
  balance: node({ id: 'fn.balance', kind: 'function', nameTr: 'Denge ve koordinasyon', summary: 'Beyincik hareketlerin akıcı ve dengeli olmasını sağlar.' }),
  vital: node({ id: 'fn.vital', kind: 'function', nameTr: 'Solunum, kalp atımı, bilinç', summary: 'Beyin sapındaki merkezler hayati işlevleri ve uyanıklığı düzenler.' }),
  relay: node({ id: 'fn.relay', kind: 'function', nameTr: 'Duyu aktarımı ve hareket ayarı', summary: 'Talamus duyuları kortekse aktarır; bazal çekirdekler hareketi başlatır ve ayarlar.' }),
  connect: node({ id: 'fn.connectivity', kind: 'function', nameTr: 'Beyin bölgeleri arası iletişim', summary: 'Beyaz cevher yolları bölgeleri birbirine ve omuriliğe bağlar.' }),
};
const lobes: Array<[string, string, string, string[]]> = [
  ['frontal', 'Alın (frontal) lobu', 'Beynin ön bölümü; planlama, karar verme, kişilik, istemli hareket ve (solda) konuşma üretimi.', [funcs.planning, funcs.motor, funcs.speech]],
  ['parietal', 'Yan kafa (parietal) lobu', 'Tepenin altındaki bölüm; dokunma ve konum duyuları, uzamsal algı.', [funcs.sensation, funcs.spatial]],
  ['temporal', 'Şakak (temporal) lobu', 'Kulağın üstündeki bölüm; işitme, dil anlama, bellek ve duygular.', [funcs.hearing, funcs.memory]],
  ['occipital', 'Arka kafa (oksipital) lobu', 'Beynin arka bölümü; görme merkezleri.', [funcs.vision]],
  ['insula', 'İnsula', 'Yan yarığın derininde; tat, iç organ duyuları ve duygusal farkındalık.', [funcs.sensation]],
];
for (const [key, nameTr, summary, fs] of lobes) {
  const id = node({ id: `brain.${key}`, kind: 'region', nameTr, summary, structure: 'brain', part: key });
  edge(id, 'part_of', hemL);
  edge(id, 'part_of', hemR);
  for (const f of fs) edge(id, 'performs', f);
}
const deep: Array<[string, string, string, string[]]> = [
  ['basal-nuclei', 'Bazal çekirdekler', 'Derin gri cevher çekirdekleri; hareketin başlatılması ve ayarlanması.', [funcs.relay]],
  ['thalamus', 'Talamus', 'Duyuların kortekse aktarıldığı derin merkez.', [funcs.relay]],
  ['hippocampus', 'Hipokampus', 'Şakak lobunun iç yüzünde; yeni anıların oluşturulması.', [funcs.memory]],
  ['ventricles', 'Beyin karıncıkları (ventriküller)', 'Beyin-omurilik sıvısının (BOS) üretildiği ve dolaştığı boşluklar.', []],
  ['white-matter', 'Beyaz cevher', 'Miyelinli sinir liflerinden oluşan bağlantı yolları; korteksin altında ve ventriküllerin çevresinde.', [funcs.connect]],
  ['corpus-callosum', 'Korpus kallozum', 'İki yarıküreyi birbirine bağlayan en büyük beyaz cevher demeti.', [funcs.connect]],
  ['cerebellum', 'Beyincik', 'Beynin arka-alt bölümünde; denge, koordinasyon, hareket öğrenmesi.', [funcs.balance]],
  ['pons', 'Beyin sapı (pons, orta beyin, soğancık)', 'Beyni omuriliğe bağlar; solunum, kalp atımı ve bilinç merkezleri.', [funcs.vital]],
];
for (const [key, nameTr, summary, fs] of deep) {
  const id = node({ id: `brain.${key}`, kind: 'region', nameTr, summary, structure: 'brain', part: key });
  edge(id, 'part_of', brain);
  for (const f of fs) edge(id, 'performs', f);
}
const gray = node({ id: 'tissue.gray-matter', kind: 'tissue', nameTr: 'Gri cevher', summary: 'Sinir hücresi gövdelerinin ve sinapsların yoğun olduğu doku (korteks ve derin çekirdekler).' });
const white = node({ id: 'tissue.white-matter', kind: 'tissue', nameTr: 'Beyaz cevher dokusu', summary: 'Miyelin kılıfla sarılı aksonlar; beyaz rengini yağdan zengin miyelin verir.' });
const neuron = node({ id: 'cell.neuron', kind: 'cell', nameTr: 'Nöron (sinir hücresi)', summary: 'Elektriksel ve kimyasal sinyal üreten ve ileten hücre.' });
const axon = node({ id: 'cell.myelinated-axon', kind: 'cell', nameTr: 'Miyelinli akson', summary: 'Nöronun uzun uzantısı; miyelin kılıf sinyalin sıçrayarak ve hızlı ilerlemesini sağlar.' });
const oligo = node({ id: 'cell.oligodendrocyte', kind: 'cell', nameTr: 'Oligodendrosit', summary: 'Beyin ve omurilikte aksonların etrafına miyelin saran destek hücresi.' });
const myelination = node({ id: 'proc.myelination', kind: 'process', nameTr: 'Miyelin oluşumu ve korunması', summary: 'Oligodendrositlerin zarları aksonun çevresine sarılarak yalıtkan katman oluşturur; hasar görürse sinyal yavaşlar.' });
const myelin = node({ id: 'mol.myelin', kind: 'molecule', nameTr: 'Miyelin (lipid–protein katmanı)', summary: 'Kolesterol ve özel lipidlerden zengin, miyelin bazik proteini gibi proteinler içeren yalıtkan zar.' });
const nerveSignal = node({ id: 'proc.nerve-signal', kind: 'process', nameTr: 'Sinir sinyali (aksiyon potansiyeli ve sinaps)', summary: 'Sodyum ve potasyum kanallarıyla oluşan elektriksel dalga; sinapsta nörotransmitterle sonraki hücreye geçer.' });
const neurotransmitter = node({ id: 'mol.neurotransmitter', kind: 'molecule', nameTr: 'Nörotransmitterler', summary: 'Glutamat, GABA, dopamin gibi sinapsta salınan haberci moleküller.' });
const csf = node({ id: 'proc.csf-circulation', kind: 'process', nameTr: 'Beyin-omurilik sıvısı dolaşımı', summary: 'Koroid pleksustan üretilen sıvı ventriküllerden beyin çevresine akar ve emilir; beyni korur ve atıkları uzaklaştırır.' });
edge('brain.frontal', 'made_of', gray);
edge('brain.frontal', 'made_of', white);
edge('brain.white-matter', 'made_of', white);
edge(gray, 'made_of', neuron);
edge(white, 'made_of', axon);
edge(white, 'made_of', oligo);
edge(oligo, 'performs', myelination);
edge(myelination, 'produces', myelin);
edge(myelin, 'leads_to', nerveSignal, 'Miyelin sinyalin hızlı iletilmesini sağlar.');
edge(neuron, 'performs', nerveSignal);
edge(nerveSignal, 'produces', neurotransmitter);
edge(nerveSignal, 'leads_to', funcs.connect);
edge('brain.ventricles', 'performs', csf);

/* ---------------------------------------------------------------- Kalp ve EKG */
const heart = node({ id: 'heart', kind: 'organ', nameTr: 'Kalp', structure: 'heart', summary: 'Kanı akciğerlere ve tüm vücuda pompalayan dört odacıklı kas organ.' });
edge(heart, 'belongs_to', 'system:cardiovascular');
const conduction = node({ id: 'heart.conduction', kind: 'region', nameTr: 'İletim sistemi', structure: 'heart', summary: 'Sinüs düğümü → kulakçıklar → AV düğüm → His demeti → Purkinje lifleri: kalbin elektriksel uyarı yolu.' });
const lv = node({ id: 'heart.left-ventricle', kind: 'region', nameTr: 'Sol karıncık', structure: 'heart', part: 'left-ventricle', summary: 'Kanı aort yoluyla tüm vücuda pompalayan, en kalın duvarlı odacık.' });
edge(conduction, 'part_of', heart);
edge(lv, 'part_of', heart);
const myocardium = node({ id: 'tissue.myocardium', kind: 'tissue', nameTr: 'Kalp kası (miyokard)', summary: 'Birbirine aralıklı disklerle bağlı, durmadan kasılan kas dokusu.' });
const cardiomyocyte = node({ id: 'cell.cardiomyocyte', kind: 'cell', nameTr: 'Kalp kası hücresi', summary: 'Elektriksel uyarıyla kalsiyum salıp kasılan hücre.' });
const rhythm = node({ id: 'proc.heart-rhythm', kind: 'process', nameTr: 'Kalp ritmi ve uyarı iletimi', summary: 'Sinüs düğümü dinlenmede dakikada yaklaşık 60–100 uyarı üretir; uyarı iletim sistemiyle odacıklara yayılır.' });
const contraction = node({ id: 'proc.heart-contraction', kind: 'process', nameTr: 'Kalbin kasılması', summary: 'Uyarı kalp kası hücrelerinde kalsiyum salınımına, aktin-miyozin kaymasına ve kasılmaya yol açar.' });
const circulation = node({ id: 'proc.circulation', kind: 'process', nameTr: 'Kan dolaşımı', summary: 'Pompalanan kan oksijen ve besinleri dokulara taşır.' });
const bp = node({ id: 'fn.blood-pressure', kind: 'function', nameTr: 'Kan basıncı', summary: 'Kalbin pompalama gücü, damar direnci ve kan hacmine bağlıdır.' });
const calcium = node({ id: 'mol.calcium-actin-myosin', kind: 'molecule', nameTr: 'Kalsiyum ve aktin–miyozin', summary: 'Kasılmanın moleküler motoru.' });
edge(heart, 'made_of', myocardium);
edge(myocardium, 'made_of', cardiomyocyte);
edge(conduction, 'performs', rhythm);
edge(rhythm, 'leads_to', contraction);
edge(cardiomyocyte, 'performs', contraction);
edge(contraction, 'produces', calcium);
edge(contraction, 'leads_to', circulation);
edge(circulation, 'leads_to', bp);
const ecg = {
  hr: node({ id: 'ecg:heart-rate', kind: 'biomarker', nameTr: 'Kalp hızı (EKG)', summary: 'Dakikadaki atım sayısı; RR aralığından hesaplanır.', ecgMeasure: 'heart-rate' }),
  rr: node({ id: 'ecg:rr', kind: 'biomarker', nameTr: 'RR aralığı ve düzenliliği', summary: 'Ardışık R dalgaları arasındaki süre; düzenliliği ritim hakkında bilgi verir.', ecgMeasure: 'rr' }),
  pr: node({ id: 'ecg:pr', kind: 'biomarker', nameTr: 'PR aralığı', summary: 'Uyarının kulakçıklardan karıncıklara geçiş süresi (tipik 120–200 ms).', ecgMeasure: 'pr' }),
  qrs: node({ id: 'ecg:qrs', kind: 'biomarker', nameTr: 'QRS süresi', summary: 'Karıncıkların uyarılma süresi (tipik < 120 ms).', ecgMeasure: 'qrs' }),
  qt: node({ id: 'ecg:qt', kind: 'biomarker', nameTr: 'QT / QTc', summary: 'Karıncıkların uyarılıp toparlanma süresi; kalp hızına göre düzeltilir.', ecgMeasure: 'qt' }),
};
edge(rhythm, 'measured_by', ecg.hr);
edge(rhythm, 'measured_by', ecg.rr);
edge(rhythm, 'measured_by', ecg.pr);
edge(contraction, 'measured_by', ecg.qrs);
edge(contraction, 'measured_by', ecg.qt);
const ck = lab('ck', 'CK (kreatin kinaz)', 'Kas hücresi hasarında kana geçen enzim.');
edge(cardiomyocyte, 'measured_by', ck);

/* ---------------------------------------------------------------- Pankreas */
const pancreas = node({ id: 'pancreas', kind: 'organ', nameTr: 'Pankreas', structure: 'pancreas', summary: 'Midenin arkasında; hem sindirim enzimleri (ekzokrin) hem kan şekerini düzenleyen hormonlar (endokrin) üreten bez.' });
edge(pancreas, 'belongs_to', 'system:digestive');
edge(pancreas, 'belongs_to', 'system:endocrine');
const endo = node({ id: 'pancreas.endocrine', kind: 'region', nameTr: 'Endokrin bölüm (Langerhans adacıkları)', structure: 'pancreas', summary: 'Pankreasın yaklaşık %1–2’sini oluşturan hücre adacıkları; hormonlarını doğrudan kana verir.' });
const exo = node({ id: 'pancreas.exocrine', kind: 'region', nameTr: 'Ekzokrin bölüm (asiner doku)', structure: 'pancreas', summary: 'Pankreasın büyük kısmı; sindirim enzimlerini kanallarla on iki parmak bağırsağına gönderir.' });
edge(endo, 'part_of', pancreas);
edge(exo, 'part_of', pancreas);
for (const k of ['head', 'body', 'tail'] as const)
  edge(node({ id: `pancreas.${k}`, kind: 'region', nameTr: { head: 'Pankreas başı', body: 'Pankreas gövdesi', tail: 'Pankreas kuyruğu' }[k], structure: 'pancreas', part: k, summary: 'Pankreasın anatomik bölümü; endokrin ve ekzokrin doku her bölümde bulunur.' }), 'part_of', pancreas);
const beta = node({ id: 'cell.beta', kind: 'cell', nameTr: 'Beta hücresi', summary: 'Kan şekeri yükselince insülin salgılar.' });
const alpha = node({ id: 'cell.alpha', kind: 'cell', nameTr: 'Alfa hücresi', summary: 'Kan şekeri düşünce glukagon salgılar.' });
const acinar = node({ id: 'cell.acinar', kind: 'cell', nameTr: 'Asiner hücre', summary: 'Sindirim enzimlerini üretip kanallara salgılar.' });
const insulin = node({ id: 'mol.insulin', kind: 'molecule', nameTr: 'İnsülin', summary: 'Kas, yağ ve karaciğer hücrelerinin kandan glukoz almasını sağlayan hormon.' });
const glucagon = node({ id: 'mol.glucagon', kind: 'molecule', nameTr: 'Glukagon', summary: 'Karaciğerden kana glukoz verilmesini sağlayan hormon.' });
const cpep = node({ id: 'mol.c-peptide', kind: 'molecule', nameTr: 'C-peptid', summary: 'İnsülinle eşit miktarda salınan parça; vücudun kendi insülin üretimini gösterir.' });
const amylaseM = node({ id: 'mol.amylase', kind: 'molecule', nameTr: 'Amilaz', summary: 'Nişastayı parçalayan sindirim enzimi.' });
const lipaseM = node({ id: 'mol.lipase', kind: 'molecule', nameTr: 'Lipaz', summary: 'Yağları parçalayan sindirim enzimi.' });
const glucoseReg = node({ id: 'proc.glucose-regulation', kind: 'process', nameTr: 'Kan şekeri düzenlenmesi', summary: 'İnsülin ve glukagon dengesiyle kan glukozu dar bir aralıkta tutulur.' });
const glucoseUse = node({ id: 'proc.glucose-uptake', kind: 'process', nameTr: 'Hücrelerin glukoz kullanımı', summary: 'İnsülin etkisiyle kas, yağ ve karaciğer hücreleri glukozu alır, yakar ya da depolar (glikojen, yağ).' });
const energy = node({ id: 'proc.energy-metabolism', kind: 'process', nameTr: 'Enerji metabolizması', summary: 'Hücrelerde glukoz ve yağ asitlerinden ATP üretimi.' });
const digestion = node({ id: 'proc.digestion', kind: 'process', nameTr: 'Sindirim (nişasta ve yağ)', summary: 'Enzimler besinleri bağırsakta emilebilecek küçük parçalara ayırır.' });
edge(endo, 'made_of', beta);
edge(endo, 'made_of', alpha);
edge(exo, 'made_of', acinar);
edge(endo, 'performs', glucoseReg);
edge(exo, 'performs', digestion);
edge(beta, 'produces', insulin);
edge(beta, 'produces', cpep);
edge(alpha, 'produces', glucagon);
edge(acinar, 'produces', amylaseM);
edge(acinar, 'produces', lipaseM);
edge(insulin, 'regulates', glucoseReg, 'İnsülin kan şekerini düşürür.');
edge(glucagon, 'regulates', glucoseReg, 'Glukagon kan şekerini yükseltir.');
edge(glucoseReg, 'leads_to', glucoseUse);
edge(glucoseUse, 'leads_to', energy);
edge(amylaseM, 'leads_to', digestion);
edge(lipaseM, 'leads_to', digestion);
edge(glucoseReg, 'measured_by', lab('glucose', 'Glukoz', 'Ölçüm anındaki kan şekeri.'));
edge(glucoseReg, 'measured_by', lab('hba1c', 'HbA1c', 'Son 2–3 ayın ortalama kan şekerini yansıtır.'));
edge(insulin, 'measured_by', lab('insulin', 'İnsülin', 'Kandaki insülin düzeyi.'));
edge(cpep, 'measured_by', node({ id: 'lab:c-peptide', kind: 'biomarker', nameTr: 'C-peptid', summary: 'Kendi insülin üretiminin göstergesi.', note: 'Bu test henüz laboratuvar kataloğunda yok; raporda olsa da otomatik okunmaz, elle eşlenemez.' }));
edge(amylaseM, 'measured_by', lab('amylase', 'Amilaz', 'Pankreas ve tükürük bezlerinden gelen enzim.'));
edge(lipaseM, 'measured_by', lab('lipase', 'Lipaz', 'Pankreasa daha özgü yağ enzimi.'));
const tg = lab('triglyceride', 'Trigliserid', 'Kandaki yağ (trigliserid) düzeyi.');
edge(energy, 'measured_by', tg);
edge(tg, 'affects', pancreas, 'Çok yüksek trigliserid düzeyleri pankreası etkileyebilir (pankreatit ile ilişkili olabilir).');

/* ---------------------------------------------------------------- Mide ve bağırsaklar */
const stomach = node({ id: 'stomach', kind: 'organ', nameTr: 'Mide', structure: 'stomach', summary: 'Yemek borusundan gelen besini asit ve enzimlerle karıştırıp sindirmeye başlayan kas torba; B12 emilimi için gereken iç faktörü üretir.' });
edge(stomach, 'belongs_to', 'system:digestive');
const gastricMucosa = node({ id: 'tissue.gastric-mucosa', kind: 'tissue', nameTr: 'Mide mukozası ve bezleri', summary: 'Mide iç yüzeyini döşeyen, asit, pepsin ve koruyucu mukus salgılayan bezlerle dolu katman.' });
const parietal = node({ id: 'cell.parietal', kind: 'cell', nameTr: 'Parietal hücre', summary: 'Mide asidini (HCl) ve iç faktörü salgılayan bez hücresi.' });
const gastricDigestion = node({ id: 'proc.gastric-digestion', kind: 'process', nameTr: 'Midede sindirim', summary: 'Asit besini parçalar ve mikropları azaltır; pepsin proteinleri sindirmeye başlar; asit demirin emilebilir hale gelmesine yardım eder.' });
const intrinsic = node({ id: 'mol.intrinsic-factor', kind: 'molecule', nameTr: 'İç faktör', summary: 'B12 vitaminine bağlanıp ileumda emilmesini sağlayan protein.' });
edge(stomach, 'made_of', gastricMucosa);
edge(gastricMucosa, 'made_of', parietal);
edge(gastricMucosa, 'performs', gastricDigestion);
edge(parietal, 'produces', intrinsic);

const si = node({ id: 'small-intestine', kind: 'organ', nameTr: 'İnce bağırsak', structure: 'small-intestine', summary: 'Mideden sonra gelen, yaklaşık 6 metrelik kıvrımlı tüp; besinlerin sindirimi burada tamamlanır ve neredeyse tamamı burada kana ve lenfe emilir.' });
edge(si, 'belongs_to', 'system:digestive');
const duodenum = node({ id: 'small-intestine.duodenum', kind: 'region', nameTr: 'On iki parmak bağırsağı (duodenum)', structure: 'small-intestine', part: 'duodenum', summary: 'İlk bölüm: mideden gelen içeriğe safra ve pankreas enzimleri katılır; demir en çok burada emilir.' });
const jejunum = node({ id: 'small-intestine.jejunum', kind: 'region', nameTr: 'Jejunum', structure: 'small-intestine', part: 'jejunum', summary: 'Orta bölüm: şeker, amino asit, yağ ve folatın büyük kısmı burada emilir.' });
const ileum = node({ id: 'small-intestine.ileum', kind: 'region', nameTr: 'İleum', structure: 'small-intestine', part: 'ileum', summary: 'Son bölüm: B12 vitamini (iç faktörle) ve safra asitleri burada geri emilir.' });
for (const r of [duodenum, jejunum, ileum]) edge(r, 'part_of', si);
const wall = node({ id: 'tissue.intestinal-wall', kind: 'tissue', nameTr: 'Bağırsak duvarı', summary: 'İçten dışa dört katman: mukoza, submukoza, kas tabakası ve seroza. Kaslar içeriği dalga dalga ilerletir (peristaltizm).' });
const mucosa = node({ id: 'tissue.intestinal-mucosa', kind: 'tissue', nameTr: 'Mukozal yüzey', summary: 'Bağırsağın iç yüzeyi; kıvrımlar ve villuslarla emilim alanı bir tenis kortu büyüklüğüne ulaşır.' });
const villus = node({ id: 'tissue.villus', kind: 'tissue', nameTr: 'Villuslar', summary: 'Mukozadan çıkan parmak biçimli uzantılar; her birinin içinde kılcal damar ağı ve bir lenf kanalı vardır.' });
const enterocyte = node({ id: 'cell.enterocyte', kind: 'cell', nameTr: 'Enterosit (emici epitel hücresi)', summary: 'Villusu örten hücre; üst yüzündeki mikrovilluslar (fırçamsı kenar) emilim yüzeyini daha da artırır.' });
const capillary = node({ id: 'tissue.villus-capillary', kind: 'tissue', nameTr: 'Kılcal damarlar (villus içi)', summary: 'Şeker, amino asit, demir ve suda çözünen vitaminleri kana alır; kan portal venle karaciğere gider.' });
const lacteal = node({ id: 'tissue.lacteal', kind: 'tissue', nameTr: 'Lenf kanalı (lakteal)', summary: 'Yağları (şilomikron olarak) lenf yoluyla taşır; bu yağlar karaciğeri atlayarak dolaşıma katılır.' });
edge(si, 'made_of', wall);
edge(wall, 'made_of', mucosa);
edge(mucosa, 'made_of', villus);
edge(villus, 'made_of', enterocyte);
edge(villus, 'made_of', capillary);
edge(villus, 'made_of', lacteal);
const absorption = node({ id: 'proc.absorption', kind: 'process', nameTr: 'Besin emilimi', summary: 'Sindirilmiş besinler (şeker, amino asit, yağ asitleri), vitaminler ve mineraller enterositlerden geçip kana ve lenfe geçer.' });
const ironAbs = node({ id: 'proc.iron-absorption', kind: 'process', nameTr: 'Demir emilimi', summary: 'Duodenumda enterositler demiri DMT1 taşıyıcısıyla içeri alır, ferroportin ile kana verir; vücut ihtiyaca göre miktarı ayarlar.' });
const b12Abs = node({ id: 'proc.b12-absorption', kind: 'process', nameTr: 'B12 emilimi', summary: 'Mideden gelen iç faktöre bağlı B12, ileumun son kısmında emilir.' });
const folateAbs = node({ id: 'proc.folate-absorption', kind: 'process', nameTr: 'Folat emilimi', summary: 'Folat (B9) çoğunlukla jejunumda emilir.' });
const transporters = node({ id: 'mol.nutrient-transporters', kind: 'molecule', nameTr: 'Taşıyıcı proteinler (SGLT1, DMT1, ferroportin)', summary: 'Enterosit zarındaki kapılar: SGLT1 glukozu, DMT1 demiri hücreye alır; ferroportin demiri kana verir.' });
const nutrients = node({ id: 'mol.nutrients', kind: 'molecule', nameTr: 'Emilen moleküller (glukoz, amino asitler, yağ asitleri)', summary: 'Sindirimin son ürünleri; kanla ve lenfle tüm hücrelere ulaşır.' });
edge(enterocyte, 'performs', absorption);
edge(si, 'performs', absorption);
edge(si, 'performs', 'proc.digestion');
edge(enterocyte, 'produces', transporters);
edge(absorption, 'produces', nutrients);
edge(duodenum, 'performs', ironAbs);
edge(jejunum, 'performs', folateAbs);
edge(ileum, 'performs', b12Abs);
edge(intrinsic, 'leads_to', b12Abs, 'İç faktör olmadan B12 emilemez.');
edge(gastricDigestion, 'leads_to', ironAbs, 'Mide asidi demiri emilebilir hale getirir.');
edge(ironAbs, 'leads_to', 'proc.iron-metabolism');
edge(b12Abs, 'leads_to', 'proc.erythropoiesis', 'B12 alyuvar yapımı ve sinir liflerinin miyelini için gerekir.');
edge(folateAbs, 'leads_to', 'proc.erythropoiesis', 'Folat alyuvar yapımında DNA sentezi için gerekir.');
// B12 ve folat önce alyuvar yapımının göstergesidir (birincil organ: kemik iliği); emilim ikincil bağdır.
const b12 = lab('b12', 'B12 vitamini', 'Alyuvar yapımı ve sinir sistemi için gerekli vitamin.');
const folate = lab('folate', 'Folat', 'Hücre bölünmesi ve alyuvar yapımı için gerekli vitamin (B9).');
edge('proc.erythropoiesis', 'measured_by', b12);
edge('proc.erythropoiesis', 'measured_by', folate);
edge(b12Abs, 'measured_by', b12);
edge(folateAbs, 'measured_by', folate);

const li = node({ id: 'large-intestine', kind: 'organ', nameTr: 'Kalın bağırsak', structure: 'large-intestine', summary: 'İnce bağırsaktan gelen içerikten su ve tuzları geri emen, dışkıyı oluşturup depolayan bölüm; yararlı bakterilere ev sahipliği yapar.' });
edge(li, 'belongs_to', 'system:digestive');
const colonMucosa = node({ id: 'tissue.colon-mucosa', kind: 'tissue', nameTr: 'Kalın bağırsak mukozası', summary: 'Villus yoktur; derin bezler (kriptler) mukus salgılar ve suyu geri emer.' });
const waterAbs = node({ id: 'proc.water-absorption', kind: 'process', nameTr: 'Su ve tuz geri emilimi', summary: 'Günde 1–1,5 litre sıvının çoğu geri emilir; içerik katılaşarak dışkıya dönüşür.' });
edge(li, 'made_of', colonMucosa);
edge(colonMucosa, 'performs', waterAbs);

/* ---------------------------------------------------------------- Karaciğer */
const liver = node({ id: 'liver', kind: 'organ', nameTr: 'Karaciğer', structure: 'liver', summary: 'Karın sağ üst kısmında; protein üretimi, safra yapımı, besin depolama, ilaç ve toksinlerin işlenmesi.' });
edge(liver, 'belongs_to', 'system:digestive');
const lobule = node({ id: 'tissue.liver-lobule', kind: 'tissue', nameTr: 'Karaciğer lobülü', summary: 'Merkezi ven çevresinde dizilmiş hepatosit sıraları ve sinüzoidlerden oluşan altıgen birim.' });
const hepatocyte = node({ id: 'cell.hepatocyte', kind: 'cell', nameTr: 'Hepatosit', summary: 'Karaciğerin ana iş hücresi.' });
const protSynth = node({ id: 'proc.protein-synthesis', kind: 'process', nameTr: 'Protein sentezi', summary: 'Albümin ve pıhtılaşma faktörleri gibi kan proteinleri üretilir.' });
const albuminM = node({ id: 'mol.albumin', kind: 'molecule', nameTr: 'Albümin', summary: 'Kanın en bol proteini; sıvıyı damar içinde tutar, birçok maddeyi taşır.' });
const oncotic = node({ id: 'proc.fluid-distribution', kind: 'process', nameTr: 'Sıvı dağılımı (onkotik basınç)', summary: 'Albümin, sıvının damar içinde kalmasını sağlar; düşük olduğunda dokularda sıvı birikebilir.' });
const clotting = node({ id: 'mol.clotting-factors', kind: 'molecule', nameTr: 'Pıhtılaşma faktörleri', summary: 'Kanamayı durduran proteinler; çoğu karaciğerde üretilir.' });
const injury = node({ id: 'proc.hepatocyte-injury', kind: 'process', nameTr: 'Hepatosit hasarı', summary: 'Hasar gören karaciğer hücrelerinden enzimler kana geçer.' });
const bile = node({ id: 'proc.bile-metabolism', kind: 'process', nameTr: 'Safra üretimi ve bilirubin atılımı', summary: 'Bilirubin karaciğerde işlenip safrayla bağırsağa atılır.' });
const lipidT = node({ id: 'proc.lipid-transport', kind: 'process', nameTr: 'Kolesterol ve yağ taşınması', summary: 'Karaciğer lipoproteinleri üretir ve kandan geri alır.' });
edge(liver, 'made_of', lobule);
edge(lobule, 'made_of', hepatocyte);
edge(hepatocyte, 'performs', protSynth);
edge(hepatocyte, 'performs', bile);
edge(hepatocyte, 'performs', lipidT);
edge(protSynth, 'produces', albuminM);
edge(protSynth, 'produces', clotting);
edge(albuminM, 'leads_to', oncotic);
edge(albuminM, 'measured_by', lab('albumin', 'Albümin', 'Kandaki albümin düzeyi.'));
edge(protSynth, 'measured_by', lab('total-protein', 'Total protein', 'Kandaki tüm proteinler.'));
edge(clotting, 'measured_by', lab('inr', 'INR', 'Pıhtılaşma süresi; karaciğerin protein üretimini de yansıtır.'));
edge(hepatocyte, 'affects', injury);
edge(injury, 'measured_by', lab('alt', 'ALT', 'Karaciğer hücresine görece özgü enzim.'));
edge(injury, 'measured_by', lab('ast', 'AST', 'Karaciğer, kas ve kalpte bulunan enzim.'));
edge(bile, 'measured_by', lab('bilirubin-total', 'Total bilirubin', 'Hemoglobinin yıkım ürünü; karaciğerde işlenir.'));
edge(bile, 'measured_by', lab('alp', 'ALP', 'Safra yolları ve kemikle ilişkili enzim.'));
edge(bile, 'measured_by', lab('ggt', 'GGT', 'Safra yolları ve karaciğerle ilişkili enzim.'));
edge(lipidT, 'measured_by', lab('ldl', 'LDL kolesterol', 'Dokulara kolesterol taşıyan lipoprotein.'));
edge(lipidT, 'measured_by', lab('hdl', 'HDL kolesterol', 'Fazla kolesterolü karaciğere geri taşıyan lipoprotein.'));
edge(lipidT, 'measured_by', tg);
edge(lipidT, 'affects', 'heart', 'Yüksek LDL yıllar içinde damar duvarında plak oluşumuna katkıda bulunabilir.');

/* ---------------------------------------------------------------- Böbrek */
const kidney = node({ id: 'kidneys', kind: 'organ', nameTr: 'Böbrekler', structure: 'kidneys', summary: 'Kanı süzerek atıkları idrarla atan; sıvı, tuz ve asit-baz dengesini, kan basıncını düzenleyen organlar.' });
edge(kidney, 'belongs_to', 'system:urinary');
const cortex = node({ id: 'kidneys.cortex', kind: 'region', nameTr: 'Böbrek kabuğu (korteks)', structure: 'kidneys', part: 'cortex', summary: 'Glomerüllerin bulunduğu dış katman.' });
edge(cortex, 'part_of', kidney);
const nephron = node({ id: 'tissue.nephron', kind: 'tissue', nameTr: 'Nefron', summary: 'Böbreğin süzme birimi: glomerül + tübül. Her böbrekte yaklaşık bir milyon.' });
const glomerulus = node({ id: 'cell.podocyte', kind: 'cell', nameTr: 'Glomerül (podosit ve kılcallar)', summary: 'Kanın süzüldüğü kılcal yumak; podositler süzgeci oluşturur.' });
const filtration = node({ id: 'proc.glomerular-filtration', kind: 'process', nameTr: 'Glomerüler süzme', summary: 'Dakikada yaklaşık 90–120 mL kan plazması süzülür; atıklar idrara geçer.' });
const electro = node({ id: 'proc.fluid-electrolyte', kind: 'process', nameTr: 'Sıvı ve elektrolit dengesi', summary: 'Tübüller sodyum, potasyum ve suyu geri emer ya da atar.' });
const raas = node({ id: 'proc.raas', kind: 'process', nameTr: 'Renin–anjiyotensin sistemi', summary: 'Böbrek kan akımı azalınca salınan renin kan basıncını yükselten zinciri başlatır.' });
const epo = node({ id: 'mol.erythropoietin', kind: 'molecule', nameTr: 'Eritropoietin (EPO)', summary: 'Böbreğin ürettiği, kemik iliğinde alyuvar yapımını uyaran hormon.' });
edge(cortex, 'made_of', nephron);
edge(nephron, 'made_of', glomerulus);
edge(glomerulus, 'performs', filtration);
edge(nephron, 'performs', electro);
edge(filtration, 'leads_to', electro);
edge(electro, 'leads_to', bp);
edge(kidney, 'performs', raas);
edge(raas, 'regulates', bp);
edge(kidney, 'produces', epo);
edge(filtration, 'measured_by', lab('creatinine', 'Kreatinin', 'Kas metabolizması atığı; süzme azalınca yükselir.'));
edge(filtration, 'measured_by', lab('egfr', 'eGFR', 'Kreatininden hesaplanan tahmini süzme hızı.'));
edge(filtration, 'measured_by', lab('urea', 'Üre', 'Protein yıkım ürünü; böbreklerle atılır.'));
edge(electro, 'measured_by', lab('sodium', 'Sodyum', 'Vücut sıvısının ana tuzu.'));
edge(electro, 'measured_by', lab('potassium', 'Potasyum', 'Hücre içi tuz; kalp ritmi için kritik.'));
edge('lab:potassium', 'affects', rhythm, 'Potasyumun çok düşük ya da yüksek olması kalp ritmini etkileyebilir.');

/* ---------------------------------------------------------------- Kan / kemik iliği */
const marrow = node({ id: 'bones', kind: 'organ', nameTr: 'Kemikler ve kemik iliği', structure: 'bones', summary: 'İskelet; içindeki kırmızı kemik iliği kan hücrelerini üretir.' });
edge(marrow, 'belongs_to', 'system:musculoskeletal');
edge(marrow, 'belongs_to', 'system:hematologic');
const erythro = node({ id: 'proc.erythropoiesis', kind: 'process', nameTr: 'Alyuvar yapımı', summary: 'Kemik iliğinde demir, B12 ve folat kullanılarak alyuvar üretilir.' });
const o2 = node({ id: 'proc.oxygen-transport', kind: 'process', nameTr: 'Oksijen taşınması', summary: 'Alyuvarlardaki hemoglobin akciğerden aldığı oksijeni dokulara taşır.' });
const iron = node({ id: 'proc.iron-metabolism', kind: 'process', nameTr: 'Demir metabolizması', summary: 'Demir bağırsaktan emilir, ferritin olarak depolanır, hemoglobin yapımında kullanılır.' });
edge(marrow, 'performs', erythro);
edge(epo, 'regulates', erythro, 'EPO kemik iliğini alyuvar yapımı için uyarır.');
edge(iron, 'leads_to', erythro);
edge(erythro, 'leads_to', o2);
edge(erythro, 'measured_by', lab('hemoglobin', 'Hemoglobin', 'Oksijen taşıyan protein.'));
edge(erythro, 'measured_by', lab('mcv', 'MCV', 'Alyuvarların ortalama hacmi.'));
edge(iron, 'measured_by', lab('ferritin', 'Ferritin', 'Demir deposu.'));
edge(iron, 'measured_by', lab('iron', 'Demir', 'Serum demiri.'));

/* ---------------------------------------------------------------- Akciğer */
const lungs = node({ id: 'lungs', kind: 'organ', nameTr: 'Akciğerler', structure: 'lungs', summary: 'Havadaki oksijenin kana geçtiği, karbondioksitin atıldığı organlar.' });
edge(lungs, 'belongs_to', 'system:respiratory');
for (const [k, nameTr] of [
  ['right-upper', 'Sağ üst lob'],
  ['right-middle', 'Sağ orta lob'],
  ['right-lower', 'Sağ alt lob'],
  ['left-upper', 'Sol üst lob'],
  ['left-lower', 'Sol alt lob'],
] as const)
  edge(node({ id: `lungs.${k}`, kind: 'region', nameTr, structure: 'lungs', part: k, summary: 'Akciğerin lobu; kendi bronşu ve damarlarıyla ayrı bir birimdir.' }), 'part_of', lungs);
const alveolus = node({ id: 'tissue.alveolus', kind: 'tissue', nameTr: 'Alveol', summary: 'İnce duvarlı hava keseciği; çevresi kılcallarla sarılıdır.' });
const gas = node({ id: 'proc.gas-exchange', kind: 'process', nameTr: 'Gaz değişimi', summary: 'Oksijen alveolden kana, karbondioksit kandan alveole geçer.' });
edge(lungs, 'made_of', alveolus);
edge(alveolus, 'performs', gas);
edge(gas, 'leads_to', o2);

/* ---------------------------------------------------------------- Tiroid */
const thyroid = node({ id: 'thyroid', kind: 'organ', nameTr: 'Tiroid bezi', structure: 'thyroid', summary: 'Boyunda; metabolizma hızını düzenleyen T4 ve T3 hormonlarını üretir.' });
edge(thyroid, 'belongs_to', 'system:endocrine');
const follicle = node({ id: 'tissue.thyroid-follicle', kind: 'tissue', nameTr: 'Tiroid folikülü', summary: 'Hormon öncüsünün (tiroglobulin) depolandığı kesecik.' });
const thyroidAxis = node({ id: 'proc.thyroid-axis', kind: 'process', nameTr: 'Hipofiz–tiroid ekseni', summary: 'Hipofizden salınan TSH tiroidi uyarır; T4/T3 yükselince TSH azalır (geri bildirim).' });
edge(thyroid, 'made_of', follicle);
edge(follicle, 'performs', thyroidAxis);
edge(thyroidAxis, 'leads_to', energy, 'Tiroid hormonları hücrelerin enerji harcama hızını artırır.');
edge(thyroidAxis, 'measured_by', lab('tsh', 'TSH', 'Hipofizin tiroidi uyaran hormonu.'));
edge(thyroidAxis, 'measured_by', lab('ft4', 'Serbest T4', 'Kandaki serbest tiroid hormonu.'));

/* ---------------------------------------------------------------- Derin anatomi, bölgeler, komşuluk (deep.ts) */
addDeepAnatomy({ N, E });

export const NODES: readonly KNode[] = N;
export const EDGES: readonly KEdge[] = E;
