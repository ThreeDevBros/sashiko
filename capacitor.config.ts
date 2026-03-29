import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sashiko.app',
  appName: 'Sashiko Asian Fusion',
  webDir: 'dist',
  server: {
    url: 'https://6e0c6b4d-4b79-43e7-a843-1d08565d9c10.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
