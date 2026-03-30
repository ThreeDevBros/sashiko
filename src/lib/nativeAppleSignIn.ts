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
    // Access the plugin via Capacitor's runtime plugin registry
    // This avoids npm import resolution issues at build time
    const SignInWithApple = (Capacitor as any).Plugins?.SignInWithApple;
    if (!SignInWithApple) {
      return { error: new Error('SignInWithApple plugin not available') };
    }

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
      nonce: '',
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    if (err?.message?.includes('cancelled') || err?.code === '1001') {
      return { error: null };
    }
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
