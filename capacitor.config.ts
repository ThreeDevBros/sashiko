import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sashiko.app',
  appName: 'Sashiko Asian Fusion',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
