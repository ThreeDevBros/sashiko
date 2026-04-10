#!/bin/bash
set -e

echo "=== iOS Setup Script ==="
echo ""

# 0. Clean any previous iOS build
if [ -d "ios" ]; then
  echo "🧹 Removing existing ios/ directory..."
  rm -rf ios
fi

# 1. Build web assets
echo "📦 Building web assets..."
npm run build

# 2. Add iOS platform
echo "📱 Adding iOS platform..."
npx cap add ios

# 3. Sync
echo "🔄 Syncing Capacitor..."
npx cap sync ios

# 4. Patch Podfile to add FirebaseMessaging
PODFILE="ios/App/Podfile"
if ! grep -q "FirebaseMessaging" "$PODFILE"; then
  echo "🔧 Adding Firebase pods to Podfile..."
  sed -i '' "s/target 'App' do/target 'App' do\n  pod 'FirebaseCore', '~> 11.0'\n  pod 'FirebaseMessaging', '~> 11.0'/" "$PODFILE"
  echo "   ✅ FirebaseCore + FirebaseMessaging added to Podfile"
else
  echo "   ℹ️  Firebase pods already in Podfile"
fi

# 5. Pod install
echo "🍫 Installing CocoaPods dependencies..."
cd ios/App
pod install --repo-update
cd ../..

# 6. Disable User Script Sandboxing
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
  echo "🔧 Disabling User Script Sandboxing..."
  sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES/ENABLE_USER_SCRIPT_SANDBOXING = NO/g' "$PBXPROJ"
  echo "   ✅ User Script Sandboxing disabled"
fi

# 7. Copy PushNotificationSetup.swift from scripts/
SWIFT_SRC="scripts/PushNotificationSetup.swift"
SWIFT_DST="ios/App/App/PushNotificationSetup.swift"
if [ -f "$SWIFT_SRC" ]; then
  echo "📋 Copying PushNotificationSetup.swift into Xcode project..."
  cp "$SWIFT_SRC" "$SWIFT_DST"
  echo "   ✅ Copied to $SWIFT_DST"
else
  echo "   ⚠️  $SWIFT_SRC not found — you'll need to add it manually"
fi

# 8. Patch AppDelegate.swift to call PushNotificationSetup
APPDELEGATE="ios/App/App/AppDelegate.swift"
if [ -f "$APPDELEGATE" ] && ! grep -q "PushNotificationSetup" "$APPDELEGATE"; then
  echo "🔧 Patching AppDelegate.swift..."
  sed -i '' '/return true/i\
        PushNotificationSetup.shared.configure()
' "$APPDELEGATE"
  echo "   ✅ AppDelegate patched with PushNotificationSetup.shared.configure()"
else
  echo "   ℹ️  AppDelegate already patched or not found"
fi

echo ""
echo "========================================="
echo "✅ iOS project setup complete!"
echo "========================================="
echo ""
echo "Now open ios/App/App.xcworkspace in Xcode and:"
echo ""
echo "1. Add PushNotificationSetup.swift to the App target"
echo "   (Right-click App group → Add Files → select ios/App/App/PushNotificationSetup.swift)"
echo ""
echo "2. Drag GoogleService-Info.plist into the App group"
echo ""
echo "3. Under Signing & Capabilities, add:"
echo "   - Push Notifications"
echo "   - Sign in with Apple"
echo "   - Apple Pay (Merchant ID: merchant.sashiko.app)"
echo ""
echo "4. Verify User Script Sandboxing = No in Build Settings"
echo "   (for both App and Pods targets)"
echo ""
echo "5. Build and run! 🚀"
