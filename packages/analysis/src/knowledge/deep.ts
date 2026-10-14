/**
 * Derin anatomi: vücut → vücut bölgesi → organ → bölüm → alt yapı → doku → hücre → hücre içi yapı → süreç →
 * molekül; ayrıca komşuluk, bağlantı, kanlanma, sinirlenme, birlikte çalışma ve gelişim kökeni ilişkileri.
 *
 * Kurallar:
 *  - Hiyerarşi yalnızca part_of (bölüm) ve made_of (doku/hücre içerir) ile kurulur.
 *  - Komşuluk (adjacent_to) ve aynı bölgede bulunma (located_in) hiyerarşi DEĞİLDİR: yumurtalık bağırsağın
 *    içinde değil, pelviste ona komşudur.
 *  - İçerik genel eğitim bilgisidir; kişiye özel bulgu yalnızca gerçek veri (model/rapor/tahlil) bağlanınca gösterilir.
 */
import type { KEdge, KNode, NodeKind, Relation } from './graph';

export interface GraphBuilder {
  N: KNode[];
  E: KEdge[];
}

export function addDeepAnatomy({ N, E }: GraphBuilder): void {
  const ids = new Set(N.map((n) => n.id));
  const node = (id: string, kind: NodeKind, nameTr: string, summary: string, extra: Partial<KNode> = {}): string => {
    if (ids.has(id)) throw new Error(`deep: düğüm zaten var: ${id}`);
    ids.add(id);
    N.push({ id, kind, nameTr, summary, ...extra });
    return id;
  };
  const edge = (from: string, rel: Relation, to: string, note?: string) => E.push(note ? { from, to, rel, note } : { from, to, rel });
  const part = (child: string, parent: string, note?: string) => edge(child, 'part_of', parent, note);
  const made = (whole: string, ...parts: string[]) => parts.forEach((p) => edge(whole, 'made_of', p));
  const does = (who: string, ...procs: string[]) => procs.forEach((p) => edge(who, 'performs', p));
  const adj = (a: string, b: string, note?: string) => edge(a, 'adjacent_to', b, note);
  const lab = (testKey: string, nameTr: string, summary: string): string => (ids.has(`lab:${testKey}`) ? `lab:${testKey}` : node(`lab:${testKey}`, 'biomarker', nameTr, summary, { testKey }));
  const sys = (id: string, nameTr: string) => (ids.has(`system:${id}`) ? `system:${id}` : node(`system:${id}`, 'system', nameTr, `${nameTr}: birlikte çalışan organlar topluluğu.`));

  /* ============================================================ Vücut ve vücut bölgeleri */
  const body = node('body', 'body', 'Vücut', 'Tüm sistemler, bölgeler ve organlar. Keşfe buradan başlanır: bölge → organ → bölüm → doku → hücre → süreç.');
  const R = {
    head: node('region:head', 'body-region', 'Baş', 'Kafatası, beyin, yüz, gözler, kulaklar, ağız ve burun boşlukları.'),
    neck: node('region:neck', 'body-region', 'Boyun', 'Başı gövdeye bağlar; nefes borusu, yemek borusu, tiroid, şah damarları ve omurilik buradan geçer.'),
    thorax: node('region:thorax', 'body-region', 'Göğüs (toraks)', 'Göğüs kafesiyle çevrili boşluk: kalp, akciğerler, büyük damarlar, yemek borusu; altında diyafram.'),
    abdomen: node('region:abdomen', 'body-region', 'Karın (abdomen)', 'Diyaframın altındaki boşluk: mide, karaciğer, safra kesesi, pankreas, dalak, bağırsaklar, böbrekler.'),
    pelvis: node('region:pelvis', 'body-region', 'Leğen (pelvis)', 'Leğen kemiğinin çevrelediği boşluk: mesane, rektum, sigmoid kolon; kadında rahim, yumurtalıklar, fallop tüpleri; erkekte prostat. Organlar birbirine komşudur ama birbirinin içinde değildir.'),
    limbs: node('region:limbs', 'body-region', 'Kollar ve bacaklar', 'Kemikler, eklemler, kaslar, damarlar ve periferik sinirler.'),
  };
  for (const r of Object.values(R)) part(r, body);
  const located: Array<[string, string]> = [
    ['brain', R.head], ['thyroid', R.neck], ['heart', R.thorax], ['lungs', R.thorax], ['stomach', R.abdomen], ['liver', R.abdomen],
    ['pancreas', R.abdomen], ['small-intestine', R.abdomen], ['large-intestine', R.abdomen], ['large-intestine', R.pelvis], ['kidneys', R.abdomen], ['bones', R.limbs],
  ];
  for (const [o, r] of located) edge(o, 'located_in', r);

  const reproductive = sys('reproductive', 'Üreme sistemi');
  const immune = sys('immune', 'Bağışıklık sistemi');
  const sensory = sys('sensory', 'Duyu organları');

  /* ============================================================ Ortak doku ve hücre tipleri */
  const smooth = node('tissue.smooth-muscle', 'tissue', 'Düz kas dokusu', 'İstem dışı kasılan kas; bağırsak, damar, mesane ve rahim duvarında.');
  const endothelium = node('tissue.endothelium', 'tissue', 'Endotel', 'Damarların iç yüzeyini döşeyen tek kat hücre; madde geçişini ve damar tonusunu düzenler.');
  const endoCell = node('cell.endothelial', 'cell', 'Endotel hücresi', 'Damar iç yüzeyi hücresi; nitrik oksit salgılayarak damarı gevşetir.');
  made(endothelium, endoCell);
  const macrophage = node('cell.macrophage', 'cell', 'Makrofaj', 'Mikropları ve hücre artıklarını yutan, bağışıklık yanıtını başlatan hücre.');
  const lymphocyte = node('cell.lymphocyte', 'cell', 'Lenfosit (B ve T hücreleri)', 'Antikor üreten ve enfekte hücreleri tanıyan özgül bağışıklık hücreleri.');
  const inflammation = node('proc.inflammation', 'process', 'İnflamasyon (iltihap yanıtı)', 'Doku hasarı ya da enfeksiyonda damarların genişleyip bağışıklık hücrelerinin bölgeye gelmesi.');
  does(macrophage, inflammation);
  edge(inflammation, 'measured_by', lab('crp', 'CRP', 'Karaciğerin iltihapta ürettiği protein.'));
  edge(inflammation, 'measured_by', lab('wbc', 'Lökosit (WBC)', 'Kandaki toplam beyaz küre sayısı.'));
  edge(inflammation, 'measured_by', lab('esr', 'Sedimantasyon', 'Alyuvarların çökme hızı; iltihapta artar.'));

  /* ============================================================ BAĞIRSAK (derin) */
  const si = 'small-intestine';
  const wall = 'tissue.intestinal-wall';
  const mucosa = 'tissue.intestinal-mucosa';
  const submucosa = node('tissue.submucosa', 'tissue', 'Submukoza', 'Mukozanın altındaki bağ dokusu; büyük kan ve lenf damarları ile submukozal (Meissner) sinir ağı buradadır.');
  const muscularis = node('tissue.muscularis-externa', 'tissue', 'Kas tabakası (muskularis)', 'İçte dairesel, dışta boylamasına iki kat düz kas; içeriği karıştırır ve ilerletir.');
  const serosa = node('tissue.serosa', 'tissue', 'Seroza (periton)', 'Bağırsağın en dış, kaygan zarı; organların birbirine sürtünmeden kaymasını sağlar.');
  made(wall, submucosa, muscularis, serosa);
  const epithelium = node('tissue.intestinal-epithelium', 'tissue', 'Bağırsak epiteli', 'Tek kat hücre: emilim yapar ve bağırsak içeriği ile vücut arasında seçici bir bariyer oluşturur. 3–5 günde bir yenilenir.');
  const crypt = node('tissue.crypt', 'tissue', 'Kriptler (Lieberkühn bezleri)', 'Villuslar arasındaki çukurlar; tabanındaki kök hücreler epiteli sürekli yeniler.');
  const laminaPropria = node('tissue.lamina-propria', 'tissue', 'Lamina propria', 'Epitelin altındaki gevşek doku; kılcallar, lenf kanalları ve çok sayıda bağışıklık hücresi içerir.');
  made(mucosa, epithelium, crypt, laminaPropria);
  made('tissue.villus', epithelium);
  const goblet = node('cell.goblet', 'cell', 'Goblet (kadeh) hücresi', 'Bağırsak yüzeyini örten koruyucu mukusu salgılar.');
  const paneth = node('cell.paneth', 'cell', 'Paneth hücresi', 'Kript tabanında; mikrop öldürücü peptitler (defensinler) salgılar.');
  const stem = node('cell.intestinal-stem', 'cell', 'Bağırsak kök hücresi', 'Kript tabanında bölünerek tüm epitel hücrelerini yeniden oluşturur.');
  const enteroendocrine = node('cell.enteroendocrine', 'cell', 'Enteroendokrin hücre', 'Besin gelince sekretin, CCK, GLP-1 gibi hormonlar salgılar; pankreası, safra kesesini ve iştahı etkiler.');
  const mCell = node('cell.m-cell', 'cell', 'M hücresi', 'Peyer plaklarının üstünde; bağırsak içeriğinden örnek alıp bağışıklık hücrelerine sunar.');
  made(epithelium, 'cell.enterocyte', goblet, enteroendocrine);
  made(crypt, stem, paneth);
  const plasma = node('cell.plasma-iga', 'cell', 'IgA üreten plazma hücresi', 'Lamina proprianın en bol bağışıklık hücresi; bağırsak yüzeyine IgA antikoru salgılar.');
  made(laminaPropria, plasma, macrophage, lymphocyte);
  const peyer = node('tissue.peyers-patch', 'tissue', 'Peyer plakları', 'Özellikle ileumda lenf folikül kümeleri; bağırsak bağışıklığının eğitim merkezi.');
  made('small-intestine.ileum', peyer);
  made(peyer, mCell, lymphocyte);
  const microvilli = node('sub.microvilli', 'subcellular', 'Mikrovilluslar (fırçamsı kenar)', 'Enterositin yüzeyindeki binlerce mikroskobik çıkıntı; sindirim enzimleri (laktaz, sukraz) ve taşıyıcılar burada.');
  const tight = node('sub.tight-junction', 'subcellular', 'Sıkı bağlantılar', 'Komşu epitel hücrelerini birbirine mühürleyen protein bantları; bariyerin "harcı".');
  made('cell.enterocyte', microvilli, tight);
  const brushEnz = node('mol.brush-border-enzymes', 'molecule', 'Fırçamsı kenar enzimleri (laktaz, sukraz-izomaltaz, peptidazlar)', 'Şeker ve proteinlerin son sindirimini emilimden hemen önce yapar.');
  edge(microvilli, 'produces', brushEnz);
  edge(brushEnz, 'leads_to', 'proc.absorption');
  const mucus = node('mol.mucus', 'molecule', 'Mukus (müsin)', 'Epiteli mikroplardan ve sindirim enzimlerinden koruyan jel katman.');
  edge(goblet, 'produces', mucus);
  const defensin = node('mol.defensins', 'molecule', 'Defensinler', 'Bakteri zarını delen küçük antimikrobiyal peptitler.');
  edge(paneth, 'produces', defensin);
  const iga = node('mol.iga', 'molecule', 'Salgısal IgA', 'Mikropları bağırsak yüzeyinde bağlayarak tutunmalarını önleyen antikor.');
  edge(plasma, 'produces', iga);
  const incretin = node('mol.incretins', 'molecule', 'İnkretinler (GLP-1, GIP) ve CCK', 'Yemekten sonra bağırsaktan salınır; insülini artırır, mideyi yavaşlatır, tokluk verir; CCK safra ve pankreas salgısını uyarır.');
  edge(enteroendocrine, 'produces', incretin);
  edge(incretin, 'regulates', 'proc.glucose-regulation', 'GLP-1 ve GIP beta hücresinden insülin salınımını artırır.');
  edge(incretin, 'regulates', 'proc.digestion', 'CCK pankreas enzimlerini ve safra kesesi kasılmasını uyarır.');
  const barrier = node('proc.intestinal-barrier', 'process', 'Bağırsak bariyeri', 'Mukus, sıkı bağlantılar, defensinler ve IgA birlikte besinin geçmesine izin verip mikropları dışarıda tutar.');
  edge(tight, 'leads_to', barrier);
  edge(mucus, 'leads_to', barrier);
  edge(defensin, 'leads_to', barrier);
  edge(iga, 'leads_to', barrier);
  does(epithelium, barrier);
  const renewal = node('proc.epithelial-renewal', 'process', 'Epitel yenilenmesi', 'Kök hücreler bölünür, yeni hücreler kriptten villus ucuna 3–5 günde göç eder ve dökülür.');
  does(stem, renewal);
  const motility = node('proc.intestinal-motility', 'process', 'Bağırsak hareketleri (peristaltizm ve segmentasyon)', 'Dairesel ve boylamasına kaslar içeriği karıştırır ve ileri iter; sinir ağı ve Cajal hücreleri ritmi belirler.');
  const cajal = node('cell.cajal', 'cell', 'Cajal interstisyel hücresi', 'Bağırsak kasının "kalp pili"; yavaş elektriksel dalgalar üretir.');
  const myenteric = node('tissue.myenteric-plexus', 'tissue', 'Miyenterik (Auerbach) sinir ağı', 'Kas katları arasında; hareketleri yönetir. Bağırsağın kendi sinir sistemi (enterik sinir sistemi) yüz milyon nörondan oluşur.');
  const submPlexus = node('tissue.submucosal-plexus', 'tissue', 'Submukozal (Meissner) sinir ağı', 'Salgıyı ve yerel kan akımını düzenler.');
  made(muscularis, smooth, cajal, myenteric);
  made(submucosa, submPlexus);
  does(muscularis, motility);
  does(cajal, motility);
  does(myenteric, motility);
  const mucosalImmunity = node('proc.mucosal-immunity', 'process', 'Bağırsak bağışıklığı ve bağışıklık sinyalleri', 'Peyer plakları ve lamina propria, zararsız besin ve bakterilere tolerans gösterirken patojenlere yanıt verir; vücudun bağışıklık hücrelerinin büyük kısmı bağırsakta bulunur.');
  does(peyer, mucosalImmunity);
  does(laminaPropria, mucosalImmunity);
  edge(mucosalImmunity, 'leads_to', inflammation, 'Bariyer bozulursa iltihap yanıtı başlayabilir.');
  edge(mucosalImmunity, 'functions_with', immune);
  const microbiome = node('proc.microbiome', 'process', 'Mikrobiyota ile etkileşim', 'Özellikle kalın bağırsakta trilyonlarca bakteri lifleri fermente eder, vitamin (K, bazı B) üretir, bağışıklığı eğitir ve bariyeri destekler.');
  const scfa = node('mol.scfa', 'molecule', 'Kısa zincirli yağ asitleri (bütirat, asetat, propiyonat)', 'Bakterilerin lif fermentasyonu ürünü; kolon hücrelerinin ana enerji kaynağı, iltihabı azaltıcı etkili.');
  edge(microbiome, 'produces', scfa);
  edge(scfa, 'leads_to', barrier);
  edge(microbiome, 'affects', mucosalImmunity, 'Mikrobiyota bağırsak bağışıklığının dengesini etkiler.');
  edge(microbiome, 'affects', 'liver', 'Bakteri ürünleri portal venle karaciğere ulaşır.');
  // Kalın bağırsak bölümleri ve dokusu
  const liParts: Array<[string, string, string]> = [
    ['cecum', 'Çekum ve apandis', 'İnce bağırsağın kalın bağırsağa açıldığı kese; ileoçekal kapak geri kaçışı önler, apandis lenf dokusu içerir.'],
    ['ascending', 'Çıkan kolon', 'Karnın sağında yukarı çıkar; suyun geri emilimi başlar.'],
    ['transverse', 'Transvers kolon', 'Karnın üstünde soldan sağa uzanır; mide ve karaciğere komşudur.'],
    ['descending', 'İnen kolon', 'Karnın solunda aşağı iner.'],
    ['sigmoid', 'Sigmoid kolon', 'S biçimli son bölüm; pelvise iner, dışkıyı rektuma iletir. Kadında sol yumurtalığa komşudur.'],
    ['rectum', 'Rektum', 'Dışkının depolandığı son bölüm; dolunca dışkılama refleksi başlar. Önünde mesane (erkekte prostat, kadında rahim ve vajina) bulunur.'],
  ];
  for (const [k, nameTr, summary] of liParts) part(node(`large-intestine.${k}`, 'region', nameTr, summary, { structure: 'large-intestine', part: k }), 'large-intestine');
  const colonocyte = node('cell.colonocyte', 'cell', 'Kolonosit', 'Kalın bağırsak epitel hücresi; su ve sodyumu geri emer, enerjisini bütirattan alır.');
  made('tissue.colon-mucosa', colonocyte, goblet, crypt);
  edge(scfa, 'leads_to', 'proc.water-absorption', 'Bütirat kolonositlerin su ve tuz emilimini besler.');
  does('large-intestine', microbiome);
  // Kalın bağırsağın kendi duvarı: villus YOKTUR (yalnızca kriptler); kas tabakasında tenya koli şeritleri.
  const colonWall = node('tissue.colon-wall', 'tissue', 'Kalın bağırsak duvarı', 'Mukoza (villussuz, kriptli), submukoza, kas tabakası (dış boylamasına kas üç şerit hâlinde: tenya koli) ve seroza.');
  made('large-intestine', colonWall);
  made(colonWall, 'tissue.colon-mucosa', submucosa, muscularis, serosa);
  const defecation = node('proc.defecation', 'process', 'Dışkılama refleksi', 'Rektum gerildiğinde iç sfinkter gevşer; dış sfinkter isteğe bağlı kontrol edilir.');
  does('large-intestine.rectum', defecation);
  // Damarlar, sinirler, gelişim
  const sma = node('vessel.sma', 'region', 'Üst mezenterik arter', 'İnce bağırsağı, çekumu, çıkan ve transvers kolonun büyük kısmını besler.', { structure: 'abdominal-vessels' });
  const ima = node('vessel.ima', 'region', 'Alt mezenterik arter', 'İnen kolon, sigmoid ve rektumun üst kısmını besler.', { structure: 'abdominal-vessels' });
  const celiac = node('vessel.celiac', 'region', 'Çölyak gövde', 'Mide, karaciğer, dalak, pankreas ve duodenumun üst kısmını besler.', { structure: 'abdominal-vessels' });
  const portal = node('vessel.portal-vein', 'region', 'Kapı (portal) ven', 'Bağırsak, mide, pankreas ve dalaktan gelen besinden zengin kanı karaciğere taşır.', { structure: 'abdominal-vessels' });
  const vagus = node('nerve.vagus', 'region', 'Vagus siniri', 'Beyin sapından çıkıp kalbe, akciğerlere ve sindirim organlarına giden parasempatik sinir; "dinlen ve sindir" sinyalleri.', { structure: 'nerves' });
  const sympathetic = node('nerve.sympathetic', 'region', 'Sempatik sinir sistemi', 'Omurilik yanındaki zincirden organlara gider; "savaş ya da kaç" yanıtı: kalp hızlanır, bağırsak yavaşlar.', { structure: 'nerves' });
  const enteric = node('nerve.enteric', 'region', 'Enterik sinir sistemi', 'Bağırsak duvarındaki bağımsız sinir ağı (miyenterik + submukozal); beyinden komut almadan da çalışabilir.');
  made(enteric, myenteric, submPlexus);
  edge(si, 'supplied_by', sma);
  edge('large-intestine', 'supplied_by', sma, 'Çekum, çıkan ve transvers kolonun büyük kısmı.');
  edge('large-intestine', 'supplied_by', ima, 'İnen kolon, sigmoid ve üst rektum.');
  edge('stomach', 'supplied_by', celiac);
  edge('liver', 'supplied_by', celiac, 'Hepatik arter yoluyla.');
  edge('pancreas', 'supplied_by', celiac);
  edge(si, 'drained_by', portal, 'Emilen besinler önce karaciğere gider.');
  edge('large-intestine', 'drained_by', portal);
  edge('stomach', 'drained_by', portal);
  edge(si, 'innervated_by', enteric);
  edge(si, 'innervated_by', vagus);
  edge('large-intestine', 'innervated_by', enteric);
  edge('stomach', 'innervated_by', vagus);
  const midgut = node('dev.midgut', 'region', 'Orta bağırsak (embriyo)', 'Embriyoda duodenumun ikinci yarısından transvers kolonun üçte ikisine kadar olan kısmı oluşturan ilkel bağırsak bölümü.');
  const hindgut = node('dev.hindgut', 'region', 'Arka bağırsak (embriyo)', 'Transvers kolonun son üçte birinden rektuma kadar olan kısmı oluşturur.');
  const foregut = node('dev.foregut', 'region', 'Ön bağırsak (embriyo)', 'Yemek borusu, mide, duodenumun başı, karaciğer, safra kesesi ve pankreası oluşturur.');
  edge(si, 'develops_from', midgut);
  edge('large-intestine', 'develops_from', hindgut, 'Çekum ve çıkan kolon orta bağırsaktan, inen kolon ve rektum arka bağırsaktan gelişir.');
  edge('stomach', 'develops_from', foregut);
  edge('liver', 'develops_from', foregut);
  edge('pancreas', 'develops_from', foregut);
  edge(portal, 'connected_to', 'liver', 'Portal kan karaciğer sinüzoidlerine dağılır.');
  // Komşuluklar (karın)
  adj('stomach', 'liver', 'Mide karaciğerin sol lobunun altında.');
  adj('stomach', 'pancreas', 'Pankreas midenin arkasında.');
  adj('small-intestine.duodenum', 'pancreas', 'Pankreas başı duodenumun C kıvrımına oturur.');
  adj('large-intestine.transverse', 'stomach');
  adj('large-intestine.ascending', 'kidneys', 'Çıkan kolon sağ böbreğin önünde.');
  adj('large-intestine.descending', 'kidneys', 'İnen kolon sol böbreğin önünde.');
  edge('stomach', 'connected_to', 'small-intestine.duodenum', 'Pilor kapağı yoluyla.');
  edge('small-intestine.ileum', 'connected_to', 'large-intestine.cecum', 'İleoçekal kapak yoluyla.');
  edge(si, 'functions_with', 'pancreas', 'Pankreas enzimleri duodenumda sindirimi tamamlar.');
  edge(si, 'functions_with', 'liver', 'Safra yağların emilimi için gerekir; emilen besinler karaciğere gider.');

  /* ============================================================ SAFRA KESESİ, DALAK */
  const gb = node('gallbladder', 'organ', 'Safra kesesi ve safra yolları', 'Karaciğerin ürettiği safrayı depolayıp yoğunlaştırır; yemekte duodenuma boşaltır.', { structure: 'gallbladder' });
  edge(gb, 'belongs_to', 'system:digestive');
  edge(gb, 'located_in', R.abdomen);
  const bileDucts = node('gallbladder.bile-ducts', 'region', 'Safra yolları (koledok)', 'Karaciğer ve safra kesesinden duodenuma safra taşıyan kanallar; Vater ampullasında pankreas kanalıyla birleşir.', { structure: 'gallbladder', part: 'bile-ducts' });
  part(bileDucts, gb);
  edge(gb, 'connected_to', 'liver', 'Safra kanalları yoluyla.');
  edge(bileDucts, 'connected_to', 'small-intestine.duodenum', 'Vater ampullası.');
  edge(gb, 'performs', 'proc.bile-metabolism');
  adj(gb, 'liver', 'Karaciğerin alt yüzündeki çukurda.');
  edge(gb, 'develops_from', foregut);
  edge('mol.incretins', 'regulates', gb, 'CCK safra kesesini kastırır.');
  const spleen = node('spleen', 'organ', 'Dalak', 'Karnın sol üstünde; yaşlı alyuvarları ayıklar, kanı süzer ve bağışıklık yanıtı başlatır.', { structure: 'spleen' });
  edge(spleen, 'belongs_to', immune);
  edge(spleen, 'belongs_to', 'system:hematologic');
  edge(spleen, 'located_in', R.abdomen);
  const redPulp = node('spleen.red-pulp', 'tissue', 'Kırmızı pulpa', 'Kanın süzüldüğü bölüm; yaşlı ve hasarlı alyuvarlar makrofajlarca yutulur.');
  const whitePulp = node('spleen.white-pulp', 'tissue', 'Beyaz pulpa', 'Lenfosit kümeleri; kandaki mikroplara karşı antikor yanıtı.');
  made(spleen, redPulp, whitePulp);
  made(redPulp, macrophage);
  made(whitePulp, lymphocyte);
  const rbcClear = node('proc.rbc-clearance', 'process', 'Yaşlı alyuvarların ayıklanması', 'Yaklaşık 120 günlük alyuvarlar dalakta parçalanır; demir geri kazanılır, hem bilirubine dönüşür.');
  does(redPulp, rbcClear);
  edge(rbcClear, 'leads_to', 'proc.iron-metabolism');
  edge(rbcClear, 'leads_to', 'proc.bile-metabolism', 'Hemden oluşan bilirubin karaciğerde işlenir.');
  edge(spleen, 'supplied_by', celiac, 'Dalak arteri yoluyla.');
  edge(spleen, 'drained_by', portal);
  adj(spleen, 'stomach');
  adj(spleen, 'kidneys', 'Sol böbreğin üst-ön yüzüne komşu.');
  adj(spleen, 'pancreas', 'Pankreas kuyruğu dalak kapısına uzanır.');

  /* ============================================================ KARACİĞER (derin) */
  const liverLobes: Array<[string, string, string]> = [
    ['right-lobe', 'Sağ lob (segment V–VIII)', 'Karaciğerin en büyük lobu; Couinaud segmentleri V–VIII.'],
    ['left-lobe', 'Sol lob (segment II–IV)', 'Midenin üzerine uzanan lob.'],
    ['caudate', 'Kaudat lob (segment I)', 'Arka yüzde, alt toplardamara yakın; kanını doğrudan alt toplardamara boşaltır.'],
    ['quadrate', 'Kuadrat lob', 'Alt yüzde, safra kesesi ile yuvarlak bağ arasında.'],
  ];
  for (const [k, nameTr, summary] of liverLobes) part(node(`liver.${k}`, 'region', nameTr, summary, { structure: 'liver', part: k }), 'liver');
  // Couinaud segmentleri: her biri kendi portal ven, hepatik arter ve safra kanalı dalıyla bağımsız bir birim (cerrahide çıkarılabilir).
  const couinaud: Array<[number, string, string, string]> = [
    [1, 'I', 'caudate', 'Kaudat lob; kanını doğrudan alt toplardamara verir.'],
    [2, 'II', 'left-lobe', 'Sol lobun arka-üst bölümü (sol lateral).'],
    [3, 'III', 'left-lobe', 'Sol lobun ön-alt bölümü (sol lateral).'],
    [4, 'IV', 'left-lobe', 'Sol medial segment (kuadrat lob bölgesi dahil); orta hepatik venin solunda.'],
    [5, 'V', 'right-lobe', 'Sağ lobun ön-alt segmenti; safra kesesi yatağına komşu.'],
    [6, 'VI', 'right-lobe', 'Sağ lobun arka-alt segmenti; sağ böbreğe komşu.'],
    [7, 'VII', 'right-lobe', 'Sağ lobun arka-üst segmenti; diyaframın altında.'],
    [8, 'VIII', 'right-lobe', 'Sağ lobun ön-üst segmenti; diyaframın altında.'],
  ];
  for (const [i, roman, lobe, summary] of couinaud) part(node(`liver.segment-${i}`, 'region', `Segment ${roman} (Couinaud)`, `${summary} Kendi portal ve arter dalı ile ayrı bir işlev birimidir.`, { structure: 'liver', part: lobe }), `liver.${lobe}`);
  adj('liver.segment-6', 'kidneys');
  adj('liver.segment-5', 'gallbladder');
  const porta = node('liver.porta', 'region', 'Karaciğer kapısı (porta hepatis)', 'Portal ven, hepatik arter ve safra kanalının karaciğere girip çıktığı yer.', { structure: 'liver', part: 'porta' });
  part(porta, 'liver');
  const lobule = 'tissue.liver-lobule';
  const triad = node('tissue.portal-triad', 'tissue', 'Portal üçlü (alan)', 'Lobül köşelerinde portal ven dalı, hepatik arter dalı ve safra kanalcığı birlikte bulunur.');
  const sinusoid = node('tissue.sinusoid', 'tissue', 'Sinüzoidler', 'Hepatosit sıraları arasındaki geçirgen kılcallar; portal ve arter kanı karışıp merkezi vene akar.');
  const centralVein = node('tissue.central-vein', 'tissue', 'Merkezi ven', 'Lobülün ortasında; kanı hepatik venlere, oradan alt toplardamara taşır.');
  const canaliculi = node('sub.bile-canaliculi', 'subcellular', 'Safra kanalcıkları', 'Komşu hepatositlerin zarları arasında; safra ters yönde portal alandaki kanallara akar.');
  made(lobule, triad, sinusoid, centralVein);
  made('cell.hepatocyte', canaliculi);
  const kupffer = node('cell.kupffer', 'cell', 'Kupffer hücresi', 'Sinüzoidlerdeki makrofaj; portal kandan gelen bakteri ve artıkları temizler.');
  const stellate = node('cell.stellate', 'cell', 'Yıldızsı (Ito) hücre', 'A vitamini depolar; hasarda etkinleşip kollajen üreterek yara dokusuna (fibroz) yol açabilir.');
  const lsec = node('cell.lsec', 'cell', 'Sinüzoid endotel hücresi', 'Delikli (fenestralı) endotel; plazmanın hepatositlere ulaşmasına izin verir.');
  made(sinusoid, kupffer, lsec);
  made(lobule, stellate);
  const er = node('sub.smooth-er', 'subcellular', 'Düz endoplazmik retikulum (CYP450)', 'İlaç ve toksinleri işleyen sitokrom P450 enzimlerinin bulunduğu hücre içi zar sistemi.');
  const glycogen = node('mol.glycogen', 'molecule', 'Glikojen', 'Glukozun karaciğer ve kasta depolanan biçimi.');
  made('cell.hepatocyte', er);
  const detox = node('proc.detoxification', 'process', 'Zehirsizleştirme (ilaç ve toksin işleme)', 'Faz I (CYP450) ve faz II (bağlama) tepkimeleriyle maddeler suda çözünür hâle gelip safra ya da idrarla atılır; amonyak üreye çevrilir.');
  const glucoseStore = node('proc.hepatic-glucose', 'process', 'Karaciğerin glukoz yönetimi', 'Toklukta glukozu glikojen olarak depolar; açlıkta glikojeni yıkar ve yeni glukoz üretir (glukoneogenez).');
  const ureaCycle = node('proc.urea-cycle', 'process', 'Üre döngüsü', 'Protein yıkımından çıkan zehirli amonyak üreye çevrilir; üre böbrekle atılır.');
  does('cell.hepatocyte', detox, glucoseStore, ureaCycle);
  does(er, detox);
  edge(glucoseStore, 'produces', glycogen);
  edge('mol.insulin', 'regulates', glucoseStore, 'İnsülin glikojen depolamayı artırır.');
  edge('mol.glucagon', 'regulates', glucoseStore, 'Glukagon glikojen yıkımı ve glukoz üretimini artırır.');
  edge(glucoseStore, 'leads_to', 'proc.glucose-regulation');
  edge(ureaCycle, 'measured_by', 'lab:urea');
  edge(ureaCycle, 'leads_to', 'proc.glomerular-filtration', 'Üre böbreklerle atılır.');
  edge('mol.clotting-factors', 'leads_to', node('proc.coagulation', 'process', 'Pıhtılaşma', 'Damar hasarında trombositler ve pıhtılaşma faktörleri zinciri fibrin ağı oluşturur.'));
  edge('proc.coagulation', 'measured_by', lab('aptt', 'aPTT', 'İç yol pıhtılaşma süresi.'));
  edge('proc.coagulation', 'measured_by', lab('platelet', 'Trombosit', 'Pıhtılaşmanın ilk adımını yapan kan pulcukları.'));
  edge('proc.coagulation', 'measured_by', 'lab:inr');
  edge('liver', 'drained_by', node('vessel.hepatic-veins', 'region', 'Hepatik venler', 'Karaciğer kanını alt toplardamara (ve kalbe) taşır.', { structure: 'veins' }));
  edge('liver', 'supplied_by', portal, 'Kanın ~%75\'i portal venden (besinden zengin), ~%25\'i hepatik arterden (oksijenden zengin).');
  adj('liver', 'kidneys', 'Sağ böbreğin üst kutbu karaciğerin alt yüzüne komşu.');
  adj('liver', 'large-intestine.transverse');
  edge('liver', 'functions_with', 'pancreas', 'İnsülin ve glukagon karaciğerin glukoz üretimini yönetir.');

  /* ============================================================ BÖBREK (derin) */
  const kid = 'kidneys';
  const capsule = node('kidneys.capsule', 'region', 'Böbrek kapsülü', 'Böbreği saran sert bağ dokusu zarı.', { structure: 'kidneys', part: 'capsule' });
  const medulla = node('kidneys.medulla', 'region', 'Böbrek özü (medulla) ve piramitler', 'Henle kulpları ve toplayıcı kanalların uzandığı iç bölüm; idrarın yoğunlaştırıldığı yer.', { structure: 'kidneys', part: 'pyramid' });
  const papilla = node('kidneys.papilla', 'region', 'Böbrek papillaları', 'Piramit uçları; idrar buradan kalikslere damlar.', { structure: 'kidneys', part: 'papilla' });
  const hilum = node('kidneys.hilum', 'region', 'Böbrek kapısı (hilus)', 'Böbrek arter ve veni ile üreterin girip çıktığı yer.', { structure: 'kidneys', part: 'hilum' });
  for (const r of [capsule, medulla, hilum]) part(r, kid);
  part(papilla, medulla);
  const glom = node('tissue.glomerulus', 'tissue', 'Glomerül ve Bowman kapsülü', 'Kılcal yumak (glomerül) ve onu saran çift katlı kese; süzülen sıvı (ön idrar) kapsül boşluğuna geçer.');
  const pct = node('tissue.proximal-tubule', 'tissue', 'Proksimal tübül', 'Süzülen sodyum, suyun ~2/3\'ü, glukozun ve amino asitlerin tamamı burada geri emilir.');
  const henle = node('tissue.loop-of-henle', 'tissue', 'Henle kulpu', 'Medullaya inip çıkan U biçimli bölüm; ters akım düzeneğiyle tuz gradyanı oluşturur.');
  const dct = node('tissue.distal-tubule', 'tissue', 'Distal tübül', 'Sodyum, kalsiyum ve potasyumun hormonlarla (aldosteron, PTH) ince ayarı.');
  const cd = node('tissue.collecting-duct', 'tissue', 'Toplayıcı kanal', 'ADH ile suyun geri emilip idrarın yoğunlaştırıldığı son bölüm; asit atılımı burada ayarlanır.');
  const jga = node('tissue.juxtaglomerular', 'tissue', 'Jukstaglomerüler aygıt', 'Glomerüle giren arter duvarındaki renin hücreleri ve distal tübüldeki makula densa: kan basıncı ve tuz algılayıcısı.');
  made('tissue.nephron', glom, pct, henle, dct, cd, jga);
  made(glom, 'cell.podocyte');
  const mesangial = node('cell.mesangial', 'cell', 'Mezangial hücre', 'Glomerül kılcallarını destekler, süzgeçte biriken maddeleri temizler.');
  const fenEndo = node('cell.glomerular-endothelium', 'cell', 'Glomerül endoteli (delikli)', 'Süzgecin ilk katmanı; alyuvarları tutar, plazmayı geçirir.');
  made(glom, mesangial, fenEndo);
  const slit = node('sub.slit-diaphragm', 'subcellular', 'Süzme yarığı diyaframı (nefrin)', 'Podosit ayakçıkları arasındaki protein zar; albümin gibi büyük proteinleri tutar. Hasarında idrara protein kaçar.');
  made('cell.podocyte', slit);
  const pctCell = node('cell.proximal-tubule', 'cell', 'Proksimal tübül hücresi', 'Fırçamsı kenarlı, mitokondriden zengin; aktif taşıyıcılarla geri emilim yapar.');
  made(pct, pctCell);
  const principal = node('cell.principal', 'cell', 'Esas (principal) hücre', 'Toplayıcı kanalda; aldosteronla sodyum alır, potasyum atar; ADH ile su kanalı açar.');
  const intercalated = node('cell.intercalated', 'cell', 'Ara (interkalar) hücre', 'Toplayıcı kanalda asit (H+) ya da bikarbonat salgılayarak asit-baz dengesini ayarlar.');
  made(cd, principal, intercalated);
  const aqp2 = node('sub.aquaporin2', 'subcellular', 'Akuaporin-2 su kanalları', 'ADH etkisiyle zara yerleşir; suyun idrardan kana geri dönmesini sağlar.');
  made(principal, aqp2);
  const jgCell = node('cell.juxtaglomerular', 'cell', 'Jukstaglomerüler (renin) hücresi', 'Kan basıncı düşünce ya da tuz azalınca renin salgılar.');
  made(jga, jgCell);
  does(jgCell, 'proc.raas');
  const reabs = node('proc.tubular-reabsorption', 'process', 'Geri emilim', 'Süzülen günlük ~180 litre sıvının ~%99\'u tübüllerden kana geri döner.');
  const secretion = node('proc.tubular-secretion', 'process', 'Tübüler salgılama', 'Potasyum, hidrojen iyonu, bazı ilaçlar ve atıklar kandan idrara aktif olarak atılır.');
  const concentrate = node('proc.urine-concentration', 'process', 'İdrarın yoğunlaştırılması', 'Henle kulpunun tuz gradyanı ve ADH ile vücut suyu korunur.');
  const acidBase = node('proc.acid-base', 'process', 'Asit-baz dengesi', 'Böbrek bikarbonatı geri kazanır ve asidi atar; akciğerlerle birlikte kan pH\'ını ~7,4\'te tutar.');
  does(pct, reabs);
  does(pctCell, reabs);
  does(dct, reabs, secretion);
  does(henle, concentrate);
  does(cd, concentrate, acidBase);
  does(intercalated, acidBase);
  does(principal, secretion);
  does(aqp2, concentrate);
  edge('proc.glomerular-filtration', 'leads_to', reabs);
  edge(reabs, 'leads_to', 'proc.fluid-electrolyte');
  edge(secretion, 'leads_to', 'proc.fluid-electrolyte');
  edge(concentrate, 'leads_to', 'fn.blood-pressure', 'Vücut suyu ve kan hacmi kan basıncını belirler.');
  edge(secretion, 'measured_by', 'lab:potassium');
  edge(acidBase, 'measured_by', lab('chloride', 'Klor', 'Asit-baz ve sıvı dengesinde sodyumla birlikte çalışan iyon.'));
  edge(reabs, 'measured_by', lab('calcium', 'Kalsiyum', 'Kemik, kas kasılması ve sinir iletimi için gerekli mineral.'));
  edge(reabs, 'measured_by', lab('phosphorus', 'Fosfor', 'Kemik ve enerji metabolizmasında görevli mineral.'));
  edge(reabs, 'measured_by', lab('magnesium', 'Magnezyum', 'Kas, sinir ve enzimler için gerekli mineral.'));
  edge(secretion, 'measured_by', lab('uric-acid', 'Ürik asit', 'Pürin yıkım ürünü; böbreklerle atılır.'));
  edge(slit, 'affects', 'lab:albumin', 'Süzgeç bozulursa albümin idrara kaçar, kandaki düzeyi düşebilir.');
  const renalArtery = node('vessel.renal-artery', 'region', 'Böbrek arterleri', 'Aorttan çıkar; kalbin pompaladığı kanın ~%20\'si böbreklere gider.', { structure: 'renal-vessels' });
  edge(kid, 'supplied_by', renalArtery);
  edge(kid, 'drained_by', node('vessel.renal-vein', 'region', 'Böbrek venleri', 'Süzülmüş kanı alt toplardamara taşır.', { structure: 'renal-vessels' }));
  edge(kid, 'innervated_by', sympathetic, 'Sempatik uyarı renin salınımını ve damar direncini artırır.');
  edge(kid, 'develops_from', node('dev.metanephros', 'region', 'Metanefroz (embriyo)', 'Kalıcı böbreğin geliştiği embriyonik doku; üreter tomurcuğu toplayıcı sistemi oluşturur.'));
  // Kalp–böbrek–kan basıncı ekseni
  edge('heart', 'functions_with', kid, 'Kalp böbreklere kan pompalar; böbrekler kan hacmini ve basıncını ayarlar (kardiyorenal eksen).');
  edge('proc.raas', 'leads_to', node('mol.aldosterone', 'molecule', 'Aldosteron', 'Böbreküstü bezinden salınır; böbrekte sodyum tutup potasyum attırır, kan hacmini artırır.'));
  edge('mol.aldosterone', 'regulates', principal);
  edge('mol.aldosterone', 'regulates', 'proc.fluid-electrolyte');

  /* ============================================================ İDRAR YOLLARI, MESANE */
  const ut = node('urinary-tract', 'organ', 'İdrar yolları ve mesane', 'Böbrek havuzu, üreterler, mesane ve üretra: idrarı toplar, taşır, depolar ve boşaltır.', { structure: 'urinary-tract' });
  edge(ut, 'belongs_to', 'system:urinary');
  const pelvisRen = node('urinary-tract.renal-pelvis', 'region', 'Böbrek havuzu ve kaliksler', 'Papillalardan damlayan idrarı toplayan huni.', { structure: 'urinary-tract', part: 'renal-pelvis' });
  const ureter = node('urinary-tract.ureter', 'region', 'Üreter', 'Böbrekten mesaneye ~25–30 cm\'lik kas boru; peristaltizmle idrarı iter.', { structure: 'urinary-tract', part: 'ureter' });
  const bladder = node('urinary-tract.bladder', 'region', 'Mesane', 'Pelviste, idrarı depolayan kas kese (yetişkinde ~400–500 mL). Kadında rahmin önünde, erkekte rektumun önünde.', { structure: 'urinary-tract', part: 'bladder' });
  const trigone = node('urinary-tract.trigone', 'region', 'Mesane üçgeni', 'İki üreter ağzı ve üretra iç ağzı arasındaki düz bölge.', { structure: 'urinary-tract', part: 'trigone' });
  const urethra = node('urinary-tract.urethra', 'region', 'Üretra', 'İdrarı dışarı taşıyan kanal.', { structure: 'urinary-tract', part: 'urethra' });
  for (const r of [pelvisRen, ureter, bladder, urethra]) part(r, ut);
  part(trigone, bladder);
  edge(kid, 'connected_to', pelvisRen);
  edge(pelvisRen, 'connected_to', ureter);
  edge(ureter, 'connected_to', bladder);
  edge(bladder, 'connected_to', urethra);
  const urothelium = node('tissue.urothelium', 'tissue', 'Ürotel (değişici epitel)', 'Mesane dolunca gerilip yassılaşan, idrara geçirimsiz çok katlı epitel.');
  const umbrella = node('cell.umbrella', 'cell', 'Şemsiye hücreleri', 'Ürotelin en yüzeyindeki büyük hücreler; uroplakin plaklarıyla idrar bariyeri oluşturur.');
  const detrusor = node('tissue.detrusor', 'tissue', 'Detrüsör kası', 'Mesane duvarının düz kası; işemede kasılır.');
  made(bladder, urothelium, detrusor);
  made(urothelium, umbrella);
  made(detrusor, smooth);
  const micturition = node('proc.micturition', 'process', 'İşeme (miksiyon) refleksi', 'Mesane gerilince sinyaller omuriliğe ve beyin sapına gider; parasempatik uyarıyla detrüsör kasılır, sfinkterler gevşer.');
  does(bladder, micturition);
  edge(ut, 'located_in', R.abdomen);
  edge(bladder, 'located_in', R.pelvis);
  edge(bladder, 'innervated_by', node('nerve.pelvic-splanchnic', 'region', 'Pelvik splanknik sinirler (S2–S4)', 'Mesane, rektum ve üreme organlarına parasempatik lifler taşır.', { structure: 'nerves' }));
  const pelvicVessels = node('vessel.internal-iliac', 'region', 'İç iliak damarlar', 'Pelvis organlarını (mesane, rahim, rektum, prostat) besleyen ve boşaltan damarlar.', { structure: 'abdominal-vessels' });
  edge(bladder, 'supplied_by', pelvicVessels);
  edge(urothelium, 'performs', node('proc.urine-barrier', 'process', 'İdrar bariyeri', 'İdrardaki atık ve tuzların mesane duvarından geri emilmesini önler.'));

  /* ============================================================ KADIN ÜREME: YUMURTALIK, TÜP, RAHİM */
  const ovary = node('ovaries', 'organ', 'Yumurtalıklar', 'Pelviste rahmin iki yanında badem büyüklüğünde bezler; yumurta hücresi olgunlaştırır, östrojen ve progesteron üretir. Bağırsağın içinde değil, pelvis boşluğunda ona komşudur.', { structure: 'ovaries' });
  edge(ovary, 'belongs_to', reproductive);
  edge(ovary, 'belongs_to', 'system:endocrine');
  edge(ovary, 'located_in', R.pelvis);
  for (const [k, tr] of [['left', 'Sol yumurtalık'], ['right', 'Sağ yumurtalık']] as const) part(node(`ovaries.${k}`, 'region', tr, `${tr}: ${k === 'left' ? 'sigmoid kolona' : 'çekum ve apandise'} yakın, pelvisin yan duvarında (over çukuru).`, { structure: 'ovaries', part: k }), ovary);
  const ovCortex = node('ovary.cortex', 'tissue', 'Yumurtalık korteksi (kabuk)', 'Dış katman; gelişmekte olan foliküller bu stromada bulunur.');
  const ovMedulla = node('ovary.medulla', 'tissue', 'Yumurtalık medullası (öz)', 'İç kısım; kan damarları, lenf damarları ve sinirler.');
  made(ovary, ovCortex, ovMedulla);
  const follicles = node('tissue.ovarian-follicles', 'tissue', 'Foliküller', 'Her biri bir yumurta hücresi ve onu saran destek hücrelerinden oluşan kesecikler; doğumda ~1–2 milyon, ergenlikte ~300–400 bin.');
  made(ovCortex, follicles);
  const stages: Array<[string, string, string]> = [
    ['primordial', 'Primordiyal folikül', 'Tek kat yassı hücreyle sarılı uyuyan yumurta hücresi; yumurtalık rezervi.'],
    ['primary', 'Primer folikül', 'Çevre hücreler kübik granüloza hücrelerine dönüşür; zona pellusida oluşur.'],
    ['secondary', 'Sekonder folikül', 'Çok katlı granüloza; dışta teka hücreleri belirir.'],
    ['antral', 'Antral (Graaf) folikül', 'Sıvı dolu boşluk (antrum); olgun folikül ~18–25 mm\'ye ulaşıp yumurtlar. Ultrasonda görülen foliküller bunlardır.'],
  ];
  let prev: string | undefined;
  for (const [k, nameTr, summary] of stages) {
    const id = node(`ovary.follicle-${k}`, 'tissue', nameTr, summary);
    made(follicles, id);
    if (prev) edge(prev, 'leads_to', id);
    prev = id;
  }
  const corpusLuteum = node('ovary.corpus-luteum', 'tissue', 'Korpus luteum (sarı cisim)', 'Yumurtlamadan sonra boşalan folikülden oluşur; progesteron üretir. Gebelik olmazsa ~14 günde geriler.');
  made(ovCortex, corpusLuteum);
  edge(prev!, 'leads_to', corpusLuteum, 'Yumurtlamadan sonra.');
  const oocyte = node('cell.oocyte', 'cell', 'Oosit (yumurta hücresi)', 'Mayozun ilk evresinde bekleyen dişi üreme hücresi; yumurtlamadan hemen önce bölünmesini sürdürür.');
  const granulosa = node('cell.granulosa', 'cell', 'Granüloza hücresi', 'Oositi besler; FSH etkisiyle androjenleri östrojene çevirir (aromataz); AMH ve inhibin üretir.');
  const theca = node('cell.theca', 'cell', 'Teka hücresi', 'Folikülün dış katmanı; LH etkisiyle androjen üretir, bunlar granülozada östrojene dönüşür.');
  const luteal = node('cell.luteal', 'cell', 'Luteal hücre', 'Korpus luteumda progesteron ve östrojen üretir.');
  made('ovary.follicle-primordial', oocyte);
  made('ovary.follicle-secondary', oocyte, granulosa, theca);
  made('ovary.follicle-antral', oocyte, granulosa, theca);
  made(corpusLuteum, luteal);
  const zona = node('sub.zona-pellucida', 'subcellular', 'Zona pellusida', 'Oositi saran glikoprotein kılıf; spermin bağlanmasında rol oynar.');
  made(oocyte, zona);
  const estradiol = node('mol.estradiol', 'molecule', 'Östradiol (östrojen)', 'Rahim iç zarını kalınlaştırır, kemik ve damarları korur, LH tepesini tetikler.');
  const progesterone = node('mol.progesterone', 'molecule', 'Progesteron', 'Rahim iç zarını gebeliğe hazırlar (salgı evresi), vücut ısısını hafif artırır.');
  const fsh = node('mol.fsh', 'molecule', 'FSH (folikül uyarıcı hormon)', 'Hipofizden salınır; folikül büyümesini ve östrojen yapımını uyarır.');
  const lh = node('mol.lh', 'molecule', 'LH (luteinleştirici hormon)', 'Hipofizden salınır; döngünün ortasındaki ani yükselişi yumurtlamayı tetikler.');
  const amh = node('mol.amh', 'molecule', 'AMH (anti-Müllerian hormon)', 'Küçük büyüyen foliküllerin granüloza hücrelerince üretilir; yumurtalık rezervini yansıtır.');
  edge(granulosa, 'produces', estradiol);
  edge(granulosa, 'produces', amh);
  edge(theca, 'produces', node('mol.androgens', 'molecule', 'Androjenler (androstenedion, testosteron)', 'Teka hücrelerinde üretilir; granülozada östrojene dönüşür.'));
  edge('mol.androgens', 'leads_to', estradiol, 'Aromataz enzimiyle.');
  edge(luteal, 'produces', progesterone);
  edge(luteal, 'produces', estradiol);
  const folliculo = node('proc.folliculogenesis', 'process', 'Folikül gelişimi (follikülogenez)', 'Primordiyal folikülden olgun Graaf folikülüne aylar süren gelişim; her döngüde genellikle tek baskın folikül seçilir.');
  const ovulation = node('proc.ovulation', 'process', 'Yumurtlama (ovülasyon)', 'LH tepesinden ~24–36 saat sonra olgun folikül yırtılır, oosit tüpün saçaklarına yakalanır.');
  const steroid = node('proc.ovarian-steroidogenesis', 'process', 'Yumurtalık hormon üretimi', 'İki hücre–iki gonadotropin modeli: teka (LH) androjen, granüloza (FSH) östrojen üretir; yumurtlamadan sonra korpus luteum progesteron üretir.');
  const cycle = node('proc.menstrual-cycle', 'process', 'Adet (menstrüel) döngüsü', 'Ortalama 21–35 gün: foliküler evre → yumurtlama → luteal evre → adet. Yumurtalık hormonları rahim iç zarını yönetir.');
  const hpo = node('proc.hpo-axis', 'process', 'Hipotalamus–hipofiz–yumurtalık ekseni', 'Hipotalamustan GnRH → hipofizden FSH/LH → yumurtalıktan östrojen/progesteron; hormonlar geri bildirimle hipotalamus ve hipofizi düzenler.');
  does(follicles, folliculo);
  does('ovary.follicle-antral', ovulation);
  does(granulosa, steroid);
  does(theca, steroid);
  does(ovary, folliculo, ovulation, steroid);
  edge(folliculo, 'leads_to', ovulation);
  edge(ovulation, 'leads_to', cycle);
  edge(steroid, 'leads_to', cycle);
  edge(fsh, 'regulates', folliculo);
  edge(lh, 'regulates', ovulation, 'LH tepesi yumurtlamayı tetikler.');
  edge(lh, 'regulates', steroid);
  edge(hpo, 'produces', fsh);
  edge(hpo, 'produces', lh);
  edge(estradiol, 'regulates', hpo, 'Geri bildirim: döngü ortasında yüksek östrojen LH tepesini başlatır.');
  edge(progesterone, 'regulates', hpo);
  edge(fsh, 'measured_by', lab('fsh', 'FSH', 'Folikül uyarıcı hormon.'));
  edge(lh, 'measured_by', lab('lh', 'LH', 'Luteinleştirici hormon.'));
  edge(estradiol, 'measured_by', lab('estradiol', 'Östradiol (E2)', 'Ana östrojen hormonu.'));
  edge(progesterone, 'measured_by', lab('progesterone', 'Progesteron', 'Yumurtlama sonrası yükselen hormon.'));
  edge(hpo, 'measured_by', lab('prolactin', 'Prolaktin', 'Yüksekliği yumurtlamayı baskılayabilir.'));
  edge('mol.androgens', 'measured_by', lab('testosterone', 'Testosteron', 'Androjen hormonu.'));
  edge(estradiol, 'affects', 'bones', 'Östrojen kemik yıkımını frenler; azalınca kemik kaybı hızlanır.');
  edge(ovary, 'supplied_by', node('vessel.ovarian-artery', 'region', 'Yumurtalık arteri', 'Doğrudan aorttan çıkar, asıcı bağ içinde yumurtalığa ulaşır; uterin arterle de birleşir.', { structure: 'abdominal-vessels' }));
  edge(ovary, 'drained_by', node('vessel.ovarian-vein', 'region', 'Yumurtalık veni', 'Sağda alt toplardamara, solda sol böbrek venine boşalır.', { structure: 'veins' }));
  edge(ovary, 'develops_from', node('dev.gonadal-ridge', 'region', 'Gonad sırtı (embriyo)', 'Böbrek taslağının yanında gelişen ve ilkel üreme hücrelerinin göç ettiği doku; yumurtalık ve testis buradan gelişir. Yumurtalık sonradan pelvise iner.'));

  const tube = node('fallopian-tubes', 'organ', 'Fallop tüpleri', 'Yumurtalıktan rahme uzanan ~10–12 cm\'lik kanallar; döllenme genellikle ampullada olur.', { structure: 'fallopian-tubes' });
  edge(tube, 'belongs_to', reproductive);
  edge(tube, 'located_in', R.pelvis);
  const tubeParts: Array<[string, string, string]> = [
    ['infundibulum', 'İnfundibulum ve fimbriyalar', 'Yumurtalığa uzanan saçaklı huni; yumurtlanan oositi yakalar.'],
    ['ampulla', 'Ampulla', 'Tüpün en geniş kısmı; döllenmenin olağan yeri.'],
    ['isthmus', 'İstmus', 'Rahme bağlanan dar kısım.'],
  ];
  for (const [k, nameTr, summary] of tubeParts) part(node(`fallopian-tubes.${k}`, 'region', nameTr, summary, { structure: 'fallopian-tubes', part: k }), tube);
  const ciliated = node('cell.ciliated-tubal', 'cell', 'Silli tüp epitel hücresi', 'Titrek tüyleri oositi ve embriyoyu rahme doğru süpürür.');
  const tubalEpi = node('tissue.tubal-epithelium', 'tissue', 'Tüp iç yüzeyi (mukoza)', 'Silli ve salgı hücrelerinden oluşan kıvrımlı mukoza.');
  made(tube, tubalEpi);
  made(tubalEpi, ciliated);
  const transport = node('proc.gamete-transport', 'process', 'Oosit ve embriyo taşınması', 'Silli hareket ve kas kasılmalarıyla döllenmiş yumurta 3–5 günde rahme ulaşır.');
  does(ciliated, transport);
  edge(ovulation, 'leads_to', transport);
  edge('fallopian-tubes.infundibulum', 'adjacent_to', ovary, 'Fimbriyalar yumurtalığın yüzeyini sarar ama ona yapışık değildir.');
  edge(tube, 'connected_to', 'uterus', 'İstmus rahim boşluğuna açılır.');

  const uterus = node('uterus', 'organ', 'Rahim (uterus)', 'Pelvisin ortasında, mesanenin arkasında ve rektumun önünde kas organ; gebelikte bebeği taşır, döngüyle iç zarı yenilenir.', { structure: 'uterus' });
  edge(uterus, 'belongs_to', reproductive);
  edge(uterus, 'located_in', R.pelvis);
  const uParts: Array<[string, string, string]> = [
    ['fundus', 'Rahim tabanı (fundus)', 'Tüplerin girişinin üstündeki kubbe.'],
    ['body', 'Rahim gövdesi', 'Embriyonun genellikle yerleştiği ana bölüm.'],
    ['lower-segment', 'Alt uterin segment', 'Gövde ile serviks arası; gebelikte incelir.'],
    ['cervix', 'Rahim ağzı (serviks)', 'Vajinaya açılan dar boyun; mukus kıvamı döngüyle değişir. Tarama (smear/HPV) buradan yapılır.'],
    ['ligaments', 'Rahim ve yumurtalık bağları', 'Geniş bağ, yuvarlak bağ, yumurtalık bağı: organları yerinde tutar.'],
  ];
  for (const [k, nameTr, summary] of uParts) part(node(`uterus.${k}`, 'region', nameTr, summary, { structure: 'uterus', part: k }), uterus);
  const endometrium = node('tissue.endometrium', 'tissue', 'Endometrium (iç zar)', 'Bezler ve stromadan oluşan, her döngüde kalınlaşıp dökülen iç tabaka.');
  const myometrium = node('tissue.myometrium', 'tissue', 'Miyometrium (kas tabakası)', 'Kalın düz kas; adette ve doğumda kasılır. Miyomlar bu katmandan gelişir.');
  const perimetrium = node('tissue.perimetrium', 'tissue', 'Perimetrium', 'Rahmin dış zarı (periton).');
  made(uterus, endometrium, myometrium, perimetrium);
  made(myometrium, smooth);
  const endoStroma = node('cell.endometrial-stromal', 'cell', 'Endometrial stroma hücresi', 'Progesteronla desidual hücreye dönüşüp embriyonun yerleşmesine hazırlanır.');
  const endoGland = node('cell.endometrial-gland', 'cell', 'Endometrial bez hücresi', 'Luteal evrede embriyoyu besleyen salgılar üretir.');
  made(endometrium, endoStroma, endoGland);
  const prolif = node('proc.endometrial-cycle', 'process', 'Endometriumun döngüsel değişimi', 'Östrojenle kalınlaşır (proliferatif), progesteronla salgı evresine geçer; hormonlar düşünce dökülür (adet).');
  does(endometrium, prolif);
  edge(estradiol, 'regulates', prolif);
  edge(progesterone, 'regulates', prolif);
  edge(prolif, 'leads_to', cycle);
  edge(uterus, 'performs', cycle);
  edge(uterus, 'supplied_by', node('vessel.uterine-artery', 'region', 'Rahim (uterin) arteri', 'İç iliak arterin dalı; üreterin üzerinden çaprazlar ("köprü altından su geçer").', { structure: 'abdominal-vessels' }));
  edge(uterus, 'develops_from', node('dev.mullerian', 'region', 'Müller kanalları (embriyo)', 'Rahim, tüpler ve vajinanın üst kısmı bu çift kanalın birleşmesiyle gelişir.'));
  edge(tube, 'develops_from', 'dev.mullerian');
  edge(endometrium, 'measured_by', lab('bhcg', 'Beta-hCG', 'Gebelik hormonu; embriyo yerleşince yükselir.'));
  // Pelvis komşulukları: kimse kimsenin içinde değil.
  adj(uterus, bladder, 'Rahim mesanenin üst-arka yüzüne yaslanır.');
  adj(uterus, 'large-intestine.rectum', 'Arada rekto-uterin çukur (Douglas boşluğu) vardır; serbest sıvı en önce burada birikir.');
  adj(ovary, uterus, 'Yumurtalık bağıyla rahme tutunur.');
  adj('ovaries.left', 'large-intestine.sigmoid', 'Sol yumurtalık sigmoid kolona komşudur.');
  adj('ovaries.right', 'large-intestine.cecum', 'Sağ yumurtalık çekum ve apandise yakındır (sağ alt karın ağrısında ikisi de düşünülür).');
  adj(ovary, ureter, 'Üreter yumurtalık çukurunun arkasından geçer.');
  adj(ovary, pelvicVessels, 'Pelvis yan duvarındaki iç iliak damarlara komşudur.');
  adj('large-intestine.sigmoid', bladder);
  adj(bladder, 'large-intestine.rectum', 'Erkekte mesane doğrudan rektumun önündedir.');
  for (const o of ['large-intestine.rectum', 'large-intestine.sigmoid', pelvicVessels, 'nerve.pelvic-splanchnic']) edge(o, 'located_in', R.pelvis);

  /* ============================================================ ERKEK ÜREME: PROSTAT */
  const prostate = node('prostate', 'organ', 'Prostat', 'Mesanenin altında, üretrayı saran ceviz büyüklüğünde bez; meni sıvısının bir kısmını üretir.', { structure: 'prostate' });
  edge(prostate, 'belongs_to', reproductive);
  edge(prostate, 'located_in', R.pelvis);
  for (const [k, tr, sm] of [
    ['peripheral', 'Periferik bölge', 'Arka-dış bölüm; dokunun ~%70\'i, kanserlerin çoğu burada gelişir.'],
    ['transition', 'Geçiş bölgesi', 'Üretrayı saran bölüm; iyi huylu büyüme (BPH) buradan başlar.'],
    ['central', 'Santral bölge', 'Ejakülatör kanalları çevreler.'],
  ] as const)
    part(node(`prostate.${k}`, 'region', tr, sm, { structure: 'prostate', part: k }), prostate);
  const prostGland = node('cell.prostate-luminal', 'cell', 'Prostat bez (luminal) hücresi', 'Meni sıvısına PSA ve diğer proteinleri salgılar.');
  made(prostate, prostGland);
  edge(prostGland, 'produces', node('mol.psa', 'molecule', 'PSA (prostat spesifik antijen)', 'Meniyi sıvılaştıran enzim; az miktarı kana geçer.'));
  edge('mol.psa', 'measured_by', lab('psa', 'PSA', 'Prostat spesifik antijen.'));
  adj(prostate, bladder, 'Prostat mesane boynunun hemen altında.');
  adj(prostate, 'large-intestine.rectum', 'Prostatın arka yüzü rektumdan elle muayene edilebilir.');
  edge(prostate, 'connected_to', urethra, 'Üretra prostatın içinden geçer.');

  /* ============================================================ KULAK (derin) */
  const ear = node('ear', 'organ', 'Kulak', 'İşitme ve denge organı: dış kulak sesi toplar, orta kulak güçlendirir, iç kulak titreşimi sinir sinyaline çevirir ve baş hareketlerini algılar.', { structure: 'ear' });
  edge(ear, 'belongs_to', sensory);
  edge(ear, 'belongs_to', 'system:nervous');
  edge(ear, 'located_in', R.head);
  const outer = node('ear.outer', 'region', 'Dış kulak', 'Kulak kepçesi ve dış kulak yolu: sesi toplayıp kulak zarına yönlendirir.');
  const middle = node('ear.middle', 'region', 'Orta kulak', 'Kulak zarı ile iç kulak arasındaki hava dolu boşluk (timpan boşluğu); kemikçikler burada.');
  const inner = node('ear.inner', 'region', 'İç kulak', 'Şakak kemiğinin içinde sıvı dolu labirent: işitme (koklea) ve denge (vestibül, yarım daire kanalları) bölümleri.');
  for (const r of [outer, middle, inner]) part(r, ear);
  const pinna = node('ear.pinna', 'region', 'Kulak kepçesi', 'Elastik kıkırdaktan yapılı; sesin yönünü belirlemeye yardım eder.');
  const canal = node('ear.canal', 'region', 'Dış kulak yolu', '~2,5 cm\'lik kanal; kulak kiri bezleri ve kılları koruma sağlar; konuşma frekanslarını hafifçe güçlendirir.', { structure: 'ear', part: 'canal' });
  part(pinna, outer);
  part(canal, outer);
  const eardrum = node('ear.eardrum', 'region', 'Kulak zarı (timpan zarı)', '~9 mm\'lik üç katlı ince zar; ses dalgasıyla titreşir ve titreşimi çekiç kemiğine aktarır. Dış ve orta kulağı ayırır.', { structure: 'ear', part: 'eardrum' });
  part(eardrum, middle, 'Zar dış ve orta kulağın sınırıdır; orta kulağın dış duvarı sayılır.');
  edge(canal, 'connected_to', eardrum);
  const tmLayers = node('tissue.tympanic-layers', 'tissue', 'Zarın katmanları', 'Dışta deri, ortada lifli (kollajen) katman, içte orta kulak mukozası.');
  made(eardrum, tmLayers);
  const ossicles = node('ear.ossicles', 'region', 'Kulak kemikçikleri', 'Vücudun en küçük kemikleri: çekiç, örs, üzengi. Zar titreşimini iç kulağa ~20 kat güçlendirerek aktarır.', { structure: 'ear', part: 'ossicles' });
  part(ossicles, middle);
  const malleus = node('ear.malleus', 'region', 'Çekiç (malleus)', 'Sapı kulak zarına yapışıktır.');
  const incus = node('ear.incus', 'region', 'Örs (inkus)', 'Çekiç ile üzengi arasında köprü.');
  const stapes = node('ear.stapes', 'region', 'Üzengi (stapes)', 'Tabanı iç kulağın oval penceresine oturur; en küçük kemik (~3 mm).');
  for (const o of [malleus, incus, stapes]) part(o, ossicles);
  edge(eardrum, 'connected_to', malleus);
  edge(malleus, 'connected_to', incus);
  edge(incus, 'connected_to', stapes);
  const stapedius = node('ear.middle-ear-muscles', 'region', 'Orta kulak kasları (stapedius, tensor timpani)', 'Çok yüksek seste kemikçikleri sertleştirerek iç kulağı korur (akustik refleks).');
  part(stapedius, middle);
  const eustachian = node('ear.eustachian', 'region', 'Östaki borusu', 'Orta kulağı geniz (nazofarenks) ile bağlar; basıncı eşitler, sıvıyı boşaltır. Çocukta kısa ve yatay olduğu için orta kulak iltihabı sıktır.');
  part(eustachian, middle);
  edge(eustachian, 'connected_to', node('airway.nasopharynx', 'region', 'Geniz (nazofarenks)', 'Burun boşluğunun arkası; Östaki boruları buraya açılır.', { structure: 'airways' }));
  const cochlea = node('ear.cochlea', 'region', 'Koklea (salyangoz)', '2,5 tur sarmal kemik kanal; içindeki sıvı ve zar sistemi sesi frekanslarına ayırır: tabanda tiz, tepede pes sesler.', { structure: 'ear', part: 'cochlea' });
  const vestibule = node('ear.vestibule', 'region', 'Vestibül (utrikulus ve sakkulus)', 'Doğrusal ivmeyi ve yerçekimine göre baş eğimini algılayan keseler.', { structure: 'ear', part: 'vestibule' });
  const canals = node('ear.semicircular-canals', 'region', 'Yarım daire kanalları', 'Birbirine dik üç kanal; başın dönme hareketlerini algılar.', { structure: 'ear', part: 'canals' });
  for (const r of [cochlea, vestibule, canals]) part(r, inner);
  edge(stapes, 'connected_to', node('ear.oval-window', 'region', 'Oval pencere', 'Üzengi tabanının oturduğu, iç kulak sıvısına açılan zar.'), 'Titreşim buradan koklea sıvısına geçer.');
  part('ear.oval-window', inner);
  const corti = node('tissue.organ-of-corti', 'tissue', 'Corti organı', 'Baziler zar üzerinde duran işitme algılayıcısı: tüy hücreleri, destek hücreleri ve üstlerini örten tektoryal zar.');
  const basilar = node('tissue.basilar-membrane', 'tissue', 'Baziler zar', 'Tabanda dar ve sert, tepede geniş ve esnek; her frekans zarın farklı noktasını en çok titreştirir (tonotopi).');
  const stria = node('tissue.stria-vascularis', 'tissue', 'Stria vaskülaris', 'Endolenfi potasyumdan zengin tutan damarlı doku; tüy hücrelerine "pil" görevi gören +80 mV potansiyeli oluşturur.');
  const endolymph = node('mol.endolymph', 'molecule', 'Endolenf (potasyumdan zengin sıvı)', 'Koklea ve vestibüler keseleri dolduran sıvı; tüy hücrelerinin uyarılmasını sağlayan iyon kaynağı.');
  made(cochlea, basilar, corti, stria);
  edge(stria, 'produces', endolymph);
  const ihc = node('cell.inner-hair', 'cell', 'İç tüy hücreleri', 'Kokleada tek sıra (~3.500); asıl işitme sinyalini işitme sinirine gönderir.');
  const ohc = node('cell.outer-hair', 'cell', 'Dış tüy hücreleri', 'Üç sıra (~12.000); uzayıp kısalarak zayıf sesleri güçlendirir (koklear amplifikatör). Gürültü ve yaşla ilk bunlar hasar görür.');
  const supporting = node('cell.supporting-cochlear', 'cell', 'Destek hücreleri (Deiters, pilar)', 'Tüy hücrelerini taşıyan ve iyon dengesini koruyan hücreler.');
  made(corti, ihc, ohc, supporting);
  const stereocilia = node('sub.stereocilia', 'subcellular', 'Stereosilya (tüy demeti)', 'Tüy hücresinin tepesindeki merdiven biçimli çıkıntılar; uçlarındaki bağlarla iyon kanalları mekanik olarak açılır.');
  const tipLink = node('sub.mechanotransduction-channel', 'subcellular', 'Uç bağları ve mekanik duyarlı kanallar', 'Tüyler eğilince uç bağları gerilir, kanallar açılır ve potasyum hücreye girer.');
  made(ihc, stereocilia);
  made(ohc, stereocilia);
  made(stereocilia, tipLink);
  const prestin = node('mol.prestin', 'molecule', 'Prestin', 'Dış tüy hücresi zarındaki motor protein; voltajla boyu değişerek sesi güçlendirir.');
  edge(ohc, 'produces', prestin);
  const conduction2 = node('proc.sound-conduction', 'process', 'Ses iletimi ve empedans uyumu', 'Kulak zarı ile oval pencere arasındaki alan farkı ve kemikçik kaldıracı, havadaki sesi sıvıya kayıpsız aktarır.');
  const mechano = node('proc.mechanotransduction', 'process', 'Mekanoelektrik dönüşüm', 'Titreşim tüyleri eğer → kanallar açılır → potasyum girer → hücre depolarize olur → işitme sinirine glutamat salınır.');
  const amplifier = node('proc.cochlear-amplification', 'process', 'Koklear güçlendirme', 'Dış tüy hücrelerinin hareketi zayıf sesleri ~40 dB güçlendirir ve frekans ayrımını keskinleştirir (otoakustik emisyon testinin temeli).');
  const tonotopy = node('proc.tonotopy', 'process', 'Frekans ayrıştırma (tonotopi)', 'Baziler zarın her noktası farklı frekansa yanıt verir; beyin hangi sinir liflerinin uyarıldığından sesin perdesini anlar.');
  does(eardrum, conduction2);
  does(ossicles, conduction2);
  does(ihc, mechano);
  does(tipLink, mechano);
  does(ohc, amplifier);
  does(basilar, tonotopy);
  edge(conduction2, 'leads_to', tonotopy);
  edge(tonotopy, 'leads_to', mechano);
  edge(endolymph, 'leads_to', mechano, 'Potasyumdan zengin endolenf tüy hücresini uyaran akımı sağlar.');
  edge(amplifier, 'leads_to', mechano);
  const spiralGanglion = node('tissue.spiral-ganglion', 'tissue', 'Spiral gangliyon', 'İşitme siniri nöronlarının gövdeleri; tüy hücrelerinden sinyali alır.');
  part(spiralGanglion, cochlea, 'Koklea ekseninde (modiolus) yer alır.');
  made(spiralGanglion, 'cell.neuron');
  const auditoryNerve = node('nerve.cochlear', 'region', 'İşitme (koklear) siniri', 'VIII. kafa sinirinin işitme dalı; sinyali beyin sapındaki koklear çekirdeklere taşır.', { structure: 'nerves' });
  const vestNerve = node('nerve.vestibular', 'region', 'Denge (vestibüler) siniri', 'VIII. kafa sinirinin denge dalı.', { structure: 'nerves' });
  edge(cochlea, 'innervated_by', auditoryNerve);
  edge(vestibule, 'innervated_by', vestNerve);
  edge(canals, 'innervated_by', vestNerve);
  edge(eardrum, 'innervated_by', vagus, 'Zarın dış yüzünün bir kısmı (öksürük refleksi kulak temizlerken bu yüzdendir).');
  const pathway = node('proc.auditory-pathway', 'process', 'İşitme yolu', 'Koklear çekirdekler → üst olivar kompleks (iki kulağı karşılaştırıp yön bulur) → alt kollikulus → talamus (medial genikulat) → şakak lobundaki işitme korteksi.');
  edge(mechano, 'leads_to', pathway);
  edge(auditoryNerve, 'performs', pathway);
  edge(pathway, 'leads_to', 'fn.hearing');
  edge(pathway, 'connected_to', 'brain.temporal', 'İşitme korteksi (Heschl girusu) şakak lobunda.');
  edge(pathway, 'connected_to', 'brain.thalamus');
  edge(pathway, 'connected_to', 'brain.pons');
  const macula = node('tissue.vestibular-macula', 'tissue', 'Makula ve otolitler', 'Utrikulus ve sakkulustaki tüy hücresi tabakası; üstündeki kalsiyum kristalleri (otolit) yerçekimiyle kayarak tüyleri eğer.');
  const crista = node('tissue.crista-ampullaris', 'tissue', 'Krista ampullaris', 'Her yarım daire kanalının genişlemiş ucundaki algılayıcı; dönme sırasında sıvı akımı jelatinöz kupulayı büker.');
  const vestHair = node('cell.vestibular-hair', 'cell', 'Vestibüler tüy hücreleri (tip I ve II)', 'Baş hareketini sinir sinyaline çeviren denge algılayıcıları.');
  made(vestibule, macula);
  made(canals, crista);
  made(macula, vestHair);
  made(crista, vestHair);
  made(vestHair, stereocilia);
  const otoconia = node('mol.otoconia', 'molecule', 'Otokonya (kalsiyum karbonat kristalleri)', 'Makula üzerindeki ağırlık kristalleri; yerinden oynayıp kanallara kaçarsa pozisyonel baş dönmesi (BPPV) olur.');
  edge(macula, 'produces', otoconia);
  const balance = node('proc.vestibular-balance', 'process', 'Denge fizyolojisi', 'İç kulak, gözler ve kas-eklem duyusu beyin sapında birleşir; vestibülo-oküler refleks baş dönerken bakışı sabit tutar.');
  does(vestHair, balance);
  does(vestNerve, balance);
  edge(balance, 'leads_to', 'fn.balance');
  edge(balance, 'functions_with', 'brain.cerebellum', 'Beyincik denge bilgisini hareketlerle eşleştirir.');
  edge(vestHair, 'performs', mechano);
  edge(ear, 'supplied_by', node('vessel.labyrinthine', 'region', 'Labirent arteri', 'Çoğunlukla baziler sistemden; iç kulağın tek ve uç arteri (tıkanırsa ani işitme kaybı olabilir).'));
  edge(inner, 'develops_from', node('dev.otic-vesicle', 'region', 'Otik vezikül (embriyo)', 'Ektodermden gelişen kese; iç kulağın tüm zar labirentini oluşturur.'));
  edge(middle, 'develops_from', node('dev.pharyngeal-pouch-1', 'region', 'Birinci farinks cebi (embriyo)', 'Orta kulak boşluğu ve Östaki borusu buradan gelişir.'));
  adj(ear, 'brain', 'İç kulak şakak kemiğinde, beynin şakak lobunun hemen altındadır.');
  adj(middle, 'brain.temporal', 'Orta kulağın tavanı ince bir kemikle şakak lobundan ayrılır.');

  /* ============================================================ KALP (derin) */
  const H = 'heart';
  const chambers: Array<[string, string, string]> = [
    ['right-atrium', 'Sağ kulakçık', 'Vücuttan dönen oksijeni azalmış kanı üst ve alt toplardamarlardan alır; sinüs düğümü duvarında.'],
    ['right-ventricle', 'Sağ karıncık', 'Kanı pulmoner artere, akciğerlere pompalar; ince duvarlı.'],
    ['left-atrium', 'Sol kulakçık', 'Akciğerden gelen oksijenli kanı pulmoner venlerden alır; yemek borusunun hemen önünde.'],
  ];
  for (const [k, nameTr, summary] of chambers) part(node(`heart.${k}`, 'region', nameTr, summary, { structure: 'heart', part: k }), H);
  const septum = node('heart.septum', 'region', 'Karıncıklar arası bölme', 'Sağ ve sol karıncığı ayırır; içinden His demetinin dalları geçer.', { structure: 'heart', part: 'septum' });
  part(septum, H);
  const valves = node('heart.valves', 'region', 'Kalp kapakları', 'Kanın tek yönde akmasını sağlayan dört kapak; kapanırken kalp seslerini (S1, S2) oluştururlar.');
  part(valves, H);
  for (const [k, tr, sm] of [
    ['tricuspid', 'Triküspit kapak', 'Sağ kulakçık ile sağ karıncık arasında, üç yaprakçıklı.'],
    ['pulmonary-valve', 'Pulmoner kapak', 'Sağ karıncık ile akciğer atardamarı arasında.'],
    ['mitral', 'Mitral kapak', 'Sol kulakçık ile sol karıncık arasında, iki yaprakçıklı.'],
    ['aortic-valve', 'Aort kapağı', 'Sol karıncık ile aort arasında.'],
  ] as const)
    part(node(`heart.${k}`, 'region', tr, sm, { structure: 'heart', part: k }), valves);
  const papillary = node('heart.papillary', 'region', 'Papiller kaslar ve kiriş bağları', 'Karıncık duvarından uzanıp kapak yaprakçıklarını bağlarla tutar; kapağın geri kaçmasını önler.', { structure: 'heart', part: 'papillary' });
  part(papillary, H);
  edge(papillary, 'connected_to', 'heart.mitral');
  const endocardium = node('tissue.endocardium', 'tissue', 'Endokard', 'Odacıkların ve kapakların iç yüzeyini döşeyen ince tabaka.');
  const epicardium = node('tissue.epicardium', 'tissue', 'Epikard', 'Kalbin dış yüzü; koroner damarlar ve yağ dokusu bu katmanda seyreder.');
  const pericardium = node('heart.pericardium', 'region', 'Perikard (kalp zarı)', 'Kalbi saran çift katlı kese; yaprakları arasında 15–50 mL kaydırıcı sıvı bulunur. Fazlası (efüzyon) kalbi sıkıştırabilir.');
  part(pericardium, H);
  const pericFluid = node('mol.pericardial-fluid', 'molecule', 'Perikard sıvısı', 'Kalbin sürtünmesiz atmasını sağlayan ince sıvı; normalde 15–50 mL.');
  edge(pericardium, 'produces', pericFluid);
  made(H, endocardium, epicardium);
  const fibrous = node('tissue.fibrous-pericardium', 'tissue', 'Fibröz perikard', 'Dıştaki sert, esnemeyen kese; ani sıvı birikiminde kalbin dolmasını kısıtlar.');
  const serous = node('tissue.serous-pericardium', 'tissue', 'Seröz perikard (paryetal ve visseral)', 'Sıvıyı üreten ve emen iki ince yaprak.');
  made(pericardium, fibrous, serous);
  const coronary = node('vessel.coronary', 'region', 'Koroner arterler', 'Aort kökünden çıkan sağ ve sol koroner arter (sol ön inen, sirkumfleks dalları) kalp kasını besler.', { structure: 'coronary-arteries' });
  edge(H, 'supplied_by', coronary);
  edge(coronary, 'connected_to', node('vessel.aorta', 'region', 'Aort', 'Sol karıncıktan çıkan ana atardamar; tüm vücuda oksijenli kan dağıtır.', { structure: 'aorta' }));
  edge(H, 'connected_to', 'vessel.aorta', 'Aort kapağı yoluyla.');
  edge(H, 'drained_by', node('vessel.coronary-sinus', 'region', 'Koroner sinüs', 'Kalp kasının kanını sağ kulakçığa boşaltan toplardamar.', { structure: 'veins' }));
  const conductionParts: Array<[string, string, string]> = [
    ['sa-node', 'Sinüs (SA) düğümü', 'Sağ kulakçık duvarındaki doğal kalp pili; dinlenmede dakikada 60–100 uyarı.'],
    ['av-node', 'AV düğüm', 'Kulakçık ile karıncık arasındaki kapı; uyarıyı ~0,1 sn geciktirir (karıncıklar dolsun diye) — EKG\'de PR aralığı.'],
    ['his', 'His demeti ve dalları', 'Uyarıyı bölme boyunca sağ ve sol karıncığa taşır.'],
    ['purkinje', 'Purkinje lifleri', 'Uyarıyı karıncık kasına saniyenin küçük bir kesrinde yayan hızlı lifler — EKG\'de QRS.'],
  ];
  prev = undefined;
  for (const [k, nameTr, summary] of conductionParts) {
    const id = node(`heart.${k}`, 'tissue', nameTr, summary);
    made('heart.conduction', id);
    if (prev) edge(prev, 'connected_to', id);
    prev = id;
  }
  const pacemaker = node('cell.pacemaker', 'cell', 'Kalp pili (pacemaker) hücresi', 'Kendiliğinden yavaş depolarize olup ritmik uyarı üreten özel kalp kası hücresi (HCN "funny" kanalları).');
  made('heart.sa-node', pacemaker);
  does(pacemaker, 'proc.heart-rhythm');
  const sarcomere = node('sub.sarcomere', 'subcellular', 'Sarkomer', 'Kas lifinin en küçük kasılma birimi (~2 µm): aktin ve miyozin iplikleri birbiri üzerinde kayar.');
  const ttubule = node('sub.t-tubule-sr', 'subcellular', 'T-tübüller ve sarkoplazmik retikulum', 'Elektriksel uyarıyı hücre içine taşır ve kalsiyum deposunu açar.');
  const disc = node('sub.intercalated-disc', 'subcellular', 'Aralıklı diskler (gap junction)', 'Kalp kası hücrelerini elektriksel olarak birbirine bağlar; kalp tek bir birim gibi kasılır.');
  const mito = node('sub.mitochondria-cardiac', 'subcellular', 'Mitokondriler', 'Kalp hücresi hacminin ~%30\'u; kesintisiz kasılma için ATP üretir.');
  made('cell.cardiomyocyte', sarcomere, ttubule, disc, mito);
  edge(sarcomere, 'produces', 'mol.calcium-actin-myosin');
  const ecc = node('proc.excitation-contraction', 'process', 'Uyarılma–kasılma eşleşmesi', 'Aksiyon potansiyeli → L tipi kalsiyum kanalı → SR\'den kalsiyum salınımı → troponin–aktin–miyozin etkileşimi → kasılma.');
  does(ttubule, ecc);
  does(sarcomere, ecc);
  edge(ecc, 'leads_to', 'proc.heart-contraction');
  edge(disc, 'leads_to', 'proc.heart-rhythm', 'Uyarı hücreden hücreye gap junction ile yayılır.');
  edge(mito, 'leads_to', ecc, 'ATP olmadan kasılma ve gevşeme durur.');
  const cycleH = node('proc.cardiac-cycle', 'process', 'Kalp döngüsü (sistol ve diyastol)', 'Kulakçık kasılması → karıncık kasılması (sistol; kapaklar açılır, kan atılır) → gevşeme (diyastol; karıncıklar dolar). Dinlenmede ~0,8 sn.');
  const output = node('proc.cardiac-output', 'process', 'Kalp debisi ve ejeksiyon fraksiyonu', 'Kalp hızı × atım hacmi (dinlenmede ~5 L/dk). Sol karıncık her atımda kanının ~%55–70\'ini atar (EF).');
  edge('proc.heart-contraction', 'leads_to', cycleH);
  edge(cycleH, 'leads_to', output);
  edge(output, 'leads_to', 'proc.circulation');
  does(valves, cycleH);
  does('heart.left-ventricle', output);
  edge(H, 'innervated_by', vagus, 'Parasempatik: kalp hızını yavaşlatır.');
  edge(H, 'innervated_by', sympathetic, 'Kalp hızını ve kasılma gücünü artırır.');
  edge(H, 'develops_from', node('dev.heart-tube', 'region', 'Kalp tüpü (embriyo)', 'Mezodermden oluşan tüp; 4. haftada kıvrılarak dört odacıklı kalbi oluşturur, ilk çalışan organdır.'));
  adj(H, 'lungs', 'Kalp iki akciğerin arasında, mediastende.');
  adj('heart.left-atrium', node('esophagus', 'organ', 'Yemek borusu', 'Yutağı mideye bağlayan ~25 cm\'lik kas boru; kalbin ve aortun arkasında seyreder.', { structure: 'esophagus' }), 'Sol kulakçık yemek borusunun hemen önünde (transözofageal EKO bu yüzden mümkündür).');
  edge('esophagus', 'belongs_to', 'system:digestive');
  edge('esophagus', 'located_in', R.thorax);
  edge('esophagus', 'connected_to', 'stomach');
  adj(H, node('diaphragm', 'organ', 'Diyafram', 'Göğüs ve karın boşluğunu ayıran kubbe biçimli ana solunum kası.', { structure: 'diaphragm' }), 'Kalp diyaframın üzerine oturur.');
  edge('diaphragm', 'belongs_to', 'system:respiratory');
  edge('diaphragm', 'located_in', R.thorax);
  edge('diaphragm', 'performs', node('proc.ventilation', 'process', 'Soluk alıp verme (ventilasyon)', 'Diyafram kasılınca göğüs genişler, basınç düşer ve hava akciğerlere dolar; gevşeyince hava çıkar.'));
  edge('diaphragm', 'innervated_by', node('nerve.phrenic', 'region', 'Frenik sinir (C3–C5)', 'Diyaframı yöneten boyun siniri.', { structure: 'nerves' }));
  adj('diaphragm', 'liver');
  adj('diaphragm', spleen);
  adj(pericardium, 'lungs', 'Perikardın iki yanında plevra ve akciğerler.');

  /* ============================================================ AKCİĞER (derin) */
  const L = 'lungs';
  const lungHilum = node('lungs.hilum', 'region', 'Akciğer kökü (hilus)', 'Ana bronş, pulmoner arter ve venler ile lenf düğümlerinin akciğere girdiği yer.', { structure: 'lungs', part: 'hilum' });
  part(lungHilum, L);
  const airways = node('airways', 'organ', 'Hava yolları', 'Gırtlak, nefes borusu ve dallanan bronşlar: havayı ısıtır, nemlendirir, temizler ve alveollere iletir.', { structure: 'airways' });
  edge(airways, 'belongs_to', 'system:respiratory');
  edge(airways, 'located_in', R.neck);
  edge(airways, 'located_in', R.thorax);
  const trachea = node('airways.trachea', 'region', 'Nefes borusu (trakea)', '~10–12 cm, C biçimli kıkırdak halkalarıyla açık tutulan boru; arkası yemek borusuna komşudur.', { structure: 'airways', part: 'trachea' });
  const mainB = node('airways.main-bronchi', 'region', 'Ana bronşlar', 'Trakeanın sağ ve sol akciğere ayrılan dalları; sağ ana bronş daha dik olduğu için yabancı cisim çoğunlukla sağa kaçar.', { structure: 'airways', part: 'main-bronchi' });
  const lobarB = node('airways.lobar-bronchi', 'region', 'Lob ve segment bronşları', 'Her loba ve segmente giden dallar.', { structure: 'airways', part: 'lobar-bronchi' });
  const bronchioles = node('airways.bronchioles', 'region', 'Bronşiyoller', 'Kıkırdaksız, 1 mm\'den ince hava yolları; düz kas çapını ayarlar (astımda daralır).');
  const respBronch = node('airways.respiratory-bronchioles', 'region', 'Solunum bronşiyolleri ve alveol kanalları', 'Duvarlarında alveol açılmaya başlayan son hava yolları; gaz değişimi bölgesinin girişi.');
  for (const r of [trachea, mainB, lobarB, bronchioles, respBronch]) part(r, airways);
  edge(trachea, 'connected_to', mainB);
  edge(mainB, 'connected_to', lobarB);
  edge(lobarB, 'connected_to', bronchioles);
  edge(bronchioles, 'connected_to', respBronch);
  edge(respBronch, 'connected_to', 'tissue.alveolus');
  edge(mainB, 'connected_to', lungHilum);
  adj(trachea, 'esophagus');
  adj(trachea, 'thyroid', 'Tiroid trakeanın önünü sarar.');
  const respEpi = node('tissue.respiratory-epithelium', 'tissue', 'Solunum epiteli (silli)', 'Silli hücreler ve kadeh hücreleriyle mukus–silya yürüyen bandı: tozu ve mikropları yukarı taşır.');
  made(airways, respEpi);
  const ciliatedResp = node('cell.ciliated-respiratory', 'cell', 'Silli solunum epitel hücresi', 'Her biri ~200 titrek tüyle mukusu dakikada birkaç milimetre yukarı iter.');
  const gobletResp = node('cell.goblet-respiratory', 'cell', 'Hava yolu kadeh hücresi', 'Mikropları ve tozu yakalayan mukusu salgılar.');
  made(respEpi, ciliatedResp, gobletResp);
  const clearance = node('proc.mucociliary-clearance', 'process', 'Mukosiliyer temizlik', 'Mukus partikülleri yakalar, silyalar onu boğaza taşır; sigara silyaları felç eder.');
  does(ciliatedResp, clearance);
  edge(gobletResp, 'produces', 'mol.mucus');
  made('tissue.alveolus', node('tissue.alveolar-wall', 'tissue', 'Alveol duvarı (kan–hava bariyeri)', 'Tip I hücre + ortak bazal zar + kılcal endoteli: toplam ~0,5 µm; gazlar buradan difüzyonla geçer.'));
  const alvCap = node('tissue.alveolar-capillary', 'tissue', 'Alveol kılcalları', 'Her alveolu saran kılcal ağ; alyuvar burada ~0,75 sn içinde oksijenle dolar.');
  made('tissue.alveolar-wall', alvCap, endoCell);
  const pn1 = node('cell.pneumocyte-1', 'cell', 'Tip I pnömosit', 'Alveol yüzeyinin ~%95\'ini örten çok ince yassı hücre; gaz değişim yüzeyi.');
  const pn2 = node('cell.pneumocyte-2', 'cell', 'Tip II pnömosit', 'Sürfaktan üretir; hasarda bölünerek tip I hücreleri yeniler.');
  const alvMac = node('cell.alveolar-macrophage', 'cell', 'Alveol makrofajı', 'Alveollere ulaşan toz ve mikropları temizleyen "toz hücresi".');
  made('tissue.alveolar-wall', pn1, pn2);
  made('tissue.alveolus', alvMac);
  const lamellar = node('sub.lamellar-bodies', 'subcellular', 'Lamellar cisimcikler', 'Tip II hücrede sürfaktanın depolandığı katmanlı paketler.');
  made(pn2, lamellar);
  const surfactant = node('mol.surfactant', 'molecule', 'Sürfaktan', 'Fosfolipid-protein karışımı; alveol yüzey gerilimini düşürür, alveollerin soluk verirken kapanmasını önler.');
  edge(lamellar, 'produces', surfactant);
  edge(pn2, 'produces', surfactant);
  edge(surfactant, 'leads_to', 'proc.gas-exchange', 'Açık kalan alveoller gaz değişimini sürdürür.');
  does(pn1, 'proc.gas-exchange');
  does(alvCap, 'proc.gas-exchange');
  edge('proc.ventilation', 'leads_to', 'proc.gas-exchange');
  edge('proc.gas-exchange', 'leads_to', 'proc.acid-base', 'CO2 atılımı kan pH\'ını belirler.');
  edge('proc.gas-exchange', 'measured_by', 'lab:hemoglobin');
  const pleura = node('lungs.pleura', 'region', 'Plevra (akciğer zarı)', 'Akciğeri saran visseral ve göğüs duvarını döşeyen paryetal yaprak; aralarında birkaç mL kaydırıcı sıvı bulunur. Fazla sıvı plevral efüzyondur.');
  part(pleura, L);
  const pleuralFluid = node('mol.pleural-fluid', 'molecule', 'Plevra sıvısı', 'Normalde her tarafta yalnızca birkaç mL (~0,1–0,3 mL/kg); akciğerin göğüs duvarında kaymasını sağlar.');
  edge(pleura, 'produces', pleuralFluid);
  edge(pleuralFluid, 'leads_to', 'proc.ventilation', 'Yüzey gerilimi akciğeri göğüs duvarına "yapıştırır".');
  edge(L, 'supplied_by', node('vessel.pulmonary-artery', 'region', 'Pulmoner (akciğer) arter', 'Sağ karıncıktan oksijeni azalmış kanı gaz değişimi için akciğerlere taşır.', { structure: 'pulmonary-vessels' }));
  edge(L, 'supplied_by', node('vessel.bronchial-arteries', 'region', 'Bronşiyal arterler', 'Aorttan; hava yolu ve akciğer dokusunun kendisini besler.'));
  edge(L, 'drained_by', node('vessel.pulmonary-veins', 'region', 'Pulmoner venler', 'Oksijenlenmiş kanı sol kulakçığa getirir.', { structure: 'pulmonary-vessels' }));
  edge('vessel.pulmonary-artery', 'connected_to', 'heart.right-ventricle');
  edge('vessel.pulmonary-veins', 'connected_to', 'heart.left-atrium');
  edge(L, 'innervated_by', vagus, 'Bronşları daraltır, mukus salgısını artırır.');
  edge(L, 'develops_from', node('dev.lung-bud', 'region', 'Akciğer tomurcuğu (embriyo)', 'Ön bağırsaktan tomurcuklanır; dallanma doğuma kadar sürer, alveollerin çoğu doğumdan sonra gelişir.'));
  edge('dev.lung-bud', 'develops_from', foregut);
  edge(L, 'functions_with', H, 'Sağ kalp kanı akciğere, akciğer oksijenli kanı sol kalbe gönderir.');
  edge(L, 'functions_with', kid, 'Asit-baz dengesini birlikte korurlar.');

  /* ============================================================ BEYİN (derin) */
  const B = 'brain';
  const cerebrum = node('brain.cerebrum', 'region', 'Uç beyin (serebrum)', 'İki yarıküre: korteks, beyaz cevher ve derin çekirdekler. Düşünme, istemli hareket, duyu, dil, bellek.');
  part(cerebrum, B);
  edge('brain.hemisphere-left', 'part_of', cerebrum);
  edge('brain.hemisphere-right', 'part_of', cerebrum);
  const brainstem = node('brain.brainstem', 'region', 'Beyin sapı', 'Orta beyin, köprü (pons) ve soğancık: solunum, kalp atımı, bilinç, kafa sinirleri, beyinle omurilik arasındaki tüm yollar.');
  part(brainstem, B);
  edge('brain.pons', 'part_of', brainstem);
  for (const [k, tr, sm] of [
    ['midbrain', 'Orta beyin', 'Göz hareketleri, işitsel ve görsel refleksler; dopamin üreten substantia nigra burada.'],
    ['medulla', 'Soğancık (medulla oblongata)', 'Solunum ve dolaşım merkezleri; yutma ve öksürük refleksleri.'],
  ] as const)
    part(node(`brain.${k}`, 'region', tr, sm, { structure: 'brain', part: k }), brainstem);
  const diencephalon = node('brain.diencephalon', 'region', 'Ara beyin', 'Talamus ve hipotalamus: duyu aktarımı, hormonlar, vücut ısısı, açlık-susuzluk, uyku.');
  part(diencephalon, B);
  edge('brain.thalamus', 'part_of', diencephalon);
  const hypothalamus = node('brain.hypothalamus', 'region', 'Hipotalamus', 'Badem büyüklüğünde ama hayati: vücut ısısı, açlık, susuzluk, uyku ritmi ve hipofiz üzerinden tüm hormon eksenleri.', { structure: 'hypothalamus' });
  part(hypothalamus, diencephalon);
  edge(hypothalamus, 'performs', hpo);
  edge(hypothalamus, 'performs', 'proc.thyroid-axis');
  edge(hypothalamus, 'connected_to', node('pituitary', 'organ', 'Hipofiz', 'Hipotalamusun altında, kafatası tabanındaki çukurda; TSH, ACTH, FSH, LH, büyüme hormonu, prolaktin ve ADH salgılar.', { structure: 'pituitary' }), 'Hipofiz sapı ve portal damarlarla.');
  edge('pituitary', 'belongs_to', 'system:endocrine');
  edge('pituitary', 'located_in', R.head);
  edge('pituitary', 'produces', fsh);
  edge('pituitary', 'produces', lh);
  edge('pituitary', 'produces', node('mol.adh', 'molecule', 'ADH (vazopressin)', 'Hipotalamusta üretilip arka hipofizden salınır; böbrekte su kanallarını açar.'));
  edge('mol.adh', 'regulates', aqp2, 'ADH akuaporin-2 kanallarını zara yerleştirir.');
  edge('pituitary', 'performs', 'proc.thyroid-axis');
  edge('pituitary', 'performs', node('proc.hpa-axis', 'process', 'Hipotalamus–hipofiz–böbreküstü (stres) ekseni', 'CRH → ACTH → kortizol: stres yanıtı, kan şekeri ve bağışıklık düzenlenmesi.'));
  edge('proc.hpa-axis', 'measured_by', lab('cortisol', 'Kortizol', 'Stres hormonu; sabah en yüksek.'));
  const limbic = node('brain.limbic', 'region', 'Limbik sistem', 'Hipokampus, amigdala ve singulat girus: bellek, duygu ve motivasyon.');
  part(limbic, cerebrum);
  edge('brain.hippocampus', 'part_of', limbic);
  for (const [k, tr, sm] of [
    ['amygdala', 'Amigdala', 'Korku ve duygusal anıların merkezi.'],
    ['cingulate', 'Singulat girus', 'Duygu, dikkat ve ağrının duygusal boyutu.'],
  ] as const)
    part(node(`brain.${k}`, 'region', tr, sm, { structure: 'brain', part: k }), limbic);
  const cortexLayers = node('tissue.cortical-layers', 'tissue', 'Korteksin altı katmanı', 'Yüzeyden derine I–VI katmanları: girdi alan (IV), çıkış veren (V–VI) ve bağlantı kuran katmanlar; ~2–4 mm kalınlık.');
  made('tissue.gray-matter', cortexLayers);
  made(cortexLayers, node('cell.pyramidal', 'cell', 'Piramidal nöron', 'Korteksin ana uyarıcı çıkış nöronu; uzun aksonlarla uzak bölgelere ve omuriliğe sinyal gönderir.'));
  const meninges = node('brain.meninges', 'region', 'Beyin zarları (meninksler)', 'Dışta sert zar (dura), ortada örümceksi zar (araknoid), içte yumuşak zar (pia); araknoid altında beyin-omurilik sıvısı dolaşır.');
  part(meninges, B);
  made(meninges, node('tissue.dura', 'tissue', 'Dura mater', 'Kafatasına yapışık sert zar; venöz sinüsler içindedir.'), node('tissue.arachnoid', 'tissue', 'Araknoid ve subaraknoid boşluk', 'Beyin-omurilik sıvısı ve büyük beyin damarlarının bulunduğu boşluk; bu boşluğa kanama subaraknoid kanamadır.'), node('tissue.pia', 'tissue', 'Pia mater', 'Beyin yüzeyine sıkıca yapışık ince zar.'));
  const glia = node('tissue.glia', 'tissue', 'Glia (destek hücreleri)', 'Nöronlardan sayıca fazla: besler, yalıtır, korur ve sinapsları düzenler.');
  made('tissue.gray-matter', glia);
  made('tissue.white-matter', glia);
  const astro = node('cell.astrocyte', 'cell', 'Astrosit', 'Kan-beyin bariyerini destekler, sinapslardaki nörotransmitteri temizler, nöronları besler.');
  const microglia = node('cell.microglia', 'cell', 'Mikroglia', 'Beynin bağışıklık hücresi; hasarı ve mikropları temizler.');
  const ependymal = node('cell.ependymal', 'cell', 'Ependim hücresi', 'Ventrikülleri döşer; koroid pleksusta beyin-omurilik sıvısını üretir.');
  made(glia, astro, microglia, 'cell.oligodendrocyte');
  made('brain.ventricles', ependymal);
  does(ependymal, 'proc.csf-circulation');
  const synapse = node('sub.synapse', 'subcellular', 'Sinaps', 'İki nöron arasındaki ~20 nm\'lik bağlantı; kesecikler nörotransmitteri boşluğa salar, karşı hücrenin reseptörleri yanıt verir.');
  const vesicles = node('sub.synaptic-vesicles', 'subcellular', 'Sinaptik kesecikler', 'Nörotransmitter paketleri; kalsiyum girince zara kaynaşıp boşalır.');
  const ionCh = node('sub.ion-channels', 'subcellular', 'İyon kanalları (Na⁺, K⁺, Ca²⁺)', 'Zar potansiyelini değiştirerek aksiyon potansiyelini oluşturan protein kapılar.');
  made('cell.neuron', synapse, ionCh);
  made(synapse, vesicles);
  const neurotransmission = node('proc.neurotransmission', 'process', 'Sinaptik iletim', 'Aksiyon potansiyeli uca ulaşır → kalsiyum girer → nörotransmitter salınır → reseptörler karşı nöronu uyarır ya da baskılar → taşıyıcılar ve astrositler sinyali sonlandırır.');
  does(synapse, neurotransmission);
  does(vesicles, neurotransmission);
  does(ionCh, 'proc.nerve-signal');
  edge('proc.nerve-signal', 'leads_to', neurotransmission);
  edge(neurotransmission, 'produces', 'mol.neurotransmitter');
  edge(astro, 'performs', neurotransmission);
  const bbb = node('proc.blood-brain-barrier', 'process', 'Kan-beyin bariyeri', 'Sıkı bağlantılı beyin kılcalları ve astrosit ayakçıkları, kandaki çoğu maddenin beyne geçişini sınırlar.');
  does(astro, bbb);
  does(endoCell, bbb);
  edge(microglia, 'performs', inflammation);
  const willis = node('vessel.circle-of-willis', 'region', 'Willis halkası ve beyin arterleri', 'İç karotis ve vertebral arterlerin beyin tabanında oluşturduğu halka; ön, orta ve arka beyin arterlerini verir. Anevrizmalar sıklıkla burada gelişir.', { structure: 'carotid-arteries' });
  edge(B, 'supplied_by', willis);
  edge(B, 'drained_by', node('vessel.dural-sinuses', 'region', 'Dural venöz sinüsler', 'Beynin kanını iç juguler venlere taşıyan dura içindeki kanallar.', { structure: 'veins' }));
  edge(B, 'connected_to', node('spinal-cord', 'organ', 'Omurilik', 'Beyin sapından bel omurlarına uzanan sinir demeti; beyinle vücut arasındaki tüm yolların ve refleks merkezlerinin yeri.', { structure: 'spinal-cord' }));
  edge('spinal-cord', 'belongs_to', 'system:nervous');
  edge('spinal-cord', 'located_in', R.neck);
  edge('spinal-cord', 'located_in', R.thorax);
  edge(B, 'develops_from', node('dev.neural-tube', 'region', 'Nöral tüp (embriyo)', 'Ektodermden kapanan tüp; ön ucu beyin, gerisi omurilik olur. Folat eksikliği kapanma kusurlarına yol açabilir.'));
  edge('spinal-cord', 'develops_from', 'dev.neural-tube');
  edge('brain.occipital', 'connected_to', node('eyes', 'organ', 'Gözler', 'Işığı retinada sinir sinyaline çeviren duyu organları; görme yolu arka kafa lobuna ulaşır.', { structure: 'eyes' }), 'Görme yolu.');
  edge('eyes', 'belongs_to', sensory);
  edge('eyes', 'located_in', R.head);
  const retina = node('eyes.retina', 'region', 'Retina (ağ tabaka)', 'Işığa duyarlı çubuk ve koni hücreleriyle gözün iç yüzü; fundus fotoğrafında ve OCT\'de incelenen katman.', { structure: 'eyes', part: 'retina' });
  part(retina, 'eyes');
  made(retina, node('cell.photoreceptor', 'cell', 'Fotoreseptör (çubuk ve koni)', 'Işığı elektrik sinyaline çevirir; koniler renk ve keskin görme, çubuklar loş ışık.'));
  does('cell.photoreceptor', node('proc.phototransduction', 'process', 'Fototransdüksiyon', 'Işık rodopsini değiştirir → kanallar kapanır → hücre hiperpolarize olur → sinyal bipolar ve ganglion hücrelerine geçer.'));
  edge('proc.phototransduction', 'leads_to', 'fn.vision');
  for (const [k, tr] of [['macula', 'Sarı nokta (makula) ve fovea'], ['optic-disc', 'Optik disk (kör nokta)']] as const) part(node(`eyes.${k}`, 'region', tr, k === 'macula' ? 'Keskin ve renkli görmenin merkezi; konilerin en yoğun olduğu yer.' : 'Görme sinirinin gözden çıktığı ve damarların girdiği nokta; glokomda çukurluğu büyür.', { structure: 'eyes', part: k }), retina);
  edge('eyes', 'develops_from', 'dev.neural-tube', 'Retina beyin dokusunun bir uzantısıdır.');
  adj('eyes', B);

  /* ============================================================ PANKREAS ↔ insülin ↔ hedef dokular (çapraz organ) */
  const muscle = node('skeletal-muscle', 'organ', 'İskelet kasları', 'İstemli hareket; vücut ağırlığının ~%40\'ı. İnsülinle kandan en çok glukoz alan doku.', { structure: 'skeletal-muscle' });
  edge(muscle, 'belongs_to', 'system:musculoskeletal');
  edge(muscle, 'located_in', R.limbs);
  const myocyte = node('cell.skeletal-myocyte', 'cell', 'İskelet kası lifi', 'Çok çekirdekli uzun hücre; sarkomerlerle kasılır.');
  made(muscle, myocyte);
  made(myocyte, node('sub.glut4', 'subcellular', 'GLUT4 glukoz taşıyıcıları', 'İnsülin ya da egzersizle hücre zarına taşınıp glukozu içeri alır.'));
  made(myocyte, sarcomere);
  edge('sub.glut4', 'performs', 'proc.glucose-uptake');
  edge('mol.insulin', 'regulates', 'sub.glut4', 'İnsülin GLUT4\'ü zara taşır.');
  edge(myocyte, 'measured_by', 'lab:ck');
  const adipose = node('adipose', 'organ', 'Yağ dokusu', 'Enerjiyi trigliserid olarak depolar; leptin, adiponektin gibi hormonlar salgılar. İnsülin yağ yıkımını frenler.', );
  edge(adipose, 'belongs_to', 'system:endocrine');
  const adipocyte = node('cell.adipocyte', 'cell', 'Yağ hücresi (adiposit)', 'İçi büyük bir yağ damlasıyla dolu hücre.');
  made(adipose, adipocyte);
  made(adipocyte, 'sub.glut4');
  edge(adipocyte, 'performs', node('proc.lipid-storage', 'process', 'Yağ depolama ve yıkımı (lipogenez–lipoliz)', 'Toklukta insülinle trigliserid depolanır; açlıkta yağ asitleri kana verilir.'));
  edge('mol.insulin', 'regulates', 'proc.lipid-storage');
  edge('proc.lipid-storage', 'measured_by', 'lab:triglyceride');
  edge('pancreas', 'functions_with', muscle, 'İnsülin kasın glukoz almasını sağlar.');
  edge('pancreas', 'functions_with', adipose, 'İnsülin yağ depolanmasını yönetir.');
  edge('pancreas', 'functions_with', 'liver', 'İnsülin–glukagon dengesi karaciğerin glukoz üretimini belirler.');
  adj('pancreas', kid, 'Sol böbreğin önünde.');

  /* ============================================================ Diğer bölge üyelikleri */
  for (const [o, r] of [['gallbladder', R.abdomen], ['spleen', R.abdomen], ['urinary-tract', R.pelvis], ['airways', R.thorax], [ear, R.head], ['adipose', R.abdomen]] as const) if (!E.some((e) => e.from === o && e.to === r && e.rel === 'located_in')) edge(o, 'located_in', r);
}
