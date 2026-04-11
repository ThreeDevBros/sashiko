

# Fix: Xcode Build Errors

Two errors visible in your screenshot:

## Error 1: "Missing return in closure expected to return 'DynamicIsland'"

The `dynamicIsland:` closure on line 56 needs an explicit `return` before the `DynamicIsland {` initializer. Swift closures with multiple statements (the `let` bindings on lines 57-60) require an explicit `return` keyword.

### Fix in `setup/swift/OrderTrackingWidgetLiveActivity.swift`

Change line 62 from:
```swift
            DynamicIsland {
```
to:
```swift
            return DynamicIsland {
```

That single word fixes both the "missing return" error and the "result unused" warning.

## Error 2: "No such module 'FirebaseCore'" on AppDelegate

This means CocoaPods didn't install successfully (the `objectVersion = 70` failure from earlier prevented pods from being generated). Once you apply the `objectVersion` patch and re-run `pod install`, this error will resolve automatically.

### Steps on your Mac

1. **Patch objectVersion** (if not already done):
   ```bash
   sed -i '' 's/objectVersion = 70;/objectVersion = 77;/' ios/App/App.xcodeproj/project.pbxproj
   ```

2. **Fix the Swift file** -- open `ios/App/App/OrderTrackingWidgetLiveActivity.swift` in Xcode and add `return` before `DynamicIsland {` on line 62. (I will also update the file in the repo so future pulls have the fix.)

3. **Re-run pod install**:
   ```bash
   cd ios/App && pod install --repo-update && cd ../..
   ```

4. **Build again** in Xcode (Cmd+B).

## Files to update in the repo

| File | Change |
|------|--------|
| `setup/swift/OrderTrackingWidgetLiveActivity.swift` | Add `return` before `DynamicIsland {` on line 62 |

