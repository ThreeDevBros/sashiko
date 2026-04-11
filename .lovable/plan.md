

# Plan: Fix Customer Name Display + Live Activity Plugin Registration

## Issue 1: "Registered customer" instead of actual name

The recent change introduced `user_id ? (profiles?.full_name || 'Registered customer') : (guest_name || 'Guest')` but some authenticated users have their name stored in `guest_name` (from checkout forms) rather than `profiles.full_name`.

**Fix**: Change the fallback chain to also check `guest_name` before falling back to "Registered customer":

```
order.user_id
  ? (order.profiles?.full_name || order.guest_name || 'Registered customer')
  : (order.guest_name || 'Guest')
```

**Files to update** (4 files, same pattern in each):
- `src/pages/admin/OrderManagement.tsx`
- `src/pages/admin/StaffDashboard.tsx` (2 occurrences)
- `src/pages/staff/StaffOrders.tsx` (2 occurrences)
- `src/components/admin/MobileOrderCards.tsx`

## Issue 2: Live Activity plugin not registered

Your Xcode target membership is **correct** — the problem is different.

Capacitor's `CAPBridgedPlugin` auto-discovery only works for plugins installed via CocoaPods/SPM packages. **Local plugins** (Swift files added directly to the App target) must be manually registered in the AppDelegate.

**Fix**: Update `setup/swift/AppDelegate.swift` to register the LiveActivityPlugin with the Capacitor bridge after it initializes:

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: ...) -> Bool {
    PushNotificationSetup.shared.configure(application: application)

    // Register local Live Activity plugin with Capacitor bridge
    DispatchQueue.main.async {
        if let bridge = self.window?.rootViewController as? CAPBridgeViewController {
            bridge.bridge?.registerPluginInstance(LiveActivityPlugin())
        }
    }

    return true
}
```

This ensures the plugin appears in `Capacitor.Plugins` and will show `Plugin found: true` in logs.

**After code changes**, you will need to:
1. Copy the updated `AppDelegate.swift` to your Xcode project (replace the existing one)
2. Clean Build (Cmd+Shift+K) and Run

## Technical details

- The `registerPluginInstance()` call must happen after the bridge is initialized, hence the `DispatchQueue.main.async` wrapper
- The `.m` bridge file (`LiveActivityPlugin.m`) is NOT needed with this approach and should be deleted from the Xcode project if it still exists
- No changes needed to the JS-side code — it already correctly accesses `Capacitor.Plugins.LiveActivity`

