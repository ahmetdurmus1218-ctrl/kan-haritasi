import { useEffect, useState } from 'react';

export type Route =
  /** Ana sayfa: genel durum, tek "Veri ekle" girişi. */
  | { name: 'home' }
  /** Tek yükleme akışı: dosyayı seç / fotoğraf çek → sistem türünü algılar. */
  | { name: 'add' }
  | { name: 'documents' }
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
  /** Organ / bölge / doku sayfası (bilgi grafiği düğümü, ör. "pancreas", "brain.frontal"). view: normal | benim | fark */
  | { name: 'organ'; id: string; view?: OrganViewMode };

export type OrganViewMode = 'normal' | 'benim' | 'fark';
const VIEWS: readonly string[] = ['normal', 'benim', 'fark'];
/** Bilgi grafiği düğüm kimliği: küçük harf, rakam, tire ve nokta. */
const NODE = /^[a-z0-9][a-z0-9.-]{0,59}$/;

export type SimulationMode = 'temel' | 'benim';
const MODES: readonly string[] = ['temel', 'benim'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[a-z0-9-]{1,40}$/;

export function parseHash(hash: string): Route {
  const [, section, arg, arg2, arg3] = hash.replace(/^#/, '').split('/');
  switch (section) {
    case '':
    case 'ana':
      return { name: 'home' };
    case 'ekle':
      return { name: 'add' };
    case 'belgeler':
      return { name: 'documents' };
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
    case 'simulasyon':
      if (!arg || !KEY.test(arg)) return { name: 'body' };
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
    case 'organ':
      if (!arg || !NODE.test(arg)) return { name: 'mybody' };
      return arg2 && VIEWS.includes(arg2) ? { name: 'organ', id: arg, view: arg2 as OrganViewMode } : { name: 'organ', id: arg };
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
      return `#/organ/${route.id}${route.view ? `/${route.view}` : ''}`;
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
