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

  // Android: Apple has no native SDK. The Lovable Cloud OAuth broker (`/~oauth/initiate`)
  // is hosted by the proxy worker on our production domain — it does NOT exist inside
  // the Capacitor WebView (`https://localhost`). If we let the SDK use
  // `window.location.href = '/~oauth/initiate?...'` it shows the in-app 404 page.
  //
  // Instead, build the broker URL against the production domain and open it in the
  // device's system browser. Apple completes the OAuth flow there, then the broker
  // redirects to our App Link (`https://sashikoasianfusion.com/~oauth`) which Android
  // routes back into our app via the intent-filter in AndroidManifest.xml.
  if (platform === 'android') {
    try {
      const productionOrigin = 'https://sashikoasianfusion.com';
      const state = generateState();
      const params = new URLSearchParams({
        provider: 'apple',
        redirect_uri: productionOrigin,
        state,
      });
      const url = `${productionOrigin}/~oauth/initiate?${params.toString()}`;

      // Try the Capacitor Browser plugin first (in-app Custom Tab on Android).
      try {
        const Browser = (Capacitor as any).Plugins?.Browser;
        if (Browser?.open) {
          await Browser.open({ url });
          return { error: null };
        }
      } catch {
        // fall through
      }

      // Fallback: open in the system browser via window.open with `_system`.
      // Capacitor intercepts this and launches the external browser.
      window.open(url, '_system');
      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
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
    console.log('[AppleNative] plugin available?', !!SignInWithApple);
    if (!SignInWithApple) {
      return { error: new Error('SignInWithApple plugin not available') };
    }

    console.log('[AppleNative] calling authorize with clientId app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10');
    const result = await SignInWithApple.authorize({
      clientId: 'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10',
      redirectURI: '',
      scopes: 'email name',
    });

    const identityToken = result.response.identityToken;
    console.log('[AppleNative] authorize returned, has identityToken?', !!identityToken);
    if (!identityToken) {
      console.error('[AppleNative] full result without token:', JSON.stringify(result));
      return { error: new Error('No identity token received from Apple') };
    }

    // Decode JWT payload (no signature verification — diagnostic only)
    try {
      const parts = identityToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        console.log('[AppleNative] token claims:', { iss: payload.iss, aud: payload.aud, sub: payload.sub, exp: payload.exp });
      }
    } catch (decodeErr) {
      console.warn('[AppleNative] could not decode token for diagnostics:', decodeErr);
    }

    console.log('[AppleNative] calling supabase.auth.signInWithIdToken');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce: '',
    });

    if (error) {
      console.error('[AppleNative] signInWithIdToken error:', {
        message: error.message,
        name: error.name,
        status: (error as any).status,
        raw: error,
      });
      return { error: new Error(error.message) };
    }

    console.log('[AppleNative] signInWithIdToken success, has session?', !!data?.session);
    return { error: null };
  } catch (err: any) {
    console.error('[AppleNative] caught exception:', {
      message: err?.message,
      code: err?.code,
      raw: err,
    });
    if (err?.message?.includes('cancelled') || err?.code === '1001') {
      return { error: null };
    }
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

function generateState(length = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
