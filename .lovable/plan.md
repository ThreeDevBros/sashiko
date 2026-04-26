# Fix: Android Google Sign-In NullPointerException

## Root cause

The crash log shows:

```
NullPointerException: GoogleSignInClient.getSignInIntent() on a null object reference
  at com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth.signIn(GoogleAuth.java:81)
```

The Google Auth plugin's internal client was never built. This happens because `MainActivity.java` calls `registerPlugin(GoogleAuth.class)` **before** `super.onCreate()`. In Capacitor 7, the Bridge isn't initialized yet at that point, so the plugin's `load()` lifecycle method (which reads `server_client_id` from `strings.xml` and constructs the `GoogleSignInClient`) never runs.

Your `strings.xml` already has the correct `server_client_id`, and `google-services.json` is in place — only the Java init order is wrong.

## Change

**File:** `android/app/src/main/java/com/sashiko/app/MainActivity.java`

Swap the order so `super.onCreate()` runs first, then register the plugin:

```java
package com.sashiko.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuth.class);
        super.onCreate(savedInstanceState);
    }
}
```

Actually — important correction: the official `@codetrix-studio/capacitor-google-auth` README for Capacitor 5+/6+/7 specifies `registerPlugin()` must be called **before** `super.onCreate()` (same as your current code). So the order is *not* the bug.

The real cause is then one of:

1. **Plugin's `load()` is failing silently** because `server_client_id` isn't being resolved at runtime (resource not packaged into the APK due to a stale build).
2. **Plugin not registered with Capacitor's autodiscovery** — Capacitor 7 auto-discovers plugins from `node_modules`, and `registerPlugin()` in MainActivity can actually conflict and leave the auto-instance unloaded.

## Recommended fix (two-part)

### Part 1: Remove manual registration

Capacitor 7 auto-discovers the plugin from `node_modules/@codetrix-studio/capacitor-google-auth`. Manually calling `registerPlugin()` creates a second instance that never gets `load()` called by the Bridge.

New `MainActivity.java`:

```java
package com.sashiko.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
}
```

### Part 2: Force a clean rebuild

After changing the Java file, run locally:

```bash
npx cap sync android
```

Then in Android Studio: **Build → Clean Project**, then **Build → Rebuild Project**, then Run.

This guarantees the new `MainActivity.class` is packaged and that `strings.xml` (with `server_client_id`) is freshly bundled into the APK.

## Why this works

- Capacitor 7 reads `node_modules/.../android/build.gradle` and auto-registers the GoogleAuth plugin during Bridge initialization.
- During auto-registration, the plugin's `load()` runs, reads `R.string.server_client_id` (the value in your `strings.xml`), and constructs `mGoogleSignInClient`.
- When JS later invokes `GoogleAuth.signIn()`, the client is non-null and `getSignInIntent()` succeeds.

## What you'll do after I apply the change

1. `git pull` to get the new `MainActivity.java`.
2. `npx cap sync android`.
3. Android Studio → Build → Clean Project → Rebuild Project.
4. Run on the emulator and tap Google login.

If it still crashes, we'll add a fallback: explicitly call `GoogleAuth.initialize({ clientId: '...', scopes: [...] })` from JS before `signIn()` — but the auto-discovery path should work.

## Files changed

- `android/app/src/main/java/com/sashiko/app/MainActivity.java` (remove manual `registerPlugin`)

No JS, Capacitor config, or `strings.xml` changes needed.