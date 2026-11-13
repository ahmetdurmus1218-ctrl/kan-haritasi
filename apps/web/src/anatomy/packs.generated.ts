// Otomatik üretildi (assets-pipeline/build-anatomy.ts → zanatomy-packs.ts). Elle düzenlemeyin.
// Resmi anatomi paketleri: kurulumda paketteki model.glb'nin SHA-256 özeti buradakiyle eşleşmelidir.
export const PACK_ALIGNMENT = {"pairs":72,"meanResidualMm":4.37,"maxResidualMm":21.15} as const;

export const PACK_INDEX = [
 {
  "id": "kaslar",
  "body": "male",
  "title": "Kaslar, tendonlar ve fasyalar",
  "summary": "Tek tek iskelet kasları (tendonlarıyla), fasyalar, bursalar ve tendon kılıfları. Temel modeldeki 15 bölgesel kas parçasının yerini alır.",
  "file": "anatomi-kaslar-erkek.khpack",
  "sha256": "9756e1920e964e4cc05e544f1d4056b37aea6d9c8cdf81906cb06101bd7f057f",
  "bytes": 4511848,
  "packBytes": 4514826,
  "triangles": 520120,
  "elements": 664,
  "structures": {
   "skeletal-muscle": 664
  },
  "replaces": [
   "skeletal-muscle"
  ],
  "schematicReplaced": [],
  "adapted": false
 },
 {
  "id": "eklemler",
  "body": "male",
  "title": "Eklemler ve bağlar",
  "summary": "Eklem kapsülleri, bağlar, eklem diskleri ve zarlar (kafatası, omurga, göğüs, kol, bacak, gırtlak). Diz bağları ve menisküsler temel modelde (HRA) kalır.",
  "file": "anatomi-eklemler-erkek.khpack",
  "sha256": "7043b0b4c9d0a680a6d50ebd24062487e36cb99a7bcfa5697e603755c1f2c343",
  "bytes": 1424352,
  "packBytes": 1427298,
  "triangles": 138663,
  "elements": 345,
  "structures": {
   "joints": 345
  },
  "replaces": [],
  "schematicReplaced": [],
  "adapted": false
 },
 {
  "id": "sinirler",
  "body": "male",
  "title": "Sinirler",
  "summary": "Kafa sinirleri (I–XII ve dalları), boyun, kol (brakiyal pleksus) ve bel-sakral pleksus sinirleri, sempatik zincir, spinal ganglionlar ve beyin-omurilik zarları. Temel modeldeki şematik sinir tüplerinin yerini alır.",
  "file": "anatomi-sinirler-erkek.khpack",
  "sha256": "4850b90c30863679bcc37586d4741add85d738d4f80746b2172347c52b0ddc7d",
  "bytes": 2122672,
  "packBytes": 2125948,
  "triangles": 259795,
  "elements": 265,
  "structures": {
   "nerves": 259,
   "brain": 5,
   "spinal-cord": 1
  },
  "replaces": [
   "nerves"
  ],
  "schematicReplaced": [],
  "adapted": false
 },
 {
  "id": "damarlar",
  "body": "male",
  "title": "Kol, bacak, baş-boyun ve gövde duvarı damarları",
  "summary": "Kol ve bacağın atardamar ve toplardamarları (el ve ayak dallarına kadar), dış ve iç karotis dalları, vertebral arter, Willis halkası, dural venöz sinüsler, gövde duvarı ve pelvis damarları. Temel modeldeki şematik kol/bacak damarlarının yerini alır; kalp ve ana gövde damarları temel modelde (HRA) kalır.",
  "file": "anatomi-damarlar-erkek.khpack",
  "sha256": "ccda85b7afb8af36fc294a233189a092cc84776f6a6ad172b3b5b3309b668cf7",
  "bytes": 3095324,
  "packBytes": 3098592,
  "triangles": 331519,
  "elements": 534,
  "structures": {
   "abdominal-vessels": 110,
   "carotid-arteries": 166,
   "limb-vessels": 209,
   "veins": 49
  },
  "replaces": [
   "limb-vessels"
  ],
  "schematicReplaced": [],
  "adapted": false
 },
 {
  "id": "lenf",
  "body": "male",
  "title": "Lenf düğümleri",
  "summary": "Baş, boyun, koltuk altı ve kol, göğüs, karın, pelvis ve bacaktaki adlandırılmış lenf düğümü grupları. Lenf damarları (toraks kanalı vb.) hiçbir açık kaynakta model olarak yok.",
  "file": "anatomi-lenf-erkek.khpack",
  "sha256": "3e95ffa696a9721f6130307e782ad60687706c6459a15e6c39f9be9018179f6f",
  "bytes": 687516,
  "packBytes": 690487,
  "triangles": 72544,
  "elements": 158,
  "structures": {
   "lymph-node": 158
  },
  "replaces": [],
  "schematicReplaced": [],
  "adapted": false
 },
 {
  "id": "bas-boyun",
  "body": "male",
  "title": "Baş-boyun: ağız, dişler, yutak, burun, tiroid, kulak",
  "summary": "Dil, damak, dişeti, tükürük bezleri, 28 diş, yutak, burun boşluğu ve sinüsler, gırtlak kıkırdakları, tiroid ve paratiroid bezleri, kulak kepçesi, kulak zarı, kulak kemikçikleri ve Östaki borusu. Şematik tiroidin ve kulağın dış/orta kısmının yerini alır; iç kulak (koklea, vestibül) lisans nedeniyle şematik kalır.",
  "file": "anatomi-bas-boyun-erkek.khpack",
  "sha256": "7faedcb90f556796e416d6253f4432e61b454ce99c56bf0f0d45f338ac40997e",
  "bytes": 1208676,
  "packBytes": 1212001,
  "triangles": 164200,
  "elements": 124,
  "structures": {
   "mouth": 19,
   "thyroid": 5,
   "airways": 20,
   "bones": 28,
   "ear": 52
  },
  "replaces": [],
  "schematicReplaced": [
   "thyroid",
   "ear:canal",
   "ear:eardrum",
   "ear:ossicles"
  ],
  "adapted": false
 },
 {
  "id": "kaslar",
  "body": "female",
  "title": "Kaslar, tendonlar ve fasyalar",
  "summary": "Tek tek iskelet kasları (tendonlarıyla), fasyalar, bursalar ve tendon kılıfları. Temel modeldeki 15 bölgesel kas parçasının yerini alır.",
  "file": "anatomi-kaslar-kadin.khpack",
  "sha256": "fe4a39d47612a0d1bdecda86859874629b6ba34799306e2ba7c9814fc51f28a0",
  "bytes": 4536100,
  "packBytes": 4539434,
  "triangles": 520311,
  "elements": 664,
  "structures": {
   "skeletal-muscle": 664
  },
  "replaces": [
   "skeletal-muscle"
  ],
  "schematicReplaced": [],
  "adapted": true
 },
 {
  "id": "eklemler",
  "body": "female",
  "title": "Eklemler ve bağlar",
  "summary": "Eklem kapsülleri, bağlar, eklem diskleri ve zarlar (kafatası, omurga, göğüs, kol, bacak, gırtlak). Diz bağları ve menisküsler temel modelde (HRA) kalır.",
  "file": "anatomi-eklemler-kadin.khpack",
  "sha256": "b842eec2fb851af1fc266328508a68f602fcf365c718d826142659929e3701db",
  "bytes": 1439176,
  "packBytes": 1442478,
  "triangles": 139451,
  "elements": 345,
  "structures": {
   "joints": 345
  },
  "replaces": [],
  "schematicReplaced": [],
  "adapted": true
 },
 {
  "id": "sinirler",
  "body": "female",
  "title": "Sinirler",
  "summary": "Kafa sinirleri (I–XII ve dalları), boyun, kol (brakiyal pleksus) ve bel-sakral pleksus sinirleri, sempatik zincir, spinal ganglionlar ve beyin-omurilik zarları. Temel modeldeki şematik sinir tüplerinin yerini alır.",
  "file": "anatomi-sinirler-kadin.khpack",
  "sha256": "8c66f0d7e1c912f3cc742a091781d22418dcc6fc85be10a8629d2bd3cc273641",
  "bytes": 2123760,
  "packBytes": 2127392,
  "triangles": 259730,
  "elements": 265,
  "structures": {
   "nerves": 259,
   "brain": 5,
   "spinal-cord": 1
  },
  "replaces": [
   "nerves"
  ],
  "schematicReplaced": [],
  "adapted": true
 },
 {
  "id": "damarlar",
  "body": "female",
  "title": "Kol, bacak, baş-boyun ve gövde duvarı damarları",
  "summary": "Kol ve bacağın atardamar ve toplardamarları (el ve ayak dallarına kadar), dış ve iç karotis dalları, vertebral arter, Willis halkası, dural venöz sinüsler, gövde duvarı ve pelvis damarları. Temel modeldeki şematik kol/bacak damarlarının yerini alır; kalp ve ana gövde damarları temel modelde (HRA) kalır.",
  "file": "anatomi-damarlar-kadin.khpack",
  "sha256": "0d5bdfcc02c724381f9cf81da3e74d07d901468af8eb153fcfa5ac1b0ad25e4e",
  "bytes": 3104520,
  "packBytes": 3108144,
  "triangles": 332095,
  "elements": 534,
  "structures": {
   "abdominal-vessels": 110,
   "carotid-arteries": 166,
   "limb-vessels": 209,
   "veins": 49
  },
  "replaces": [
   "limb-vessels"
  ],
  "schematicReplaced": [],
  "adapted": true
 },
 {
  "id": "lenf",
  "body": "female",
  "title": "Lenf düğümleri",
  "summary": "Baş, boyun, koltuk altı ve kol, göğüs, karın, pelvis ve bacaktaki adlandırılmış lenf düğümü grupları. Lenf damarları (toraks kanalı vb.) hiçbir açık kaynakta model olarak yok.",
  "file": "anatomi-lenf-kadin.khpack",
  "sha256": "9bc169e2b31a970f9153d9a125b1813f01cbbba57b6b3254703e8af233ae49a9",
  "bytes": 701608,
  "packBytes": 704935,
  "triangles": 72372,
  "elements": 158,
  "structures": {
   "lymph-node": 158
  },
  "replaces": [],
  "schematicReplaced": [],
  "adapted": true
 },
 {
  "id": "bas-boyun",
  "body": "female",
  "title": "Baş-boyun: ağız, dişler, yutak, burun, tiroid, kulak",
  "summary": "Dil, damak, dişeti, tükürük bezleri, 28 diş, yutak, burun boşluğu ve sinüsler, gırtlak kıkırdakları, tiroid ve paratiroid bezleri, kulak kepçesi, kulak zarı, kulak kemikçikleri ve Östaki borusu. Şematik tiroidin ve kulağın dış/orta kısmının yerini alır; iç kulak (koklea, vestibül) lisans nedeniyle şematik kalır.",
  "file": "anatomi-bas-boyun-kadin.khpack",
  "sha256": "fedc9a7b61e1cb43444a2a236f04dd60464b13e4879c7e6075289e40f191956f",
  "bytes": 1216552,
  "packBytes": 1220233,
  "triangles": 164200,
  "elements": 124,
  "structures": {
   "mouth": 19,
   "thyroid": 5,
   "airways": 20,
   "bones": 28,
   "ear": 52
  },
  "replaces": [],
  "schematicReplaced": [
   "thyroid",
   "ear:canal",
   "ear:eardrum",
   "ear:ossicles"
  ],
  "adapted": true
 }
] as const;
