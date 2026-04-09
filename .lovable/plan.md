

# Switch to Your Own Google OAuth Credentials

## The Problem

The current code uses `lovable.auth.signInWithOAuth('google')` — Lovable's managed OAuth layer. You want full control using your own Google Cloud credentials.

The redirect URI `https://cqzprtgcptqusmospdys.supabase.co/auth/v1/callback` **is valid** and should save fine in Google Cloud Console. If you're getting an error, it's likely because:
- The **OAuth consent screen** hasn't been fully configured yet (Google requires this before you can save credentials)
- The app status is set to "Testing" without adding test users
- There's a stale browser cache on the Google Cloud Console page

**Try**: Go to Google Cloud Console → APIs & Services → **OAuth consent screen** → make sure it's fully configured (app name, support email, authorized domains including `supabase.co`). Then go back to Credentials and save.

## Code Changes

### 1. Update `src/lib/nativeGoogleSignIn.ts`
Replace the Lovable managed OAuth call with direct backend OAuth:

```typescript
if (!Capacitor.isNativePlatform()) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
```

Remove the `lovable` import from this file since it's no longer needed here.

### 2. Update `capacitor.config.ts`
Replace the placeholder `serverClientId` with your actual Web Client ID from Google Cloud Console.

### 3. Configure Google Auth in Lovable Cloud
In the Cloud → Users → Auth Settings → Google section, enter your:
- **Google Client ID** (Web client)
- **Google Client Secret**

This configures the backend to accept Google tokens using your credentials.

### 4. Google Cloud Console Setup
In your Google Cloud OAuth client:
- **Authorized JavaScript origins**: `https://sashikoasianfusion.com`, `https://www.sashikoasianfusion.com`, `https://sashiko.lovable.app`
- **Authorized redirect URI**: `https://cqzprtgcptqusmospdys.supabase.co/auth/v1/callback`
- **OAuth consent screen**: Must have `supabase.co` listed under authorized domains

## What stays the same
- Apple sign-in continues using Lovable managed OAuth (unchanged)
- Native iOS/Android Google sign-in flow stays the same (uses ID token exchange)
- The `PhonePromptDialog` for collecting phone numbers from OAuth users remains

