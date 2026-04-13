// GoogleAuthPlugin.swift
// Custom Capacitor plugin for native Google Sign-In on iOS.
// Uses Google Sign-In SDK directly — no npm dependency needed.
// Reads serverClientId from Capacitor config (GoogleAuth.serverClientId)
// so you don't need to manually edit Info.plist.

import Capacitor
import GoogleSignIn

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    private let buildMarker = "2026-04-13-load-config-v3"

    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        super.load()
        print("[GoogleAuthPlugin] load() build=\(buildMarker)")
        _ = configureGoogleSignInIfPossible(context: "plugin-load")
    }

    private func sanitizeClientId(_ value: String?) -> String? {
        guard let value, !value.isEmpty, !value.contains("YOUR_") else {
            return nil
        }

        return value
    }

    /// Read the Web Client ID from capacitor.config.ts → plugins.GoogleAuth.serverClientId
    private func getClientId() -> String? {
        // Try Capacitor plugin config first
        if let configId = sanitizeClientId(getConfigValue("serverClientId") as? String) {
            print("[GoogleAuthPlugin] Resolved client ID from Capacitor config build=\(buildMarker)")
            return configId
        }
        // Fall back to Info.plist
        if let plistId = sanitizeClientId(Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String) {
            print("[GoogleAuthPlugin] Resolved client ID from Info.plist build=\(buildMarker)")
            return plistId
        }
        return nil
    }

    @discardableResult
    private func configureGoogleSignInIfPossible(context: String) -> Bool {
        guard let clientId = getClientId() else {
            print("[GoogleAuthPlugin] No valid client ID found during \(context). build=\(buildMarker)")
            return false
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        print("[GoogleAuthPlugin] Configured Google Sign-In during \(context) with client ID prefix: \(clientId.prefix(20))... build=\(buildMarker)")
        return true
    }

    @objc func signIn(_ call: CAPPluginCall) {
        print("[GoogleAuthPlugin] signIn called build=\(buildMarker)")
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                print("[GoogleAuthPlugin] No view controller available")
                call.reject("No view controller available")
                return
            }

            let hasConfiguration = GIDSignIn.sharedInstance.configuration != nil
            print("[GoogleAuthPlugin] Existing configuration before sign-in: \(hasConfiguration) build=\(self.buildMarker)")

            guard hasConfiguration || self.configureGoogleSignInIfPossible(context: "sign-in") else {
                print("[GoogleAuthPlugin] ERROR: No Google Client ID found. Set serverClientId in capacitor.config.ts or GIDClientID in Info.plist.")
                call.reject("Google Sign-In not configured: missing client ID. Set serverClientId in capacitor.config.ts under plugins.GoogleAuth")
                return
            }

            print("[GoogleAuthPlugin] Presenting from view controller: \(type(of: viewController)) build=\(self.buildMarker)")
            GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
                if let error = error {
                    let nsError = error as NSError
                    print("[GoogleAuthPlugin] signIn error code=\(nsError.code) message=\(error.localizedDescription)")
                    if nsError.code == -5 || nsError.code == GIDSignInError.canceled.rawValue {
                        call.reject("The user canceled the sign-in flow.", "12501")
                        return
                    }
                    call.reject(error.localizedDescription)
                    return
                }

                print("[GoogleAuthPlugin] signIn callback success, has user: \(result?.user != nil)")
                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    print("[GoogleAuthPlugin] Missing ID token in result")
                    call.reject("No ID token received from Google")
                    return
                }

                print("[GoogleAuthPlugin] Received tokens for email: \(user.profile?.email ?? "unknown")")
                call.resolve([
                    "authentication": [
                        "idToken": idToken,
                        "accessToken": user.accessToken.tokenString,
                    ],
                    "email": user.profile?.email ?? "",
                    "familyName": user.profile?.familyName ?? "",
                    "givenName": user.profile?.givenName ?? "",
                    "id": user.userID ?? "",
                    "name": user.profile?.name ?? "",
                ])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        print("[GoogleAuthPlugin] signOut called")
        GIDSignIn.sharedInstance.signOut()
        call.resolve()
    }
}
