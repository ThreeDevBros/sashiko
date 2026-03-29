import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export const usePushNotifications = () => {
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
        const platform = Capacitor.getPlatform(); // 'ios' or 'android'
        
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
        // Notification received while app is in foreground
        console.log('Push received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        // User tapped on notification
        console.log('Push action:', notification);
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);
};
