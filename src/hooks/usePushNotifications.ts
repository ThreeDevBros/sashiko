import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = (navigate?: (path: string) => void) => {
  const registered = useRef(false);
  const listenersAttached = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const attachListeners = () => {
      if (listenersAttached.current) return;
      listenersAttached.current = true;

      PushNotifications.addListener('registration', async (token) => {
        registered.current = true;
        const platform = Capacitor.getPlatform();
        console.log(`[Push] Token received (${platform}):`, token.value.slice(0, 20) + '...');

        // Save token if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
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
        } else {
          // Store token locally for guest users - will be saved when they sign in
          try {
            localStorage.setItem('guest_push_token', token.value);
            localStorage.setItem('guest_push_platform', platform);
            console.log('[Push] Token stored locally for guest user');
          } catch {}
        }
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

    const registerPush = async () => {
      if (registered.current) return;

      console.log('[Push] Requesting permissions...');
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Push] Permission not granted:', permResult.receive);
        return;
      }

      console.log('[Push] Registering for push notifications...');
      attachListeners();
      await PushNotifications.register();
    };

    // Register immediately - no auth required (supports guest order tracking)
    registerPush();

    // When user signs in, save any stored guest token to the database
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const guestToken = localStorage.getItem('guest_push_token');
        const guestPlatform = localStorage.getItem('guest_push_platform');
        if (guestToken) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await (supabase.from('push_device_tokens') as any).upsert(
              {
                user_id: user.id,
                token: guestToken,
                platform: guestPlatform || 'ios',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,token' }
            );
            console.log('[Push] Guest token migrated to authenticated user');
            localStorage.removeItem('guest_push_token');
            localStorage.removeItem('guest_push_platform');
          }
        }
        // Re-register if not already done
        if (!registered.current) {
          registerPush();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      PushNotifications.removeAllListeners();
      listenersAttached.current = false;
    };
  }, [navigate]);
};