import { Capacitor } from '@capacitor/core';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';

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

    console.log('[GoogleSignIn] Invoking native GoogleAuth.signIn()');
    const result = await GoogleAuth.signIn();
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

    console.log('[GoogleSignIn] Exchanging ID token for app session');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
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
