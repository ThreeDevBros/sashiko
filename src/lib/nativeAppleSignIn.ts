import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Performs native Apple Sign In on iOS via Capacitor,
 * then exchanges the identity token with Supabase.
 * Falls back to web OAuth on non-native platforms.
 */
export async function nativeAppleSignIn(): Promise<{ error: Error | null }> {
  // Only use native flow on iOS native app
  if (Capacitor.getPlatform() !== 'ios') {
    // Fallback to web OAuth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }

  try {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

    const result = await SignInWithApple.authorize({
      clientId: 'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10',
      redirectURI: '',
      scopes: 'email name',
    });

    const identityToken = result.response.identityToken;
    if (!identityToken) {
      return { error: new Error('No identity token received from Apple') };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce: '', // Apple Sign In via Capacitor doesn't use nonce by default
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    // User cancelled or other error
    if (err?.message?.includes('cancelled') || err?.code === '1001') {
      return { error: null }; // User cancelled, not an error
    }
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
