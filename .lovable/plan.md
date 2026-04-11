

# Plan: Update Setup Guide for Full iOS Rebuild with Live Activities

Since there's no `capacitor-live-activity` npm package (it was removed due to Capacitor 7 incompatibility), the project uses a **custom native Swift plugin** accessed via `(Capacitor as any).Plugins?.LiveActivity`. The setup guide needs to be updated to reflect this reality.

## What I will do

Update `docs/LIVE_ACTIVITIES_SETUP.md` with a complete, accurate, step-by-step guide covering:

1. **Full iOS rebuild commands** (delete ios folder, `npx cap add ios`, objectVersion patch, Firebase pods, `pod install`, `npx cap sync ios`)

2. **Custom LiveActivityPlugin Swift code** — a complete Capacitor plugin file (`LiveActivityPlugin.swift` + `LiveActivityPlugin.m`) that you create inside `ios/App/App/` in Xcode, implementing:
   - `isAvailable()` — checks iOS 16.2+
   - `startActivityWithPush()` — starts a Live Activity with push token registration
   - `updateActivity()` — updates content state
   - `endActivity()` — ends the activity
   - Emits `liveActivityPushToken` event back to JS

3. **GenericAttributes.swift** — a shared `ActivityAttributes` struct using `[String: String]` dictionary for content state (no npm plugin to copy from, so we provide the file directly)

4. **Widget Extension setup** — step-by-step Xcode instructions + the full `OrderTrackingWidgetLiveActivity.swift` code (already written in the doc)

5. **Info.plist + Capabilities** — `NSSupportsLiveActivities`, Push Notifications

6. **APNs secrets** — where to get `.p8` key and how to add secrets

Remove all references to the `capacitor-live-activity` npm package since it's not used.

## Technical details

The custom plugin registers as `"LiveActivity"` in Capacitor's plugin registry, matching what `nativeLiveActivity.ts` expects at `(Capacitor as any).Plugins?.LiveActivity`. The `GenericAttributes` struct uses `ActivityAttributes` with a `ContentState` containing `values: [String: String]` to match the `buildContentState()` output.

## Files changed

| File | Change |
|------|--------|
| `docs/LIVE_ACTIVITIES_SETUP.md` | Complete rewrite with accurate custom plugin instructions |

