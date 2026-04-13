// AppDelegate.swift
// Replace the default Capacitor AppDelegate with this file.
// It adds Firebase push notifications and manually registers the LiveActivity plugin.

// AppDelegate.swift
// Replace the default Capacitor AppDelegate with this file.
// It adds Firebase push notifications, Google Sign-In, and the LiveActivity plugin.

import UIKit
import Capacitor
import GoogleSignIn

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        print("[AppDelegate] didFinishLaunchingWithOptions")
        // Initialize Firebase + push notifications
        PushNotificationSetup.shared.configure(application: application)

        // Register local plugins with the Capacitor bridge.
        // Must be dispatched async so the bridge has finished initializing.
        DispatchQueue.main.async {
            if let bridgeViewController = self.window?.rootViewController as? CAPBridgeViewController,
               let bridge = bridgeViewController.bridge {
                bridge.registerPluginInstance(LiveActivityPlugin())
                bridge.registerPluginInstance(GoogleAuthPlugin())
                print("[Plugins] LiveActivity + GoogleAuth registered with bridge")
                print("[Plugins] Bridge view controller: \(type(of: bridgeViewController))")
            } else {
                print("[Plugins] WARNING: Could not find Capacitor bridge to register plugins")
                print("[Plugins] Root view controller: \(String(describing: self.window?.rootViewController))")
            }
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        print("[AppDelegate] openURL: \(url.absoluteString)")
        let handledByGoogle = GIDSignIn.sharedInstance.handle(url)
        print("[AppDelegate] handledByGoogle: \(handledByGoogle)")
        if handledByGoogle {
            return true
        }
        let handledByCapacitor = ApplicationDelegateProxy.shared.application(app, open: url, options: options)
        print("[AppDelegate] handledByCapacitor: \(handledByCapacitor)")
        return handledByCapacitor
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        print("[AppDelegate] continueUserActivity: \(userActivity.activityType)")
        let handled = ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
        print("[AppDelegate] continueUserActivity handled: \(handled)")
        return handled
    }
}
