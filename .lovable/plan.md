

## Plan: Delete shell scripts and provide simple manual steps

### What I will do in the repo
1. **Delete** `scripts/rebuild-ios.sh`, `scripts/setup-ios.sh`, and `scripts/PushNotificationSetup.swift`
2. **Delete** the `scripts/` folder entirely (if nothing else is in it)
3. **Remove** `ios/` directory files from the repo (since you are deleting it locally)
4. **Update `.lovable/plan.md`** with the manual steps below so they are always accessible

### What you run on your Mac (every time after `git pull`)

```bash
# 1. Install deps & build
npm install
npm run build

# 2. Add iOS platform fresh
npx cap add ios

# 3. Sync web assets into native project
npx cap sync ios

# 4. Add Firebase pods — open ios/App/Podfile and add these two lines inside "target 'App' do", before "capacitor_pods":
#      pod 'FirebaseCore', '~> 11.0'
#      pod 'FirebaseMessaging', '~> 11.0'

# 5. Install pods
cd ios/App && pod install --repo-update && cd ../..

# 6. Open Xcode
npx cap open ios
```

### Once Xcode is open (one-time setup per rebuild)

1. **Copy `GoogleService-Info.plist`** into `ios/App/App/` (drag into Xcode App group, check "Copy items if needed")
2. **Create a new Swift file** in the App target called `PushNotificationSetup.swift` — paste the contents from the repo's current `scripts/PushNotificationSetup.swift`
3. **Edit `AppDelegate.swift`**:
   - Add imports at the top: `import FirebaseCore`, `import FirebaseMessaging`, `import UserNotifications`
   - Add `PushNotificationSetup.shared.configure()` before `return true` in `didFinishLaunchingWithOptions`
   - Add the two bridge methods (didRegister/didFail for remote notifications) that forward to `PushNotificationSetup.shared`
4. **In Build Settings**: Set "User Script Sandboxing" to **No**
5. **In Signing & Capabilities**: Add Push Notifications, Sign in with Apple, Apple Pay (merchant.sashiko.app)

### Keeping it conflict-proof
- I will add `/ios/` to `.gitignore` so the generated native folder never gets committed or causes merge conflicts again
- From now on, after every `git pull`, just run the 6 commands above

