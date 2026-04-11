import UIKit
import FirebaseCore
import FirebaseMessaging

/// Singleton that initializes Firebase and manages push notification registration.
/// Add this file to the App target — do NOT replace Capacitor's AppDelegate.
///
/// Usage: In your AppDelegate (or anywhere early), call:
///   PushNotificationSetup.shared.configure(application: application)
///
/// Or let it auto-configure via the swizzled load() if preferred.
@objc final class PushNotificationSetup: NSObject {

    static let shared = PushNotificationSetup()
    private var isConfigured = false

    private override init() {
        super.init()
    }

    /// Call this from AppDelegate.didFinishLaunchingWithOptions or a Capacitor plugin.
    func configure(application: UIApplication) {
        guard !isConfigured else { return }
        isConfigured = true

        // Initialize Firebase
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // Set FCM messaging delegate
        Messaging.messaging().delegate = self

        // Request push notification permissions
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            if let error = error {
                print("[Push] Authorization error: \(error)")
            }
            print("[Push] Permission granted: \(granted)")
        }

        application.registerForRemoteNotifications()

        // Listen for APNs token from Capacitor's AppDelegate
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didRegisterForRemoteNotifications(_:)),
            name: .capacitorDidRegisterForRemoteNotifications,
            object: nil
        )

        print("[PushNotificationSetup] Configured successfully")
    }

    // MARK: - APNs Token forwarding

    @objc private func didRegisterForRemoteNotifications(_ notification: Notification) {
        guard let deviceToken = notification.object as? Data else { return }
        // Forward APNs token to Firebase so it can generate an FCM token
        Messaging.messaging().apnsToken = deviceToken
        print("[Push] APNs token forwarded to Firebase")
    }
}

// MARK: - FCM Messaging Delegate

extension PushNotificationSetup: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("[FCM] Token received: \(token)")

        // Store FCM token so the JS Preferences plugin can read it.
        // Key format: "CapacitorStorage.<key>" matches @capacitor/preferences storage.
        UserDefaults.standard.set(token, forKey: "CapacitorStorage.fcm_push_token")
        UserDefaults.standard.synchronize()
    }
}

// MARK: - UNUserNotificationCenter Delegate

extension PushNotificationSetup: UNUserNotificationCenterDelegate {
    // Show notifications even when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    // Handle notification tap
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Forward to Capacitor for JS-side handling
        NotificationCenter.default.post(
            name: NSNotification.Name("capacitorDidReceiveRemoteNotification"),
            object: nil,
            userInfo: userInfo
        )

        completionHandler()
    }
}
