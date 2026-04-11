# iOS Manual Rebuild Steps

No automation scripts — everything is done manually for full control.

## After every `git pull`, run these commands:

```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
```

Then edit `ios/App/Podfile` — add these two lines inside `target 'App' do`, before `capacitor_pods`:

```ruby
pod 'FirebaseCore', '~> 11.0'
pod 'FirebaseMessaging', '~> 11.0'
```

Then install pods and open Xcode:

```bash
cd ios/App && pod install --repo-update && cd ../..
npx cap open ios
```

## One-time Xcode setup (after each rebuild)

1. **GoogleService-Info.plist** — drag into `ios/App/App/` in Xcode (check "Copy items if needed")
2. **PushNotificationSetup.swift** — create a new Swift file in the App target with these contents:

```swift
import UIKit
import FirebaseCore
import FirebaseMessaging
import Capacitor

final class PushNotificationSetup: NSObject, MessagingDelegate, UNUserNotificationCenterDelegate {

    static let shared = PushNotificationSetup()

    private let prefsKey = "CapacitorStorage.fcm_push_token"

    private override init() { super.init() }

    func configure() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        print("[PushSetup] Firebase configured & delegates set")
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, !token.isEmpty else { return }
        print("[PushSetup] FCM token: \(token.prefix(20))...")
        UserDefaults.standard.set(token, forKey: prefsKey)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        handler([.banner, .sound, .badge])
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }
}
```

3. **Edit AppDelegate.swift** — add these imports and calls:

```swift
import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        PushNotificationSetup.shared.configure()
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushNotificationSetup.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushNotificationSetup.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
```

4. **Build Settings** → Set "User Script Sandboxing" to **No**
5. **Signing & Capabilities** → Add:
   - Push Notifications
   - Sign in with Apple
   - Apple Pay (Merchant ID: merchant.sashiko.app)

## Push Notification Credential Checklist

Before push notifications will work, **all of these must match**:

1. **Xcode Bundle ID** — must be `com.sashiko.app`
2. **Firebase Console → Project Settings → iOS app** — Bundle ID must be exactly `com.sashiko.app`
3. **`GoogleService-Info.plist`** — must belong to that same Firebase iOS app (check `BUNDLE_ID` and `PROJECT_ID` inside the plist)
4. **APNs Auth Key** — in [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list):
   - Create or verify a key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` file
   - Note the **Key ID** and your **Team ID**
5. **Upload to Firebase** — in Firebase Console → Project Settings → Cloud Messaging → Apple app configuration:
   - Upload the `.p8` key
   - Enter the Key ID and Team ID
   - Ensure it shows as active
6. **`FIREBASE_SERVICE_ACCOUNT_JSON` secret** — must be from the **same** Firebase project as the `GoogleService-Info.plist`

### How to verify
- The `project_id` inside `GoogleService-Info.plist` must match the `project_id` inside the service account JSON
- If you recently regenerated any credentials, re-upload them to Firebase and re-download `GoogleService-Info.plist`

### Removing old native upsert code
Your `PushNotificationSetup.swift` should **NOT** contain `upsertTokenToSupabase`. Token registration is now handled entirely by the web JS hook via the `register-push-device` edge function. Remove any direct Supabase HTTP calls from the Swift file.
