import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sashiko.app',
  appName: 'Sashiko Asian Fusion',
  webDir: 'dist',
  ios: {
    // Explicit allowlist: excludes @codetrix-studio/capacitor-google-auth on iOS
    // because it requires GoogleSignIn ~> 6.2.4, which conflicts with the custom
    // Swift GoogleAuthPlugin (GoogleSignIn 9.x) registered manually in setup/swift/.
    // iOS uses the custom Swift plugin; Android still uses the codetrix plugin.
    includePlugins: [
      '@capacitor-community/apple-sign-in',
      '@capacitor-community/stripe',
      '@capacitor/app',
      '@capacitor/geolocation',
      '@capacitor/haptics',
      '@capacitor/preferences',
      '@capacitor/push-notifications',
    ],
  },
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
