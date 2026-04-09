

## Fix iOS Push Notifications

### Problem
The native iOS app grants notification permission but never delivers notifications because:
1. **No Firebase SDK** — Firebase Messaging is not in the Podfile, so APNs tokens never get converted to FCM tokens
2. **No AppDelegate forwarding** — the native app doesn't forward device tokens to Capacitor
3. **Registration timing** — the hook only tries once on mount; if the user isn't logged in yet, it silently fails forever

### Changes in Lovable

**1. Fix `usePushNotifications.ts` — retry registration after login**
- Listen for `supabase.auth.onAuthStateChange` so registration retries when a user signs in after app launch
- Add console logging to help debug token registration

### Files for You to Paste into Xcode

**2. Create `ios-native-setup/PushNotification.swift`** (artifact file you'll copy)
- A standalone Swift file using `@objc` methods that you add to your Xcode project
- Initializes Firebase, forwards APNs tokens to both Firebase Messaging and Capacitor
- No changes needed to AppDelegate.swift — this file uses `load()` or a manual call pattern

**3. Create `ios-native-setup/Podfile-additions.txt`** (artifact file)
- The exact lines to add to your `ios/App/Podfile`
- Adds `FirebaseMessaging` pod

**4. Create `ios-native-setup/SETUP-INSTRUCTIONS.md`** (artifact file)
- Step-by-step instructions for adding the files and rebuilding

### Technical Details

- The `PushNotification.swift` file will use `FirebaseApp.configure()` and implement `MessagingDelegate` to capture the FCM token
- It registers as a `UNUserNotificationCenter` delegate and forwards `didRegisterForRemoteNotificationsWithDeviceToken` to Firebase via swizzling (Firebase's default behavior)
- Firebase method swizzling handles the APNs-to-FCM token mapping automatically, so you don't need to edit AppDelegate

### Steps Summary
1. I update `usePushNotifications.ts` with auth-aware retry logic
2. I create setup files in `/mnt/documents/ios-native-setup/`
3. You add `pod 'FirebaseMessaging'` to Podfile, run `pod install`
4. You drag `PushNotification.swift` into your Xcode project
5. Rebuild and test

