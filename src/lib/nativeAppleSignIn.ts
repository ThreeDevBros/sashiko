import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

/**
 * Performs native Apple Sign In on iOS via Capacitor,
 * then exchanges the identity token with Supabase.
 * Falls back to web OAuth via Lovable Cloud on non-native platforms.
 */
export async function nativeAppleSignIn(): Promise<{ error: Error | null }> {
  const platform = Capacitor.getPlatform();

  // Android: Apple has no native SDK — use Lovable Cloud's managed OAuth web flow
  // inside the WebView. Use the production domain as redirect_uri because
  // window.location.origin on Capacitor Android is "http://localhost", which is
  // not registered with Apple. Lovable's broker handles the callback in-app.
  if (platform === 'android') {
    const result = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: 'https://sashikoasianfusion.com',
    });
    return { error: result.error ? (result.error instanceof Error ? result.error : new Error(String(result.error))) : null };
  }

  // Web: standard Lovable Cloud managed Apple OAuth
  if (platform !== 'ios') {
    const result = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: window.location.origin,
    });
    return { error: result.error ? (result.error instanceof Error ? result.error : new Error(String(result.error))) : null };
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
