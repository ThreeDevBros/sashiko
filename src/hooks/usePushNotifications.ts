import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = (navigate?: (path: string) => void) => {
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleaned = false;

    const saveToken = async (tokenValue: string, platform: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Upsert token – works for both guest (user_id=null) and authenticated users
      const row: Record<string, unknown> = {
        token: tokenValue,
        platform,
        updated_at: new Date().toISOString(),
      };
      if (user) {
        row.user_id = user.id;
      }

      // Use the token as the conflict target via the unique index
      const { error } = await (supabase.from('push_device_tokens') as any).upsert(row, {
        onConflict: 'token',
      });

      if (error) {
        console.error('[Push] Failed to save token:', error.message);
      } else {
        console.log('[Push] Token saved to database', user ? '(authenticated)' : '(guest)');
      }
    };

    const registerPush = async () => {
      console.log('[Push] Requesting permissions...');
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Push] Permission not granted:', permResult.receive);
        return;
      }

      console.log('[Push] Registering for push notifications...');

      // Attach listeners BEFORE calling register
      PushNotifications.addListener('registration', async (token) => {
        if (cleaned) return;
        const platform = Capacitor.getPlatform();
        console.log(`[Push] Token received (${platform}):`, token.value.slice(0, 20) + '...');
        await saveToken(token.value, platform);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
      });

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

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data || {};
        if (data.type === 'order_status' && data.order_id && navigateRef.current) {
          navigateRef.current(`/order/${data.order_id}`);
        }
      });

      await PushNotifications.register();
    };

    // Register immediately (supports guest order tracking)
    registerPush();

    // When user signs in, update any existing token rows to link to their user_id
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Re-register to ensure token is captured and linked
        console.log('[Push] Auth state changed to SIGNED_IN, re-saving token');
        registerPush();
      }
    });

    return () => {
      cleaned = true;
      subscription.unsubscribe();
      PushNotifications.removeAllListeners();
    };
  }, []); // Empty deps — runs once, uses refs for navigate
};
