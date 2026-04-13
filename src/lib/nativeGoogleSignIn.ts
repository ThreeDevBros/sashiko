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
 * Performs native Google Sign In on iOS/Android via Capacitor,
 * then exchanges the ID token with Supabase.
 * Falls back to direct Supabase OAuth on web.
 */
export async function nativeGoogleSignIn(): Promise<{ error: Error | null }> {
  console.log('[GoogleSignIn] Starting sign-in flow', {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  });

  if (!Capacitor.isNativePlatform()) {
    console.log('[GoogleSignIn] Using web OAuth flow');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
      extraParams: {
        prompt: 'select_account',
      },
    });

    console.log('[GoogleSignIn] Web OAuth result', {
      redirected: result.redirected,
      hasError: Boolean(result.error),
    });

    if (result.error) {
      console.error('[GoogleSignIn] Web OAuth error:', result.error);
      return { error: new Error(result.error.message) };
    }
    return { error: null };
  }

  try {
    const runtimePlugins = (Capacitor as any).Plugins;
    console.log('[GoogleSignIn] Native runtime plugin keys:', runtimePlugins ? Object.keys(runtimePlugins) : []);

    const GoogleAuth = runtimePlugins?.GoogleAuth;
    if (!GoogleAuth) {
      console.error('[GoogleSignIn] GoogleAuth plugin missing from runtime registry');
      return { error: new Error('GoogleAuth plugin not available') };
    }

    // Generate nonce pair: raw stays in JS, SHA-256 digest goes to native plugin
    const rawNonce = generateRawNonce();
    const nonceDigest = await sha256Hex(rawNonce);
    console.log('[GoogleSignIn] Nonce generated', {
      rawNonceLength: rawNonce.length,
      nonceDigestPrefix: nonceDigest.substring(0, 8) + '…',
    });

    console.log('[GoogleSignIn] Invoking native GoogleAuth.signIn() with nonce');
    const result = await GoogleAuth.signIn({ nonce: nonceDigest });
    console.log('[GoogleSignIn] Native plugin result received', {
      hasAuthentication: Boolean(result?.authentication),
      hasIdToken: Boolean(result?.authentication?.idToken),
      email: result?.email ?? null,
    });

    const idToken = result.authentication?.idToken;
    if (!idToken) {
      console.error('[GoogleSignIn] Missing ID token in native plugin response', result);
      return { error: new Error('No ID token received from Google') };
    }

    const tokenHasNonce = jwtHasNonce(idToken);
    console.log('[GoogleSignIn] ID token nonce claim present:', tokenHasNonce);

    console.log('[GoogleSignIn] Exchanging ID token for app session');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce: rawNonce,
    });

    console.log('[GoogleSignIn] Token exchange finished', {
      hasSession: Boolean(data.session),
      hasUser: Boolean(data.user),
      error: error?.message ?? null,
    });

    if (error) {
      console.error('[GoogleSignIn] Token exchange error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    console.error('[GoogleSignIn] Native sign-in threw', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      raw: err,
    });
    if (err?.message?.includes('canceled') || err?.message?.includes('cancelled') || err?.code === '12501') {
      return { error: null };
    }
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
