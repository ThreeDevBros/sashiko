// Capacitor bridge for iOS Live Activities (ActivityKit)
// Uses the `capacitor-live-activity` plugin for the native bridge.
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
 * Check if Live Activities are supported (iOS 16.2+)
 */
export async function areLiveActivitiesSupported(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return false;

    const { LiveActivity } = await import('capacitor-live-activity');
    const result = await LiveActivity.isAvailable();
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

/**
 * Start a Live Activity for an order and register the push token
 */
export async function startOrderLiveActivity(data: LiveActivityData): Promise<string | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return null;

    const { LiveActivity } = await import('capacitor-live-activity');

    // Listen for the push token
    LiveActivity.addListener('liveActivityPushToken', async (event) => {
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

    // Start with push support so we get a push-to-update token
    const result = await LiveActivity.startActivityWithPush({
      id: data.orderId,
      attributes: {
        orderNumber: data.orderNumber,
        orderType: data.orderType,
      },
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
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return;

    const { LiveActivity } = await import('capacitor-live-activity');

    await LiveActivity.updateActivity({
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
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return;

    const { LiveActivity } = await import('capacitor-live-activity');

    await LiveActivity.endActivity({
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
