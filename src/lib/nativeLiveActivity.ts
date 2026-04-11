// Capacitor bridge for iOS Live Activities (ActivityKit)
// Uses a custom native LiveActivityPlugin registered as "LiveActivity".
// Registers push-to-update tokens with the backend for server-driven updates.

import { supabase } from '@/integrations/supabase/client';

interface LiveActivityData {
  orderId: string;
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
    const platform = Capacitor.getPlatform();
    console.log('[LiveActivity] Platform:', platform);
    if (platform !== 'ios') {
      console.log('[LiveActivity] Not iOS — skipping');
      return null;
    }
    const plugin = (Capacitor as any).Plugins?.LiveActivity;
    console.log('[LiveActivity] Plugin found:', !!plugin);
    if (!plugin) {
      console.warn('[LiveActivity] Plugin not registered. Available plugins:', Object.keys((Capacitor as any).Plugins || {}));
    }
    return plugin || null;
  } catch (err) {
    console.error('[LiveActivity] Error getting plugin:', err);
    return null;
  }
}

/**
 * Check if Live Activities are supported (iOS 16.2+)
 */
export async function areLiveActivitiesSupported(): Promise<boolean> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) {
      console.log('[LiveActivity] areLiveActivitiesSupported: no plugin');
      return false;
    }
    const result = await plugin.isAvailable();
    console.log('[LiveActivity] isAvailable result:', result);
    return result.value === true;
  } catch (err) {
    console.error('[LiveActivity] isAvailable error:', err);
    return false;
  }
}

/**
 * Build the content state object sent to the widget.
 * All values MUST be strings to match Swift's [String: String] Codable type.
 */
function buildContentState(data: LiveActivityData): Record<string, string> {
  return {
    status: data.status,
    orderId: data.orderId,
    orderType: data.orderType,
    statusMessage: data.statusMessage,
    etaMinutes: data.etaMinutes != null ? String(data.etaMinutes) : '',
    updatedAt: new Date().toISOString(),
  };
}

// Track the current active order ID for the push token listener
let pushTokenListenerRegistered = false;
let currentActiveOrderId: string | null = null;

/**
 * Start a Live Activity for an order and register the push token
 */
export async function startOrderLiveActivity(data: LiveActivityData): Promise<string | null> {
  try {
    console.log('[LiveActivity] startOrderLiveActivity called for order:', data.orderId);
    const plugin = await getLiveActivityPlugin();
    if (!plugin) {
      console.log('[LiveActivity] Cannot start — no plugin');
      return null;
    }

    // Always update the current order ID so the listener persists the token for the right order
    currentActiveOrderId = data.orderId;

    // Register push token listener once — reads currentActiveOrderId dynamically (no stale closure)
    if (!pushTokenListenerRegistered && plugin.addListener) {
      pushTokenListenerRegistered = true;
      plugin.addListener('liveActivityPushToken', async (event: any) => {
        const orderId = currentActiveOrderId;
        console.log('[LiveActivity] Push token received for order:', orderId, 'token:', event.token?.substring(0, 20) + '...');
        if (!orderId) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          if (userId) {
            await supabase.from('live_activity_tokens').upsert(
              {
                user_id: userId,
                order_id: orderId,
                push_token: event.token,
                platform: 'ios',
              },
              { onConflict: 'user_id,order_id' }
            );
            console.log('[LiveActivity] Token persisted for order:', orderId);
          }
        } catch (err) {
          console.error('[LiveActivity] Failed to register push token:', err);
        }
      });
    }

    const contentState = buildContentState(data);
    console.log('[LiveActivity] Starting activity with state:', contentState);

    const result = await plugin.startActivityWithPush({
      id: data.orderId,
      contentState,
    });

    console.log('[LiveActivity] Activity started, activityId:', result.activityId);
    return result.activityId;
  } catch (err) {
    console.error('[LiveActivity] Failed to start Live Activity:', err);
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

    console.log('[LiveActivity] Updating activity for order:', data.orderId);
    await plugin.updateActivity({
      id: data.orderId,
      contentState: buildContentState(data),
    });
    console.log('[LiveActivity] Activity updated');
  } catch (err) {
    console.error('[LiveActivity] Failed to update Live Activity:', err);
  }
}

/**
 * End a Live Activity
 */
export async function endOrderLiveActivity(orderId: string): Promise<void> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return;

    console.log('[LiveActivity] Ending activity for order:', orderId);
    await plugin.endActivity({
      id: orderId,
      contentState: {
        status: 'delivered',
        orderId: orderId,
        statusMessage: 'Order complete',
        etaMinutes: '0',
        updatedAt: new Date().toISOString(),
      },
    });

    // Clean up token from DB — use getSession (cached) instead of getUser (network call)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('live_activity_tokens')
        .delete()
        .eq('user_id', session.user.id)
        .eq('order_id', orderId);
    }
    currentActiveOrderId = null;
    console.log('[LiveActivity] Activity ended');
  } catch (err) {
    console.error('[LiveActivity] Failed to end Live Activity:', err);
  }
}
