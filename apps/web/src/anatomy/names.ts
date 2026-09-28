import { partDef } from '@kh/catalog';

/** Damar düğüm adlarının (HRA, İngilizce) Türkçe karşılıkları; bilinmeyenler İngilizce gösterilir. */
const EXACT: Record<string, string> = {
  'ascending aorta': 'Çıkan aort',
  'aortic arch': 'Aort kavsi',
  'descending aorta a': 'İnen aort (göğüs)',
  'descending aorta b': 'İnen aort (karın)',
  'left coronary artery': 'Sol koroner arter',
  'right coronary artery': 'Sağ koroner arter',
  'left anterior descending artery': 'Sol ön inen arter (LAD)',
  'right posterior descending artery': 'Arka inen arter',
  'right marginal artery': 'Sağ marjinal arter',
  'left marginal branch': 'Sol marjinal dal',
  'diagonal branch of left anterior descending artery': 'Diyagonal dal',
  'diagonal branch of anterior descending branch of left coronary artery': 'Diyagonal dal',
  'pulmonary trunk': 'Pulmoner gövde',
  'pulmonary artery L': 'Sol akciğer atardamarı',
  'pulmonary artery R': 'Sağ akciğer atardamarı',
  'superior vena cava': 'Üst ana toplardamar',
  'inferior vena cava a': 'Alt ana toplardamar',
  'inferior vena cava b': 'Alt ana toplardamar',
  'left common carotid artery a': 'Sol ortak şah damarı',
  'left common carotid artery b': 'Sol ortak şah damarı',
  'brachiocephalic artery a': 'Brakiyosefalik arter',
  'brachiocephalic artery b': 'Brakiyosefalik arter',
  'left subclavian artery a': 'Sol köprücükaltı arter',
  'left subclavian artery b': 'Sol köprücükaltı arter',
  'celiac trunk': 'Çölyak gövde',
  'superior mesenteric artery': 'Üst mezenter arter',
  'inferior mesenteric artery': 'Alt mezenter arter',
  'superior mesenteric vein': 'Üst mezenter ven',
  'inferior mesenteric vein': 'Alt mezenter ven',
  'splenic artery': 'Dalak atardamarı',
  'splenic vein': 'Dalak toplardamarı',
  'left renal artery': 'Sol böbrek atardamarı',
  'right renal artery': 'Sağ böbrek atardamarı',
  'renal vein L': 'Sol böbrek toplardamarı',
  'renal vein R': 'Sağ böbrek toplardamarı',
  'common hepatic artery': 'Ortak karaciğer atardamarı',
  'proper hepatic artery': 'Karaciğer atardamarı',
  'coronary sinus': 'Koroner sinüs',
  'right subclavian artery': 'Sağ köprücükaltı arter',
  'left subclavian artery': 'Sol köprücükaltı arter',
  'right common carotid artery': 'Sağ ortak şah damarı',
  'right common iliac artery': 'Sağ ortak iliak arter',
  'left common iliac artery': 'Sol ortak iliak arter',
  'right external iliac artery': 'Sağ dış iliak arter',
  'left external iliac artery': 'Sol dış iliak arter',
  'right internal iliac artery': 'Sağ iç iliak arter',
  'left internal iliac artery': 'Sol iç iliak arter',
  'right internal jugular vein': 'Sağ iç şah toplardamarı (juguler ven)',
  'left internal jugular vein': 'Sol iç şah toplardamarı (juguler ven)',
  'right subclavian vein': 'Sağ köprücükaltı ven',
  'left subclavian vein': 'Sol köprücükaltı ven',
  'great cardiac vein': 'Büyük kalp toplardamarı',
  'middle cardiac vein': 'Orta kalp toplardamarı',
  'small cardiac vein': 'Küçük kalp toplardamarı',
  'anterior cardiac vein': 'Ön kalp toplardamarı',
  'posterior vein of left ventricle': 'Sol karıncık arka toplardamarı',
  'oblique vein of left atrium': 'Sol kulakçık eğik toplardamarı',
  'marginal artery of Drummond': 'Drummond marjinal arteri (kalın bağırsak)',
  'pulmonary vein R inf': 'Sağ alt akciğer toplardamarı',
  'pulmonary vein R sup': 'Sağ üst akciğer toplardamarı',
  'pulmonary vein L inf': 'Sol alt akciğer toplardamarı',
  'pulmonary vein L sup': 'Sol üst akciğer toplardamarı',
  'brachiocephalic vein L': 'Sol brakiyosefalik ven',
  'brachiocephalic vein R': 'Sağ brakiyosefalik ven',
  'common iliac vein L': 'Sol ortak iliak ven',
  'common iliac vein R': 'Sağ ortak iliak ven',
  'external iliac vein L': 'Sol dış iliak ven',
  'external iliac vein R': 'Sağ dış iliak ven',
  'internal iliac vein L': 'Sol iç iliak ven',
  'internal iliac vein R': 'Sağ iç iliak ven',
  'portal vein': 'Kapı toplardamarı (portal ven)',
  'hepatic portal vein': 'Kapı toplardamarı (portal ven)',
  'left branch of portal vein': 'Portal venin sol dalı',
  'right branch of portal vein': 'Portal venin sağ dalı',
  'right hepatic vein': 'Sağ karaciğer toplardamarı',
  'left hepatic vein': 'Sol karaciğer toplardamarı',
  'middle hepatic vein': 'Orta karaciğer toplardamarı',
  'left hepatic artery': 'Sol karaciğer atardamarı',
  'right hepatic artery': 'Sağ karaciğer atardamarı',
  'anterior segmental right hepatic artery': 'Sağ karaciğer atardamarı (ön segment)',
  'posterior segmental right hepatic artery': 'Sağ karaciğer atardamarı (arka segment)',
  'middle hepatic artery branch of left hepatic artery': 'Orta karaciğer atardamarı dalı',
  'cystic artery': 'Safra kesesi atardamarı',
  'cystic vein': 'Safra kesesi toplardamarı',
  'ileocolic artery': 'İleokolik arter',
  'ileocolic vein': 'İleokolik ven',
  'right colic artery': 'Sağ kolik arter',
  'middle colic artery': 'Orta kolik arter',
  'left colic artery': 'Sol kolik arter',
  'right colic vein': 'Sağ kolik ven',
  'middle colic vein': 'Orta kolik ven',
  'left colic vein': 'Sol kolik ven',
  'sigmoid vein': 'Sigmoid ven',
  'superior rectal vein': 'Üst rektal ven',
  'median sacral vein': 'Orta sakral ven',
  'inferior pancreaticoduodenal vein': 'Alt pankreatikoduodenal ven',
  'central retinal artery L': 'Sol retina merkez arteri',
  'central retinal artery R': 'Sağ retina merkez arteri',
  'central retinal vein L': 'Sol retina merkez veni',
  'central retinal vein R': 'Sağ retina merkez veni',
  'opthalmic artery L': 'Sol göz arteri (oftalmik)',
  'opthalmic artery R': 'Sağ göz arteri (oftalmik)',
  'ophthalmic vein L': 'Sol göz veni (oftalmik)',
  'ophthalmic vein R': 'Sağ göz veni (oftalmik)',
  'superior ophthalmic vein L': 'Sol üst oftalmik ven',
  'superior ophthalmic vein R': 'Sağ üst oftalmik ven',
  'inferior ophthalmic vein L': 'Sol alt oftalmik ven',
  'inferior ophthalmic vein R': 'Sağ alt oftalmik ven',
  'long posterior ciliary artery L': 'Sol uzun arka siliyer arter',
  'long posterior ciliary artery R': 'Sağ uzun arka siliyer arter',
};

