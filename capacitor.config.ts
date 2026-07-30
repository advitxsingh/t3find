import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.t3find.app',
  appName: 'T3Find',
  webDir: 'dist',
  server: {
    // Point the Android WebView to the live Vercel deployment
    // This enables TRUE over-the-air (OTA) updates:
    // Every Vercel deploy is instantly loaded on phone without a new APK!
    url: 'https://t3find.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
