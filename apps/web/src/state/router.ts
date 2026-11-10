import { useEffect, useState } from 'react';

export type Route =
  /** Ana sayfa: genel durum, tek "Veri ekle" girişi. */
  | { name: 'home' }
  /** Tek yükleme akışı: dosyayı seç / fotoğraf çek → sistem türünü algılar. */
  | { name: 'add' }
  | { name: 'documents' }
  /** Görüntüleme çalışmaları (model / ön inceleme / rapor durumu ile). */
  | { name: 'images' }
  | { name: 'document'; id: string }
  | { name: 'results' }
  | { name: 'result'; key: string }
  /** focus: test anahtarı ("Vücutta göster"); structure: organ/yapı; system: sistem. */
  | { name: 'body'; focus?: string; structure?: string; system?: string; part?: string }
  /**
   * İçeri girilen sahne (damar içi, alveol…); from: girilen yapı.
   * mode: 'temel' = organ temelde nasıl çalışır (tipik değerlerle süreç), 'benim' = sonucuma göre nasıl çalışır.
   */
  | { name: 'simulation'; id: string; from?: string; mode?: SimulationMode }
  | { name: 'coverage' }
  | { name: 'timeline'; key?: string }
  | { name: 'privacy' }
  | { name: 'about' }
  /** Vücut merkezli ana ekran: organlar, bulgular, zaman. */
  | { name: 'mybody' }
  /**
   * Organ sayfası (bilgi grafiği düğümü, ör. "pancreas", "small-intestine"). view yoksa genel bakış
   * (Ne? Nasıl çalışır? Bende ne var?). benim: kişisel ayrıntı; ic: organın içi (adım adım);
   * derin: doku → hücre → süreç → molekül (trail: organdan itibaren seçilen düğümler).
   */
  | { name: 'organ'; id: string; view?: OrganViewMode; trail?: string[] }
  /** Vücut akışları: liste (#/akis) ya da bir akışın adımı; personal: "Benim durumuma göre göster". */
  | { name: 'flow'; id?: string; step?: number; personal?: boolean }
  /** Sistem sayfası: organları ve akışları. */
  | { name: 'system'; id: string }
  /**
   * "İÇİNE GİR": organın fiziksel/işlevsel iç dünyası (lümen, içerik, akış, duvar → doku → hücre → molekül).
   * stage: 1'den başlayan basamak; mode: eğitimsel içerik modu (ör. "sindirim").
   */
  | { name: 'interior'; id: string; stage?: number; mode?: string }
  /**
   * Kişisel organ: kullanıcının BT/MR serisindeki GERÇEK bölütleme maskesinden çıkarılan organ yüzeyi
   * (iç dünya kimliği). inside: kamera gerçek mesh'in içine dalmış (sonra eğitimsel iç dünyaya geçilir).
   */
  | { name: 'personalOrgan'; id: string; inside?: boolean }
  /** Fizyoloji grafiği: zincir listesi ya da bir zincir (glukoz, B12, demir…). */
  | { name: 'physiology'; id?: string }
  /**
   * Beyin haritası: beynin bütün bölümleri, rapordan okunan cümleler bölgesine yerleşmiş hâlde.
   * region: bilgi grafiği düğümü (ör. "brain.frontal") → o bölgenin sayfası ve her rapor cümlesi adım adım.
   */
  | { name: 'brain'; region?: string }
  /** Bir rapor cümlesi adım adım (her organ): file = belge kimliği, n = cümlenin rapordaki sırası (1'den). */
  | { name: 'sentence'; file: string; n: number }
  /**
   * Simülasyon laboratuvarı: matematiksel fizyoloji modelleri (#/sim) ve tek model (#/sim/<model>[/<senaryo>]).
   * Eğitimseldir; kişisel ölçüm üretmez.
   */
  | { name: 'simlab'; id?: string; scenario?: string }
  /** Anatomi laboratuvarı: sistemler, katmanlar, organın içine giriş ve mikroanatomi için tek giriş ekranı. */
  | { name: 'anatomylab' };

