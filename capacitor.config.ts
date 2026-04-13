import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sashiko.app',
  appName: 'Sashiko Asian Fusion',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // serverClientId is read from GoogleService-Info.plist → SERVER_CLIENT_ID
      // so you don't need to hardcode it here. Only set this if you want to
      // override the plist value explicitly.
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
