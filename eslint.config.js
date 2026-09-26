import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const NETWORK_MESSAGE = 'Uygulama kodu ağ API\'si kullanamaz: sağlık verisi cihazdan çıkmaz. Gerekirse mimari dokümanında gerekçelendirip istisna ekleyin.';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/web/public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Loglar yalnızca apps/web/src/log.ts üzerinden, olay adıyla.
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Rapor/dosya içeriği asla HTML olarak basılmaz.' },
        { selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]', message: 'innerHTML yasak (Trusted Types da engeller).' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'insertAdjacentHTML yasak.' },
        { selector: "CallExpression[callee.property.name='write'][callee.object.name='document']", message: 'document.write yasak.' },
        { selector: "CallExpression[callee.name='eval']", message: 'eval yasak.' },
        { selector: "NewExpression[callee.name='Function']", message: 'new Function yasak.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NETWORK_MESSAGE },
        { name: 'XMLHttpRequest', message: NETWORK_MESSAGE },
        { name: 'WebSocket', message: NETWORK_MESSAGE },
        { name: 'EventSource', message: NETWORK_MESSAGE },
        { name: 'localStorage', message: 'Yalnızca state/settings.ts (hassas olmayan tercihler) kullanabilir.' },
        { name: 'sessionStorage', message: 'Hassas veri tarayıcı depolamasına şifresiz yazılmaz.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: NETWORK_MESSAGE },
        { object: 'window', property: 'fetch', message: NETWORK_MESSAGE },
        { object: 'globalThis', property: 'fetch', message: NETWORK_MESSAGE },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/src/state/settings.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Geliştirici araçları (derleme hattı) konsola ilerleme yazar; uygulama koduna dahil değildir.
    files: ['assets-pipeline/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['**/*.{js,mjs}', 'apps/web/vite.config.ts', 'apps/web/vite-plugins/**', 'vitest.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
