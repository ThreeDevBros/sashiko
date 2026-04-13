// GoogleAuthPlugin.swift
// Custom Capacitor plugin for native Google Sign-In on iOS.
// Uses Google Sign-In SDK directly — no npm dependency needed.
// Reads serverClientId from Capacitor config (GoogleAuth.serverClientId)
// so you don't need to manually edit Info.plist.

import Capacitor
import GoogleSignIn

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    /// Read the Web Client ID from capacitor.config.ts → plugins.GoogleAuth.serverClientId
    private func getClientId() -> String? {
        // Try Capacitor plugin config first
        if let configId = getConfigValue("serverClientId") as? String, !configId.isEmpty,
           !configId.contains("YOUR_") {
            return configId
        }
        // Fall back to Info.plist
        if let plistId = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String, !plistId.isEmpty {
            return plistId
        }
        return nil
    }

    @objc func signIn(_ call: CAPPluginCall) {
        print("[GoogleAuthPlugin] signIn called")
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                print("[GoogleAuthPlugin] No view controller available")
                call.reject("No view controller available")
                return
            }

            print("[GoogleAuthPlugin] Presenting from view controller: \(type(of: viewController))")
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
