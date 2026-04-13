// GoogleAuthPlugin.swift
// Custom Capacitor plugin for native Google Sign-In on iOS.
// Uses Google Sign-In SDK directly — no npm dependency needed.
//
// Client ID resolution:
//   • iOS Client ID  → GoogleService-Info.plist → CLIENT_ID
//   • Web Client ID  → capacitor.config.ts → plugins.GoogleAuth.serverClientId
//                      (fallback: GoogleService-Info.plist → SERVER_CLIENT_ID)
//
// The iOS client ID is used for the native sign-in UI.
// The Web/server client ID is sent as the audience so Supabase can validate
// the returned ID token.
//
// Nonce flow:
//   JS generates rawNonce, computes sha256(rawNonce) = nonceDigest,
//   passes nonceDigest to signIn(). The plugin forwards it to GIDSignIn
//   so the returned ID token includes nonce = nonceDigest.
//   JS then calls signInWithIdToken(token, nonce: rawNonce) — Supabase
//   validates sha256(rawNonce) == id_token.nonce.

import Capacitor
import GoogleSignIn
import CryptoKit

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    private let buildMarker = "2026-04-13-nonce-v1"

    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        super.load()
        print("[GoogleAuthPlugin] load() build=\(buildMarker)")
        _ = configureIfPossible(context: "plugin-load")
    }

    // MARK: – helpers

    private func sanitize(_ value: String?) -> String? {
        guard let v = value, !v.isEmpty, !v.contains("YOUR_") else { return nil }
        return v
    }

    /// iOS client ID from GoogleService-Info.plist → CLIENT_ID
    private func getIOSClientId() -> String? {
        if let plistPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let dict = NSDictionary(contentsOfFile: plistPath),
           let clientId = sanitize(dict["CLIENT_ID"] as? String) {
            print("[GoogleAuthPlugin] iOS client ID from plist prefix: \(clientId.prefix(20))… build=\(buildMarker)")
            return clientId
        }
        // Fallback: GIDClientID in Info.plist
        if let clientId = sanitize(Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String) {
            print("[GoogleAuthPlugin] iOS client ID from Info.plist GIDClientID build=\(buildMarker)")
            return clientId
        }
        return nil
    }

    /// Web / server client ID – needed so the ID token audience matches what Supabase expects.
    /// Priority: capacitor.config.ts → GoogleService-Info.plist → nil
    private func getServerClientId() -> String? {
        if let configId = sanitize(getConfigValue("serverClientId") as? String) {
            print("[GoogleAuthPlugin] Server client ID from Capacitor config build=\(buildMarker)")
            return configId
        }
        if let plistPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let dict = NSDictionary(contentsOfFile: plistPath),
           let serverId = sanitize(dict["SERVER_CLIENT_ID"] as? String) {
            print("[GoogleAuthPlugin] Server client ID from plist build=\(buildMarker)")
            return serverId
        }
        return nil
    }

    @discardableResult
    private func configureIfPossible(context: String) -> Bool {
        guard let iosClientId = getIOSClientId() else {
            print("[GoogleAuthPlugin] No iOS client ID found during \(context). build=\(buildMarker)")
            return false
        }

        let serverClientId = getServerClientId()
        
        if serverClientId == nil {
            print("[GoogleAuthPlugin] ⚠️ WARNING: No serverClientId found! The ID token audience will be the iOS client ID, which Supabase will reject. Add SERVER_CLIENT_ID to GoogleService-Info.plist or set serverClientId in capacitor.config.ts. build=\(buildMarker)")
        }
        
        print("[GoogleAuthPlugin] Configuring GIDSignIn during \(context) – iOS: \(iosClientId.prefix(30))… server: \(serverClientId?.prefix(30) ?? "⚠️ NIL") build=\(buildMarker)")

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: iosClientId,
            serverClientID: serverClientId
        )
        return true
    }

    // MARK: – plugin methods

    @objc func signIn(_ call: CAPPluginCall) {
        let nonceDigest = call.getString("nonce")
        print("[GoogleAuthPlugin] signIn called nonce=\(nonceDigest != nil ? "present(\(nonceDigest!.prefix(8))…)" : "nil") build=\(buildMarker)")
        
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("No view controller available")
                return
            }

            let hasConfig = GIDSignIn.sharedInstance.configuration != nil
            print("[GoogleAuthPlugin] Existing config before signIn: \(hasConfig) build=\(self.buildMarker)")

            guard hasConfig || self.configureIfPossible(context: "sign-in") else {
                call.reject("Google Sign-In not configured: missing CLIENT_ID in GoogleService-Info.plist")
                return
            }

            print("[GoogleAuthPlugin] Presenting sign-in from \(type(of: vc)) build=\(self.buildMarker)")
            
            // Use the nonce-capable sign-in overload when a nonce digest is provided
            if let nonce = nonceDigest {
                GIDSignIn.sharedInstance.signIn(withPresenting: vc, hint: nil, additionalScopes: nil, nonce: nonce) { result, error in
                    self.handleSignInResult(result: result, error: error, call: call)
                }
            } else {
                GIDSignIn.sharedInstance.signIn(withPresenting: vc) { result, error in
                    self.handleSignInResult(result: result, error: error, call: call)
                }
            }
        }
    }
    
    private func handleSignInResult(result: GIDSignInResult?, error: Error?, call: CAPPluginCall) {
        if let error = error {
            let ns = error as NSError
            print("[GoogleAuthPlugin] signIn error code=\(ns.code) msg=\(error.localizedDescription)")
            if ns.code == -5 || ns.code == GIDSignInError.canceled.rawValue {
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

        print("[GoogleAuthPlugin] Success – email: \(user.profile?.email ?? "?") build=\(self.buildMarker)")
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

    @objc func signOut(_ call: CAPPluginCall) {
        GIDSignIn.sharedInstance.signOut()
        call.resolve()
    }
}
