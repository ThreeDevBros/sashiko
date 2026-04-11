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
