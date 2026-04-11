# iOS Live Activities Setup Guide

Complete guide to rebuild the iOS project from scratch with Live Activities support.

## Prerequisites

- Mac with Xcode 15+ installed
- iOS 16.2+ physical device (Live Activities don't work in Simulator)
- Apple Developer account with Push Notifications capability
- Project exported to GitHub and cloned locally

---

## Step 1: Clean Rebuild of iOS Project

```bash
# From the project root
rm -rf ios

npm install
npm run build
npx cap add ios
npx cap sync ios
```

### Xcode 26 Compatibility Fix

If you're using Xcode 26 (beta or release), patch the project format:

```bash
sed -i '' 's/objectVersion = 70;/objectVersion = 77;/' ios/App/App.xcodeproj/project.pbxproj
```

---

## Step 2: Add Firebase Pods

Edit `ios/App/Podfile` and add these lines inside the `target 'App'` block:

```ruby
target 'App' do
  capacitor_pods
  # Add these two lines:
  pod 'FirebaseCore', '~> 11.0'
  pod 'FirebaseMessaging', '~> 11.0'
end
```

Then install pods:

```bash
cd ios/App
pod install --repo-update
cd ../..
```

---

## Step 3: Create the Custom LiveActivity Plugin

Since there is no npm package for Live Activities on Capacitor 7, you need a custom native Swift plugin. Create these files in Xcode inside `ios/App/App/`.

### 3a. `GenericAttributes.swift`

This is the shared `ActivityAttributes` struct used by both the plugin and the widget.

```swift
import ActivityKit
import Foundation

struct GenericAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var values: [String: String]
    }
}
```

### 3b. `LiveActivityPlugin.swift`

```swift
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startActivityWithPush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endActivity", returnType: CAPPluginReturnPromise),
    ]

    // Track running activities by our custom ID
    private var activityMap: [String: String] = [:]  // customId -> Activity.id

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["value": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["value": false])
        }
    }

    @objc func startActivityWithPush(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard let id = call.getString("id"),
              let contentStateDict = call.getObject("contentState") as? [String: String] else {
            call.reject("Missing 'id' or 'contentState'")
            return
        }

        let attributes = GenericAttributes()
        let state = GenericAttributes.ContentState(values: contentStateDict)

        do {
            let content = ActivityContent(state: state, staleDate: nil)
            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: .token
            )

            activityMap[id] = activity.id

            // Observe push token
            Task {
                for await tokenData in activity.pushTokenUpdates {
                    let token = tokenData.map { String(format: "%02x", $0) }.joined()
                    self.notifyListeners("liveActivityPushToken", data: [
                        "token": token,
                        "activityId": id
                    ])
                }
            }

            call.resolve(["activityId": activity.id])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard let id = call.getString("id"),
              let contentStateDict = call.getObject("contentState") as? [String: String] else {
            call.reject("Missing 'id' or 'contentState'")
            return
        }

        let state = GenericAttributes.ContentState(values: contentStateDict)

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == activityMap[id] {
                    let content = ActivityContent(state: state, staleDate: nil)
                    await activity.update(content)
                    call.resolve()
                    return
                }
            }
            call.reject("Activity not found for id: \(id)")
        }
    }

    @objc func endActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard let id = call.getString("id") else {
            call.reject("Missing 'id'")
            return
        }

        let contentStateDict = call.getObject("contentState") as? [String: String]

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == activityMap[id] {
                    let finalState: GenericAttributes.ContentState
                    if let dict = contentStateDict {
                        finalState = GenericAttributes.ContentState(values: dict)
                    } else {
                        finalState = activity.content.state
                    }
                    let content = ActivityContent(state: finalState, staleDate: nil)
                    await activity.end(content, dismissalPolicy: .after(.now + 300))
                    activityMap.removeValue(forKey: id)
                    call.resolve()
                    return
                }
            }
            call.resolve() // Already ended or not found — not an error
        }
    }
}
```

### 3c. `LiveActivityPlugin.m` (Objective-C bridge)

```objc
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivity",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startActivityWithPush, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(endActivity, CAPPluginReturnPromise);
)
```

### How to add these files in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Right-click the **App** folder in the navigator → **New File…**
3. Choose **Swift File**, name it `GenericAttributes.swift` → paste the code
4. Repeat for `LiveActivityPlugin.swift`
5. Choose **Objective-C File**, name it `LiveActivityPlugin.m` → paste the code
6. If Xcode asks to create a bridging header, click **Create**

---

## Step 4: Add a Widget Extension

1. In Xcode: **File → New → Target…**
2. Choose **Widget Extension**
3. Name it `OrderTrackingWidget`
4. ✅ Check **"Include Live Activity"**
5. Click **Finish**

### Share `GenericAttributes.swift` with the widget

1. Select `GenericAttributes.swift` in the file navigator
2. In the **File Inspector** (right panel), under **Target Membership**, check both:
   - ✅ **App**
   - ✅ **OrderTrackingWidgetExtension**

### Replace the widget UI

Open `OrderTrackingWidgetLiveActivity.swift` and replace with:

```swift
import ActivityKit
import WidgetKit
import SwiftUI

struct OrderTrackingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            let status = context.state.values["status"] ?? "pending"
            let orderNumber = context.state.values["orderNumber"] ?? "#000"
            let statusMessage = context.state.values["statusMessage"] ?? "Processing…"
            let etaText = context.state.values["etaMinutes"] ?? ""

            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(statusColor(status).opacity(0.15))
                        .frame(width: 44, height: 44)
                    Image(systemName: statusIcon(status))
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(statusColor(status))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Order \(orderNumber)")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    Text(statusMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                    VStack(spacing: 1) {
                        Text("\(mins)")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(statusColor(status))
                        Text("min")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .frame(minWidth: 48)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(.clear)

        } dynamicIsland: { context in
            let status = context.state.values["status"] ?? "pending"
            let orderNumber = context.state.values["orderNumber"] ?? "#000"
            let statusMessage = context.state.values["statusMessage"] ?? ""
            let etaText = context.state.values["etaMinutes"] ?? ""

            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: statusIcon(status))
                            .foregroundColor(statusColor(status))
                        Text(orderNumber)
                            .font(.headline)
                            .fontWeight(.bold)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                        Text("~\(mins) min")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(statusColor(status))
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(statusMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            } compactLeading: {
                Image(systemName: statusIcon(status))
                    .foregroundColor(statusColor(status))
            } compactTrailing: {
                if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                    Text("\(mins)m")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(statusColor(status))
                } else {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 6))
                        .foregroundColor(statusColor(status))
                }
            } minimal: {
                Image(systemName: statusIcon(status))
                    .foregroundColor(statusColor(status))
            }
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "pending":          return "clock"
        case "confirmed":        return "checkmark.circle"
        case "preparing":        return "frying.pan"
        case "ready":            return "bag.fill"
        case "out_for_delivery": return "car.fill"
        case "delivered":        return "checkmark.seal.fill"
        case "cancelled":        return "xmark.circle.fill"
        default:                 return "circle"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "pending":          return .orange
        case "confirmed":        return .blue
        case "preparing":        return .orange
        case "ready":            return .green
        case "out_for_delivery": return .blue
        case "delivered":        return .green
        case "cancelled":        return .red
        default:                 return .gray
        }
    }
}
```

---

## Step 5: Configure Capabilities & Info.plist

### Main App Target

1. Select the **App** target → **Signing & Capabilities**
2. Click **+ Capability** → add **Push Notifications**
3. In `Info.plist`, add:

```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

---

## Step 6: Configure APNs Secrets

You need an APNs Auth Key (`.p8` file) for server-driven Live Activity updates.

### Get your .p8 key

1. Go to [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click **+** → name it (e.g., "Live Activities APNs Key")
3. ✅ Check **Apple Push Notifications service (APNs)**
4. Click **Continue → Register**
5. **Download the .p8 file** (one-time download!)
6. Note the **Key ID** (10 characters)
7. Note your **Team ID** from [Membership](https://developer.apple.com/account/#/membership/)

### Add secrets in Lovable

Ask me to add these secrets:

- **`APNS_KEY_ID`** — 10-character Key ID from Apple
- **`APNS_TEAM_ID`** — 10-character Team ID
- **`APNS_AUTH_KEY_P8`** — Full contents of the `.p8` file (including BEGIN/END lines)
- **`APNS_ENVIRONMENT`** *(optional)* — `development` for testing, `production` for App Store (default: `production`)

---

## Step 7: Build & Run

```bash
npm run build
npx cap sync ios
npx cap open ios
```

1. Select your physical iOS device in Xcode
2. Build and run (Cmd + R)
3. Place an order → navigate to Order Tracking
4. The Live Activity appears on Lock Screen and Dynamic Island!

---

## How It Works

### Client-side flow

1. User opens `/order-tracking/:id` → app calls `startOrderLiveActivity()`
2. The custom `LiveActivityPlugin` starts a Live Activity with push token support
3. Plugin emits `liveActivityPushToken` event with the APNs push-to-update token
4. Token is saved to the `live_activity_tokens` database table
5. On each status change, `updateOrderLiveActivity()` updates the widget locally
6. On delivery/cancellation, `endOrderLiveActivity()` dismisses it after 5 minutes

### Server-side flow

1. Staff changes order status → `send-order-push` edge function runs
2. It checks `live_activity_tokens` for the order
3. If tokens exist, sends an APNs `liveactivity` push to update the widget remotely
4. Every 2 minutes, `update-order-eta` refreshes the ETA on active Live Activities
5. On terminal status, sends `event: 'end'` with auto-dismiss

### Content State Schema

| Key | Example | Description |
|-----|---------|-------------|
| `status` | `"preparing"` | Current order status |
| `orderNumber` | `"#042"` | Display order number |
| `orderType` | `"delivery"` | delivery/pickup/dine_in |
| `statusMessage` | `"Your food is being prepared"` | Human-readable status |
| `etaMinutes` | `"12"` | Minutes until ready (empty if unknown) |
| `updatedAt` | `"2026-04-11T05:30:00Z"` | ISO timestamp of last update |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Live Activity doesn't appear | Ensure `NSSupportsLiveActivities` is `true` in Info.plist. Must use a real device. |
| Widget shows generic content | Make sure `GenericAttributes.swift` is added to **both** the App and Widget targets. |
| Push updates don't work | Verify APNs secrets are configured. Check `APNS_ENVIRONMENT` matches your build. |
| Token not registering | Check console for `[LiveActivity] Push token received:` logs. |
| `objectVersion 70` pod error | Run the `sed` command from Step 1 to patch the Xcode project format. |

---

## Quick Rebuild Cheatsheet

When you pull new changes and need to rebuild iOS:

```bash
rm -rf ios
npm install && npm run build
npx cap add ios && npx cap sync ios

# Xcode 26 fix (if needed)
sed -i '' 's/objectVersion = 70;/objectVersion = 77;/' ios/App/App.xcodeproj/project.pbxproj

# Add Firebase pods to ios/App/Podfile, then:
cd ios/App && pod install && cd ../..

npx cap open ios
```

Then in Xcode, re-add the 3 plugin files + Widget Extension as described above.
