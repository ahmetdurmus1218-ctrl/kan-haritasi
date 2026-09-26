import { useEffect, useState } from 'react';

export type Route =
  | { name: 'documents' }
  | { name: 'document'; id: string }
  | { name: 'results' }
  | { name: 'result'; key: string }
  /** focus: test anahtarı ("Vücutta göster"); structure: organ/yapı; system: sistem. */
  | { name: 'body'; focus?: string; structure?: string; system?: string }
  /** İçeri girilen sahne (damar içi, alveol…); from: girilen yapı. */
  | { name: 'simulation'; id: string; from?: string }
  | { name: 'timeline'; key?: string }
  | { name: 'privacy' }
  | { name: 'about' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[a-z0-9-]{1,40}$/;

export function parseHash(hash: string): Route {
  const [, section, arg, arg2] = hash.replace(/^#/, '').split('/');
  switch (section) {
    case 'belge':
      return arg && UUID.test(arg) ? { name: 'document', id: arg } : { name: 'documents' };
    case 'sonuclar':
      return { name: 'results' };
    case 'sonuc':
      return arg && KEY.test(arg) ? { name: 'result', key: arg } : { name: 'results' };
    case 'vucut':
      if (arg === 'yapi' && arg2 && KEY.test(arg2)) return { name: 'body', structure: arg2 };
      if (arg === 'sistem' && arg2 && KEY.test(arg2)) return { name: 'body', system: arg2 };
      return arg && KEY.test(arg) ? { name: 'body', focus: arg } : { name: 'body' };
    case 'simulasyon':
      if (!arg || !KEY.test(arg)) return { name: 'body' };
      return arg2 && KEY.test(arg2) ? { name: 'simulation', id: arg, from: arg2 } : { name: 'simulation', id: arg };
    case 'zaman':
      return arg && KEY.test(arg) ? { name: 'timeline', key: arg } : { name: 'timeline' };
    case 'gizlilik':
      return { name: 'privacy' };
    case 'hakkinda':
      return { name: 'about' };
    default:
      return { name: 'documents' };
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'document':
      return `#/belge/${route.id}`;
    case 'results':
      return '#/sonuclar';
    case 'result':
      return `#/sonuc/${route.key}`;
    case 'body':
      if (route.structure) return `#/vucut/yapi/${route.structure}`;
      if (route.system) return `#/vucut/sistem/${route.system}`;
      return route.focus ? `#/vucut/${route.focus}` : '#/vucut';
    case 'simulation':
      return route.from ? `#/simulasyon/${route.id}/${route.from}` : `#/simulasyon/${route.id}`;
    case 'timeline':
      return route.key ? `#/zaman/${route.key}` : '#/zaman';
    case 'privacy':
      return '#/gizlilik';
    case 'about':
      return '#/hakkinda';
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
