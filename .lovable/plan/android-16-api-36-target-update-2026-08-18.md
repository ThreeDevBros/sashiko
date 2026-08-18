# Android 16 (API 36) Target Update

Google Play requires apps to target Android 16 (API level 36) for updates after Nov 1, 2026. The Android build currently targets API 35.

## Changes

1. `android/variables.gradle`
   - `compileSdkVersion = 36`
   - `targetSdkVersion = 36`

2. `android/app/build.gradle`
   - `versionCode 4` -> `5`
   - `versionName "1.4"` -> `"1.5"`

No other files change. Android Gradle Plugin 8.7.2 already supports API 36, so no plugin upgrade is needed.

## After approval (on your Mac)

```bash
git pull
npm install --legacy-peer-deps
npm run build
npx cap sync android
```

Then in Android Studio: Build > Generate Signed Bundle (AAB) and upload to Play Console. Once the release rolls out, the policy warning clears.

## Note

Android 16 tightens edge-to-edge display and some background/permission behaviors. After the rebuild, sanity-check the app on a device for layout issues around the status/navigation bars (the app already uses safe-area utilities, so this is expected to be fine).
