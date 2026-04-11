

# Plan: Create `/setup` Folder with All Native Files and Full Setup Guide

## Overview

Create a `/setup` directory containing every native file needed for the iOS build (ready to copy-paste into Xcode), plus a comprehensive `SETUP.md` that covers the entire iOS setup from scratch -- including push notifications, Live Activities, Firebase, Apple Sign In, Google Sign In, and Stripe.

## Files to create

### 1. `setup/SETUP.md`
Complete setup guide covering:
- **Prerequisites** (Xcode 15+, physical iOS device, Apple Developer account, Firebase project)
- **Step 1: Clean iOS rebuild** (`rm -rf ios`, `npm install`, `npm run build`, `npx cap add ios`, Xcode 26 `objectVersion` patch)
- **Step 2: Firebase setup** -- creating a Firebase project, downloading `GoogleService-Info.plist`, adding Firebase pods to Podfile, running `pod install`
- **Step 3: Adding native Swift/ObjC files** -- instructions to copy each file from this `/setup` folder into `ios/App/App/` in Xcode
- **Step 4: Widget Extension** -- Xcode steps to add `OrderTrackingWidget` target, share `GenericAttributes.swift`, replace widget UI
- **Step 5: Capabilities & Info.plist** -- Push Notifications capability, `NSSupportsLiveActivities`, `NSFaceIDUsageDescription`, etc.
- **Step 6: Secrets** -- APNs `.p8` key setup, `FIREBASE_SERVICE_ACCOUNT_JSON`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY_P8`
- **Step 7: Build & Run** (`npx cap sync ios`, `npx cap open ios`, select device, Cmd+R)
- **Push Notifications flow** -- how FCM tokens are captured in Swift AppDelegate, stored in UserDefaults, read by JS via Preferences plugin, and registered with the backend
- **Live Activities flow** -- client-side and server-side lifecycle
- **Troubleshooting** table
- **Quick Rebuild Cheatsheet**

### 2. `setup/swift/AppDelegate.swift`
Custom AppDelegate with:
- Firebase initialization (`FirebaseApp.configure()`)
- FCM delegate setup and token capture
- Storing FCM token in `UserDefaults` (key: `CapacitorStorage.fcm_push_token`) so the JS `Preferences` plugin can read it
- APNs token forwarding to `Messaging.messaging()`

### 3. `setup/swift/GenericAttributes.swift`
The shared `ActivityAttributes` struct (already written in the existing guide).

### 4. `setup/swift/LiveActivityPlugin.swift`
The custom Capacitor plugin for Live Activities (already written).

### 5. `setup/swift/LiveActivityPlugin.m`
The Objective-C bridge file (already written).

### 6. `setup/swift/OrderTrackingWidgetLiveActivity.swift`
The Widget Extension UI code for Lock Screen and Dynamic Island (already written).

## Technical details

- The `AppDelegate.swift` is new -- it replaces Capacitor's default AppDelegate to add Firebase/FCM token capture. This is critical because on iOS, the `PushNotifications.addListener('registration')` callback returns an APNs token, not an FCM token. The Swift code captures the real FCM token and stores it where the JS layer can read it.
- All `.swift` and `.m` files go into `ios/App/App/` except the widget file which goes into the widget extension target.
- The existing `docs/LIVE_ACTIVITIES_SETUP.md` will be replaced with a redirect pointing to `setup/SETUP.md` to avoid maintaining two copies.

## Files changed

| File | Change |
|------|--------|
| `setup/SETUP.md` | New -- comprehensive setup guide |
| `setup/swift/AppDelegate.swift` | New -- Firebase + FCM token capture |
| `setup/swift/GenericAttributes.swift` | New -- ActivityAttributes struct |
| `setup/swift/LiveActivityPlugin.swift` | New -- Capacitor Live Activity bridge |
| `setup/swift/LiveActivityPlugin.m` | New -- ObjC bridge |
| `setup/swift/OrderTrackingWidgetLiveActivity.swift` | New -- Widget UI |
| `docs/LIVE_ACTIVITIES_SETUP.md` | Updated to redirect to `setup/SETUP.md` |

