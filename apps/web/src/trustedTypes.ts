/**
 * Trusted Types varsayılan politikası. CSP'deki `require-trusted-types-for 'script'`
 * ile birlikte, HTML/script enjeksiyonu yapılabilecek tüm DOM sink'lerini kapatır:
 * - innerHTML vb.: yalnızca boş dizeye izin (temizleme amaçlı kütüphane çağrıları için)
 * - eval/Function: tamamen kapalı
 * - Worker/ServiceWorker/script URL'leri: yalnızca aynı kökenden
 * Bu modül, başka hiçbir modül çalışmadan önce içe aktarılmalıdır (main.tsx'in ilk satırı).
 */
type TrustedTypePolicyFactoryLike = {
  createPolicy(name: string, rules: Record<string, (input: string) => string>): unknown;
};

const factory = (globalThis as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;

if (factory) {
  factory.createPolicy('default', {
    createHTML(input) {
      if (input === '') return input;
      throw new TypeError('Trusted Types: HTML sink blocked');
    },
    createScript() {
      throw new TypeError('Trusted Types: script sink blocked');
    },
    createScriptURL(input) {
      const url = new URL(input, document.baseURI);
      if (url.origin === location.origin) return url.href;
      throw new TypeError('Trusted Types: cross-origin script URL blocked');
    },
  });
}

export {};
