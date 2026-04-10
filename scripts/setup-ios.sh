#!/bin/bash
set -e

echo "=== iOS Setup Script ==="
echo ""

# 1. Build web assets
echo "📦 Building web assets..."
npm run build

# 2. Add iOS platform
echo "📱 Adding iOS platform..."
npx cap add ios || echo "iOS platform already exists, continuing..."

# 3. Sync
echo "🔄 Syncing Capacitor..."
npx cap sync ios

# 4. Patch Podfile to add FirebaseMessaging
PODFILE="ios/App/Podfile"
if ! grep -q "FirebaseMessaging" "$PODFILE"; then
  echo "🔧 Adding FirebaseMessaging to Podfile..."
  sed -i '' "s/target 'App' do/target 'App' do\n  pod 'FirebaseMessaging', '~> 11.0'/" "$PODFILE"
  echo "   ✅ FirebaseMessaging added to Podfile"
else
  echo "   ℹ️  FirebaseMessaging already in Podfile"
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

echo ""
echo "========================================="
echo "✅ iOS project setup complete!"
echo "========================================="
echo ""
echo "Now open ios/App/App.xcworkspace in Xcode and:"
echo ""
echo "1. Drag PushNotificationSetup.swift into the App group"
echo "   (ios/App/App/ folder, next to AppDelegate.swift)"
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
