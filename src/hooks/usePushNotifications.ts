import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = (navigate?: (path: string) => void) => {
  const registered = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || registered.current) return;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        registered.current = true;
        const platform = Capacitor.getPlatform();
        
        await (supabase.from('push_device_tokens') as any).upsert(
          {
            user_id: user.id,
            token: token.value,
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // Show in-app toast for foreground notifications
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
        // User tapped on notification — navigate to relevant screen
        const data = action.notification.data || {};
        if (data.type === 'order_status' && data.order_id && navigate) {
          navigate(`/order/${data.order_id}`);
        }
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [navigate]);
};