/** ic: İçine gir (iç dünya); doku: duvar → doku → hücre adım adım; derin: bilgi grafiğinde serbest iniş. */
export type OrganViewMode = 'normal' | 'benim' | 'fark' | 'ic' | 'doku' | 'derin';
const VIEWS: readonly string[] = ['normal', 'benim', 'fark', 'ic', 'doku', 'derin'];
/** Bilgi grafiği düğüm kimliği: küçük harf, rakam, tire ve nokta. */
const NODE = /^[a-z0-9][a-z0-9.:-]{0,59}$/;

export type SimulationMode = 'temel' | 'benim';
const MODES: readonly string[] = ['temel', 'benim'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[a-z0-9-]{1,40}$/;

export function parseHash(hash: string): Route {
  const [, section, arg, arg2, arg3, ...rest] = hash.replace(/^#/, '').split('/');
  switch (section) {
    case '':
    case 'ana':
      return { name: 'home' };
    case 'ekle':
      return { name: 'add' };
    case 'belgeler':
      return { name: 'documents' };
    case 'goruntuler':
      return { name: 'images' };
    case 'belge':
      return arg && UUID.test(arg) ? { name: 'document', id: arg } : { name: 'documents' };
    case 'sonuclar':
      return { name: 'results' };
    case 'sonuc':
      return arg && KEY.test(arg) ? { name: 'result', key: arg } : { name: 'results' };
    case 'vucut':
      if (arg === 'yapi' && arg2 && KEY.test(arg2)) return arg3 && KEY.test(arg3) ? { name: 'body', structure: arg2, part: arg3 } : { name: 'body', structure: arg2 };
      if (arg === 'sistem' && arg2 && KEY.test(arg2)) return { name: 'body', system: arg2 };
      return arg && KEY.test(arg) ? { name: 'body', focus: arg } : { name: 'body' };
    case 'sim':
      if (!arg || !KEY.test(arg)) return { name: 'simlab' };
      return arg2 && KEY.test(arg2) ? { name: 'simlab', id: arg, scenario: arg2 } : { name: 'simlab', id: arg };
    case 'laboratuvar':
      return { name: 'anatomylab' };
    case 'simulasyon':
      if (!arg) return { name: 'simlab' };
      if (!KEY.test(arg)) return { name: 'body' };
      if (arg2 && MODES.includes(arg2)) return { name: 'simulation', id: arg, mode: arg2 as SimulationMode };
      if (!arg2 || !KEY.test(arg2)) return { name: 'simulation', id: arg };
      return arg3 && MODES.includes(arg3) ? { name: 'simulation', id: arg, from: arg2, mode: arg3 as SimulationMode } : { name: 'simulation', id: arg, from: arg2 };
    case 'kapsam':
      return { name: 'coverage' };
    case 'zaman':
      return arg && KEY.test(arg) ? { name: 'timeline', key: arg } : { name: 'timeline' };
    case 'gizlilik':
      return { name: 'privacy' };
    case 'hakkinda':
      return { name: 'about' };
    case 'vucudum':
      return { name: 'mybody' };
    case 'organ': {
      if (!arg || !NODE.test(arg)) return { name: 'mybody' };
      if (arg2 === 'derin') {
        const trail = [arg3, ...rest].filter((x): x is string => Boolean(x));
        return trail.length <= 8 && trail.every((t) => NODE.test(t)) ? { name: 'organ', id: arg, view: 'derin', trail } : { name: 'organ', id: arg, view: 'derin', trail: [] };
      }
      return arg2 && VIEWS.includes(arg2) ? { name: 'organ', id: arg, view: arg2 as OrganViewMode } : { name: 'organ', id: arg };
    }
    case 'akis': {
      if (!arg || !KEY.test(arg)) return { name: 'flow' };
      const n = arg2 && /^\d{1,2}$/.test(arg2) ? Number(arg2) : 1;
      return { name: 'flow', id: arg, step: Math.max(1, n), ...(arg3 === 'benim' ? { personal: true } : {}) };
    }
    case 'sistem':
      return arg && KEY.test(arg) ? { name: 'system', id: arg } : { name: 'mybody' };
    case 'ic': {
      if (!arg || !NODE.test(arg)) return { name: 'mybody' };
      const n = arg2 && /^\d{1,2}$/.test(arg2) ? Math.max(1, Number(arg2)) : undefined;
      const mode = arg3 && KEY.test(arg3) ? arg3 : undefined;
      return { name: 'interior', id: arg, ...(n ? { stage: n } : {}), ...(mode ? { mode } : {}) };
    }
    case 'kisisel':
      return arg && NODE.test(arg) ? { name: 'personalOrgan', id: arg, ...(arg2 === 'ic' ? { inside: true } : {}) } : { name: 'mybody' };
    case 'fizyoloji':
      return arg && KEY.test(arg) ? { name: 'physiology', id: arg } : { name: 'physiology' };
    case 'beyin':
      return arg && NODE.test(arg) ? { name: 'brain', region: arg } : { name: 'brain' };
    case 'cumle': {
      const n = Number(arg2);
      return arg && UUID.test(arg) && Number.isInteger(n) && n >= 1 && n <= 500 ? { name: 'sentence', file: arg, n } : { name: 'images' };
    }
    default:
      return { name: 'home' };
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'add':
      return '#/ekle';
    case 'images':
      return '#/goruntuler';
    case 'document':
      return `#/belge/${route.id}`;
    case 'results':
      return '#/sonuclar';
    case 'result':
      return `#/sonuc/${route.key}`;
    case 'body':
      if (route.structure) return route.part ? `#/vucut/yapi/${route.structure}/${route.part}` : `#/vucut/yapi/${route.structure}`;
      if (route.system) return `#/vucut/sistem/${route.system}`;
      return route.focus ? `#/vucut/${route.focus}` : '#/vucut';
    case 'simulation':
      return `#/simulasyon/${route.id}${route.from ? `/${route.from}` : ''}${route.mode ? `/${route.mode}` : ''}`;
    case 'coverage':
      return '#/kapsam';
    case 'timeline':
      return route.key ? `#/zaman/${route.key}` : '#/zaman';
    case 'privacy':
      return '#/gizlilik';
    case 'about':
      return '#/hakkinda';
    case 'mybody':
      return '#/vucudum';
    case 'organ':
      if (route.view === 'derin') return `#/organ/${route.id}/derin${(route.trail ?? []).map((t) => `/${t}`).join('')}`;
      return `#/organ/${route.id}${route.view ? `/${route.view}` : ''}`;
    case 'flow':
      return route.id ? `#/akis/${route.id}/${route.step ?? 1}${route.personal ? '/benim' : ''}` : '#/akis';
    case 'system':
      return `#/sistem/${route.id}`;
    case 'interior':
      return `#/ic/${route.id}${route.stage || route.mode ? `/${route.stage ?? 1}` : ''}${route.mode ? `/${route.mode}` : ''}`;
    case 'personalOrgan':
      return `#/kisisel/${route.id}${route.inside ? '/ic' : ''}`;
    case 'physiology':
      return route.id ? `#/fizyoloji/${route.id}` : '#/fizyoloji';
    case 'brain':
      return route.region ? `#/beyin/${route.region}` : '#/beyin';
    case 'sentence':
      return `#/cumle/${route.file}/${route.n}`;
    case 'simlab':
      return route.id ? `#/sim/${route.id}${route.scenario ? `/${route.scenario}` : ''}` : '#/sim';
    case 'anatomylab':
      return '#/laboratuvar';
    default:
      return '#/belgeler';
  }
}

/** Hash tabanlı yönlendirme: çevrimdışı ve göreli yolla (GitHub Pages, Android asset) çalışır. URL'de yalnızca rastgele kimlik veya test anahtarı bulunur. */
export function useRoute(): [Route, (r: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);

  const navigate = (r: Route, replace = false) => {
    const href = hrefFor(r);
    if (replace) history.replaceState(null, '', href);
    else history.pushState(null, '', href);
    setRoute(r);
  };

  return [route, navigate];
}

/** Uygulamanın her yerinden gezinme için (ör. sonuç kartından "Vücutta göster"). */
export function go(route: Route): void {
  history.pushState(null, '', hrefFor(route));
  window.dispatchEvent(new PopStateEvent('popstate'));
}
