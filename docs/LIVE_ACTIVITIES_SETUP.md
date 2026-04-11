# iOS Live Activities Setup Guide

This guide walks you through setting up Live Activities for order tracking in your native iOS app.

## Prerequisites
- Mac with Xcode 15+ installed
- iOS 16.2+ device (Live Activities don't work in Simulator)
- Apple Developer account with Push Notifications capability
- The project pulled from GitHub with `npx cap sync ios` completed

---

## Step 1: Install the Plugin

The `capacitor-live-activity` npm package is already installed. After pulling:

```bash
npm install
npx cap sync ios
```

---

## Step 2: Add a Widget Extension in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Go to **File → New → Target…**
3. Choose **Widget Extension**
4. Name it `OrderTrackingWidget`
5. ✅ Check **"Include Live Activity"**
6. Click **Finish**

---

## Step 3: Copy `GenericAttributes.swift` to Your Widget

The plugin uses a shared struct called `GenericAttributes` that both the main app and widget need.

1. In Xcode's File Navigator, expand: **Pods → CapacitorLiveActivity → Shared**
2. Find `GenericAttributes.swift`
3. Drag it into your `OrderTrackingWidget` folder
4. ✅ Check **"Copy items if needed"**
5. Make sure `OrderTrackingWidget` is selected as the target

---

## Step 4: Replace the Widget UI

Open `OrderTrackingWidgetLiveActivity.swift` (auto-generated) and replace its contents with:

```swift
import ActivityKit
import WidgetKit
import SwiftUI

struct OrderTrackingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            // ── Lock Screen / StandBy banner ──
            let status = context.state.values["status"] ?? "pending"
            let orderNumber = context.state.values["orderNumber"] ?? "#000"
            let statusMessage = context.state.values["statusMessage"] ?? "Processing…"
            let etaText = context.state.values["etaMinutes"] ?? ""
            
            HStack(spacing: 12) {
                // Status icon
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
                
                // ETA badge
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
                // ── Expanded view ──
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
                
            // ── Compact (pill) views ──
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
                
            // ── Minimal (single icon) ──
            } minimal: {
                Image(systemName: statusIcon(status))
                    .foregroundColor(statusColor(status))
            }
        }
    }
    
    // MARK: - Helpers
    
    private func statusIcon(_ status: String) -> String {
        switch status {
        case "pending":          return "clock"
        case "confirmed":        return "checkmark.circle"
        case "preparing":        return "frying.pan"
        case "ready":            return "bag.fill"
        case "out_for_delivery", "onTheWay": return "car.fill"
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
        case "out_for_delivery", "onTheWay": return .blue
        case "delivered":        return .green
        case "cancelled":        return .red
        default:                 return .gray
        }
    }
}
```

---

## Step 5: Add Capabilities

### Main App Target
1. Select your **App** target in Xcode
2. Go to **Signing & Capabilities**
3. Click **+ Capability** and add:
   - ✅ **Push Notifications**
4. In **Info.plist** add:
```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

### Widget Extension Target
No special capabilities needed — it inherits from the app.

---

## Step 6: Configure APNs Secrets

You need an APNs Auth Key (.p8 file) for server-driven Live Activity updates.

### Get your .p8 key:
1. Go to [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click **+** to create a new key
3. Name it (e.g., "Live Activities APNs Key")
4. ✅ Check **Apple Push Notifications service (APNs)**
5. Click **Continue → Register**
6. **Download the .p8 file** (you can only download once!)
7. Note the **Key ID** shown on the page
8. Note your **Team ID** from [Account → Membership](https://developer.apple.com/account/#/membership/)

### Add secrets to Lovable:
In Lovable, I'll need to add these three secrets. Tell me when you have the values ready:

- **`APNS_KEY_ID`** — The 10-character Key ID from Apple
- **`APNS_TEAM_ID`** — Your 10-character Apple Developer Team ID
- **`APNS_AUTH_KEY_P8`** — The full contents of the .p8 file (paste the entire file including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

Optionally:
- **`APNS_ENVIRONMENT`** — Set to `development` for testing, or `production` for App Store builds (defaults to `production`)

---

## Step 7: Build & Test

```bash
# Build the web app
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

1. Select your physical iOS device
2. Build and run (Cmd + R)
3. Place an order and navigate to Order Tracking
4. The Live Activity should appear on your Lock Screen and Dynamic Island!

---

## How It Works

### Client-side flow:
1. When a user opens `/order-tracking/:id`, the app calls `startOrderLiveActivity()`
2. This starts a local Live Activity via `capacitor-live-activity` plugin with push support
3. The plugin emits a `liveActivityPushToken` event with the APNs push-to-update token
4. The token is saved to the `live_activity_tokens` database table
5. On each status change, `updateOrderLiveActivity()` updates the widget locally
6. When the order is delivered/cancelled, `endOrderLiveActivity()` dismisses it

### Server-side flow:
1. When staff changes order status → `send-order-push` edge function runs
2. It checks `live_activity_tokens` for the order
3. If tokens exist, sends an APNs `liveactivity` push to update the widget remotely
4. Every 2 minutes, `update-order-eta` refreshes the ETA countdown on active Live Activities
5. On terminal status, sends `event: 'end'` with a 5-minute auto-dismiss

### Content State Schema:
The widget receives these values as `context.state.values[key]`:
| Key | Example | Description |
|-----|---------|-------------|
| `status` | `"preparing"` | Current order status |
| `orderNumber` | `"#042"` | Display order number |
| `orderType` | `"delivery"` | delivery/pickup/dine_in |
| `statusMessage` | `"Your food is being prepared"` | Human-readable status |
| `etaMinutes` | `"12"` | Minutes until ready (empty string if unknown) |
| `updatedAt` | `"2026-04-11T05:30:00Z"` | ISO timestamp of last update |

---

## Troubleshooting

- **Live Activity doesn't appear**: Make sure `NSSupportsLiveActivities` is `true` in Info.plist and you're on a real device (not Simulator)
- **Widget shows generic content**: Make sure you copied `GenericAttributes.swift` to the widget target
- **Push updates don't work**: Verify APNs secrets are configured and `APNS_ENVIRONMENT` matches your build (development vs production)
- **Token not registering**: Check the browser console for `[LiveActivity] Push token received:` logs
