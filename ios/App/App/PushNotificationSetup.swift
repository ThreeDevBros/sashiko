import UIKit
import FirebaseCore
import FirebaseMessaging
import Capacitor

final class PushNotificationSetup: NSObject, MessagingDelegate, UNUserNotificationCenterDelegate {

    static let shared = PushNotificationSetup()

    // ── Supabase config (same values already shipped in the web bundle) ──
    private let supabaseUrl = "https://cqzprtgcptqusmospdys.supabase.co"
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxenBydGdjcHRxdXNtb3NwZHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDA1NzUsImV4cCI6MjA5MDM3NjU3NX0.RvFLuvD-T9afp8r_EZ1vp0_2HvIPSFoJ5CRhwtHC5vk"

    // Key used by @capacitor/preferences to read from JS
    private let prefsKey = "CapacitorStorage.fcm_push_token"

    private override init() { super.init() }

    // Called from AppDelegate
    func configure() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self

        print("[PushSetup] Firebase configured & delegates set")
    }

    // MARK: - MessagingDelegate

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, !token.isEmpty else { return }
        print("[PushSetup] FCM token: \(token.prefix(20))...")

        // 1. Persist to UserDefaults so JS can read via @capacitor/preferences
        UserDefaults.standard.set(token, forKey: prefsKey)

        // 2. Upsert to Supabase directly (guest row, user_id = null)
        upsertTokenToSupabase(token: token)
    }

    // MARK: - Foreground notification display

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner even when app is in foreground
        handler([.banner, .sound, .badge])
    }

    // MARK: - APNs → Capacitor bridge (keeps plugin working as fallback)

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

    // MARK: - Supabase REST upsert

    private func upsertTokenToSupabase(token: String) {
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/push_device_tokens") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        // Upsert on token conflict
        request.setValue("token", forHTTPHeaderField: "on-conflict")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        // Supabase requires both apikey header and Authorization
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "token": token,
            "platform": "ios",
            "updated_at": ISO8601DateFormatter().string(from: Date())
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        // Prefer header can only appear once — combine directives
        request.setValue("return=minimal,resolution=merge-duplicates", forHTTPHeaderField: "Prefer")

        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                print("[PushSetup] Supabase upsert error: \(error.localizedDescription)")
                return
            }
            if let http = response as? HTTPURLResponse {
                if (200...299).contains(http.statusCode) {
                    print("[PushSetup] Token saved to Supabase ✅")
                } else {
                    print("[PushSetup] Supabase upsert HTTP \(http.statusCode)")
                }
            }
        }.resume()
    }
}
