import type { SceneContent } from '../content';

/**
 * Retina sahnesinin eğitim içeriği. Genel biyoloji bilgisidir; kişinin gözünden bir bulgu değildir.
 */
const content: SceneContent = {
  tests: ['glucose', 'hba1c'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin gözünü göstermez. Uzun süre yüksek seyreden kan şekeri ve kan basıncı retina damarlarını etkileyebilir, ancak tek bir glukoz ya da HbA1c değeri retinanda ne olduğunu göstermez. Retinanın durumu yalnızca göz muayenesiyle (göz dibi incelemesi) değerlendirilebilir.',
  stages: [
    {
      title: 'Işık retinaya ulaşır',
      text: 'Kornea ve mercekten geçen ışık gözün arkasındaki retinaya odaklanır. Retina, ışığı sinir sinyaline çeviren ince bir doku katmanıdır. Sahnedeki kılcallarda görünen glukoz ve sarımsı (glikozillenmiş) alyuvar oranı senin değerlerine göre ayarlanır.',
    },
    {
      title: 'Retina katmanları',
      text: 'Işık önce saydam iç katmanlardan, yani gangliyon ve bipolar hücrelerden geçer; ışığı algılayan çubuk ve koniler en dıştadır. Onların arkasındaki koyu pigment epiteli fazla ışığı emer ve fotoreseptörleri besleyip yeniler.',
    },
    {
      title: 'Çubuklar ve koniler',
      text: 'Çubuklar çok hassastır ve loş ışıkta görmeyi sağlar, ama renk ayırt etmez. Koniler parlak ışıkta çalışır; kısa (S), orta (M) ve uzun (L) dalga boylarına duyarlı üç türün sinyalleri karşılaştırılarak renk algılanır. Sarı noktanın çukurunda (fovea) yalnızca sık diziliş koniler vardır.',
    },
    {
      title: 'Fototransdüksiyon',
      text: 'Işık, çubukların dış segmentindeki disklerde bulunan rodopsine (konilerde opsinlere) çarpınca pigmentin biçimi değişir. Hücre içi bir sinyal zinciri iyon kanallarını kapatır ve hücrenin gerilimi değişir. Bu değişim bipolar hücreler üzerinden gangliyon hücrelerine iletilir.',
    },
    {
      title: 'Görme siniri',
      text: 'Gangliyon hücreleri aksiyon potansiyeli üretir. Aksonları retinanın iç yüzeyinde toplanır ve optik diskte gözü terk ederek görme sinirini oluşturur. Optik diskte fotoreseptör olmadığı için orası kör noktadır; beyin bu boşluğu fark ettirmez.',
    },
    {
      title: 'Retina damarları',
      text: 'İç katmanları görme sinirinden giren retina damarları, fotoreseptörleri ise arkadaki koroid damarları besler. Foveanın merkezi damarsızdır. Uzun süre yüksek seyreden kan şekeri ve kan basıncı bu küçük damarların duvarını etkileyebilir; bu yüzden diyabette düzenli göz muayenesi önerilir.',
    },
  ],
  objects: {
    photon: {
      name: 'Işık (foton)',
      text: 'Işığın en küçük enerji paketi. Görünür ışık farklı dalga boylarında gelir; sahnede fotonun rengi en çok uyardığı hücre türünü temsil eder (mavimsi: çubuk ya da S konisi, yeşil: M, kırmızı: L).',
    },
    rod: {
      name: 'Çubuk hücresi',
      text: 'Loş ışıkta görmeyi sağlayan çok hassas fotoreseptör. Dış segmentinde üst üste dizilmiş, rodopsin taşıyan yüzlerce zar diski vardır. Renk ayırt etmez; retinada konilerden çok daha fazladır.',
      size: 'çapı yaklaşık 2 mikrometre',
    },
    cone: {
      name: 'Koni hücresi',
      text: 'Parlak ışıkta keskin ve renkli görmeyi sağlayan fotoreseptör. S (mavi), M (yeşil) ve L (kırmızı) türleri farklı dalga boylarına en duyarlıdır. Foveada en sıktır.',
      size: 'çapı yaklaşık 2–6 mikrometre',
    },
    bipolar: {
      name: 'Bipolar hücre',
      text: 'Fotoreseptörlerden gelen sinyali gangliyon hücrelerine aktaran ara nöron. Işığın açılıp kapanmasına ve kenarlara duyarlı sinyaller üretmeye katkıda bulunur.',
    },
    ganglion: {
      name: 'Gangliyon hücresi',
      text: 'Retinanın çıkış hücresi. Bipolar hücrelerden gelen sinyalleri toplar, aksiyon potansiyeli üretir ve aksonuyla beyne gönderir.',
    },
    nerve: {
      name: 'Görme siniri',
      text: 'Yaklaşık 1 milyon gangliyon hücresi aksonunun oluşturduğu sinir. Retinanın optik disk denen noktasından çıkar; burada fotoreseptör olmadığından kör nokta oluşur.',
    },
    rpe: {
      name: 'Retina pigment epiteli',
      text: 'Fotoreseptörlerin arkasındaki koyu hücre sırası. Fazla ışığı emer, eskiyen disk uçlarını yutar, görsel pigmentin yenilenmesine yardım eder ve fotoreseptörleri koroidden gelen besinlerle destekler.',
    },
    capillary: {
      name: 'Retina kılcalları',
      text: 'Retinanın iç katmanlarını besleyen ince damarlar; görme sinirinin içinden gelen damarlardan dallanır. Göz dibi muayenesinde vücutta damarların doğrudan görülebildiği ender yerlerdendir.',
    },
    choroid: {
      name: 'Koroid',
      text: 'Pigment epitelinin arkasındaki damardan zengin katman. Retinanın dış katmanlarını, yani çubuk ve konileri oksijen ve besinle besler.',
    },
    rbc: {
      name: 'Alyuvar (HbA1c)',
      text: 'Kandaki glukoz alyuvardaki hemoglobine yavaşça yapışır (glikozillenme). HbA1c bunun oranını ölçer ve son 2–3 ayın ortalama kan şekerini yansıtır. Sarımsı alyuvarlar bu oranı temsil eder (abartılı ölçek).',
    },
    glucose: {
      name: 'Glukoz',
      text: 'Retina, vücudun enerji tüketimi en yüksek dokularındandır ve glukozu yoğun kullanır. Sahnedeki glukoz molekülü sayısı senin değerine göre ayarlanır.',
    },
    macula: {
      name: 'Sarı nokta (makula) ve fovea',
      text: 'Retinanın merkezindeki keskin görme bölgesi. Sarı pigment içerir; ortasındaki çukurda (fovea) iç katmanlar yana itilmiştir, ışık doğrudan sık dizilmiş konilere ulaşır.',
    },
  },
};

export default content;
