// AppDelegate.swift
// Replace the default Capacitor AppDelegate with this file.
// It adds Firebase push notifications and manually registers the LiveActivity plugin.

import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Firebase + push notifications
        PushNotificationSetup.shared.configure(application: application)

        // Register local LiveActivity plugin with the Capacitor bridge.
        // Must be dispatched async so the bridge has finished initializing.
        DispatchQueue.main.async {
            if let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge {
                bridge.registerPluginInstance(LiveActivityPlugin())
                print("[LiveActivity] Plugin manually registered with bridge")
            } else {
                print("[LiveActivity] WARNING: Could not find Capacitor bridge to register plugin")
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
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
