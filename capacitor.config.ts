import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeos.app',
  appName: 'LifeOS',
  webDir: 'out',
  server: {
    url: 'https://lifeos-app-five-eosin.vercel.app',
    cleartext: true
  }
};

export default config;