/** Şematik kol/bacak damarları: "right radial artery" → "Sağ radyal arter (önkol)". */
const LIMB: Record<string, string> = {
  'axillary and brachial artery': 'koltukaltı ve kol atardamarı (aksiller–brakiyal arter)',
  'radial artery': 'radyal arter (önkol, başparmak tarafı)',
  'ulnar artery': 'ulnar arter (önkol, serçe parmak tarafı)',
  'palmar arch': 'avuç içi atardamar kavsi',
  'axillary and brachial vein': 'koltukaltı ve kol toplardamarı',
  'cephalic vein': 'sefalik ven (kolun dış yüzü)',
  'basilic vein': 'bazilik ven (kolun iç yüzü)',
  'femoral and popliteal artery': 'uyluk ve diz arkası atardamarı (femoral–popliteal arter)',
  'anterior tibial artery': 'ön tibial arter (bacağın önü, ayak sırtı)',
  'posterior tibial artery': 'arka tibial arter (bacağın arkası, ayak tabanı)',
  'femoral and popliteal vein': 'uyluk ve diz arkası toplardamarı (femoral–popliteal ven)',
  'great saphenous vein': 'büyük safen ven (bacağın iç yüzü)',
  'small saphenous vein': 'küçük safen ven (baldır)',
};

export function vesselLabel(raw: string): string {
  if (EXACT[raw]) return EXACT[raw];
  const limb = /^(right|left) (.+)$/.exec(raw);
  if (limb && LIMB[limb[2]!]) return `${limb[1] === 'right' ? 'Sağ' : 'Sol'} ${LIMB[limb[2]!]}`;
  const tr = raw
    .replace(/ (a|b|c)$/, '')
    .replace(/\binferior\b/g, 'alt')
    .replace(/\bsuperior\b/g, 'üst')
    .replace(/\bmiddle\b/g, 'orta')
    .replace(/\brectal\b/g, 'rektal')
    .replace(/\bmesenteric\b/g, 'mezenter')
    .replace(/\binternal\b/g, 'iç')
    .replace(/\bartery\b/g, 'arter')
    .replace(/\bvein\b/g, 'ven')
    .replace(/\bleft\b/g, 'sol')
    .replace(/\bright\b/g, 'sağ')
    .replace(/ L$/, ' (sol)')
    .replace(/ R$/, ' (sağ)')
    .replace(/ [ab]$/, '');
  return tr.charAt(0).toUpperCase() + tr.slice(1);
}

export const isVein = (raw: string) => /\bvein\b|vena|sinus/.test(raw);

/** Bir 3D parçasının Türkçe adı: organ bölümü (parts.ts) ya da damar/sinir kaynak adı. */
export function partLabel(structure: string, label: string | null): string | null {
  if (!label) return null;
  return partDef(structure, label)?.tr ?? vesselLabel(label);
}

/** Bölümün Latince adı (varsa). */
export function partLatin(structure: string, label: string | null): string | undefined {
  return partDef(structure, label)?.latin;
}
