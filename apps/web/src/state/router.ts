import { useEffect, useState } from 'react';

export type Route =
  | { name: 'documents' }
  | { name: 'document'; id: string }
  | { name: 'results' }
  | { name: 'body' }
  | { name: 'timeline' }
  | { name: 'privacy' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseHash(hash: string): Route {
  const [, section, arg] = hash.replace(/^#/, '').split('/');
  switch (section) {
    case 'belge':
      return arg && UUID.test(arg) ? { name: 'document', id: arg } : { name: 'documents' };
    case 'sonuclar':
      return { name: 'results' };
    case 'vucut':
      return { name: 'body' };
    case 'zaman':
      return { name: 'timeline' };
    case 'gizlilik':
      return { name: 'privacy' };
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
    case 'body':
      return '#/vucut';
    case 'timeline':
      return '#/zaman';
    case 'privacy':
      return '#/gizlilik';
    default:
      return '#/belgeler';
  }
}

/** Hash tabanlı yönlendirme: çevrimdışı ve göreli yolla (GitHub Pages, Android asset) çalışır. URL'de yalnızca rastgele kimlik bulunur. */
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
