import type { PlatformAdapter } from '@kh/platform';
import { androidPlatform, isAndroidShell } from './android';
import { webPlatform } from './web';

/** Android kabuğunda köprü nesnesi sayfa betiklerinden önce enjekte edilir; tespit bununla yapılır. */
export const platform: PlatformAdapter = isAndroidShell() ? androidPlatform : webPlatform;
