import { Capacitor } from '@capacitor/core';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';

/**
 * Performs native Google Sign In on iOS/Android via Capacitor,
 * then exchanges the ID token with Supabase.
 * Falls back to direct Supabase OAuth on web.
 */
export async function nativeGoogleSignIn(): Promise<{ error: Error | null }> {
  if (!Capacitor.isNativePlatform()) {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
      extraParams: {
        prompt: 'select_account',
      },
    });

    if (result.error) return { error: new Error(result.error.message) };
    return { error: null };
  }

  try {
    // Access the plugin via Capacitor's runtime plugin registry
    // This avoids npm import resolution issues at build time
    const GoogleAuth = (Capacitor as any).Plugins?.GoogleAuth;
    if (!GoogleAuth) {
      return { error: new Error('GoogleAuth plugin not available') };
    }

    const result = await GoogleAuth.signIn();

    const idToken = result.authentication?.idToken;
    if (!idToken) {
      return { error: new Error('No ID token received from Google') };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    if (err?.message?.includes('canceled') || err?.message?.includes('cancelled') || err?.code === '12501') {
      return { error: null };
    }
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
