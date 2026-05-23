import { Capacitor } from '@capacitor/core';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';

/**
 * Generate a random nonce string.
 */
function generateRawNonce(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

/**
 * SHA-256 hash a string and return lowercase hex digest.
 */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check whether a JWT payload contains a nonce claim (without exposing secrets).
 */
function jwtHasNonce(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.nonce === 'string' && payload.nonce.length > 0;
  } catch {
    return false;
  }
}

/**
 * iOS path: invoke the custom Swift GoogleAuthPlugin (uses GoogleSignIn 9.x).
 * Returns an ID token + the raw nonce that was sent in (digest sent to native).
 */
async function signInIOS(): Promise<{ idToken: string; rawNonce: string }> {
  const rawNonce = generateRawNonce();
  const nonceDigest = await sha256Hex(rawNonce);

  const Plugins = (Capacitor as any).Plugins;
  const GoogleAuthNative = Plugins?.GoogleAuth;
  if (!GoogleAuthNative?.signIn) {
    throw new Error('Native GoogleAuth plugin not registered on iOS');
  }

  console.log('[GoogleSignIn][iOS] Calling native GoogleAuth.signIn()');
  const result = await GoogleAuthNative.signIn({ nonce: nonceDigest });
  const idToken: string | undefined =
    result?.idToken || result?.authentication?.idToken;
  if (!idToken) {
    throw new Error('No ID token received from native iOS GoogleAuth plugin');
  }
  return { idToken, rawNonce };
}

/**
 * Android path: use the @codetrix-studio/capacitor-google-auth plugin.
 * Loaded dynamically so iOS bundles never try to resolve a missing native bridge.
 */
async function signInAndroid(): Promise<{ idToken: string; rawNonce: string | null }> {
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

  // serverClientId (web client) is required so the returned ID token's audience
  // matches what Supabase expects when exchanging via signInWithIdToken.
  const WEB_CLIENT_ID = '737774269765-vm8humggkeo8457qopvm0n7u2ij9js5s.apps.googleusercontent.com';

  try {
    await Promise.resolve(
      GoogleAuth.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      } as any)
    );
  } catch (e) {
    console.warn('[GoogleSignIn][Android] initialize warning:', e);
  }

  console.log('[GoogleSignIn][Android] Calling GoogleAuth.signIn()');
  const result = await GoogleAuth.signIn();
  const idToken = result.authentication?.idToken;
  if (!idToken) {
    throw new Error('No ID token received from Android GoogleAuth plugin');
  }
  return { idToken, rawNonce: null };
}

/**
 * Performs native Google Sign In on iOS/Android via Capacitor,
 * then exchanges the ID token with Supabase.
 * Falls back to managed Lovable Cloud OAuth on web.
 */
export async function nativeGoogleSignIn(): Promise<{ error: Error | null }> {
  const platform = Capacitor.getPlatform();
  console.log('[GoogleSignIn] Starting sign-in flow', {
    isNative: Capacitor.isNativePlatform(),
    platform,
  });

  if (!Capacitor.isNativePlatform()) {
    console.log('[GoogleSignIn] Using web OAuth flow');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
      extraParams: {
        prompt: 'select_account',
      },
    });

    if (result.error) {
      console.error('[GoogleSignIn] Web OAuth error:', result.error);
      return { error: new Error(result.error.message) };
    }
    return { error: null };
  }

  try {
    const { idToken, rawNonce } =
      platform === 'ios' ? await signInIOS() : await signInAndroid();

    console.log('[GoogleSignIn] ID token nonce claim present:', jwtHasNonce(idToken));

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      ...(rawNonce ? { nonce: rawNonce } : {}),
    });

    if (error) {
      console.error('[GoogleSignIn] Token exchange error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    const code = err?.code != null ? String(err.code) : undefined;
    const message = err?.message ? String(err.message) : String(err);
    console.error('[GoogleSignIn] Native sign-in threw', {
      platform,
      code,
      message,
      errorString: String(err),
    });
    if (
      message.includes('canceled') ||
      message.includes('cancelled') ||
      code === '12501' ||
      code === '-5'
    ) {
      return { error: null };
    }
    // Preserve the original code on the returned Error so the UI can map it.
    const wrapped = new Error(message) as Error & { code?: string };
    if (code) wrapped.code = code;
    return { error: wrapped };
  }
}
