import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FCM_TOKEN_KEY = 'fcm_push_token';

export const usePushNotifications = (navigate?: (path: string) => void) => {
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleaned = false;

    // ── Save / link token in database ──────────────────────────────
    const saveTokenToDb = async (tokenValue: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const row: Record<string, unknown> = {
        token: tokenValue,
        platform: Capacitor.getPlatform(),
        updated_at: new Date().toISOString(),
      };
      if (user) {
        row.user_id = user.id;
      }

      const { error } = await (supabase.from('push_device_tokens') as any).upsert(row, {
        onConflict: 'token',
      });

      if (error) {
        console.error('[Push] Failed to save token:', error.message);
      } else {
        console.log('[Push] Token saved to database', user ? '(authenticated)' : '(guest)');
      }
    };

    // ── Read FCM token from native UserDefaults via Preferences ──
    const readFcmToken = async (): Promise<string | null> => {
      try {
        const { value } = await Preferences.get({ key: FCM_TOKEN_KEY });
        return value || null;
      } catch {
        return null;
      }
    };

    // ── Try to persist token from native side ─────────────────────
    const persistToken = async () => {
      const token = await readFcmToken();
      if (token) {
        console.log(`[Push] FCM token from Preferences: ${token.slice(0, 20)}...`);
        await saveTokenToDb(token);
      } else {
        console.log('[Push] No FCM token in Preferences yet — will retry on auth change');
      }
    };

    // ── Register push + attach listeners ──────────────────────────
    const registerPush = async () => {
      console.log('[Push] Requesting permissions...');
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Push] Permission not granted:', permResult.receive);
        return;
      }

      console.log('[Push] Registering for push notifications...');

      // Fallback: if Capacitor plugin does fire (e.g. Android), capture it
      PushNotifications.addListener('registration', async (token) => {
        if (cleaned) return;
        console.log(`[Push] registration event (fallback): ${token.value.slice(0, 20)}...`);
        await saveTokenToDb(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
      });

      // Foreground notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const data = notification.data || {};
        const title = notification.title || 'Notification';
        const body = notification.body || '';

        if (data.type === 'order_status' && data.order_id) {
          toast(title, {
            description: body,
            action: navigateRef.current ? {
              label: 'View Order',
              onClick: () => navigateRef.current?.(`/order/${data.order_id}`),
            } : undefined,
          });
        } else {
          toast(title, { description: body });
        }
      });

      // Tap on notification
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data || {};
        if (data.type === 'order_status' && data.order_id && navigateRef.current) {
          navigateRef.current(`/order/${data.order_id}`);
        }
      });

      await PushNotifications.register();
    };

    // Register immediately (guest support)
    registerPush();

    // After a short delay, try reading the FCM token the native side saved
    const tokenTimer = setTimeout(() => {
      if (!cleaned) persistToken();
    }, 2000);

    // On sign-in, link the token to the user
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' && !cleaned) {
        console.log('[Push] Auth SIGNED_IN — linking FCM token to user');
        await persistToken();
      }
    });

    return () => {
      cleaned = true;
      clearTimeout(tokenTimer);
      subscription.unsubscribe();
      PushNotifications.removeAllListeners();
    };
  }, []); // Empty deps — runs once, uses refs for navigate
};
