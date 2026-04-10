#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_DIR="$SCRIPT_DIR/.local"
EXCLUDE_FILE="$REPO_ROOT/.git/info/exclude"
APP_DIR="$REPO_ROOT/ios/App/App"
PODFILE="$REPO_ROOT/ios/App/Podfile"
PBXPROJ="$REPO_ROOT/ios/App/App.xcodeproj/project.pbxproj"
APPDELEGATE="$APP_DIR/AppDelegate.swift"
SWIFT_TEMPLATE="$SCRIPT_DIR/PushNotificationSetup.swift"
LOCAL_PLIST="$LOCAL_DIR/GoogleService-Info.plist"
ROOT_PLIST="$REPO_ROOT/GoogleService-Info.plist"
APP_PLIST="$APP_DIR/GoogleService-Info.plist"

if [ ! -f "$REPO_ROOT/package.json" ]; then
  echo "❌ Run this script from the project repository."
  exit 1
fi

append_unique_line() {
  local file="$1"
  local line="$2"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  if ! grep -qxF "$line" "$file"; then
    printf '%s\n' "$line" >> "$file"
  fi
}

ensure_local_git_excludes() {
  if [ -d "$REPO_ROOT/.git" ]; then
    echo "🛡️  Adding local git excludes for generated native files..."
    append_unique_line "$EXCLUDE_FILE" "/ios/"
    append_unique_line "$EXCLUDE_FILE" "/android/"
    append_unique_line "$EXCLUDE_FILE" "/scripts/.local/"
  fi
}

cache_google_service_info() {
  mkdir -p "$LOCAL_DIR"

  if [ -f "$APP_PLIST" ] && [ ! -f "$LOCAL_PLIST" ]; then
    echo "💾 Caching existing GoogleService-Info.plist for future rebuilds..."
    cp "$APP_PLIST" "$LOCAL_PLIST"
  fi
}

restore_google_service_info() {
  mkdir -p "$APP_DIR"

  if [ -f "$LOCAL_PLIST" ]; then
    echo "📋 Restoring cached GoogleService-Info.plist..."
    cp "$LOCAL_PLIST" "$APP_PLIST"
  elif [ -f "$ROOT_PLIST" ]; then
    echo "📋 Copying GoogleService-Info.plist from project root..."
    cp "$ROOT_PLIST" "$APP_PLIST"
  else
    echo "⚠️  GoogleService-Info.plist not found."
    echo "   Put it at scripts/.local/GoogleService-Info.plist once and future rebuilds will restore it automatically."
  fi
}

patch_podfile() {
  if [ ! -f "$PODFILE" ]; then
    echo "⚠️  Podfile not found, skipping Firebase pod patch."
    return
  fi

  if ! grep -q "FirebaseMessaging" "$PODFILE"; then
    echo "🔧 Adding Firebase pods to Podfile..."
    python3 - "$PODFILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
needle = "target 'App' do\n"
replacement = "target 'App' do\n  pod 'FirebaseCore', '~> 11.0'\n  pod 'FirebaseMessaging', '~> 11.0'\n"
if needle in text and "FirebaseMessaging" not in text:
    text = text.replace(needle, replacement, 1)
path.write_text(text)
PY
    echo "   ✅ FirebaseCore + FirebaseMessaging added"
  else
    echo "   ℹ️  Firebase pods already configured"
  fi
}

disable_user_script_sandboxing() {
  if [ -f "$PBXPROJ" ]; then
    echo "🔧 Disabling User Script Sandboxing..."
    python3 - "$PBXPROJ" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
updated = text.replace("ENABLE_USER_SCRIPT_SANDBOXING = YES", "ENABLE_USER_SCRIPT_SANDBOXING = NO")
path.write_text(updated)
PY
    echo "   ✅ User Script Sandboxing disabled"
  fi
}

patch_app_delegate() {
  if [ ! -f "$APPDELEGATE" ] || [ ! -f "$SWIFT_TEMPLATE" ]; then
    echo "⚠️  AppDelegate.swift or PushNotificationSetup.swift template is missing."
    return
  fi

  echo "🔧 Patching AppDelegate.swift (imports + configure call + bridge methods)..."
  python3 - "$APPDELEGATE" <<'PY'
from pathlib import Path
import re
import sys

app_delegate_path = Path(sys.argv[1])
text = app_delegate_path.read_text()

imports_to_add = ["import FirebaseCore", "import FirebaseMessaging", "import UserNotifications"]
import_lines = [line for line in text.splitlines() if line.startswith("import ")]
if import_lines:
    last_import = import_lines[-1]
    for imp in imports_to_add:
        if imp not in text:
            text = text.replace(last_import, f"{last_import}\n{imp}", 1)
            last_import = imp

if "PushNotificationSetup.shared.configure()" not in text:
    text = re.sub(r"^(\s*)return true$", r"\1PushNotificationSetup.shared.configure()\n\1return true", text, count=1, flags=re.MULTILINE)

bridge_marker = "// MARK: - Push Notifications Bridge"
bridge_block = """
    // MARK: - Push Notifications Bridge
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushNotificationSetup.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushNotificationSetup.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    }

"""
if bridge_marker not in text:
    lifecycle_marker = "    func applicationWillResignActive(_ application: UIApplication) {"
    if lifecycle_marker in text:
        text = text.replace(lifecycle_marker, bridge_block + lifecycle_marker, 1)
    else:
        closing_index = text.rfind("\n}")
        if closing_index != -1:
            text = text[:closing_index] + "\n" + bridge_block.rstrip() + "\n" + text[closing_index:]

app_delegate_path.write_text(text)
PY
  echo "   ✅ AppDelegate.swift patched"

  # Copy PushNotificationSetup.swift as a separate file (NOT inlined into AppDelegate)
  echo "📋 Copying PushNotificationSetup.swift into App target..."
  cp "$SWIFT_TEMPLATE" "$APP_DIR/PushNotificationSetup.swift"
  echo "   ✅ PushNotificationSetup.swift copied"
}

run_pod_install() {
  if [ ! -d "$REPO_ROOT/ios/App" ]; then
    return
  fi

  if command -v pod >/dev/null 2>&1; then
    echo "🍫 Installing CocoaPods dependencies..."
    (
      cd "$REPO_ROOT/ios/App"
      pod install --repo-update
    )
  else
    echo "⚠️  CocoaPods not installed here; skipping pod install."
    echo "   On your Mac, install it with: sudo gem install cocoapods"
  fi
}

open_xcode_workspace() {
  if [ "$(uname -s)" = "Darwin" ] && command -v xcodebuild >/dev/null 2>&1; then
    echo "🚀 Opening Xcode workspace..."
    npx cap open ios
  else
    echo "ℹ️  Skipping Xcode auto-open in this environment."
  fi
}

echo "=== Conflict-Proof iOS Rebuild ==="
echo ""

cd "$REPO_ROOT"
ensure_local_git_excludes
cache_google_service_info

echo "🧹 Removing generated ios/ directory..."
rm -rf "$REPO_ROOT/ios"

echo "📦 Installing dependencies..."
npm install

echo "🏗️  Building web assets..."
npm run build

echo "📱 Recreating iOS platform..."
npx cap add ios

echo "🔄 Syncing Capacitor..."
npx cap sync ios

restore_google_service_info
patch_podfile
disable_user_script_sandboxing
patch_app_delegate
run_pod_install
open_xcode_workspace

echo ""
echo "✅ Done. Use: bash scripts/rebuild-ios.sh"
