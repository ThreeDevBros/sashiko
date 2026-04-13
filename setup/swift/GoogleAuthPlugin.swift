// GoogleAuthPlugin.swift
// Custom Capacitor plugin for native Google Sign-In on iOS.
// Uses Google Sign-In SDK directly — no npm dependency needed.

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

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("No view controller available")
                return
            }

            GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
                if let error = error {
                    let nsError = error as NSError
                    // User cancelled — code -5 is GIDSignInError.canceled
                    if nsError.code == -5 || nsError.code == GIDSignInError.canceled.rawValue {
                        call.reject("The user canceled the sign-in flow.", "12501")
                        return
                    }
                    call.reject(error.localizedDescription)
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    call.reject("No ID token received from Google")
                    return
                }

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
        GIDSignIn.sharedInstance.signOut()
        call.resolve()
    }
}
