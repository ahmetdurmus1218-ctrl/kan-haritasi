import type { SceneContent } from '../content';

/**
 * Nöron ve sinaps sahnesinin eğitim içeriği. Genel biyoloji bilgisidir; kişinin sinir dokusundan
 * bir bulgu değildir.
 */
const content: SceneContent = {
  tests: ['sodium', 'potassium', 'calcium', 'magnesium', 'b12', 'glucose'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin sinir dokunu göstermez. Sodyum, potasyum, kalsiyum ve B12 değerlerinin sahnedeki etkileri (iyon ve vezikül sayısı, miyelin kalınlığı) farkı görünür kılmak için basitleştirilmiş ve abartılmıştır. Tek bir kan değeri sinirlerinin nasıl çalıştığını göstermez; belirtiler ve sonuçlar hekimle birlikte değerlendirilmelidir.',
  stages: [
    {
      title: 'Sinir dokusu',
      text: 'Sinir dokusu, sinyal ileten nöronlardan ve onları destekleyen glia hücrelerinden oluşur. Her nöronun bir gövdesi (soma), sinyal toplayan dendritleri ve sinyali uzağa taşıyan tek bir aksonu vardır. Sahnedeki iyon ve vezikül yoğunlukları ile miyelin kalınlığı senin değerlerine göre ayarlanır.',
    },
    {
      title: 'Dinlenim potansiyeli',
      text: 'Dinlenen nöronda sodyum (Na⁺, sarı) çoğunlukla hücre dışında, potasyum (K⁺, mor) hücre içindedir. Zardaki sodyum-potasyum pompaları enerji (ATP) harcayarak bu farkı korur; böylece hücre içi, dışına göre negatif yüklü kalır (yaklaşık −70 mV).',
    },
    {
      title: 'Aksiyon potansiyeli',
      text: 'Uyarı eşiği aşılınca aksonun başındaki sodyum kanalları açılır ve Na⁺ içeri akar; zar kısa süreliğine pozitifleşir. Hemen ardından potasyum kanalları açılır, K⁺ dışarı çıkar ve zar eski haline döner. Bu elektrik dalgası akson boyunca ilerler.',
    },
    {
      title: 'Miyelin ve sıçramalı iletim',
      text: 'Miyelin, aksonu saran yağdan zengin bir yalıtım kılıfıdır. Sinyal yalnızca kılıfların arasındaki Ranvier boğumlarında yeniden üretilir ve boğumdan boğuma “sıçrar”. Bu, arkadaki ince miyelinsiz aksondaki kesintisiz iletimden çok daha hızlıdır.',
    },
    {
      title: 'Sinaps',
      text: 'Sinyal akson ucuna ulaşınca kalsiyum (Ca²⁺) kanalları açılır. İçeri giren kalsiyum, nörotransmitter dolu veziküllerin zarla kaynaşmasını tetikler; nörotransmitter sinaptik aralığa boşalır ve karşıdaki hücrenin reseptörlerine bağlanır. Fazlası geri alınır ya da parçalanır.',
    },
    {
      title: 'Sinyal bir sonraki hücrede',
      text: 'Reseptörlere bağlanan nörotransmitter, karşı hücrenin zarında küçük bir gerilim değişikliği oluşturur. Nöron binlerce sinapstan gelen bu sinyalleri toplar; eşik aşılırsa kendi aksiyon potansiyelini üretir ve sinyal yoluna devam eder.',
    },
  ],
  objects: {
    soma: {
      name: 'Nöron gövdesi (soma)',
      text: 'Çekirdeği ve protein yapım düzeneğini taşıyan bölüm. Dendritlerden gelen sinyaller burada toplanır; aksonun çıktığı yerde (akson tepeciği) aksiyon potansiyeli başlar.',
      size: 'yaklaşık 10–100 mikrometre',
    },
    dendrite: {
      name: 'Dendrit',
      text: 'Gövdeden ağaç gibi dallanan kısa uzantılar. Başka nöronlardan gelen sinyalleri sinapslar aracılığıyla alır.',
    },
    axon: {
      name: 'Akson',
      text: 'Sinyali gövdeden uzağa taşıyan tek uzun uzantı; bazıları 1 metreyi aşar. Zarındaki voltaja duyarlı kanallar aksiyon potansiyelini oluşturur. Turuncu sodyum-potasyum pompaları ATP harcayarak her döngüde 3 Na⁺ iyonunu dışarı, 2 K⁺ iyonunu içeri taşır.',
      size: 'çapı yaklaşık 0,2–20 mikrometre',
    },
    myelin: {
      name: 'Miyelin kılıf',
      text: 'Glia hücresi zarının aksonun çevresine defalarca sarılmasıyla oluşan yalıtım katmanı. Beyin ve omurilikte oligodendrositler, çevresel sinirlerde Schwann hücreleri yapar. B12 vitamini sinir sistemi ve miyelin sağlığı için gereklidir; uzun süreli ciddi B12 eksikliği miyelini etkileyebilir. Sahnede B12 değerin düşükse miyelin temsili olarak inceltilir.',
    },
    node: {
      name: 'Ranvier boğumu',
      text: 'Miyelin kılıfları arasındaki kısa, açık akson bölümü. Sodyum kanalları burada yoğundur; sinyal her boğumda yeniden üretilir.',
      size: 'yaklaşık 1 mikrometre',
    },
    synapse: {
      name: 'Sinaps',
      text: 'Akson ucu (sinaptik düğme), dar sinaptik aralık ve karşı hücrenin zarından oluşan bağlantı noktası. Bir nöron binlerce sinaps kurabilir.',
      size: 'aralık yaklaşık 20–40 nanometre',
    },
    vesicle: {
      name: 'Sinaptik vezikül',
      text: 'Nörotransmitter depolayan küçük zar kesecikleri. Kalsiyum girişiyle zara kaynaşıp içeriğini boşaltır, sonra geri dönüştürülür. Sahnede bir sinyalde boşalan vezikül sayısı kalsiyum değerine göre ayarlanır (temsili).',
      size: 'yaklaşık 40 nanometre',
    },
    transmitter: {
      name: 'Nörotransmitter',
      text: 'Sinyali bir hücreden diğerine taşıyan kimyasal haberci (ör. glutamat, GABA, asetilkolin, dopamin). Reseptöre bağlandıktan sonra geri alınır ya da parçalanır.',
    },
    receptor: {
      name: 'Reseptör',
      text: 'Karşı hücrenin zarında nörotransmitteri tanıyan protein. Bir kısmı iyon kanalıdır ve bağlanınca açılır. Magnezyum, bazı glutamat reseptörlerini (NMDA) dinlenimde kısmen tıkayarak düzenlemeye katkıda bulunur.',
    },
    sodium: {
      name: 'Sodyum iyonu (Na⁺)',
      text: 'Hücre dışında yüksek, içinde düşüktür. Aksiyon potansiyelinde içeri akarak zarı pozitifleştirir. Kan tahlilindeki sodyum hücre dışı sıvıdaki düzeyi gösterir; sahnede hücre dışındaki sarı iyonların sayısı senin değerine göre ayarlanır (fark görünsün diye abartılmıştır).',
    },
    potassium: {
      name: 'Potasyum iyonu (K⁺)',
      text: 'Hücre içinde yüksek, dışında düşüktür; dışarı çıkışı zarı dinlenim durumuna döndürür. Kan tahlilindeki potasyum hücre DIŞINDAKİ düzeyi gösterir. Bu düzey dinlenim potansiyelini etkilediği için çok düşük ya da çok yüksek değerler sinir ve kas hücrelerinin (kalp dahil) uyarılabilirliğini değiştirebilir. Sahnede hücre dışındaki mor iyonların sayısı senin değerine göre ayarlanır.',
    },
    calcium: {
      name: 'Kalsiyum iyonu (Ca²⁺)',
      text: 'Akson ucuna giren kalsiyum veziküllerin boşalmasını tetikler. Kandaki kalsiyumun çok düşük ya da çok yüksek olması sinir ve kasların uyarılabilirliğini farklı yollarla etkileyebilir. Sahnede kalsiyum iyonlarının ve bir sinyalde boşalan veziküllerin sayısı senin değerine göre ayarlanır (temsili).',
    },
    astrocyte: {
      name: 'Astrosit',
      text: 'Yıldız biçimli glia hücresi. Sinapsları sarar, ortamdaki fazla nörotransmitteri ve potasyumu temizler, kılcal damarlardan aldığı glukozla nöronlara enerji desteği sağlar. Beyin, yakıt olarak büyük ölçüde glukoz kullanır.',
    },
    oligodendrocyte: {
      name: 'Oligodendrosit',
      text: 'Beyin ve omurilikte miyelin yapan glia hücresi; uzantılarıyla birden çok aksonu sarabilir. Çevresel sinirlerde bu işi Schwann hücreleri yapar.',
    },
  },
};

export default content;
