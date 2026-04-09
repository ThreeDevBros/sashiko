import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = (navigate?: (path: string) => void) => {
  const registered = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      if (registered.current) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Push] No authenticated user, skipping registration');
        return;
      }

      console.log('[Push] Requesting permissions...');
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Push] Permission not granted:', permResult.receive);
        return;
      }

      console.log('[Push] Registering for push notifications...');
      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        registered.current = true;
        const platform = Capacitor.getPlatform();
        console.log(`[Push] Token received (${platform}):`, token.value.slice(0, 20) + '...');

        await (supabase.from('push_device_tokens') as any).upsert(
          {
            user_id: user.id,
            token: token.value,
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );
        console.log('[Push] Token saved to database');
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
            action: navigate ? {
              label: 'View Order',
              onClick: () => navigate(`/order/${data.order_id}`),
            } : undefined,
          });
        } else {
          toast(title, { description: body });
        }
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data || {};
        if (data.type === 'order_status' && data.order_id && navigate) {
          navigate(`/order/${data.order_id}`);
        }
      });
    };

    // Try immediately
    registerPush();

    // Retry when auth state changes (user logs in after app launch)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        console.log('[Push] Auth state changed to SIGNED_IN, retrying registration');
        registerPush();
      }
    });

    return () => {
      subscription.unsubscribe();
      PushNotifications.removeAllListeners();
    };
  }, [navigate]);
};
