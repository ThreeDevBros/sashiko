

## Rebuild iOS from Scratch — Full Setup

### What You'll Get
After this, you delete `ios/`, run a few commands, and only need to manually:
1. Copy `PushNotificationSetup.swift` into `ios/App/App/`
2. Copy `GoogleService-Info.plist` into `ios/App/App/`
3. Add both files to Xcode (right-click App group → Add Files)
4. Enable Push Notifications + Sign in with Apple + Apple Pay capabilities in Xcode

Everything else will be automated.

### Changes I'll Make

**1. Create `scripts/setup-ios.sh`** — a one-command script you run after deleting `ios/`:
```
npm run build
npx cap add ios
npx cap sync ios
```
Then automatically:
- Patches `ios/App/Podfile` to add `FirebaseMessaging` pod
- Runs `pod install --repo-update`
- Disables User Script Sandboxing in Xcode project
- Prints reminder to add Swift file, plist, and capabilities

**2. Regenerate `/mnt/documents/ios-native-setup/` files:**
- **PushNotificationSetup.swift** — standalone Swift file (no AppDelegate changes), initializes Firebase, bridges APNs→FCM tokens to Capacitor
- **SETUP-INSTRUCTIONS.md** — step-by-step checklist

### What You Do After I'm Done

```bash
rm -rf ios
bash scripts/setup-ios.sh
```

Then in Xcode:
1. Open `ios/App/App.xcworkspace`
2. Drag `PushNotificationSetup.swift` into the App group
3. Drag `GoogleService-Info.plist` into the App group
4. Under Signing & Capabilities: add Push Notifications, Sign in with Apple, Apple Pay (merchant.sashiko.app)
5. Set User Script Sandboxing to No (if script didn't handle it)
6. Build and run

### Technical Notes
- The Podfile patch adds `FirebaseMessaging` inside the `target 'App'` block
- `PushNotificationSetup.swift` uses `NSObject.load()` to auto-initialize without touching AppDelegate
- `capacitor.config.ts` stays as-is (no server.url for production native builds)

