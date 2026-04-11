// Capacitor bridge for iOS Live Activities (ActivityKit)
// Uses a custom native LiveActivityPlugin registered as "LiveActivity".
// Registers push-to-update tokens with the backend for server-driven updates.

import { supabase } from '@/integrations/supabase/client';

interface LiveActivityData {
  orderId: string;
  orderNumber: string;
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  statusMessage: string;
  etaMinutes: number | null;
}

/**
 * Get the native LiveActivity plugin via Capacitor's plugin registry
 */
async function getLiveActivityPlugin(): Promise<any | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return null;
    const plugin = (Capacitor as any).Plugins?.LiveActivity;
    return plugin || null;
  } catch {
    return null;
  }
}

/**
 * Check if Live Activities are supported (iOS 16.2+)
 */
export async function areLiveActivitiesSupported(): Promise<boolean> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return false;
    const result = await plugin.isAvailable();
    return result.value === true;
  } catch {
    return false;
  }
}

/**
 * Build the content state object sent to the widget
 */
function buildContentState(data: LiveActivityData): Record<string, string> {
  return {
    status: data.status,
    orderNumber: data.orderNumber,
    orderType: data.orderType,
    statusMessage: data.statusMessage,
    etaMinutes: data.etaMinutes != null ? String(data.etaMinutes) : '',
    updatedAt: new Date().toISOString(),
  };
}

// Track listener registration to avoid duplicates
let pushTokenListenerRegistered = false;

/**
 * Start a Live Activity for an order and register the push token
 */
export async function startOrderLiveActivity(data: LiveActivityData): Promise<string | null> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return null;

    // Register push token listener once
    if (!pushTokenListenerRegistered && plugin.addListener) {
      pushTokenListenerRegistered = true;
      plugin.addListener('liveActivityPushToken', async (event: any) => {
        console.log('[LiveActivity] Push token received:', event.token);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('live_activity_tokens').upsert(
              {
                user_id: user.id,
                order_id: data.orderId,
                push_token: event.token,
                platform: 'ios',
              },
              { onConflict: 'user_id,order_id' }
            );
          }
        } catch (err) {
          console.error('[LiveActivity] Failed to register push token:', err);
        }
      });
    }

    const result = await plugin.startActivityWithPush({
      id: data.orderId,
      contentState: buildContentState(data),
    });

    return result.activityId;
  } catch (err) {
    console.error('Failed to start Live Activity:', err);
    return null;
  }
}

/**
 * Update a Live Activity's content state (status + ETA)
 */
export async function updateOrderLiveActivity(data: LiveActivityData): Promise<void> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return;

    await plugin.updateActivity({
      id: data.orderId,
      contentState: buildContentState(data),
    });
  } catch (err) {
    console.error('Failed to update Live Activity:', err);
  }
}

/**
 * End a Live Activity
 */
export async function endOrderLiveActivity(orderId: string): Promise<void> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return;

    await plugin.endActivity({
      id: orderId,
      contentState: {
        status: 'delivered',
        statusMessage: 'Order complete',
        etaMinutes: '0',
        updatedAt: new Date().toISOString(),
      },
    });

    // Clean up token from DB
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('live_activity_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('order_id', orderId);
    }
  } catch (err) {
    console.error('Failed to end Live Activity:', err);
  }
}
