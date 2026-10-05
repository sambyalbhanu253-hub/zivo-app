import type { CapacitorConfig } from '@capacitor/cli';

const productionUrl = process.env.ZIVO_PRODUCTION_URL ?? 'https://example.com';

const config: CapacitorConfig = {
  appId: 'com.zivo.app',
  appName: 'ZIVO',
  webDir: 'dist',
  server: {
    url: productionUrl
  }
};

export default config;
